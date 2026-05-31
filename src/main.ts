import * as THREE from 'three';
import { Track } from './sim/Track';
import { makeLoopControlPoints } from './sim/trackData';
import { Train } from './sim/Train';
import { DEFAULT_PARAMS } from './sim/params';
import { Renderer, DEFAULT_DRONE } from './view/Renderer';
import { AudioView } from './view/AudioView';
import { createControlPanel, type KeyAction } from './ui/ControlPanel';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Chybí <canvas id="scene">');

// Jedna sdílená instance parametrů: čte ji fyzika i slidery (live ladění).
const params = { ...DEFAULT_PARAMS };

const track = new Track(makeLoopControlPoints(params.trackAmplitude));
// lokomotiva (čelo) + 4 vagony
const train = new Train(track, params, [8, 6, 6, 6, 6]);
// dron = view parametry kamery (mimo fyziku), sdílená instance pro slidery (live ladění)
const drone = { ...DEFAULT_DRONE };
const renderer = new Renderer(canvas, track, train, drone);
const audio = new AudioView(train);

// Klávesové akce — single source pro keydown handler, nápovědu i tlačítka panelu.
const actions: KeyAction[] = [
  { codes: ['ArrowUp'], hint: '↑', label: 'Stupeň +', preventDefault: true, run: () => train.notchUp() },
  { codes: ['ArrowDown'], hint: '↓', label: 'Stupeň −', preventDefault: true, run: () => train.notchDown() },
  { codes: ['KeyB', 'Space'], hint: 'B / mezerník', label: 'Brzda', preventDefault: true, run: () => train.toggleBrake() },
  // held-key: drž P → sype písek (zvedne adhezi), pusť → přestane. blur to taky vypne.
  { codes: ['KeyP'], hint: 'P (drž)', label: 'Písek', run: () => train.setSanding(true), onRelease: () => train.setSanding(false) },
  { codes: ['KeyM'], hint: 'M', label: 'Zvuk', run: () => audio.toggleMute() },
  { codes: ['KeyC'], hint: 'C', label: 'Dron', run: () => renderer.toggleDrone() },
  { codes: ['KeyR'], hint: 'R', label: 'Reset', run: () => train.reset() },
];

const updatePanel = createControlPanel(params, drone, actions, {
  // slider sklonu: přestav křivku (sim) i geometrii tubu (view); souprava jede dál
  onAmplitudeChange: () => {
    track.rebuild(makeLoopControlPoints(params.trackAmplitude));
    renderer.rebuildTrack();
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
  audio.update(train, dt);
  updatePanel(train);
  renderer.render(dt);
  requestAnimationFrame(frame);
}
frame();
