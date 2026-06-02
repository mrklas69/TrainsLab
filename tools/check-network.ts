// Sanity-check topologie sítě po přidání spojky 2→1 (S37): 5 segmentů, totalLength = jen hlavní
// smyčka, gap přes oba uzly výhybek malý, a konec spojky dosedá na uzel výhybky 2 (proti zlomu).
// Spouštět: `npx tsx tools/check-network.ts`.
import { buildLoopNetwork } from '../src/sim/trackData';
import { TrackNetwork } from '../src/sim/TrackNetwork';

const net = new TrackNetwork(buildLoopNetwork(8));
console.log(`Segmentů: ${net.segments.length}`);
net.segments.forEach((s, i) => console.log(`  seg${i}: délka ${s.length.toFixed(1)} m (closed=${s.curve.closed})`));
console.log(`totalLength (hlavní smyčka): ${net.totalLength.toFixed(1)} m`);
console.log(`délka spojky (seg4): ${net.segments[4].length.toFixed(1)} m\n`);

// gap přes výhybku 1 (konec seg1 → začátek seg2) a výhybku 2 (konec seg2 → začátek seg3)
const g1 = net.gap({ seg: 1, s: net.segments[1].length - 2 }, { seg: 2, s: 2 });
const g2 = net.gap({ seg: 2, s: net.segments[2].length - 2 }, { seg: 3, s: 2 });
console.log(`gap přes výhybku 1 = ${g1.toFixed(2)} m,  přes výhybku 2 = ${g2.toFixed(2)} m  (čekáme ~ +4 m)`);

// délka spojky: getLength vs skutečná polyline (3D i horizontální) — odhalí kličky / overshoot CatmullRom
const conn = net.segments[4].curve as unknown as { points: { x: number; z: number }[] };
const cp = conn.points;
let polyXZ = 0, maxGap = 0, maxAt = -1;
for (let i = 1; i < cp.length; i++) {
  const g = Math.hypot(cp[i].x - cp[i - 1].x, cp[i].z - cp[i - 1].z);
  polyXZ += g; if (g > maxGap) { maxGap = g; maxAt = i; }
}
console.log(`spojka: ${cp.length} kontrolních bodů, polyline mezi nimi=${polyXZ.toFixed(1)} m, největší mezera=${maxGap.toFixed(1)} m u bodu ${maxAt} (čekáme ~78 m, mezery ~2 m)\n`);

// SPOJITOST KŘIVOSTI seg4: κ vzorkovaná podél odbočky musí být plynulá (žádný skok) a omezená.
// Vypíšeme max|κ| (min poloměr) a max skok |Δκ| mezi sousedními vzorky (velký skok = porušení C²).
const c4 = net.segments[4]; const Lc = c4.length;
let maxKc = 0, maxJumpc = 0, prevKc = NaN;
for (let i = 0; i <= 300; i++) {
  const k = c4.signedCurvature((i / 300) * Lc);
  maxKc = Math.max(maxKc, Math.abs(k));
  if (!Number.isNaN(prevKc)) maxJumpc = Math.max(maxJumpc, Math.abs(k - prevKc));
  prevKc = k;
}
console.log(`spojitost κ seg4: max|κ|=${maxKc.toFixed(4)} (min r=${(1 / maxKc).toFixed(0)} m)  max skok |Δκ| mezi vzorky=${maxJumpc.toFixed(4)} (malé → spojité)`);

// dosednutí: konec spojky (seg4 s=length) vs uzel výhybky 2 (začátek seg3, s=0)
const endConn = net.positionAt({ seg: 4, s: net.segments[4].length });
const node2 = net.positionAt({ seg: 3, s: 0 });
const dist = Math.hypot(endConn.x - node2.x, endConn.z - node2.z);
console.log(`konec spojky (${endConn.x.toFixed(1)}, ${endConn.z.toFixed(1)}) vs uzel výhybky 2 (${node2.x.toFixed(1)}, ${node2.z.toFixed(1)})  vzdálenost=${dist.toFixed(2)} m (čekáme ~0)`);

// advance default [0] přes obě výhybky musí jet po hlavní (seg1→seg2→seg3), ne po spojce
const l1 = { seg: 1, s: net.segments[1].length + 1 }; net.advance(l1);
const l2 = { seg: 2, s: net.segments[2].length + 1 }; net.advance(l2);
console.log(`advance přes výhybku 1: → seg${l1.seg} (čekáme 2 = rovně),  přes výhybku 2: → seg${l2.seg} (čekáme 3 = rovně)`);
