// Regrese fail-state: volný vůz musí vstupovat do kritéria převrácení stejně jako souprava.
import { DEFAULT_PARAMS } from '../src/sim/params';
import {
  SERVICE_COAL_RATE,
  SERVICE_SAND_RATE,
  SERVICE_STOP_SPEED,
  SERVICE_WATER_RATE,
  serviceLocation,
} from '../src/sim/serviceSite';
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

// Servisní místo musí doplňovat postupně jen stojící lokomotivu na odbočce. Projíždějící vlak
// na stejném místě se doplňovat nesmí, jinak by šlo o „nabírání za jízdy" bez hráčské zastávky.
const serviceParams = { ...DEFAULT_PARAMS };
const serviceNetwork = new TrackNetwork(buildLoopNetwork(serviceParams.trackAmplitude));
const serviceTrain = new Train(serviceNetwork, serviceParams, [8]);
if (!serviceTrain.setRoute('branch')) throw new Error('Servisní test: branch route nejde nastavit.');
const service = serviceLocation(serviceNetwork);
if (!service) throw new Error('Servisní test: chybí servisní poloha.');
const serviceLoco = serviceTrain.bodies[0];
serviceLoco.seg = service.seg;
serviceLoco.s = service.s;
serviceLoco.route = 'branch';
serviceLoco.v = 0;
serviceTrain.coal = 0;
serviceTrain.water = 0;
serviceTrain.sand = 0;
serviceTrain.update(1);
if (!serviceTrain.isRefilling) throw new Error('Stojící loko u napaječky nezačala doplňovat.');
if (
  serviceTrain.coal !== SERVICE_COAL_RATE ||
  serviceTrain.water !== SERVICE_WATER_RATE ||
  serviceTrain.sand !== SERVICE_SAND_RATE
) {
  throw new Error(`Doplňování nemá postupnou rychlost ${SERVICE_COAL_RATE}/${SERVICE_WATER_RATE}/${SERVICE_SAND_RATE} kg/s.`);
}

const rollingServiceTrain = new Train(serviceNetwork, serviceParams, [8]);
if (!rollingServiceTrain.setRoute('branch')) throw new Error('Servisní průjezd: branch route nejde nastavit.');
const rollingLoco = rollingServiceTrain.bodies[0];
rollingLoco.seg = service.seg;
rollingLoco.s = service.s;
rollingLoco.route = 'branch';
rollingLoco.v = SERVICE_STOP_SPEED + 0.2;
rollingServiceTrain.coal = 0;
rollingServiceTrain.water = 0;
rollingServiceTrain.sand = 0;
rollingServiceTrain.update(1 / 60);
if (rollingServiceTrain.isRefilling || rollingServiceTrain.coal > 0 || rollingServiceTrain.water > 0 || rollingServiceTrain.sand > 0) {
  throw new Error('Projedoucí loko se doplnila bez zastavení u napaječky.');
}

console.log('Doplňování OK: stojící branch loko bere uhlí/vodu/písek, průjezd nedoplňuje.');

