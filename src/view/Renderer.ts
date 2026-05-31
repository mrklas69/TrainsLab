import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Track } from '../sim/Track';
import type { Train } from '../sim/Train';

const CAR_WIDTH = 2.6;
const CAR_HEIGHT = 3.0;
const RAIL_RADIUS = 0.3;

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

// napětí ve spřáhle pod tímhle (N) bereme jako klid — marker zešedne, jas plný při FORCE_FULL
const FORCE_FULL = 400_000;
const DRAFT_COLOR = new THREE.Color(0xe01818); // tah (natažení) — červená
const BUFF_COLOR = new THREE.Color(0x3070ff);  // tlak (stlačení) — modrá
const SLACK_COLOR = new THREE.Color(0x707070); // ve vůli — neutrální šedá

// stav lokomotivy (priorita: prokluz > brzda > tah > volnoběh)
const LOCO_SLIP = new THREE.Color(0xe08010);  // prokluz hnacích kol — oranžová
const LOCO_BRAKE = new THREE.Color(0xc01818); // brzdí — červená
const LOCO_POWER = new THREE.Color(0x2e9e3f); // táhne (notch ≠ 0, drží adhezi) — zelená, max. účinnost
const LOCO_IDLE = new THREE.Color(0x555a5e);  // volnoběh (notch 0, nebrzdí) — neutrální šedá
const CAR_COLOR = new THREE.Color(0x2b5a8b);  // vagon — modrá
const DERAILED_COLOR = new THREE.Color(0x8a0f0f); // vykolejeno (převrácení) — tmavě rudá, celá souprava

// gradient blízkosti převrácení: skříň žhne podle tipRatio (příč/práh) daného vozu.
// Emissive (ne barva skříně) — izomorfní s markery spřáhel, nekoliduje se semaforem loko.
const DANGER_GLOW = new THREE.Color(0xff2a10); // žár blízkosti meze — oranžovo-červená
const MAX_GLOW = 0.9; // strop emissive, ať barva skříně úplně nezmizí

// tipRatio (0..1+) → intenzita žáru (0..1). Náběh až od ~30 % využité rezervy (klidná
// jízda nesvítí); smoothstep pro plynulý gradient k mezi. Převrácení řeší render zvlášť (žár 1).
function tipGlow(ratio: number): number {
  const t = Math.min(Math.max((ratio - 0.3) / 0.7, 0), 1); // 0.3 → 0, 1.0 → 1
  return t * t * (3 - 2 * t); // smoothstep — měkký náběh i doběh
}

/**
 * Renderer = čistá funkce stavu → obraz (DD-01). Drží ThreeJS scénu a každý
 * frame jen čte sim ({@link Body} na {@link Track}); nikdy stav nemění.
 */
