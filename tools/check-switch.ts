// Kalkulačka geometrie VÝHYBKY — hledá místo „kousek pod mostem" (podjezd, dolní větev
// lemniskáty u≈0.75) a ověřuje, kudy může odbočit slepá kolej (40 m) pryč od mostu/pilířů.
// Měříme PŘED zápisem do trackData (lekce S36: slepé iterace = chyba). Spouštět: `npx tsx tools/check-switch.ts`.
import { CatmullRomCurve3, Vector3 } from 'three';
import { TrackSegment } from '../src/sim/TrackSegment';
import { terrainHeight } from '../src/sim/terrain';

const AMP = 8; // default trackAmplitude

// kopie bridgeLift + vzorce z trackData (ať jdou měřit bez zásahu do zdroje)
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
console.log(`Délka lemniskáty: ${L.toFixed(1)} m\n`);

// 1) Kde je dolní podjezd? Bod trati nejblíž počátku (0,0) na dolní polovině (u>0.5).
//    Tam se trať kříží sama se sebou; horní větev (u≈0.25) je nad ní na estakádě.
let uUnder = 0, dMin = Infinity;
const N = 4000;
for (let i = 0; i < N; i++) {
  const u = i / N;
  if (u < 0.5) continue; // dolní větev
  const p = seg.positionAt(u * L);
  const d = Math.hypot(p.x, p.z);
  if (d < dMin) { dMin = d; uUnder = u; }
}
const pUnder = seg.positionAt(uUnder * L);
console.log(`Podjezd (dolní větev nejblíž počátku): u=${uUnder.toFixed(3)}  poloha=(${pUnder.x.toFixed(1)}, ${pUnder.z.toFixed(1)})  vzdál. od osy mostu=${dMin.toFixed(1)} m\n`);

// 2) Profil kolem podjezdu: poloměr, sklon, tečna (směr hlavní trati = výchozí tečna odbočky)
console.log('Profil kolem podjezdu (u, poloha XZ, poloměr, sklon, azimut tečny):');
for (let du = -0.04; du <= 0.04 + 1e-9; du += 0.01) {
  const u = uUnder + du;
  const s = u * L;
  const p = seg.positionAt(s);
  const t = seg.at(s).tangent;
  const k = Math.abs(seg.signedCurvature(s));
  const r = k > 1e-9 ? 1 / k : Infinity;
  const az = (Math.atan2(t.z, t.x) * 180 / Math.PI).toFixed(0); // azimut horizontální tečny (°)
  console.log(
    `  u=${u.toFixed(3)}  (${p.x.toFixed(1).padStart(6)}, ${p.z.toFixed(1).padStart(6)})  `
    + `r=${(r === Infinity ? '∞' : r.toFixed(0)).padStart(5)} m  sklon=${(seg.grade(s) * 100).toFixed(0).padStart(3)}%  azimut=${az.padStart(4)}°`,
  );
}

// 3) NÁVRH ODBOČKY. Model: kruhový oblouk konstantního poloměru R v XZ, tečně napojený na hlavní
//    trať v u_switch (výchozí směr = tečna trati), stáčí o sign·(s/R) na zvolenou stranu. Délka 40 m,
//    Y kopíruje terén (slepá kolej na zemi, bez mostu). Měříme: kam dojede, jak blízko mostu (počátek),
//    a SOUBĚH = horizontální vzdálenost k nejbližšímu bodu hlavní trati na PODOBNÉ výšce (|Δy|<3 m;
//    estakáda +8 m se nepočítá). Souběh < 2 m = koleje splývají („zdvojení") — chceme krátký.
const BRANCH_LEN = 40;
const STEP = 1; // m, vzorkování odbočky

// jemné vzorky hlavní lemniskáty (pro měření souběhu)
const MAIN: Vector3[] = [];
for (let i = 0; i < 2000; i++) MAIN.push(seg.positionAt((i / 2000) * L));

function evalBranch(uSwitch: number, R: number, side: 1 | -1, label: string): void {
  const s0 = uSwitch * L;
  const P0 = seg.positionAt(s0);
  const t0 = seg.at(s0).tangent;
  let az = Math.atan2(t0.z, t0.x); // výchozí azimut (rad) = tečna hlavní trati
  let x = P0.x, z = P0.z;
  let mergeLen = 0;       // délka úseku, kde souběh < 2 m (zdvojení)
  let minMostDist = Infinity;
  let endX = 0, endZ = 0;
  for (let s = 0; s <= BRANCH_LEN + 1e-9; s += STEP) {
    // integrace polohy podél oblouku poloměru R (úhel se stáčí o side·s/R)
    const yTer = terrainHeight(x, z, AMP);
    // souběh: nejbližší bod hlavní trati na podobné výšce
    let near = Infinity;
    for (const m of MAIN) {
      if (Math.abs(m.y - yTer) > 3) continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < near) near = d;
    }
    if (s > 0 && near < 2) mergeLen = s; // poslední s, kde ještě splývají
    minMostDist = Math.min(minMostDist, Math.hypot(x, z));
    endX = x; endZ = z;
    // krok vpřed
    az += side * (STEP / R);
    x += Math.cos(az) * STEP;
    z += Math.sin(az) * STEP;
  }
  const finalAngle = (BRANCH_LEN / R) * 180 / Math.PI;
  console.log(
    `  ${label}: R=${R} m, ${side > 0 ? 'vlevo ' : 'vpravo'}  →  konec (${endX.toFixed(1)}, ${endZ.toFixed(1)})  `
    + `koncový úhel=${finalAngle.toFixed(0)}°  souběh<2m do ${mergeLen.toFixed(0)} m  min vzdál. od mostu=${minMostDist.toFixed(1)} m`,
  );
}

console.log('\nNávrh odbočky (u_switch=0.713, kousek za podjezdem; obě strany, různé poloměry):');
for (const R of [60, 100, 160]) {
  evalBranch(0.713, R, +1, `R${R}`);
  evalBranch(0.713, R, -1, `R${R}`);
}
