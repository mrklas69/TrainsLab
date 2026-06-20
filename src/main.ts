import * as THREE from 'three';
import { TrackNetwork } from './sim/TrackNetwork';
import { buildLoopNetwork } from './sim/trackData';
import { Train } from './sim/Train';
import { DEFAULT_PARAMS } from './sim/params';
import { Renderer } from './view/Renderer';
import { DEFAULT_DRONE } from './view/CameraController';
import type { CarType } from './view/carModels';
import { AudioView } from './view/AudioView';
import { ExhaustClock } from './view/ExhaustClock';
import { DEFAULT_WIND } from './view/SteamView';
import { createControlPanel, type KeyAction } from './ui/ControlPanel';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Chybí <canvas id="scene">');

// Jedna sdílená instance parametrů: čte ji fyzika i slidery (live ladění).
const params = { ...DEFAULT_PARAMS };

const network = new TrackNetwork(buildLoopNetwork(params.trackAmplitude));
// souprava: lokomotiva (čelo) + cisterna + krytý + plošinový (plato) + 2 otevřené vozy.
// `carTypes` je view metadata (typ modelu) 1:1 s tělesy; `carLengths` jde do simu (délka + rozteč spřáhel).
const carTypes: CarType[] = ['loco', 'tank', 'boxcar', 'flatcar', 'gondola', 'gondola'];
const carLengths = [8, 7, 6, 6, 7, 7];
// odstavený volný vagon na protilehlé straně smyčky — souprava ho dokola dožene a ťukne do něj
// (kontaktní buff, bez spřažení; DD-24). `freeCarTypes` je view metadata 1:1 s train.freeBodies.
const freeCarTypes: CarType[] = ['boxcar'];
const freeCars = [{ length: 7, startS: network.totalLength * 0.5 }];
const train = new Train(network, params, carLengths, 0, freeCars);
// dron = view parametry kamery (mimo fyziku), sdílená instance pro slidery (live ladění)
const drone = { ...DEFAULT_DRONE };
// vítr = view parametry pro world-space částice; 0 m/s znamená bezvětří
const wind = { ...DEFAULT_WIND };
// sdílený rytmus parního výfuku (čistě view) — kouř i zvukový chuff z něj pufají v taktu
const exhaust = new ExhaustClock(params);
const renderer = new Renderer(canvas, network, train, drone, wind, params.trackAmplitude, carTypes, freeCarTypes, exhaust);
const audio = new AudioView(train, params, exhaust);

// Klávesové akce — single source pro keydown handler, nápovědu i tlačítka panelu.
const actions: KeyAction[] = [
  { codes: ['ArrowUp'], hint: '↑', label: 'Stupeň +', preventDefault: true, run: () => train.notchUp() },
  { codes: ['ArrowDown'], hint: '↓', label: 'Stupeň −', preventDefault: true, run: () => train.notchDown() },
  { codes: ['KeyB', 'Space'], hint: 'B / mezerník', label: 'Brzda', preventDefault: true, run: () => train.toggleBrake() },
  { codes: ['Digit1'], hint: '1', label: 'Hlavní', run: () => train.setRoute('main') },
  { codes: ['Digit2'], hint: '2', label: 'Odbočka', run: () => train.setRoute('branch') },
  // held-key: drž P → sype písek (zvedne adhezi), pusť → přestane. blur to taky vypne.
  { codes: ['KeyP'], hint: 'P (drž)', label: 'Písek', run: () => train.setSanding(true), onRelease: () => train.setSanding(false) },
  {
    codes: ['KeyH'], hint: 'H', label: 'Píšťala',
    run: () => { audio.playWhistle(); renderer.triggerWhistleSteam(); },
  },
  { codes: ['KeyM'], hint: 'M', label: 'Zvuk', run: () => audio.toggleMute() },
  { codes: ['KeyC'], hint: 'C', label: 'Dron', run: () => renderer.toggleDrone() },
  { codes: ['KeyR'], hint: 'R', label: 'Reset', run: () => train.reset() },
];

const updatePanel = createControlPanel(params, drone, wind, actions, {
  // slider sklonu: terén vede trať (DD-20) → přestav terén i křivku (sim) i kolejnice (view);
  // souprava jede dál (s je v metrech, wrap přes novou délku)
  onAmplitudeChange: () => {
    network.rebuild(buildLoopNetwork(params.trackAmplitude));
    renderer.rebuildWorld(params.trackAmplitude); // přestaví terén + dekoraci + trať (WorldView)
  },
  // checkbox v Nastavení: zobrazit/skrýt markery napětí spřáhel (osciloskop slack action)
  onCouplerMarkers: (visible) => renderer.setCouplerMarkersVisible(visible),
});

// Prohlížeč spustí zvuk až po první interakci uživatele (autoplay policy).
window.addEventListener('pointerdown', () => audio.resume());

// Ovládání lokomotivy: jeden handler nad deklarovanými akcemi.
window.addEventListener('keydown', (e) => {
  audio.resume();
  const action = actions.find((a) => a.codes.includes(e.code));
  if (!action) return;
  if (action.preventDefault) e.preventDefault();
  // Jednorázové akce nesmí spouštět OS autorepeat. Held-key akce naopak opakování snesou,
  // protože `run` jen nastavuje stav a `onRelease` ho při keyup/blur vypne.
  if (e.repeat && !action.onRelease) return;
  action.run();
});

// keyup/blur dotahují held-key akce (drž pro efekt, např. pískování). Bez blur by
// klávesa držená při ztrátě fokusu zůstala „zaseknutá" (symetrie s kamerou v Rendereru).
window.addEventListener('keyup', (e) => {
  actions.find((a) => a.codes.includes(e.code))?.onRelease?.();
});
window.addEventListener('blur', () => {
  for (const a of actions) a.onRelease?.();
});

// Render loop: sim krok (s ochranou proti velkým dt) → vykreslení.
const clock = new THREE.Clock();
function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  train.update(dt);
  exhaust.advance(train.speed, dt); // posuň takt výfuku (čtou ho audio i renderer)
  audio.update(train, renderer.cameraDistance); // distanční hlasitost ∝ vzdálenost kamery od loko
  updatePanel(train);
  renderer.render(dt);
  requestAnimationFrame(frame);
}
frame();
