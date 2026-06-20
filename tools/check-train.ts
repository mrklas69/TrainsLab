// Regrese fail-state: volný vůz musí vstupovat do kritéria převrácení stejně jako souprava.
import { DEFAULT_PARAMS } from '../src/sim/params';
import { buildLoopNetwork } from '../src/sim/trackData';
import { TrackNetwork } from '../src/sim/TrackNetwork';
import { Train } from '../src/sim/Train';

const params = {
  ...DEFAULT_PARAMS,
  comHeight: 100, // záměrně nízký práh, aby test nepotřeboval extrémní rychlost
};
const network = new TrackNetwork(buildLoopNetwork(params.trackAmplitude));
const train = new Train(network, params, [8], 0, [{ length: 7, startS: 0 }]);
const free = train.freeBodies[0];

// Najdi nejostřejší bod hlavní smyčky a postav na něj pouze volný vůz.
let maxCurvature = 0;
let criticalS = 0;
for (let i = 0; i < 2000; i++) {
  const s = (i / 2000) * network.totalLength;
  const location = { seg: 0, s };
  network.advance(location);
  const curvature = Math.abs(network.signedCurvature(location));
  if (curvature > maxCurvature) {
    maxCurvature = curvature;
    criticalS = s;
  }
}

free.seg = 0;
free.s = criticalS;
network.advance(free);
free.v = 5;
train.update(1 / 60);

if (!train.derailed || train.derailReason !== 'overturn') {
  throw new Error('Volný vůz překročil mez převrácení, ale Train nevyhlásil overturn.');
}
if (train.derailSpeed <= 0) throw new Error('Diagnostika převrácení neobsahuje rychlost volného vozu.');

console.log(`Převrácení volného vozu OK při ${train.derailSpeed.toFixed(2)} m/s.`);

// Události rázů jsou per-frame flagy. Po vykolejení se sim už nehýbe, ale flagy se musí
// v dalším update vynulovat, jinak AudioView přehrává poslední clunk/skřípnutí každý frame.
train.switchFired = true;
train.transitionJerkFired = true;
train.update(1 / 60);
if (train.switchFired || train.transitionJerkFired) {
  throw new Error('Per-frame flagy rázů zůstaly aktivní po vykolejení.');
}

// Písek musí na mokré koleji odstranit prokluz i na maximální stupeň. Suchá μ=0,30
// sama nestačí na 200 kN, proto je účinnost písku explicitní násobek nad suchou hodnotu.
const adhesionParams = { ...DEFAULT_PARAMS, railFactor: 0.3 };
const adhesionNetwork = new TrackNetwork(buildLoopNetwork(adhesionParams.trackAmplitude));
const adhesionTrain = new Train(adhesionNetwork, adhesionParams, [8]);
adhesionTrain.notchUp();
adhesionTrain.notchUp();
adhesionTrain.notchUp();
adhesionTrain.update(1 / 60);
if (!adhesionTrain.slipping) throw new Error('Maximální tah na mokré koleji má prokluzovat.');

adhesionTrain.setSanding(true);
adhesionTrain.update(1 / 60);
if (adhesionTrain.slipping) throw new Error('Pískování s výchozí účinností neodstranilo prokluz.');
if (adhesionTrain.effectiveAdhesion <= adhesionParams.adhesionCoeff) {
  throw new Error('Písek musí zvýšit adhezi nad suchou hodnotu.');
}

console.log(`Pískování OK: μ ${(
  adhesionParams.adhesionCoeff * adhesionParams.railFactor
).toFixed(2)} → ${adhesionTrain.effectiveAdhesion.toFixed(2)}.`);

function trainOnBranchNearSegmentEnd(seg: number): Train {
  const testNetwork = new TrackNetwork(buildLoopNetwork(DEFAULT_PARAMS.trackAmplitude));
  const testTrain = new Train(testNetwork, DEFAULT_PARAMS, [8]);
  if (!testTrain.setRoute('branch')) throw new Error('Trasu branch nebylo možné nastavit v bezpečném úseku.');
  const testLoco = testTrain.bodies[0];
  testLoco.seg = seg;
  testLoco.s = testNetwork.segments[seg].length - 0.2;
  testLoco.v = 6;
  testLoco.route = 'branch';
  return testTrain;
}

// Route-aware průjezd: souprava na trase branch musí na první výhybce vybrat spojku
// a route lock nesmí dovolit přestavení, když už lokomotiva leží na exkluzivní větvi.
const routeNetwork = new TrackNetwork(buildLoopNetwork(DEFAULT_PARAMS.trackAmplitude));
const routeTrain = new Train(routeNetwork, DEFAULT_PARAMS, [8]);
if (!routeTrain.setRoute('branch')) throw new Error('Trasu branch nebylo možné nastavit v bezpečném úseku.');
const loco = routeTrain.bodies[0];
loco.seg = 1;
loco.s = routeNetwork.segments[1].length - 0.2;
loco.v = 6;
loco.route = 'branch';
routeTrain.update(1 / 12);
if (loco.seg !== 4) throw new Error(`Route branch nepřejela na spojku, skončila na segmentu ${loco.seg}.`);
if (routeTrain.setRoute('main')) throw new Error('Route lock dovolil přestavit výhybku uprostřed odbočky.');

console.log('Route-aware průjezd OK: branch volí spojku a zámek drží obsazenou větev.');

// Rázy na odbočce musí vzniknout v obou topologických uzlech, nejen na historických bodech
// hlavní lemniskáty. Test jede skutečným update(), aby ověřil advance + route globalS + crossed().
const branchSwitchIn = trainOnBranchNearSegmentEnd(1);
branchSwitchIn.update(1 / 12);
if (!branchSwitchIn.switchFired) throw new Error('Průjezd na spojku nespustil branch switchFired.');
if (branchSwitchIn.bodies[0].seg !== 4) throw new Error('Test rázu na rozbočení nepřejel na spojku.');

const branchSwitchOut = trainOnBranchNearSegmentEnd(4);
branchSwitchOut.update(1 / 12);
if (!branchSwitchOut.switchFired) throw new Error('Návrat ze spojky nespustil branch switchFired.');
if (branchSwitchOut.bodies[0].seg !== 3) throw new Error('Test rázu na sloučení nepřejel zpět na hlavní segment.');

console.log('Route-specific rázy OK: odbočka hlásí clunk na rozbočení i sloučení.');
