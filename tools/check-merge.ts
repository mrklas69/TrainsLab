// Návrh DRUHÉ výhybky (2→1) — kam napojit levotočivý návrat odbočky na hlavní trať „v oblouku za
// mostem". ASCII mapa XZ (hlavní trať + dosavadní pravý oblouk odbočky) + profil hlavní trati za
// mostem (poloha, azimut tečny, poloměr). Měříme PŘED kódem. Spouštět: `npx tsx tools/check-merge.ts`.
import { CatmullRomCurve3, Vector3 } from 'three';
import { TrackSegment } from '../src/sim/TrackSegment';
import { terrainHeight } from '../src/sim/terrain';

const AMP = 8;
const SWITCH_U = 0.713, BRANCH_RADIUS = 60, BRANCH_SIDE = -1;

function bridgeLift(t: number): number {
  let d = t - Math.PI / 2;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return 8 * Math.exp(-(d * d) / (0.5 * 0.5));
}
function points(amp: number): Vector3[] {
  const A = 150, B = 150, E = 0.5, count = 96;
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

const curve = new CatmullRomCurve3(points(AMP), true, 'centripetal');
const seg = new TrackSegment(curve, 0, 1, curve.getLength());
const L = seg.length;

// dosavadní odbočka (pravý oblouk R60, 40 m) — kde končí a jakým směrem
function branchPath(lenTotal: number): { x: number; z: number; az: number }[] {
  const s0 = SWITCH_U * L;
  const p0 = seg.positionAt(s0);
  const t0 = seg.at(s0).tangent;
  let az = Math.atan2(t0.z, t0.x), x = p0.x, z = p0.z;
  const path: { x: number; z: number; az: number }[] = [];
  const STEP = 2;
  for (let s = 0; s <= lenTotal + 1e-9; s += STEP) {
    path.push({ x, z, az });
    x += Math.cos(az) * STEP; z += Math.sin(az) * STEP;
    az += BRANCH_SIDE * (STEP / BRANCH_RADIUS);
  }
  return path;
}
const branch = branchPath(40);
const bEnd = branch[branch.length - 1];

// ASCII mapa XZ (X vodorovně vpravo, Z svisle dolů). '.' hlavní trať, '#' odbočka, 'M' most(0,0).
const W = 70, H = 34;
const XMIN = -60, XMAX = 240, ZMIN = -150, ZMAX = 80;
const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => ' '));
function plot(x: number, z: number, ch: string): void {
  const col = Math.round(((x - XMIN) / (XMAX - XMIN)) * (W - 1));
  const row = Math.round(((z - ZMIN) / (ZMAX - ZMIN)) * (H - 1));
  if (col >= 0 && col < W && row >= 0 && row < H) grid[row][col] = ch;
}
const MAIN: Vector3[] = [];
for (let i = 0; i < 2000; i++) MAIN.push(seg.positionAt((i / 2000) * L));
for (const p of MAIN) plot(p.x, p.z, '.');
for (const b of branch) plot(b.x, b.z, '#');
plot(0, 0, 'M');
// označ u_merge kandidáty na hlavní trati za mostem (u > SWITCH_U)
const cands = [0.73, 0.74, 0.75, 0.76, 0.78, 0.80, 0.84, 0.88, 0.92];
cands.forEach((u, i) => { const p = seg.positionAt(u * L); plot(p.x, p.z, String(i + 1)); });
console.log('Mapa XZ (M=most, #=odbočka, .=trať, číslo=kandidát merge):');
for (const row of grid) console.log('  ' + row.join(''));

console.log(`\nKonec dosavadní odbočky: (${bEnd.x.toFixed(1)}, ${bEnd.z.toFixed(1)})  azimut=${(bEnd.az * 180 / Math.PI).toFixed(0)}°`);
console.log('\nKandidáti merge (hlavní trať za mostem):');
cands.forEach((u, i) => {
  const p = seg.positionAt(u * L);
  const t = seg.at(u * L).tangent;
  const az = Math.atan2(t.z, t.x) * 180 / Math.PI;
  const k = Math.abs(seg.signedCurvature(u * L));
  const r = k > 1e-9 ? 1 / k : Infinity;
  const dist = Math.hypot(p.x - bEnd.x, p.z - bEnd.z);
  console.log(
    `  [${i + 1}] u=${u.toFixed(2)}  (${p.x.toFixed(0)}, ${p.z.toFixed(0)})  azimut=${az.toFixed(0)}°  `
    + `r=${(r === Infinity ? '∞' : r.toFixed(0))} m  vzdál. od konce odbočky=${dist.toFixed(0)} m`,
  );
});

// ── ŘEŠIČ S-KŘIVKY ──────────────────────────────────────────────────────────────────────────
// Spojka od výhybky 1 (SWITCH_U) k výhybce 2 (u_merge): pravý oblouk (R, úhel φ1) → levý oblouk
// (R, úhel φ2). Tečné napojení na obou koncích → výhybka 1→2 i 2→1 pod malým úhlem (krátký souběh).
// Okrajová úloha: koncová poloha = pos(u_merge), koncový azimut = azimut(u_merge). Z azimutu plyne
// φ2 = (a1−a0)+φ1; zbývá najít (R, φ1) tak, aby seděla poloha → grid search + zjemnění.
const A_THR = (1.435 / 2 / 0.9) * 9.81;
const s0 = SWITCH_U * L;
const P0 = seg.positionAt(s0);
const a0 = Math.atan2(seg.at(s0).tangent.z, seg.at(s0).tangent.x);

