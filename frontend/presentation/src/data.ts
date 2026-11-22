/**
 * Numbers drawn on the slides. All of them come from the prototype, not from imagination:
 * - DAY: hourly kWh per appliance for the demo household (FY-2EF2) on 21 Nov 2026,
 *   exported from the energy model (m11/model.py day_hourly). Simulated.
 * - BILL: the dashboard's bill estimate for the same household (m14/tariff.py). Simulated.
 * - ALERT: the alert raised during the recorded demo run on 22 Nov 2026 (see DESIGN-LOG.md).
 */

export const DAY: { name: string; hourly: number[] }[] = [
  { name: "Air conditioner", hourly: [0.004, 0.004, 0.0041, 0.004, 0.004, 0.004, 0.004, 0.004, 0.0041, 0.004, 0.004, 0.004, 0.004, 0.5519, 0.4031, 0.004, 0.004, 0.004, 0.3146, 0.3219, 0.2424, 0.0847, 0.3177, 0.3839] },
  { name: "Water heater", hourly: [0.0211, 0.0228, 0.0328, 0.0334, 0.032, 0.0172, 0.2912, 0.3013, 0.0158, 0.0229, 0.0301, 0.0193, 0.0327, 0.0364, 0.0199, 0.0274, 0.0367, 0.0158, 0.017, 0.1578, 0.1347, 0.2691, 0.0343, 0.019] },
  { name: "Fridge", hourly: [0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471, 0.0471] },
  { name: "TV + decoder", hourly: [0.0107, 0.0113, 0.0083, 0.007, 0.0069, 0.0126, 0.0076, 0.0086, 0.0064, 0.0061, 0.0082, 0.0115, 0.0463, 0.0521, 0.0083, 0.01, 0.0116, 0.0106, 0.0098, 0.1076, 0.1269, 0.0994, 0.0585, 0.052] },
  { name: "Phone charger", hourly: [0.0059, 0.0067, 0.0006, 0.0007, 0.0004, 0.0004, 0.0006, 0.0007, 0.0003, 0.0003, 0.0003, 0.0005, 0.0004, 0.0046, 0.0005, 0.0007, 0.0006, 0.0005, 0.0006, 0.0007, 0.0005, 0.0003, 0.0085, 0.0077] },
];

/** The standby the app flagged: TV average between 01:00 and 06:00, in watts. */
export const STANDBY = { lane: 3, from: 1, to: 6 };

/** Same moment as the recorded run (22 Nov 2026, simulated 18:29 Tunis); matches the backup screenshots. */
export const BILL = { total: "64.61", kwh: 253 };

/** Recorded run, 22 Nov 2026, simulated clock 18:26 Tunis (DESIGN-LOG.md). */
export const ALERT = {
  measured: 1624.3,
  usual: 946.6,
  threshold: 1277.9,
  gap: 677.7,
  pct: 72,
  confidence: 88,
  kwhMonth: 70.7,
  seconds: 15.3,
};

/**
 * The tech slide's rule chart: the last 23 of the 36 evidence readings stored with that alert,
 * 5 s apart. Reading 8 (really 965.6 W) is replaced by a single spike to show that one reading
 * above the threshold is ignored; the slide says so.
 */
export const RULE_READINGS = [
  968.1, 959.9, 928.3, 965, 936.7, 934.3, 956.7, 955, 1432, 953.6, 957.5, 958.1, 966.1, 971.3, 950.1, 919.7,
  931.1, 922.9, 914.6, 977, 1593.6, 1621, 1658.2,
];
export const RULE_SPIKE = 8;
export const RULE_RUN = [20, 21, 22];

/** "1 621.5" → "1 622", with a narrow no-break space as the thousands separator. */
export const num = (v: number, digits = 0) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/,/g, " ");