export class Renderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly gl: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly carMeshes: THREE.Mesh[];
  private readonly couplerMeshes: THREE.Mesh[]; // marker napětí mezi sousedními vozy
  private trackMesh!: THREE.Mesh;                // tuba trati — přestavitelná sliderem sklonu
  private readonly heldKeys = new Set<string>(); // držené klávesy kamery (WASD/QE/ZX)

  // stav auto-kamery „dron" (toggle C): směr s hysterezí + tlumeně dohánčné pozice/pohled
  private droneActive = false;
  private droneDir = 1;                            // ±1 směr jízdy (hystereze u v≈0)
  private readonly dronePos = new THREE.Vector3(); // tlumená pozice kamery
  private readonly droneLook = new THREE.Vector3();// tlumený bod pohledu

  constructor(
    canvas: HTMLCanvasElement,
    private readonly track: Track,
    private readonly train: Train, // živý sim, čtený per-frame (symetrie s track)
    private readonly drone: DroneParams, // sdílená instance — slidery ji ladí za běhu
  ) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(window.devicePixelRatio);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(188, 175, 188); // dál — osmička je ~300 m napříč

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404030, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(50, 80, 30);
    this.scene.add(sun);

    this.buildGround();
    this.buildTrack();
    this.carMeshes = this.buildCars(train);
    this.couplerMeshes = this.buildCouplers(train);

    this.onResize();
    window.addEventListener('resize', () => this.onResize());

    // klávesy kamery: keydown drží, keyup pouští; blur vyčistí (jinak by klávesa
    // držená při ztrátě fokusu zůstala „zaseknutá"). Lokomotivu řídí jiný handler.
    window.addEventListener('keydown', (e) => {
      if (CAMERA_KEYS.includes(e.code)) this.heldKeys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.heldKeys.delete(e.code));
    window.addEventListener('blur', () => this.heldKeys.clear());
  }

  // čte sim stav a promítá ho do scény — žádný zápis do modelu.
  render(dt: number): void {
    const train = this.train;
    if (this.droneActive) this.updateDroneCamera(dt);
    else this.updateCamera(dt);
    train.bodies.forEach((body, i) => {
      const { position, tangent } = this.track.at(body.s);
      const mesh = this.carMeshes[i];
      mesh.position.copy(position);
      mesh.position.y += CAR_HEIGHT / 2 + RAIL_RADIUS;
      mesh.lookAt(mesh.position.clone().add(tangent)); // čelo (−Z) ve směru jízdy
      // kývání skříně: po orientaci podél tratě nakloň lokálně — pitch kolem příčné osy (X),
      // roll kolem podélné (Z). lookAt kvaternion každý frame resetuje, takže se náklon nehromadí.
      mesh.rotateX(body.pitch);
      mesh.rotateZ(body.roll);

      // barva: vykolejení přebíjí vše (celá souprava rudá); jinak lokomotiva
      // stavovým semaforem (prokluz > brzda > tah > volnoběh), vozy modré.
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(
        train.derailed ? DERAILED_COLOR :
        i !== 0 ? CAR_COLOR :
        train.slipping ? LOCO_SLIP :
        train.isBraking ? LOCO_BRAKE :
        train.notch !== 0 && train.steamPressure > 0 ? LOCO_POWER : // bez páry netáhne → zhasne
        LOCO_IDLE,
      );

      // gradient blízkosti převrácení: žár dle tipRatio tohoto vozu (per-vůz → výstraha
      // „cestuje" soupravou, jak vjíždí do oblouku). Vykolejeno = plný žár, spojitě navazuje.
      const glow = train.derailed ? 1 : tipGlow(train.tipRatio(i));
      mat.emissive.copy(DANGER_GLOW).multiplyScalar(glow * MAX_GLOW);
    });
    this.renderCouplers(train);
    if (!this.droneActive) this.controls.update(); // orbit damping jen mimo dron režim
    this.gl.render(this.scene, this.camera);
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

  /**
   * Auto-kamera „dron": sleduje soupravu zezadu-shora ve směru jízdy, kouká na její střed.
   * Pozici i pohled tlumeně dohání k cíli — reverz jen překlopí cíl na druhý konec a tlumení
   * udělá plynulý přelet (žádný zvláštní kód). Frame-rate independent: α = 1 − exp(−tuhost·dt).
   */
  private updateDroneCamera(dt: number): void {
    const v = this.train.speed;
    // hystereze směru: přebírej sign(v) jen za jízdy; u v≈0 drž poslední (jinak slack-houpání třese dronem)
    if (Math.abs(v) > V_DRONE_DIR) this.droneDir = Math.sign(v);
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    this.computeDroneTarget(targetPos, targetLook);
    const alpha = 1 - Math.exp(-this.drone.stiffness * dt); // tuhost dohánění, nezávislá na FPS
    this.dronePos.lerp(targetPos, alpha);
    this.droneLook.lerp(targetLook, alpha);
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
  private updateCamera(dt: number): void {
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

  // marker mezi vozy: pozice ve středu rozteče, barva dle režimu spřáhla
  // (draft/tah teplá, buff/tlak studená), jas ∝ napětí → slack run-out je vidět.
  private renderCouplers(train: Train): void {
    train.couplers.forEach((coupler, i) => {
      const front = train.bodies[i];
      const rear = train.bodies[i + 1];
      const mesh = this.couplerMeshes[i];
      mesh.position.copy(this.track.at((front.s + rear.s) / 2).position);
      mesh.position.y += RAIL_RADIUS + CAR_HEIGHT;

      const base = coupler.mode > 0 ? DRAFT_COLOR : coupler.mode < 0 ? BUFF_COLOR : SLACK_COLOR;
      const intensity = Math.min(Math.abs(coupler.force) / FORCE_FULL, 1);
      // ze šedé (klid) k plné barvě režimu podle napětí
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(SLACK_COLOR).lerp(base, intensity);
      mat.emissive.copy(base).multiplyScalar(intensity * 0.6);
    });
  }

  /** Přestaví tubu trati po změně sklonu (slider). Křivka už je v Track.rebuild(). */
  rebuildTrack(): void {
    this.trackMesh.geometry.dispose();
    this.trackMesh.geometry = new THREE.TubeGeometry(this.track.curve, 600, RAIL_RADIUS, 8, true);
  }

  private buildGround(): void {
    const geo = new THREE.PlaneGeometry(700, 700);
    geo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4a7c3a }));
    ground.position.y = -10; // pod nejnižším bodem trati
    this.scene.add(ground);
  }

  private buildTrack(): void {
    const geo = new THREE.TubeGeometry(this.track.curve, 600, RAIL_RADIUS, 8, true);
    this.trackMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x55564f }));
    this.scene.add(this.trackMesh);
  }

  // jeden malý marker na spřáhlo (N−1 pro N vozů); barvu řídí renderCouplers().
  private buildCouplers(train: Train): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < train.couplers.length; i++) {
      const geo = new THREE.SphereGeometry(0.7, 12, 8);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SLACK_COLOR }));
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  // kvádr na vůz; lokomotiva (index 0) červená, vozy modré.
  private buildCars(train: Train): THREE.Mesh[] {
    return train.bodies.map((body, i) => {
      const geo = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT, body.length);
      const color = i === 0 ? LOCO_IDLE : CAR_COLOR;
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
      this.scene.add(mesh);
      return mesh;
    });
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
