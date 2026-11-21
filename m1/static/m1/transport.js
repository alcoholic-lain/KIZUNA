"use strict";

// Keep whole ticks together. Keys are removed only after the API acknowledges
// the batch; its unique measurement key also covers lost acknowledgements.
class MeasurementLink {
  constructor(update) {
    this.update = update;
    this.local = location.protocol === "file:";
    this.disconnected = false;
    this.count = 0;
    this.state = this.local ? "Fichier local" : "Prête";
    this.memory = [];
    if (this.local) return;
    this.db = new Promise((resolve) => {
      try {
        const open = indexedDB.open("mieruka-measurements-v1", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("ticks", {autoIncrement: true});
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
    window.addEventListener("online", () => this.flush());
    window.addEventListener("offline", () => this.report("Hors ligne"));
    this.flush();
    this.retry = setInterval(() => this.flush(), 5000);
  }

  report(state) {
    this.state = state;
    this.update();
  }

  // Wait for the transaction commit, including for multi-operation deletes.
  async access(mode, action) {
    const db = await this.db;
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("ticks", mode);
      const result = action(tx.objectStore("ticks"));
      tx.oncomplete = () => resolve(result());
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async record(rows) {
    if (this.local) return;
    try {
      const count = await this.access("readwrite", store => {
        store.add(rows);
        const size = store.count();
        return () => size.result;
      });
      if (count === null) this.memory.push(rows);
      this.count = ((count || 0) + this.memory.length) * adapters.length;
    } catch {
      this.memory.push(rows);
      this.count += rows.length;
    }
    this.update();
    this.flush();
  }

  async flush() {
    if (this.local || this.busy) return;
    this.busy = true;
    try {
      do {
        const batch = await this.access("readonly", store => {
          const keys = store.getAllKeys(null, 20);
          const ticks = store.getAll(null, 20);
          const size = store.count();
          return () => ({keys: keys.result, ticks: ticks.result, size: size.result});
        });
        const disk = batch || {keys: [], ticks: [], size: 0};
        this.count = (disk.size + this.memory.length) * adapters.length;
        if (this.disconnected || !navigator.onLine) {
          this.report("Hors ligne");
          break;
        }
        const fromMemory = disk.ticks.length === 0;
        const ticks = fromMemory ? this.memory.slice(0, 20) : disk.ticks;
        if (!ticks.length) { this.report("Prête"); break; }
        const rows = ticks.flat();
        const token = document.cookie.split("; ").find(c => c.startsWith("csrftoken="));
        const response = await fetch("/mesures", {
          method: "POST", headers: {"Content-Type":"application/json", "X-CSRFToken":token?.slice(10) || ""},
          body: JSON.stringify(rows), signal: AbortSignal.timeout(8000)
        });
        if (!response.ok || (await response.json()).acquittees !== rows.length) throw Error();
        if (fromMemory) this.memory.splice(0, ticks.length);
        else await this.access("readwrite", store => {
          disk.keys.forEach(key => store.delete(key));
          return () => true;
        });
      } while (true);
    } catch { this.report("Liaison en attente"); }
    finally { this.busy = false; }
  }
}
