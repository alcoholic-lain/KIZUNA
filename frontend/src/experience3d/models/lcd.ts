/** Text shown on the NABD adapter's screen: the API reading, or why there is none. */
export function lcdText(powerW: number | null, monitoring: boolean): [string, string] {
  if (!monitoring) return ["PAUSE", ""];
  if (powerW === null) return ["--", ""];
  if (powerW >= 1000) return [(powerW / 1000).toFixed(2).replace(".", ","), "kW"];
  return [powerW < 10 ? powerW.toFixed(1).replace(".", ",") : String(Math.round(powerW)), "W"];
}
