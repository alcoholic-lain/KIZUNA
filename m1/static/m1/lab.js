"use strict";

const byId = id => document.getElementById(id);
const format = (number, digits = 0) => number.toLocaleString("fr-FR", {maximumFractionDigits:digits, minimumFractionDigits:digits});
const tunisTime = new Intl.DateTimeFormat("fr-FR", {timeZone:"Africa/Tunis", hour:"2-digit", minute:"2-digit"});
let bench = new AdapterBench();
let selected = ac;
let playing = true;
let guidedTick = null;
let link;
let lastAnnouncement = "";

function drawChart() {
  const canvas = byId("chart");
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const readings = bench.history.map(tick => tick.rows[selected].watts);
  const reference = selected === ac ? bench.reference : adapters[selected].base;
  const lo = Math.min(...readings, reference), hi = Math.max(...readings, reference);
  const step = Math.pow(10, Math.floor(Math.log10(hi - lo || 1)));
  const floor = Math.max(0, Math.floor((lo - step * .35) / step) * step);
  const ceiling = Math.ceil((hi + step * .35) / step) * step;
  const left = 4, right = width - 50, top = 10, bottom = height - 23;
  const x = i => left + (right-left) * i / (readings.length-1);
  const y = value => bottom - (bottom-top) * (value-floor) / (ceiling-floor);
  function line(x1, y1, x2, y2, color) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.stroke();
  }
  ctx.font = "12px monospace";
  ctx.fillStyle = "#52695d";
  for (let i = 0; i <= 2; i++) {
    const value = floor + (ceiling-floor)*i/2;
    line(left,y(value),right,y(value),"#dce4d9");
    ctx.fillText(format(value),right+7,y(value)+4);
  }
  [0, 10, 20, 29].forEach(i => {
    ctx.textAlign = i === 0 ? "left" : i === 29 ? "right" : "center";
    ctx.fillText(tunisTime.format(bench.history[i].time), x(i), height-3);
  });
  ctx.textAlign = "left";
  ctx.setLineDash([4,4]);
  line(left,y(reference),right,y(reference),"#78917c");
  ctx.setLineDash([]);
  const path = new Path2D();
  readings.forEach((watts, i) => i ? path.lineTo(x(i),y(watts)) : path.moveTo(x(i),y(watts)));
  const fill = new Path2D(path);
  fill.lineTo(right,bottom); fill.lineTo(left,bottom); fill.closePath();
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, "#85cda682"); gradient.addColorStop(1,"#b6dcbc0d");
  ctx.fillStyle = gradient; ctx.fill(fill);
  ctx.lineWidth = 2.8; ctx.lineJoin = "round"; ctx.strokeStyle = "#087251"; ctx.stroke(path);
  readings.forEach((watts, i) => {
    const high = selected === ac && bench.history[i].high;
    if (!high && i !== readings.length-1) return;
    ctx.beginPath(); ctx.arc(x(i), y(watts), 3.5, 0, Math.PI*2);
    ctx.fillStyle = high ? "#ae551d" : "#087251"; ctx.fill();
  });
}

function diagnosis() {
  const count = Math.min(bench.highCount, 3);
  switch (bench.mode) {
    case "pulse":
      return ["Pic isolé sur la climatisation", "Une seule mesure dépasse le seuil. Deux dépassements supplémentaires seraient nécessaires pour déclencher une alerte."];
    case "spike-cleared":
      return ["Pic passé sans alerte", "La mesure suivante est revenue sous le seuil. Le compteur de dépassements est revenu à zéro."];
    case "drift":
      return ["Dérive en observation · " + count + "/3", "La climatisation dépasse sa référence de plus de 35 %. Trois mesures consécutives déclenchent l’alerte."];
    case "alert": {
      const watts = bench.history.at(-1).rows[ac].watts;
      return ["Alerte · Climatisation en surconsommation", format(watts) + " W, soit " + format((watts/bench.reference-1)*100) + " % au-dessus de sa référence. Simulez une consigne à 26 °C et le nettoyage du filtre."];
    }
    case "recovered":
      return ["Climatisation revenue au régime nominal", format(bench.savedKwh, 3) + " kWh évités en simulation, par rapport au maintien de la dérive sur la même durée."];
    default:
      return ["Fonctionnement nominal", "Testez un pic isolé ou une dérive persistante de la climatisation."];
  }
}

