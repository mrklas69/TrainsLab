import * as THREE from 'three';
import { Track } from './sim/Track';
import { makeLoopControlPoints } from './sim/trackData';
import { Train } from './sim/Train';
import { DEFAULT_PARAMS } from './sim/params';
import { Renderer } from './view/Renderer';
import { AudioView } from './view/AudioView';
import { createControlPanel } from './ui/ControlPanel';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Chybí <canvas id="scene">');

// Jedna sdílená instance parametrů: čte ji fyzika i slidery (live ladění).
const params = { ...DEFAULT_PARAMS };

const track = new Track(makeLoopControlPoints());
// lokomotiva (čelo) + 4 vagony
const train = new Train(track, params, [8, 6, 6, 6, 6]);
const renderer = new Renderer(canvas, track, train);
const audio = new AudioView(train);

const updatePanel = createControlPanel(params, {
  onReset: () => train.reset(),
  onNotchUp: () => train.notchUp(),
  onNotchDown: () => train.notchDown(),
  onBrake: () => train.toggleBrake(),
  onMute: () => audio.toggleMute(),
});

// Prohlížeč spustí zvuk až po první interakci uživatele (autoplay policy).
window.addEventListener('pointerdown', () => audio.resume());

// Ovládání lokomotivy: regulátor (notch) + brzda + reset + zvuk.
window.addEventListener('keydown', (e) => {
  audio.resume();
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      e.preventDefault();
      train.notchUp();
      break;
    case 'KeyS':
    case 'ArrowDown':
      e.preventDefault();
      train.notchDown();
      break;
    case 'KeyB':
    case 'Space':
      e.preventDefault();
      train.toggleBrake();
      break;
    case 'KeyR':
      train.reset();
      break;
    case 'KeyM':
      audio.toggleMute();
      break;
  }
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
