// Kalkulačka geometrie trati — ověřuje dvě věci pro asymetrickou osmičku (trackData):
//   1. minimální poloměr oblouku (aby nevznikla neprojetelná špička → vykolejení),
//   2. min „clearance" trati nad terénem (Catmull-Rom mezi řídkými body podstřeluje terén →
//      kolej zapadne pod zem). Roste s délkou laloku a hustotou kontrolních bodů (count).
// Spouštět: `npx tsx tools/check-radius.ts`. Mění E i count pro porovnání → ladění geometrie.
import { CatmullRomCurve3, Vector3 } from 'three';
import { TrackSegment } from '../src/sim/TrackSegment';
import { terrainHeight } from '../src/sim/terrain';

// práh převrácení z DEFAULT_PARAMS: (gauge/2)/comHeight · g ≈ 7.82 m/s²
const A_THR = (1.435 / 2 / 0.9) * 9.81;

// kopie bridgeLift + vzorce z trackData (jen aby šel proměnit count/E bez zásahu do zdroje)
function bridgeLift(t: number): number {
  let d = t - Math.PI / 2;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return 8 * Math.exp(-(d * d) / (0.5 * 0.5));
}
function points(E: number, count: number, amp: number): Vector3[] {
  const A = 150, B = 150;
  const pts: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const denom = 1 + Math.sin(t) * Math.sin(t);
    const stretch = 1 + E * (1 + Math.cos(t)) / 2;
    const x = (A * stretch * Math.cos(t)) / denom;
    const z = (B * stretch * Math.sin(t) * Math.cos(t)) / denom;
    pts.push(new Vector3(x, terrainHeight(x, z, amp) + bridgeLift(t), z));
  }
  return pts;
}

function measure(E: number, count: number, amp: number): void {
  // celou osmičku vyšetříme jako jeden segment nad master křivkou (uStart=0, uEnd=1)
  const curve = new CatmullRomCurve3(points(E, count, amp), true, 'centripetal');
  const seg = new TrackSegment(curve, 0, 1, curve.getLength());
  let minR = Infinity, minClear = Infinity, atC = 0, maxGrade = 0;
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const s = (i / N) * seg.length;
    const k = Math.abs(seg.signedCurvature(s));
    const r = k > 1e-9 ? 1 / k : Infinity;
    if (r < minR) minR = r;
    const g = Math.abs(seg.grade(s)); // |sin θ| sklonu
    if (g > maxGrade) maxGrade = g;
    const p = seg.positionAt(s);
    const clear = p.y - terrainHeight(p.x, p.z, amp); // záporné = trať pod terénem
    if (clear < minClear) { minClear = clear; atC = i / N; }
  }
  const vMax = Math.sqrt(A_THR * minR);
  const warn = minClear < -0.2 ? ' ⚠ POD TERÉNEM' : '';
  console.log(
    `amp=${amp} count=${count}: min r=${minR.toFixed(1)}m (v_max ${vMax.toFixed(1)} m/s)  max sklon=${(maxGrade * 100).toFixed(0)}%`
    + `  min clearance=${minClear.toFixed(2)}m${warn}`,
  );
}

// vlnitější trať = vyšší amplituda → větší podstřelení → potřeba hustších bodů.
for (const amp of [4, 10, 16]) {
  for (const c of [48, 72, 96]) measure(0.5, c, amp);
  console.log('');
}
