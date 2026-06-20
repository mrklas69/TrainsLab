// Regresní kontrola produkční spojky: omezená křivost a C² napojení v obou uzlech.
import { buildLoopNetwork } from '../src/sim/trackData';
import { TrackNetwork } from '../src/sim/TrackNetwork';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const net = new TrackNetwork(buildLoopNetwork(8));
const branch = net.segments[4];
const samples = 600;
let maxCurvature = 0;
let maxJump = 0;
let previous = net.signedCurvature({ seg: 4, s: 0, route: 'branch' });

for (let i = 0; i <= samples; i++) {
  const curvature = net.signedCurvature({ seg: 4, s: (i / samples) * branch.length, route: 'branch' });
  check(Number.isFinite(curvature), `Neplatná křivost ve vzorku ${i}.`);
  maxCurvature = Math.max(maxCurvature, Math.abs(curvature));
  if (i > 0) maxJump = Math.max(maxJump, Math.abs(curvature - previous));
  previous = curvature;
}

const startDelta = Math.abs(
  net.signedCurvature({ seg: 4, s: 0, route: 'branch' }) - net.signedCurvature({ seg: 2, s: 0 }),
);
const endDelta = Math.abs(
  net.signedCurvature({ seg: 4, s: branch.length, route: 'branch' }) - net.signedCurvature({ seg: 3, s: 0, route: 'branch' }),
);

check(maxCurvature < 0.025, `Spojka překročila mez křivosti: ${maxCurvature.toFixed(5)} 1/m.`);
check(maxJump < 0.004, `Profil spojky obsahuje skok κ: ${maxJump.toFixed(5)} 1/m.`);
check(startDelta < 0.0015, `Křivost nesedí v prvním uzlu: Δκ=${startDelta.toFixed(5)} 1/m.`);
check(endDelta < 0.0015, `Křivost nesedí v druhém uzlu: Δκ=${endDelta.toFixed(5)} 1/m.`);

console.log(
  `Spojka OK: max |κ|=${maxCurvature.toFixed(4)} 1/m, `
  + `uzly Δκ=${startDelta.toFixed(5)}/${endDelta.toFixed(5)} 1/m.`,
);
