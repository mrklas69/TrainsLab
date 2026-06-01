/**
 * Lowpoly terén — výšková matematika (geometrie světa).
 *
 * Single source of truth pro výšku krajiny: čte ji **sim** (Track posadí osu koleje na
 * povrch, `Y = terrainHeight + most`) i **view** (mesh terénu). Sdílení drží trať a terén
 * v zákrytu — kolejnice vedou po povrchu (DD-20).
 *
 * Žádný `three` ani barvy — čistá čísla (DD-01: matematika patří do simu, pixely do view).
 * Barvení facet podle výšky je naopak ryze view (zůstává v Rendereru).
 */

const TERRAIN_FLAT_R = 170; // m — do téhle vzdálenosti od středu jen mírné vlny (trať sahá k ~150)
const TERRAIN_HILL_R = 350; // m — od téhle vzdálenosti kopce naplno (mezi: smoothstep)
const TERRAIN_HILL_H = 45;  // m — amplituda kopců na horizontu (fixní drama, mimo slider)

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

// Deterministický „fbm" šum ze tří sinů s nesouměřitelnými frekvencemi (žádný Math.random
// → reprodukovatelný terén). Vrací zhruba [−1, 1]. Nízká frekvence = dlouhé mírné vlny
// (sklon pro slack action pod tratí), vyšší oktávy přidají nepravidelnost kopcům.
function terrainNoise(x: number, z: number): number {
  let n = Math.sin(x * 0.011) * Math.cos(z * 0.013);
  n += 0.5 * Math.sin(x * 0.023 + 1.7) * Math.cos(z * 0.019 + 0.6);
  n += 0.25 * Math.sin(x * 0.041 + 4.2) * Math.cos(z * 0.037 + 2.9);
  return n / 1.75;
}

/**
 * Výška terénu v bodě (x, z). Amplituda variace roste se vzdáleností od středu osmičky:
 * pod tratí (r < FLAT_R) jen mírné vlny škálované `amplitude` (slider sklonu → sklon pro
 * slack action), na horizontu velké kopce (fixní HILL_H). Trať tuto výšku čte a posadí se na ni.
 */
export function terrainHeight(x: number, z: number, amplitude: number): number {
  const ampHill = smoothstep(TERRAIN_FLAT_R, TERRAIN_HILL_R, Math.hypot(x, z)) * TERRAIN_HILL_H;
  return terrainNoise(x, z) * (amplitude + ampHill);
}
