import { Vector3 } from 'three';
import { terrainHeight } from './terrain';

const BRIDGE_HEIGHT = 8;  // m — výška mostu nad podjezdem; clearance > výška vozu (~5,8 m)
const BRIDGE_WIDTH = 0.5; // rad — pološířka náběhu mostu v parametru t (rampa stoupání/klesání)

/**
 * Hrb mostu kolem `t=π/2`: jedna větev křížení se zvedne na estakádu, druhá (`t=3π/2`)
 * zůstane na terénu = podjezd pod mostem. Gaussovský náběh = plynulá rampa (žádný zlom).
 * Fixní výška (mimo slider sklonu) — clearance je inženýrská konstanta, ne věc krajiny.
 */
function bridgeLift(t: number): number {
  let d = t - Math.PI / 2;
  // kruhová vzdálenost do [−π, π] — most je periodický v t
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return BRIDGE_HEIGHT * Math.exp(-(d * d) / (BRIDGE_WIDTH * BRIDGE_WIDTH));
}

/**
 * Kontrolní body ležaté osmičky (Bernoulliho lemniskáta) v rovině XZ; výšku `Y` diktuje terén.
 *
 * Osmička dělá dvě věci jedním tahem:
 *  - **esíčko** — laloky jsou zatáčky (r ≈ 33 m), střed je inflexe (r → ∞); souprava zatáčí
 *    doleva, projede středem, pak doprava. Proměnný poloměr živí příčnou dynamiku (odstředivka).
 *  - **křížení** — trať se v půdorysu protne ve středu osmičky (`t=π/2` i `t=3π/2` → bod (0,0)).
 *    Řeší se **mostem** ({@link bridgeLift}): větev u `t=π/2` jde po estakádě nad druhou.
 *
 * **Výška `Y = terrainHeight(x,z) + most`** (DD-20): koleje vedou po povrchu krajiny, sklony
 * pro slack action vznikají z terénu (emergence, ne skript). `amplitude` škáluje terénní vlny
 * (slider sklonu → Track.rebuild + Renderer.rebuildTerrain); most zůstává fixní.
 */
export function makeLoopControlPoints(amplitude: number): Vector3[] {
  const points: Vector3[] = [];
  const A = 150; // šířka osmičky (poloviční rozpětí v X, m) — větší = mírnější oblouky
  const B = 150; // výška laloků (rozpětí v Z, m)
  const count = 24;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const denom = 1 + Math.sin(t) * Math.sin(t); // Bernoulli — kulaté laloky místo špičatých (Gerono)
    const x = (A * Math.cos(t)) / denom;
    const z = (B * Math.sin(t) * Math.cos(t)) / denom;
    points.push(new Vector3(x, terrainHeight(x, z, amplitude) + bridgeLift(t), z));
  }
  return points;
}

/** Bodová nespojitost trati — zdroj rázu do kývání skříně (zpracuje {@link Train}). */
export interface TrackPerturbation {
  u: number;     // pozice na trati jako zlomek délky [0,1) — přežije rebuild (s = u·délka)
  roll: number;  // relativní váha bočního trhu (skok křivosti / chybějící přechodnice); znaménko dá Train ze strany oblouku
  pitch: number; // relativní váha svislého rázu (výhybka / radiální ráz)
}

/**
 * Bodové nespojitosti osmičky — **fenomenologický** skok křivosti (A4 b): místo přepisu
 * geometrie hladké lemniskáty se na náběhy/výjezdy laloků (kde by reálná trať potřebovala
 * přechodnici) posadí roll-ráz = boční trh. „Výhybky" u vrcholů laloků přidají svislý clunk.
 * Sjednoceno s dilatačními spárami: {@link Train} obě řeší týmž `crossed()` testem (jen jiná perioda).
 * Pozice jako zlomky délky → přežijí slider sklonu (Track.rebuild mění délku trati).
 */
export const TRACK_PERTURBATIONS: TrackPerturbation[] = [
  { u: 0.10, roll: 1.0, pitch: 0.0 }, // náběh do 1. laloku — skok křivosti (boční trh)
  { u: 0.25, roll: 0.5, pitch: 0.9 }, // výhybka u vrcholu 1. laloku — radiální clunk
  { u: 0.40, roll: 1.0, pitch: 0.0 }, // výjezd z 1. laloku
  { u: 0.60, roll: 1.0, pitch: 0.0 }, // náběh do 2. laloku
  { u: 0.75, roll: 0.5, pitch: 0.9 }, // výhybka u vrcholu 2. laloku
  { u: 0.90, roll: 1.0, pitch: 0.0 }, // výjezd z 2. laloku
];
