"use strict";

const adapters = [
  { id: "NABD-0001", name: "Réfrigérateur", base: 90, variation: 0.12 },
  { id: "NABD-0002", name: "Ordinateur", base: 60, variation: 0.22 },
  { id: "NABD-0003", name: "Télévision", base: 110, variation: 0.10 },
  { id: "NABD-0004", name: "Climatisation", base: 900, variation: 0.08 },
  { id: "NABD-0005", name: "Chargeur téléphone", base: 10, variation: 0.25 }
];
const ac = 3;
const simulatedMinute = 60000;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return (sorted[mid] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
}

class AdapterBench {
  constructor(start = Date.now()) {
    this.time = start - 30 * simulatedMinute;
    this.minute = 0;
    this.history = [];
    this.mode = "normal";
    this.highCount = 0;
    this.savedKwh = 0;
    this.reference = 900;
    this.seed = 21;
    // Warm up each hour with a synthetic day so a jury run can cross an hour boundary.
    this.normalByHour = Array.from({length: 24}, () =>
      Array.from({length: 30}, () => this.normalWatts(ac)));
    for (let i = 0; i < 30; i++) this.tick();
  }

  normalWatts(index) {
    const device = adapters[index];
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    const noise = this.seed / 4294967296 * 2 - 1;
    const base = index === 0 && this.minute % 14 >= 8 ? 4 : device.base;
    return base * (1 + device.variation * noise);
  }

  trigger(mode) {
    this.mode = mode;
  }

  apply() {
    if (this.mode !== "alert") return;
    this.mode = "recovered";
    this.highCount = 0;
  }

  tick() {
    this.minute++;
    this.time += simulatedMinute;
    const watts = adapters.map((_, i) => this.normalWatts(i));
    const nominalAc = watts[ac];
    const bucket = this.normalByHour[new Date(this.time).getUTCHours()];
    this.reference = median(bucket);
    if (this.mode === "spike") watts[ac] *= 2.1;
    if (this.mode === "drift" || this.mode === "alert") watts[ac] *= 1.6;
    const high = watts[ac] > this.reference * 1.35;
    this.highCount = high ? this.highCount + 1 : 0;
    if (!high) {
      bucket.push(nominalAc);
      bucket.shift();
    }
    if (this.highCount >= 3) this.mode = "alert";
    if (this.mode === "recovered") this.savedKwh += nominalAc * 0.6 / 60000;
    const timestamp = new Date(this.time).toISOString();
    const rows = adapters.map((d, i) => ({
      adaptateur_id: d.id, horodatage: timestamp, watts: Math.round(watts[i] * 10) / 10,
      source: "simulee"
    }));
    this.history.push({time: this.time, rows, high});
    if (this.history.length > 30) this.history.shift();
    if (this.mode === "spike") this.mode = "pulse";
    else if (this.mode === "pulse") this.mode = "spike-cleared";
    return rows;
  }
}

// The headless producer uses the same device profiles and frozen wire format.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {AdapterBench, adapters, simulatedMinute};
}
