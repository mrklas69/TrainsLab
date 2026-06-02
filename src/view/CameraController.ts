import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TrackNetwork } from '../sim/TrackNetwork';
import type { Train } from '../sim/Train';
import { CAR_HEIGHT } from './carModels';

// klávesové ovládání kamery (vedle myší orbitace) — plynulý pohyb při držení klávesy.
const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyX'];
const PAN_SPEED = 120;  // m/s — posun v rovině (WASD)
const ELEV_SPEED = 90;  // m/s — výška (QE)
const ZOOM_SPEED = 120; // m/s — přiblížení/oddálení (ZX, drženo)
const WHEEL_ZOOM_STEP = 4; // m na zaškrt kolečka myši (zoom v dron režimu)
const MIN_DIST = 5;     // m — minimální odstup od cíle (nezoomovat skrz)

// auto-kamera „dron" — laditelné knoby (Lab, izomorfní s vypružením skříně). Ryze view:
// kamera nikdy nevstupuje do simu (DD-01), proto vlastní typ mimo PhysicsParams.
export interface DroneParams {
  height: number;     // výška dronu nad lokomotivou (m)
  distance: number;   // poloměr kroužení kolem lokomotivy (m)
  stiffness: number;  // tuhost dohánění cíle (1/s) — jak ostře dron sleduje pohyb vlaku
  orbitSpeed: number; // úhlová rychlost kroužení kolem lokomotivy (rad/s); 0 = stojí na místě
}
export const DEFAULT_DRONE: DroneParams = { height: 18, distance: 35, stiffness: 2, orbitSpeed: 0.3 };

/**
 * CameraController = veškeré řízení kamery (čistě view, DD-01) vytažené z Rendereru
 * (SLAP — Renderer staví svět a kreslí aktéry, kamera je samostatná starost).
 *
 * Dva režimy přepínané klávesou C:
 *  - **ruční** — myší orbit ({@link OrbitControls}) + klávesy WASD/QE/ZX,
 *  - **dron** — auto-kamera krouží kolem jedoucí lokomotivy a kouká na ni; myší orbit
 *    a posun vypnuté, aktivní zůstává jen Z/X zoom (mění poloměr kroužení).
 *
 * Drží vlastní {@link camera}; Renderer ji jen čte při `gl.render`. Sám si registruje
 * posluchače kláves (keydown/keyup/blur) — symetricky s tím, jak je dřív držel Renderer.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly heldKeys = new Set<string>(); // držené klávesy kamery (WASD/QE/ZX)

  // stav auto-kamery „dron" (toggle C): úhel kroužení + tlumeně dohánčné pozice/pohled
  private droneActive = false;
  private orbitAngle = 0;                          // azimut kroužení kolem soupravy (rad), roste časem
  private readonly dronePos = new THREE.Vector3(); // tlumená pozice kamery
  private readonly droneLook = new THREE.Vector3();// tlumený bod pohledu
  // přepoužitelné buffery cíle dronu (žádná alokace per-frame — izomorfní s chimneyWorld v Rendereru)
  private readonly targetPos = new THREE.Vector3();
  private readonly targetLook = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly network: TrackNetwork,
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

    // kolečko myši v dron režimu = zoom (poloměr kroužení). V ručním režimu si wheel bere
    // OrbitControls sám (necháme ho), tady jen pro dron. passive:false kvůli preventDefault.
    canvas.addEventListener('wheel', (e) => {
      if (!this.droneActive) return; // ruční režim: zoom řeší OrbitControls
      e.preventDefault();            // nescrolluj stránku
      this.adjustOrbitRadius(Math.sign(e.deltaY) * WHEEL_ZOOM_STEP); // dolů = oddálit (konvence OrbitControls)
    }, { passive: false });
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
   * Auto-kamera „dron": krouží kolem jedoucí lokomotivy konstantní úhlovou rychlostí
   * (orbitSpeed), drží poloměr (distance) i výšku, kouká na lokomotivu. Loko ujíždí → střed
   * orbity jede s ní. Pozici i pohled tlumeně dohání k cíli (stiffness), aby sledování pohybu
   * vlaku bylo hladké. Frame-rate independent: úhel ∝ dt, dohánění α = 1 − exp(−tuhost·dt).
   * Z/X zoomují i v dronu — mění poloměr kroužení (jediné aktivní klávesy v tomto režimu).
   */
  private updateDroneCamera(dt: number): void {
    // zoom v dronu: Z přibliž / X oddal (drženo) — stejný vstup jako kolečko myši (adjustOrbitRadius)
    if (this.heldKeys.has('KeyZ')) this.adjustOrbitRadius(-ZOOM_SPEED * dt);
    if (this.heldKeys.has('KeyX')) this.adjustOrbitRadius(ZOOM_SPEED * dt);

    this.orbitAngle += this.drone.orbitSpeed * dt; // posun azimutu kroužení (nezávislý na FPS)
    this.computeDroneTarget(this.targetPos, this.targetLook);
    const alpha = 1 - Math.exp(-this.drone.stiffness * dt); // tuhost dohánění, nezávislá na FPS
    this.dronePos.lerp(this.targetPos, alpha);
    this.droneLook.lerp(this.targetLook, alpha);
    this.applyDrone();
  }

  /** Cílová pozice kamery (na kružnici kolem lokomotivy) a bod pohledu (lokomotiva) pro aktuální orbitAngle. */
  private computeDroneTarget(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    // střed orbity i bod pohledu = lokomotiva (čelo soupravy, bodies[0]) — kamera krouží kolem ní
    outLook.copy(this.network.positionAt(this.train.bodies[0]));
    // pozice: bod na kružnici poloměru `distance` v horizontální rovině + výška nad loko
    outPos.set(
      outLook.x + Math.cos(this.orbitAngle) * this.drone.distance,
      outLook.y + this.drone.height,
      outLook.z + Math.sin(this.orbitAngle) * this.drone.distance,
    );
    outLook.y += CAR_HEIGHT; // mířit na skříň, ne na temeno koleje
  }

  /** Zoom v dron režimu: změna poloměru kroužení (jediný zdroj „přibliž/oddal" — sdílí ZX i kolečko). */
  private adjustOrbitRadius(delta: number): void {
    this.drone.distance = Math.max(MIN_DIST, this.drone.distance + delta);
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