function trainOnRouteNearSegmentEnd(route: 'main' | 'branch', seg: number): Train {
  const testNetwork = new TrackNetwork(buildLoopNetwork(DEFAULT_PARAMS.trackAmplitude));
  const testTrain = new Train(testNetwork, DEFAULT_PARAMS, [8]);
  if (route === 'branch' && !testTrain.setRoute('branch')) {
    throw new Error('Trasu branch nebylo možné nastavit v bezpečném úseku.');
  }
  const testLoco = testTrain.bodies[0];
  testLoco.seg = seg;
  testLoco.s = testNetwork.segments[seg].length - 0.2;
  testLoco.v = 6;
  testLoco.route = route;
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

// Rázy ve výhybkových uzlech musí vzniknout na hlavní trase i odbočce. Fyzická výhybka
// je stejná kolejová nespojitost; route mění jen navazující segment a route délku pro crossed().
const mainSwitchIn = trainOnRouteNearSegmentEnd('main', 1);
mainSwitchIn.update(1 / 12);
if (!mainSwitchIn.switchFired) throw new Error('Hlavní trasa nespustila switchFired na rozbočení.');
if (mainSwitchIn.bodies[0].seg !== 2) throw new Error('Test hlavního rozbočení nepřejel na segment 2.');

const mainSwitchOut = trainOnRouteNearSegmentEnd('main', 2);
mainSwitchOut.update(1 / 12);
if (!mainSwitchOut.switchFired) throw new Error('Hlavní trasa nespustila switchFired na sloučení.');
if (mainSwitchOut.bodies[0].seg !== 3) throw new Error('Test hlavního sloučení nepřejel na segment 3.');

const branchSwitchIn = trainOnRouteNearSegmentEnd('branch', 1);
branchSwitchIn.update(1 / 12);
if (!branchSwitchIn.switchFired) throw new Error('Průjezd na spojku nespustil branch switchFired.');
if (branchSwitchIn.bodies[0].seg !== 4) throw new Error('Test rázu na rozbočení nepřejel na spojku.');

const branchSwitchOut = trainOnRouteNearSegmentEnd('branch', 4);
branchSwitchOut.update(1 / 12);
if (!branchSwitchOut.switchFired) throw new Error('Návrat ze spojky nespustil branch switchFired.');
if (branchSwitchOut.bodies[0].seg !== 3) throw new Error('Test rázu na sloučení nepřejel zpět na hlavní segment.');

console.log('Route-specific rázy OK: main i branch hlásí clunk na rozbočení i sloučení.');

// Volný vůz není ve spřaženém řetězci, ale jede po téže koleji. Rázy z trati se proto
// musí aplikovat i na freeBodies, jinak by výhybka/spára působila jen na soupravu.
const freeImpulseNetwork = new TrackNetwork(buildLoopNetwork(DEFAULT_PARAMS.trackAmplitude));
const freeImpulseTrain = new Train(freeImpulseNetwork, DEFAULT_PARAMS, [8], 0, [{ length: 7, startS: 0 }]);
const freeImpulseCar = freeImpulseTrain.freeBodies[0];
freeImpulseCar.seg = 1;
freeImpulseCar.s = freeImpulseNetwork.segments[1].length - 0.2;
freeImpulseCar.v = 6;
freeImpulseCar.route = 'main';
freeImpulseTrain.update(1 / 12);
if (!freeImpulseTrain.switchFired) throw new Error('Volný vůz přes výhybku nespustil switchFired.');
if (freeImpulseCar.seg !== 2) throw new Error('Volný vůz nepřejel rozbočení na hlavní trasu.');

console.log('Rázy volných vozů OK: freeBodies dostávají výhybkový clunk.');

// Jednovozový route test neodhalí chyby ve spřáhlech/gap přes route. Krátká plná souprava
// projede několik desítek sekund po branch bez volného vozu, takže ověřuje i Coupler.gap().
const fullRouteNetwork = new TrackNetwork(buildLoopNetwork(DEFAULT_PARAMS.trackAmplitude));
const fullRouteParams = { ...DEFAULT_PARAMS, trackImpulse: 0 };
const fullRouteTrain = new Train(fullRouteNetwork, fullRouteParams, [8, 7, 6, 6, 7, 7]);
if (!fullRouteTrain.setRoute('branch')) throw new Error('Plnou soupravu nešlo přepnout na branch.');
fullRouteTrain.notchUp();
fullRouteTrain.notchUp();
for (let i = 0; i < 1800; i++) {
  fullRouteTrain.update(1 / 60);
  if (fullRouteTrain.derailed) {
    throw new Error(`Plná souprava na branch vykolejila: ${fullRouteTrain.derailReason} ${fullRouteTrain.derailSpeed.toFixed(2)} m/s.`);
  }
}

console.log('Plná souprava OK: branch route drží spřáhla/gap bez vykolejení.');
