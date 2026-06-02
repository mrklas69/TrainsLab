// Návrh ODBOČKY jako boční OFFSET hlavní trati (3. hrana θ-grafu): odbočka(s) = hlavní(u) + δ(s)·normála,
// kde δ(s) = δ_max·sin⁴(π·t), t∈[0,1] mapuje úsek [u1,u2]. Profil sin⁴ má δ=δ'=δ''=0 na obou koncích →
// odbočka navazuje na trať polohou, tečnou I křivostí (C², spojitá omezená změna rychlosti). δ≥0 →
// nekříží. Měříme κ (spojitost + max), nekřížení, dosednutí PŘED kódem. Spouštět: `npx tsx tools/check-connector.ts`.
import { CatmullRomCurve3, Vector3 } from 'three';
import { TrackSegment } from '../src/sim/TrackSegment';
import { terrainHeight } from '../src/sim/terrain';

const AMP = 8, U1 = 0.713;

function bridgeLift(t: number): number {
  let d = t - Math.PI / 2;
  if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
  return 8 * Math.exp(-(d * d) / 0.25);
}
function points(): Vector3[] {
  const A = 150, B = 150, E = 0.5, count = 96; const pts: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const denom = 1 + Math.sin(t) ** 2, stretch = 1 + E * (1 + Math.cos(t)) / 2;
    const x = (A * stretch * Math.cos(t)) / denom, z = (B * stretch * Math.sin(t) * Math.cos(t)) / denom;
    pts.push(new Vector3(x, terrainHeight(x, z, AMP) + bridgeLift(t), z));
  }
  return pts;
}

const loop = new CatmullRomCurve3(points(), true, 'centripetal');
const A_THR = (1.435 / 2 / 0.9) * 9.81;

// offset body: hlavní(u) + δ·horizontální normála; δ = δ_max·sin⁴(π t)
function offsetPts(u2: number, dMax: number, side: number, N: number): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = U1 + (u2 - U1) * t;
    const p = loop.getPointAt(u);
    const tan = loop.getTangentAt(u);
    const nl = Math.hypot(tan.x, tan.z);
    const nx = -tan.z / nl, nz = tan.x / nl; // horizontální normála (otočení tečny o 90°)
    const delta = side * dMax * Math.sin(Math.PI * t) ** 4;
    const x = p.x + nx * delta, z = p.z + nz * delta;
    pts.push(new Vector3(x, terrainHeight(x, z, AMP), z));
  }
  return pts;
}

// vyhodnocení varianty: min r (max|κ|), souběh (kde δ<2 m), kolize s JINOU částí trati (mimo úsek)
function evalVariant(u2: number, dMax: number, side: number, verbose = false): void {
  const branch = new CatmullRomCurve3(offsetPts(u2, dMax, side, 80), false, 'centripetal');
  const seg = new TrackSegment(branch, 0, 1, branch.getLength());
  const Lb = seg.length;
  // hustá hlavní trať MIMO úsek [u1,u2] (±0,05) — test kolize s jinou větví (např. u mostu)
  const other: Vector3[] = [];
  for (let i = 0; i < 3000; i++) { const u = i / 3000; if (u > U1 - 0.05 && u < u2 + 0.05) continue; other.push(loop.getPointAt(u)); }
  let maxK = 0, minOther = Infinity;
  const M = 200; const kprofile: number[] = [];
  for (let i = 0; i <= M; i++) {
    const s = (i / M) * Lb;
    const k = seg.signedCurvature(s);
    maxK = Math.max(maxK, Math.abs(k));
    if (i % 20 === 0) kprofile.push(k);
    const p = seg.positionAt(s);
    let dm = Infinity; for (const m of other) dm = Math.min(dm, Math.hypot(m.x - p.x, m.z - p.z));
    if (dm < minOther) minOther = dm;
  }
  // souběh: délka od začátku/konce, kde δ<2 m (sin⁴ profil, symetrický)
  let merge = 0; for (let i = 0; i <= M; i++) { const t = i / M; if (dMax * Math.sin(Math.PI * t) ** 4 < 2) merge = (t <= 0.5 ? t : 1 - t) * Lb; else break; }
  const rMin = maxK > 1e-9 ? 1 / maxK : Infinity;
  console.log(
    `u2=${u2.toFixed(2)} δ=${dMax} ${side > 0 ? 'L' : 'P'}: délka=${Lb.toFixed(0)} m  min r=${rMin.toFixed(0)} m (v_max ${Math.sqrt(A_THR * rMin).toFixed(1)})  `
    + `souběh~${merge.toFixed(0)} m/konec  odstup od jiné větve=${minOther.toFixed(0)} m${minOther < 8 ? ' ⚠' : ''}`,
  );
  if (verbose) console.log(`   κ profil (1/m, á 10 %): ${kprofile.map((k) => k.toFixed(4)).join('  ')}`);
}

console.log('Offset odbočka — varianty (u2, δ_max, strana L/P):');
for (const u2 of [0.80, 0.84, 0.88]) {
  for (const side of [1, -1]) evalVariant(u2, 12, side);
}
console.log('\nDetail kandidáta u2=0.86, δ=12, levá (κ profil = spojitost):');
evalVariant(0.86, 12, 1, true);