function render() {
  const rows = bench.history.at(-1).rows;
  const device = adapters[selected];
  const alarm = selected === ac && bench.highCount > 0;
  byId("device-name").textContent = device.name;
  byId("device-id").textContent = device.id;
  byId("device-state").textContent = alarm ? (bench.mode === "alert" ? "Alerte" : "Seuil dépassé") : "Nominal";
  document.querySelector(".device-card").classList.toggle("alarm", alarm);
  byId("watts").textContent = format(rows[selected].watts);
  byId("reference").textContent = format(selected === ac ? bench.reference : device.base) + " W";
  byId("clock").textContent = tunisTime.format(bench.time);
  byId("packet").textContent = JSON.stringify(rows[selected], null, 2);
  byId("live").textContent = playing ? "En cours" : "En pause";
  byId("live").classList.toggle("paused", !playing);
  byId("play").textContent = playing ? "Ⅱ   Pause" : "▷   Reprendre";
  byId("guide").disabled = guidedTick !== null;
  byId("guide").textContent = guidedTick !== null ? "Démo en cours" : "▷   Démo guidée";
  byId("apply").hidden = bench.mode !== "alert";
  byId("diagnosis").classList.toggle("alert", bench.mode === "alert");
  const [title, description] = diagnosis();
  byId("status-title").textContent = title;
  byId("status-text").textContent = description;
  if (title !== lastAnnouncement) { byId("announcement").textContent = title; lastAnnouncement = title; }
  deviceButtons.forEach((button, i) => {
    button.setAttribute("aria-pressed", String(i === selected));
    button.querySelector("span").textContent = format(rows[i].watts) + " W";
  });
  drawChart();
}

function renderLink() {
  if (!link) return;
  const pending = link.count + " en attente";
  byId("sync-status").textContent = link.local ? "Mode autonome" : link.state + " · " + pending;
  byId("link-description").textContent = link.local ?
    "Démo autonome sur cet ordinateur. Les trames sont consultables ici. Ouvrez /m1/ depuis Django pour les transmettre." :
    "POST /mesures · " + pending + ". La file est rejouée après reconnexion." +
      (link.memory.length ? " Certaines mesures sont en mémoire jusqu’à leur envoi. Gardez cet onglet ouvert." : "");
  byId("offline").hidden = link.local;
  byId("offline").textContent = link.disconnected ? "Rétablir la liaison" : "Simuler une perte de liaison";
}

const deviceButtons = adapters.map((device, i) => {
  const button = document.createElement("button");
  button.className = "adapter";
  button.innerHTML = "<small></small><strong></strong><span></span>";
  button.querySelector("small").textContent = device.id;
  button.querySelector("strong").textContent = device.name;
  button.onclick = () => { selected = i; render(); };
  byId("devices").append(button);
  return button;
});

function advance() {
  if (guidedTick !== null) {
    guidedTick++;
    if (guidedTick === 1) bench.trigger("spike");
    if (guidedTick === 5) bench.trigger("drift");
  }
  const rows = bench.tick();
  link.record(rows);
  if (guidedTick !== null && bench.mode === "alert") {
    guidedTick = null;
    playing = false;
  }
  render();
}

let timer;
function schedule() {
  clearInterval(timer);
  if (playing) timer = setInterval(() => { if (playing) advance(); }, 2000);
}

function scenario(mode) {
  guidedTick = null;
  selected = ac;
  bench.trigger(mode);
  playing = true;
  advance();
  schedule();
}

byId("play").onclick = () => { playing = !playing; schedule(); render(); };
byId("reset").onclick = () => {
  bench = new AdapterBench();
  selected = ac; guidedTick = null; playing = true;
  schedule(); render();
};
byId("spike").onclick = () => scenario("spike");
byId("drift").onclick = () => scenario("drift");
byId("guide").onclick = () => {
  bench = new AdapterBench();
  selected = ac; guidedTick = 0; playing = true;
  advance(); schedule();
};
byId("apply").onclick = () => {
  bench.apply(); selected = ac; playing = true;
  advance(); schedule();
};
byId("offline").onclick = () => {
  link.disconnected = !link.disconnected;
  link.report(link.disconnected ? "Hors ligne" : "Reconnexion");
  link.flush();
};

link = new MeasurementLink(renderLink);
renderLink(); render(); schedule();
new ResizeObserver(drawChart).observe(byId("chart"));
