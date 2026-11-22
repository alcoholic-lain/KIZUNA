/**
 * Numbers drawn on the slides. Every one comes from the repository, with its source:
 * - 2014 / 2019 household averages: STEG household survey, quoted in L'Économiste Maghrébin, 19 Feb 2023
 *   ("1635,9 … en 2019, contre 1508,4 … en 2014"; the article writes the unit as "kw", so the slide shows no unit).
 * - The 18 % air-conditioning and ≈36 % refrigerator shares on slide 3 are in the article cited on that slide
 *   (ANME/STEG study, 2024). The repo's old "Other 25 %" slice is not in any source and is not used.
 */

export const STEG_2014 = 1508.4;
export const STEG_2019 = 1635.9;
/** (1635.9 / 1508.4 − 1) × 100 = 8.45, which the app shows as 8.5 %. */
export const STEG_GROWTH = 8.5;

