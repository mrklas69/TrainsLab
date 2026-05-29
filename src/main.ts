import * as THREE from 'three';
import { Track } from './sim/Track';
import { makeLoopControlPoints } from './sim/trackData';
import { Train } from './sim/Train';
import { DEFAULT_PARAMS } from './sim/params';
import { Renderer } from './view/Renderer';
import { AudioView } from './view/AudioView';
import { createControlPanel, type KeyAction } from './ui/ControlPanel';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Chybí <canvas id="scene">');

// Jedna sdílená instance parametrů: čte ji fyzika i slidery (live ladění).
const params = { ...DEFAULT_PARAMS };

const track = new Track(makeLoopControlPoints(params.trackAmplitude));
// lokomotiva (čelo) + 4 vagony
const train = new Train(track, params, [8, 6, 6, 6, 6]);
const renderer = new Renderer(canvas, track, train);
const audio = new AudioView(train);

// Klávesové akce — single source pro keydown handler, nápovědu i tlačítka panelu.
const actions: KeyAction[] = [
  { codes: ['KeyW', 'ArrowUp'], hint: 'W / ↑', label: 'Stupeň +', preventDefault: true, run: () => train.notchUp() },
  { codes: ['KeyS', 'ArrowDown'], hint: 'S / ↓', label: 'Stupeň −', preventDefault: true, run: () => train.notchDown() },
  { codes: ['KeyB', 'Space'], hint: 'B / mezerník', label: 'Brzda', preventDefault: true, run: () => train.toggleBrake() },
  { codes: ['KeyM'], hint: 'M', label: 'Zvuk', run: () => audio.toggleMute() },
  { codes: ['KeyR'], hint: 'R', label: 'Reset', run: () => train.reset() },
];

const updatePanel = createControlPanel(params, actions, {
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

// Render loop: sim krok (s ochranou proti velkým dt) → vykreslení.
const clock = new THREE.Clock();
function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  train.update(dt);
  audio.update(train, dt);
  updatePanel(train);
  renderer.render(train);
  requestAnimationFrame(frame);
}
frame();
