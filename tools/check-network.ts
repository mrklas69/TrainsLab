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
const branchLength = net.segments[0].length + net.segments[1].length + net.segments[4].length + net.segments[3].length;
check(Math.abs(net.routeLength('branch') - branchLength) < 1e-6, 'Odbočná route má špatnou délku.');

const firstSwitch = { seg: 1, s: net.segments[1].length + 1 };
const secondSwitch = { seg: 2, s: net.segments[2].length + 1 };
net.advance(firstSwitch);
net.advance(secondSwitch);
check(firstSwitch.seg === 2, 'Výchozí trasa na první výhybce musí pokračovat po hlavní smyčce.');
check(secondSwitch.seg === 3, 'Výchozí trasa na druhé výhybce musí pokračovat po hlavní smyčce.');

const branchSwitch = { seg: 1, s: net.segments[1].length + 1, route: 'branch' as const };
net.advance(branchSwitch);
check(branchSwitch.seg === 4, 'Odbočná route musí na první výhybce zvolit spojku.');
branchSwitch.s = net.segments[4].length + 1;
net.advance(branchSwitch);
check(branchSwitch.seg === 3, 'Odbočná route se musí ve druhém uzlu vrátit na společnou trať.');

const branchReverse = { seg: 3, s: -1, route: 'branch' as const };
net.advance(branchReverse);
check(branchReverse.seg === 4, 'Couvání po odbočné route musí ze sloučení vybrat spojku.');

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
check(branchGlobalRejected, 'globalS musí odmítnout větev bez explicitní odbočné route.');
check(Number.isFinite(net.globalS({ seg: 4, s: 0, route: 'branch' })), 'globalS musí podporovat odbočnou route.');

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
