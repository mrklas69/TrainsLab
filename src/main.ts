import * as THREE from 'three';
import { Track } from './sim/Track';
import { makeLoopControlPoints } from './sim/trackData';
import { Train } from './sim/Train';
import { DEFAULT_PARAMS } from './sim/params';
import { Renderer } from './view/Renderer';
import { DEFAULT_DRONE } from './view/CameraController';
import type { CarType } from './view/carModels';
import { AudioView } from './view/AudioView';
import { ExhaustClock } from './view/ExhaustClock';
import { createControlPanel, type KeyAction } from './ui/ControlPanel';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Chybí <canvas id="scene">');

// Jedna sdílená instance parametrů: čte ji fyzika i slidery (live ladění).
const params = { ...DEFAULT_PARAMS };

const track = new Track(makeLoopControlPoints(params.trackAmplitude));
// souprava: lokomotiva (čelo) + cisterna + krytý + plošinový (plato) + 2 otevřené vozy.
// `carTypes` je view metadata (typ modelu) 1:1 s tělesy; `carLengths` jde do simu (délka + rozteč spřáhel).
const carTypes: CarType[] = ['loco', 'tank', 'boxcar', 'flatcar', 'gondola', 'gondola'];
const carLengths = [8, 7, 6, 6, 7, 7];
const train = new Train(track, params, carLengths);
// dron = view parametry kamery (mimo fyziku), sdílená instance pro slidery (live ladění)
const drone = { ...DEFAULT_DRONE };
// sdílený rytmus parního výfuku (čistě view) — kouř i zvukový chuff z něj pufají v taktu
const exhaust = new ExhaustClock(params);
const renderer = new Renderer(canvas, track, train, drone, params.trackAmplitude, carTypes, exhaust);
const audio = new AudioView(train, params, exhaust);

// Klávesové akce — single source pro keydown handler, nápovědu i tlačítka panelu.
const actions: KeyAction[] = [
  { codes: ['ArrowUp'], hint: '↑', label: 'Stupeň +', preventDefault: true, run: () => train.notchUp() },
  { codes: ['ArrowDown'], hint: '↓', label: 'Stupeň −', preventDefault: true, run: () => train.notchDown() },
  { codes: ['KeyB', 'Space'], hint: 'B / mezerník', label: 'Brzda', preventDefault: true, run: () => train.toggleBrake() },
  // held-key: drž P → sype písek (zvedne adhezi), pusť → přestane. blur to taky vypne.
  { codes: ['KeyP'], hint: 'P (drž)', label: 'Písek', run: () => train.setSanding(true), onRelease: () => train.setSanding(false) },
  { codes: ['KeyH'], hint: 'H', label: 'Houkačka', run: () => audio.playHorn() },
  { codes: ['KeyM'], hint: 'M', label: 'Zvuk', run: () => audio.toggleMute() },
  { codes: ['KeyC'], hint: 'C', label: 'Dron', run: () => renderer.toggleDrone() },
  { codes: ['KeyR'], hint: 'R', label: 'Reset', run: () => train.reset() },
];

const updatePanel = createControlPanel(params, drone, actions, {
  // slider sklonu: terén vede trať (DD-20) → přestav terén i křivku (sim) i kolejnice (view);
  // souprava jede dál (s je v metrech, wrap přes novou délku)
  onAmplitudeChange: () => {
    track.rebuild(makeLoopControlPoints(params.trackAmplitude));
    renderer.rebuildWorld(params.trackAmplitude); // přestaví terén + dekoraci + trať (WorldView)
  },
});

// Prohlížeč spustí zvuk až po první interakci uživatele (autoplay policy).
window.addEventListener('pointerdown', () => audio.resume());

// Ovládání lokomotivy: jeden handler nad deklarovanými akcemi.
window.addEventListener('keydown', (e) => {
  audio.resume();
  const action = actions.find((a) => a.codes.includes(e.code));
  if (!action) return;
  if (action.preventDefault) e.preventDefault();
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
  audio.update(train);
  updatePanel(train);
  renderer.render(dt);
  requestAnimationFrame(frame);
}
frame();
