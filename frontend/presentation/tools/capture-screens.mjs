// Recaptures the demo journey that the deck's screenshots come from (screens/01..08).
// Needs: Django running on a DISPOSABLE COPY of the database at http://127.0.0.1:8010 (the script resets
// the demo, triggers the AC fault and applies the correction), and Edge started with
// --headless=new --remote-debugging-port=9333. Usage: node capture-screens.mjs <outDir>
// Then copy the 0N-*.png files into ../screens/ and re-check the highlight rectangles in src/content.ts.
import { writeFileSync } from "node:fs";
import { open, sleep } from "./cdp.mjs";
const out = process.argv[2], base = "http://127.0.0.1:8010";
const p = await open({ width: 1600, height: 1000, scale: 1.25 });
const API = `(async (path, b) => { const c = (document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)||[])[1]||"";
  const r = await fetch("/api/" + path, { method: b ? "POST" : "GET", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRFToken": decodeURIComponent(c) }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) }; })`;
const api = (path, body) => p.eval(`${API}(${JSON.stringify(path)}, ${body ? JSON.stringify(body) : "undefined"})`);
const shot = async (n) => { await p.shot(`${out}/${n}`); console.log("saved", n); };
const ac = async () => (await api("live")).data.devices.find((d) => d.category === "climatisation");
await p.go(base + "/login", 2500);
await api("auth/me");
await api("auth/demo", { role: "foyer" });
console.log("reset", (await api("sim", { action: "reset" })).data?.message);
await api("auth/demo", { role: "foyer" });
await api("sim", { action: "forward", minutes: 360 });
await api("sim", { action: "forward", minutes: 360 });
let a = await ac();
for (let k = 0; k < 8 && !(a.power > 500); k++) { await api("sim", { action: "forward", minutes: 60 }); a = await ac(); }
console.log("sim now", (await api("sim")).data.now, "AC", a.power);
await p.eval(`localStorage.setItem("mieruka-demo", JSON.stringify({open:false, step:0}))`);
await p.go(base + "/app/accueil", 6000);
await shot("01-household.png");
console.log("scenario", (await api("sim", { action: "scenario", code: "clim" })).data?.message);
const t0 = Date.now();
await sleep(4500);
await shot("02-fault-live.png");
let alert = null;
for (let k = 0; k < 30 && !alert; k++) {
  await sleep(1000);
  alert = (await api("live")).data.alerts.find((x) => ["surconsommation", "pic"].includes(x.kind) && x.category === "climatisation");
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log("alert after", secs, "s:", alert.title, alert.measured, alert.expected, alert.confidence, alert.evidence.rule, alert.kwh_month, alert.severity);
writeFileSync(`${out}/alert.json`, JSON.stringify({ ...alert, seconds: secs }, null, 2));
await p.go(base + "/app/accueil", 4500);
await p.eval(`document.getElementById("devices-list").scrollIntoView({block:"start"}); window.scrollBy(0,-110); new Promise(r=>setTimeout(r,500))`);
await shot("03-alert-dashboard.png");
await p.go(base + "/app/analyse", 4000);
await shot("04-insights.png");
await p.go(base + `/app/analyse?alerte=${alert.id}`, 4500);
await shot("05-evidence.png");
console.log("clicked", await p.eval(`(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("Appliquer la correction")); if (b) { b.click(); return true; } return false; })()`));
await sleep(1300);
await shot("06-correction.png");
await sleep(9000);
await p.go(base + "/app/accueil", 5000);
await p.eval(`document.getElementById("devices-list").scrollIntoView({block:"start"}); window.scrollBy(0,-110); new Promise(r=>setTimeout(r,500))`);
await shot("07-after.png");
const live = (await api("live")).data;
console.log("after", JSON.stringify(live.devices.map((d) => [d.name, d.power, d.anomaly, d.fixed])), "savings", JSON.stringify(live.savings));
await api("auth/demo", { role: "steg" });
await p.go(base + "/app/steg/batiments/BAT-TUN-01", 5500);
await shot("08-steg-building.png");
const inc = (await api("steg/incidents?status=toutes")).data.items.find((i) => i.id === alert.id);
console.log("steg incident", inc && [inc.household, inc.building, inc.region, inc.device, inc.status]);
await api("auth/demo", { role: "foyer" });
console.log(p.logs.filter((l) => !/favicon/.test(l)).join("\n") || "console clean");
p.close(); process.exit(0);
