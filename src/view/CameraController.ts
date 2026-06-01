import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Track } from '../sim/Track';
import type { Train } from '../sim/Train';
import { CAR_HEIGHT } from './carModels';

// klávesové ovládání kamery (vedle myší orbitace) — plynulý pohyb při držení klávesy.
const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyX'];
const PAN_SPEED = 120;  // m/s — posun v rovině (WASD)
const ELEV_SPEED = 90;  // m/s — výška (QE)
const ZOOM_SPEED = 120; // m/s — přiblížení/oddálení (ZX)
const MIN_DIST = 5;     // m — minimální odstup od cíle (nezoomovat skrz)

// auto-kamera „dron" — laditelné knoby (Lab, izomorfní s vypružením skříně). Ryze view:
// kamera nikdy nevstupuje do simu (DD-01), proto vlastní typ mimo PhysicsParams.
export interface DroneParams {
  height: number;    // výška dronu nad zadním vozem (m)
  distance: number;  // odstup za zadním vozem, proti směru jízdy (m)
  stiffness: number; // tuhost dohánění cíle (1/s) — vyšší = tužší/rychlejší přelet
}
export const DEFAULT_DRONE: DroneParams = { height: 18, distance: 35, stiffness: 2 };
const V_DRONE_DIR = 0.5; // m/s — nad tím dron přebírá směr jízdy; pod tím drží poslední (hystereze u v≈0)

