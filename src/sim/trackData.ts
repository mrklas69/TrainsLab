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