function norm(a: number): number { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// integruj S-křivku → koncová poloha/azimut + body (pravý oblouk side=-1, pak levý side=+1)
function integrateS(R: number, phi1: number, phi2: number): { x: number; z: number; az: number; pts: { x: number; z: number }[] } {
  let az = a0, x = P0.x, z = P0.z;
  const pts = [{ x, z }];
  const ds = 0.5;
  for (const [phi, side] of [[phi1, -1], [phi2, 1]] as [number, number][]) {
    const n = Math.max(0, Math.round((R * phi) / ds));
    for (let k = 0; k < n; k++) {
      x += Math.cos(az) * ds; z += Math.sin(az) * ds;
      az += side * (ds / R);
      pts.push({ x, z });
    }
  }
  return { x, z, az, pts };
}

// najdi (R, φ1) pro daný cíl (P1, a1); φ2 dopočítá azimut. Vrať nejlepší shodu polohy.
function solve(u: number): { R: number; phi1: number; phi2: number; err: number; len: number; pts: { x: number; z: number }[] } | null {
  const P1 = seg.positionAt(u * L);
  const a1 = Math.atan2(seg.at(u * L).tangent.z, seg.at(u * L).tangent.x);
  let best: { R: number; phi1: number; phi2: number; err: number } | null = null;
  // hrubý grid
  for (let R = 35; R <= 180; R += 2.5) {
    for (let phi1 = 0; phi1 <= Math.PI; phi1 += 0.015) {
      const phi2 = norm(a1 - a0) + phi1; // z azimut. podmínky (norm: nejkratší otočení)
      if (phi2 < 0 || phi2 > Math.PI) continue;
      const e = integrateS(R, phi1, phi2);
      const err = Math.hypot(e.x - P1.x, e.z - P1.z);
      if (!best || err < best.err) best = { R, phi1, phi2, err };
    }
  }
  if (!best) return null;
  const fin = integrateS(best.R, best.phi1, best.phi2);
  return { ...best, len: best.R * (best.phi1 + best.phi2), pts: fin.pts };
}

// souběh = délka úseku (od začátku / od konce spojky), kde je blíž než 2 m k hlavní trati
function overlapEnds(pts: { x: number; z: number }[]): { atSwitch1: number; atSwitch2: number } {
  const near = (p: { x: number; z: number }): number => {
    let d = Infinity;
    for (const m of MAIN) d = Math.min(d, Math.hypot(m.x - p.x, m.z - p.z));
    return d;
  };
  const ds = 0.5; // krok integrace v pts
  let s1 = 0;
  for (let i = 0; i < pts.length; i++) { if (near(pts[i]) < 2) s1 = i * ds; else break; }
  let s2 = 0;
  for (let i = pts.length - 1; i >= 0; i--) { if (near(pts[i]) < 2) s2 = (pts.length - 1 - i) * ds; else break; }
  return { atSwitch1: s1, atSwitch2: s2 };
}

console.log('\nŘešení S-spojky pro každý kandidát (R, úhly, délka, souběh u obou výhybek, v_max):');
const solved = cands.map((u) => solve(u));
cands.forEach((u, i) => {
  const r = solved[i];
  if (!r) { console.log(`  [${i + 1}] bez řešení`); return; }
  const vMax = Math.sqrt(A_THR * r.R);
  const ov = overlapEnds(r.pts);
  const ok = r.err < 3 ? '✓' : '⚠ NEDOSEDÁ';
  console.log(
    `  [${i + 1}] u=${u.toFixed(2)}: R=${r.R.toFixed(0)} m  délka=${r.len.toFixed(0)} m  `
    + `souběh: výh1=${ov.atSwitch1.toFixed(0)} m / výh2=${ov.atSwitch2.toFixed(0)} m  v_max=${vMax.toFixed(1)} m/s  err=${r.err.toFixed(1)} m ${ok}`,
  );
});

// vykresli objížďku u=0.92 (poslední kandidát) — skutečná „zatáčka vlevo zpět na trať"
const pickIdx = cands.length - 1;
const pick = solved[pickIdx];
if (pick) {
  console.log(`\nMapa objížďky u=${cands[pickIdx].toFixed(2)} (R=${pick.R.toFixed(0)} m, délka ${pick.len.toFixed(0)} m):`);
  for (const row of grid) for (let c = 0; c < W; c++) if (row[c] === '#') row[c] = ' '; // smaž starou slepou odbočku
  for (const p of pick.pts) plot(p.x, p.z, '+');
  plot(0, 0, 'M');
  console.log('\nMapa s navrženou S-spojkou [3] (+) místo slepé odbočky:');
  for (const row of grid) console.log('  ' + row.join(''));
}
