// Regresní kontrola produkční topologie. Při porušení invariantu končí chybou,
// takže ji lze pouštět z npm skriptu i CI bez ruční interpretace výpisu.
import { buildLoopNetwork } from '../src/sim/trackData';
import { TrackNetwork } from '../src/sim/TrackNetwork';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const net = new TrackNetwork(buildLoopNetwork(8));
check(net.segments.length === 5, `Očekáváno 5 segmentů, nalezeno ${net.segments.length}.`);
check(net.segments[4].curve.closed === false, 'Spojka musí být otevřená křivka.');

const mainLength = net.segments.slice(0, 4).reduce((sum, segment) => sum + segment.length, 0);
check(Math.abs(net.totalLength - mainLength) < 1e-6, 'totalLength musí obsahovat pouze hlavní smyčku.');

const firstSwitch = { seg: 1, s: net.segments[1].length + 1 };
const secondSwitch = { seg: 2, s: net.segments[2].length + 1 };
net.advance(firstSwitch);
net.advance(secondSwitch);
check(firstSwitch.seg === 2, 'Výchozí trasa na první výhybce musí pokračovat po hlavní smyčce.');
check(secondSwitch.seg === 3, 'Výchozí trasa na druhé výhybce musí pokračovat po hlavní smyčce.');

const branchStart = net.positionAt({ seg: 4, s: 0 });
const branchEnd = net.positionAt({ seg: 4, s: net.segments[4].length });
const nodeStart = net.positionAt({ seg: 2, s: 0 });
const nodeEnd = net.positionAt({ seg: 3, s: 0 });
check(branchStart.distanceTo(nodeStart) < 0.01, 'Začátek spojky nedosedá na první uzel.');
check(branchEnd.distanceTo(nodeEnd) < 0.01, 'Konec spojky nedosedá na druhý uzel.');

let branchGlobalRejected = false;
try {
  net.globalS({ seg: 4, s: 0 });
} catch {
  branchGlobalRejected = true;
}
check(branchGlobalRejected, 'globalS musí odmítnout větev bez definované route-aware souřadnice.');

let invalidChoiceRejected = false;
try {
  const invalidChoice = { seg: 1, s: net.segments[1].length + 1 };
  net.advance(invalidChoice, () => 0);
} catch {
  invalidChoiceRejected = true;
}
check(invalidChoiceRejected, 'advance musí odmítnout volbu segmentu, který není mezi možnostmi hrany.');

let asymmetricTopologyRejected = false;
try {
  const spec = buildLoopNetwork(8);
  spec.prev[3] = [2];
  new TrackNetwork(spec);
} catch {
  asymmetricTopologyRejected = true;
}
check(asymmetricTopologyRejected, 'Síť musí odmítnout next/prev hrany, které nejsou vzájemné.');

console.log(`Síť OK: 5 segmentů, hlavní smyčka ${net.totalLength.toFixed(1)} m.`);