/**
 * CameraController = veškeré řízení kamery (čistě view, DD-01) vytažené z Rendereru
 * (SLAP — Renderer staví svět a kreslí aktéry, kamera je samostatná starost).
 *
 * Dva režimy přepínané klávesou C:
 *  - **ruční** — myší orbit ({@link OrbitControls}) + klávesy WASD/QE/ZX,
 *  - **dron** — auto-kamera sleduje soupravu zezadu-shora; orbit i klávesy vypnuté.
 *
 * Drží vlastní {@link camera}; Renderer ji jen čte při `gl.render`. Sám si registruje
 * posluchače kláves (keydown/keyup/blur) — symetricky s tím, jak je dřív držel Renderer.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly heldKeys = new Set<string>(); // držené klávesy kamery (WASD/QE/ZX)

  // stav auto-kamery „dron" (toggle C): směr s hysterezí + tlumeně dohánčné pozice/pohled
  private droneActive = false;
  private droneDir = 1;                            // ±1 směr jízdy (hystereze u v≈0)
  private readonly dronePos = new THREE.Vector3(); // tlumená pozice kamery
  private readonly droneLook = new THREE.Vector3();// tlumený bod pohledu
  // přepoužitelné buffery cíle dronu (žádná alokace per-frame — izomorfní s chimneyWorld v Rendereru)
  private readonly targetPos = new THREE.Vector3();
  private readonly targetLook = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly track: Track,
    private readonly train: Train,
    private readonly drone: DroneParams, // sdílená instance — slidery ji ladí za běhu
  ) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(188, 175, 188); // dál — osmička je ~300 m napříč

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    // klávesy kamery: keydown drží, keyup pouští; blur vyčistí (jinak by klávesa
    // držená při ztrátě fokusu zůstala „zaseknutá"). Lokomotivu řídí jiný handler.
    window.addEventListener('keydown', (e) => {
      if (CAMERA_KEYS.includes(e.code)) this.heldKeys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.heldKeys.delete(e.code));
    window.addEventListener('blur', () => this.heldKeys.clear());
  }

  /** Každý frame: dron řídí kameru sám, jinak orbit damping + klávesy. */
  update(dt: number): void {
    if (this.droneActive) {
      this.updateDroneCamera(dt);
    } else {
      this.updateManualCamera(dt);
      this.controls.update(); // orbit damping jen mimo dron režim
    }
  }

  /** Toggle auto-kamery „dron" (klávesa C). Aktivní = orbit/WASD vypnuté, kameru řídí dron. */
  toggleDrone(): void {
    this.droneActive = !this.droneActive;
    this.controls.enabled = !this.droneActive; // dron přebírá kameru → vypni myší orbit i klávesy
    if (this.droneActive) {
      this.heldKeys.clear(); // držené WASD/QE/ZX by jinak po přepnutí zůstaly „viset"
      this.computeDroneTarget(this.dronePos, this.droneLook); // snap na cíl — žádný úvodní leták přes mapu
      this.applyDrone();
    } else {
      this.controls.target.copy(this.droneLook); // orbit naváže tam, kam dron koukal (bez skoku)
    }
  }

  /** Po resize okna přenastav poměr stran (Renderer drží gl.setSize). */
  setAspect(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Auto-kamera „dron": sleduje soupravu zezadu-shora ve směru jízdy, kouká na její střed.
   * Pozici i pohled tlumeně dohání k cíli — reverz jen překlopí cíl na druhý konec a tlumení
   * udělá plynulý přelet (žádný zvláštní kód). Frame-rate independent: α = 1 − exp(−tuhost·dt).
   */
  private updateDroneCamera(dt: number): void {
    const v = this.train.speed;
    // hystereze směru: přebírej sign(v) jen za jízdy; u v≈0 drž poslední (jinak slack-houpání třese dronem)
    if (Math.abs(v) > V_DRONE_DIR) this.droneDir = Math.sign(v);
    this.computeDroneTarget(this.targetPos, this.targetLook);
    const alpha = 1 - Math.exp(-this.drone.stiffness * dt); // tuhost dohánění, nezávislá na FPS
    this.dronePos.lerp(this.targetPos, alpha);
    this.droneLook.lerp(this.targetLook, alpha);
    this.applyDrone();
  }

  /** Cílová pozice kamery a bod pohledu pro aktuální stav soupravy (čte droneDir). */
  private computeDroneTarget(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    const bodies = this.train.bodies;
    const fwd = this.droneDir; // +1 vpřed, −1 vzad
    // přední/zadní vůz vzhledem ke směru jízdy (couvání prohodí konce → dron přeletí)
    const frontBody = fwd > 0 ? bodies[0] : bodies[bodies.length - 1];
    const rearBody = fwd > 0 ? bodies[bodies.length - 1] : bodies[0];
    const rear = this.track.at(rearBody.s);
    const frontPos = this.track.positionAt(frontBody.s);
    // pozice: za zadním vozem (proti směru jízdy) + výška
    outPos.copy(rear.position).addScaledVector(rear.tangent, -fwd * this.drone.distance);
    outPos.y += this.drone.height;
    // pohled: střed mezi konci soupravy (akord) + výška skříně — klidnější než mířit na čelo
    outLook.copy(frontPos).add(rear.position).multiplyScalar(0.5);
    outLook.y += CAR_HEIGHT;
  }

  /** Promítne tlumený stav dronu do skutečné kamery. */
  private applyDrone(): void {
    this.camera.position.copy(this.dronePos);
    this.camera.lookAt(this.droneLook);
  }

  /**
   * Pohyb kamery z držených kláves (vedle myší orbitace). WASD = posun v rovině
   * (hýbe kamerou i cílem → směr pohledu se zachová), QE = výška, ZX = dolly k cíli.
   * Interakce, ne stav simu — DD-01 drží (do modelu se nezapisuje).
   */
  private updateManualCamera(dt: number): void {
    const keys = this.heldKeys;
    if (keys.size === 0) return;
    const cam = this.camera;
    const target = this.controls.target;

    // směr pohledu v rovině (WASD) + kolmice vpravo
    const forward = new THREE.Vector3().subVectors(target, cam.position);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();

    const pan = PAN_SPEED * dt;
    const move = new THREE.Vector3();
    if (keys.has('KeyW')) move.addScaledVector(forward, pan);
    if (keys.has('KeyS')) move.addScaledVector(forward, -pan);
    if (keys.has('KeyD')) move.addScaledVector(right, pan);
    if (keys.has('KeyA')) move.addScaledVector(right, -pan);
    if (keys.has('KeyE')) move.y += ELEV_SPEED * dt;
    if (keys.has('KeyQ')) move.y -= ELEV_SPEED * dt;
    cam.position.add(move);
    target.add(move);

    // zoom (ZX): dolly po ose pohledu — mění vzdálenost ke cíli, ne cíl
    if (keys.has('KeyZ') || keys.has('KeyX')) {
      const toTarget = new THREE.Vector3().subVectors(target, cam.position);
      const dist = toTarget.length();
      const dir = toTarget.normalize();
      let delta = 0;
      if (keys.has('KeyZ')) delta += ZOOM_SPEED * dt; // přiblížit
      if (keys.has('KeyX')) delta -= ZOOM_SPEED * dt; // oddálit
      const newDist = Math.max(MIN_DIST, dist - delta);
      cam.position.copy(target).addScaledVector(dir, -newDist);
    }
  }
}
