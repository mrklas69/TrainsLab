import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Track } from '../sim/Track';
import type { Train } from '../sim/Train';
import { terrainHeight, smoothstep } from '../sim/terrain';

const CAR_WIDTH = 2.6;
const CAR_HEIGHT = 3.0;
const RAIL_RADIUS = 0.12;   // poloměr trubky kolejnice (m) — štíhlá pro párový vzhled (dřív 0.3 = jedna tuba)
const RAIL_GAUGE = 1.7;     // vizuální rozchod kolejnic (m) — širší než fyzický 1.435 pro čitelnost pod vozy
const SLEEPER_SPACING = 3;  // rozteč pražců podél trati (m)
const SLEEPER_COLOR = 0x5a4632; // pražec — hnědá
const PIER_SPACING = 6;     // rozteč mostních pilířů podél trati (m)
const PIER_MIN_CLEARANCE = 1.2; // nad tímhle převýšením trati nad terénem už staví pilíř (m)
const PIER_COLOR = 0x807a70; // pilíř — betonová šeď

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

// ── Lowpoly terén — view část (výškovou matematiku drží sim/terrain.ts, DD-20) ─────────
// Mesh rozměr/hustota a barvení facet podle výšky jsou ryze render; výšku čteme z terrainHeight.
const TERRAIN_SIZE = 700; // m — rozměr desky
const TERRAIN_SEG = 48;   // dílků na stranu (~14,6 m/dílek) — velké facety = výraznější lowpoly

const MEADOW_COLOR = new THREE.Color(0x4a7c3a); // údolí / pod tratí — zelená
const FOREST_COLOR = new THREE.Color(0x35602a); // svahy — tmavší zeleň
const ROCK_COLOR = new THREE.Color(0x6e6b60);   // vrcholky — holá skála

// Barva facety podle výšky: louka → les → skála. Plní `out`, ať se nealokuje per-vrchol.
function terrainColor(y: number, out: THREE.Color): void {
  if (y <= 5) out.copy(MEADOW_COLOR);
  else if (y < 22) out.copy(MEADOW_COLOR).lerp(FOREST_COLOR, (y - 5) / 17);
  else out.copy(FOREST_COLOR).lerp(ROCK_COLOR, smoothstep(22, 45, y));
}

// ── Stromy & kameny (lowpoly dekorace, čistě view) ───────────────────────────────────
const SCENERY_STEP = 22;     // m — rozteč mřížky kandidátních míst pro dekoraci
const SCENERY_MIN_R = 180;   // m — blíž ke středu nic nesázíme (zóna trati, osmička sahá k ~150)
const SCENERY_MAX_R = 340;   // m — za horizontem desky už taky ne
const TREE_LINE = 34;        // m — nad touhle výškou jen kameny (skála), pod ní převažují stromy
const TRUNK_COLOR = 0x5a3d28;  // kmen — hnědá
const CROWN_COLOR = 0x2f6b2a;  // koruna — sytě zelená (vyniká nad loukou)
const ROCK_DECO_COLOR = 0x8a857c; // kámen — světle šedá

// Deterministický „šum" z indexu pro rozmístění dekorace (žádný Math.random → stabilní svět).
// Vrací [0, 1). Různé `seed` dají nezávislé proudy (pozice × velikost × výběr stromu/kamene).
function hash(i: number, seed: number): number {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
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
  private trackGroup!: THREE.Group;             // dvě kolejnice + pražce — přestavitelné sliderem sklonu
  private terrainMesh!: THREE.Mesh;             // lowpoly heightfield — přestavitelný sliderem sklonu
  private sceneryGroup!: THREE.Group;           // stromy + kameny — sedí na terénu (rebuild se sklonem)
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
    trackAmplitude: number, // počáteční amplituda terénu (slider sklonu) — terén vede trať (DD-20)
  ) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(window.devicePixelRatio);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(188, 175, 188); // dál — osmička je ~300 m napříč

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.background = new THREE.Color(0x87ceeb);
    // nižší ambient + silnější slunce = směrový kontrast mezi facetami → lowpoly vzhled
    // (rovnoměrné světlo by faceting setřelo, i kdyby geometrie byla zubatá).
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404030, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(50, 80, 30);
    this.scene.add(sun);

    this.buildTerrain(trackAmplitude);
    this.buildScenery(trackAmplitude);
    this.buildTrack(trackAmplitude);
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

  /** Přestaví trať po změně sklonu (slider). Křivka už je v Track.rebuild(). */
  rebuildTrack(amplitude: number): void {
    // dispose staré geometrie (kolejnice = Tube, pražce/pilíře = InstancedMesh) než vyčistíme group
    this.trackGroup.children.forEach((c) => {
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    });
    this.trackGroup.clear();
    this.populateTrack(amplitude);
  }

  private buildTrack(amplitude: number): void {
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);
    this.populateTrack(amplitude);
  }

  // Naplní group dvěma kolejnicemi (osa ± rozchod/2 do horizontální kolmice), pražci a
  // mostními pilíři (kde se trať odlepí od terénu). Sim zná jen osu koleje (track.curve,
  // DD-02); kolejnice jsou ryze vizuální offset. `amplitude` pro výšku terénu pod pilíři.
  private populateTrack(amplitude: number): void {
    const curve = this.track.curve;
    const N = 400; // vzorků podél trati — hustota offset křivek i tuby
    const leftPts: THREE.Vector3[] = [];
    const rightPts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const right = new THREE.Vector3().crossVectors(tan, UP).normalize(); // horizontální kolmice
      leftPts.push(p.clone().addScaledVector(right, -RAIL_GAUGE / 2));
      rightPts.push(p.clone().addScaledVector(right, RAIL_GAUGE / 2));
    }
    const railMat = new THREE.MeshStandardMaterial({ color: 0x55564f });
    for (const pts of [leftPts, rightPts]) {
      const railCurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
      const geo = new THREE.TubeGeometry(railCurve, N, RAIL_RADIUS, 6, true);
      this.trackGroup.add(new THREE.Mesh(geo, railMat));
    }

    // pražce: InstancedMesh kvádrů napříč tratí (osa X = příčně, Z = podél tečny).
    const count = Math.max(1, Math.floor(this.track.length / SLEEPER_SPACING));
    const sleeperGeo = new THREE.BoxGeometry(RAIL_GAUGE + 0.5, 0.08, 0.35);
    const sleepers = new THREE.InstancedMesh(sleeperGeo, new THREE.MeshStandardMaterial({ color: SLEEPER_COLOR }), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const x = new THREE.Vector3();
    const y = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p = curve.getPointAt(u);
      const z = curve.getTangentAt(u).normalize(); // podél trati
      x.crossVectors(UP, z).normalize();            // příčně (rozchod)
      y.crossVectors(z, x).normalize();             // ~svisle (kolmo na trať)
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      m.compose(p, q, scale);
      sleepers.setMatrixAt(i, m);
    }
    this.trackGroup.add(sleepers);

    this.buildPiers(amplitude);
  }

  // Mostní pilíře: tam, kde se trať odlepí od terénu (most nad podjezdem), postaví svislou
  // podpěru od povrchu ke kolejím. Emergentní — žádná znalost „kde je most"; staví se podle
  // skutečného převýšení trati nad terénem (funguje i pro budoucí estakády/náspy).
  private buildPiers(amplitude: number): void {
    const curve = this.track.curve;
    const count = Math.floor(this.track.length / PIER_SPACING);
    const pts: THREE.Vector3[] = [];
    const tangents: THREE.Vector3[] = [];
    const heights: number[] = [];
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p = curve.getPointAt(u);
      const clearance = p.y - terrainHeight(p.x, p.z, amplitude);
      if (clearance > PIER_MIN_CLEARANCE) {
        pts.push(p);
        tangents.push(curve.getTangentAt(u).normalize());
        heights.push(clearance);
      }
    }
    if (pts.length === 0) return; // plochá trať (slider sklonu ↓) → žádné pilíře

    // box 1×1×1, výšku (Y) škálujeme per pilíř na převýšení; stojí svisle, natočený podél trati
    const piers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(RAIL_GAUGE + 0.8, 1, 0.8),
      new THREE.MeshStandardMaterial({ color: PIER_COLOR }),
      pts.length,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const x = new THREE.Vector3();
    const z = new THREE.Vector3();
    const pos = new THREE.Vector3();
    pts.forEach((p, i) => {
      const h = heights[i];
      x.crossVectors(UP, tangents[i]).normalize(); // napříč (rozchod)
      z.crossVectors(x, UP).normalize();           // podél (≈ tečna, ortonormální k UP)
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, UP, z));
      pos.set(p.x, p.y - h / 2, p.z); // střed pilíře mezi terénem a kolejí
      m.compose(pos, q, new THREE.Vector3(1, h, 1));
      piers.setMatrixAt(i, m);
    });
    this.trackGroup.add(piers);
  }

  /** Přestaví terén i dekoraci po změně sklonu (slider) — vše drží zákryt (čte terrainHeight). */
  rebuildTerrain(amplitude: number): void {
    this.terrainMesh.geometry.dispose();
    this.scene.remove(this.terrainMesh);
    this.buildTerrain(amplitude);

    this.sceneryGroup.children.forEach((c) => { if (c instanceof THREE.Mesh) c.geometry.dispose(); });
    this.scene.remove(this.sceneryGroup);
    this.buildScenery(amplitude);
  }

  // Lowpoly stromy (kužel koruna + válec kmen) a kameny (ikosaedr) na svazích mimo trať.
  // Deterministická mřížka s jitterem (hash) → stabilní svět; vše InstancedMesh, sedí na terénu.
  private buildScenery(amplitude: number): void {
    this.sceneryGroup = new THREE.Group();
    type Spot = { x: number; z: number; y: number; scale: number; rot: number };
    const trees: Spot[] = [];
    const rocks: Spot[] = [];

    const half = TERRAIN_SIZE / 2;
    let idx = 0;
    for (let gx = -half; gx <= half; gx += SCENERY_STEP) {
      for (let gz = -half; gz <= half; gz += SCENERY_STEP) {
        idx++;
        if (hash(idx, 0) > 0.62) continue; // ~38 % míst osázeno (řidší, ne pravidelná mřížka)
        const x = gx + (hash(idx, 1) - 0.5) * SCENERY_STEP; // jitter z pravidelné mřížky
        const z = gz + (hash(idx, 2) - 0.5) * SCENERY_STEP;
        const r = Math.hypot(x, z);
        if (r < SCENERY_MIN_R || r > SCENERY_MAX_R) continue; // ne na trať, ne za desku
        const y = terrainHeight(x, z, amplitude);
        const spot: Spot = { x, z, y, scale: 0.7 + hash(idx, 3) * 0.8, rot: hash(idx, 4) * Math.PI * 2 };
        // nad horní hranicí lesa skály, pod ní převážně stromy (občas balvan i v lese)
        if (y > TREE_LINE || hash(idx, 5) > 0.8) rocks.push(spot);
        else trees.push(spot);
      }
    }

    this.addTrees(trees);
    this.addRocks(rocks);
    this.scene.add(this.sceneryGroup);
  }

  // strom = kmen (válec) + koruna (kužel), dvě InstancedMesh sdílející transformace míst.
  private addTrees(spots: { x: number; z: number; y: number; scale: number; rot: number }[]): void {
    if (spots.length === 0) return;
    const TRUNK_H = 2.5, CROWN_H = 8, CROWN_R = 3;
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.6, TRUNK_H, 5);
    const crownGeo = new THREE.ConeGeometry(CROWN_R, CROWN_H, 6); // 6 stěn = lowpoly jehličnan
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: TRUNK_COLOR, flatShading: true }), spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: CROWN_COLOR, flatShading: true }), spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const s = new THREE.Vector3();
    spots.forEach((sp, i) => {
      q.setFromAxisAngle(UP, sp.rot);
      s.set(sp.scale, sp.scale, sp.scale);
      pos.set(sp.x, sp.y + (TRUNK_H / 2) * sp.scale, sp.z); // kmen půlkou nad terénem
      trunks.setMatrixAt(i, m.compose(pos, q, s));
      pos.set(sp.x, sp.y + (TRUNK_H + CROWN_H / 2) * sp.scale, sp.z); // koruna nad kmenem
      crowns.setMatrixAt(i, m.compose(pos, q, s));
    });
    this.sceneryGroup.add(trunks, crowns);
  }

  // kámen = ikosaedr (20 facet) zploštělý, napůl zapuštěný do terénu.
  private addRocks(spots: { x: number; z: number; y: number; scale: number; rot: number }[]): void {
    if (spots.length === 0) return;
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.6, 0),
      new THREE.MeshStandardMaterial({ color: ROCK_DECO_COLOR, flatShading: true }),
      spots.length,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const s = new THREE.Vector3();
    spots.forEach((sp, i) => {
      q.setFromAxisAngle(UP, sp.rot);
      s.set(sp.scale * 1.3, sp.scale * 0.8, sp.scale * 1.3); // zploštělý balvan
      pos.set(sp.x, sp.y + 0.3 * sp.scale, sp.z); // napůl zapuštěný
      rocks.setMatrixAt(i, m.compose(pos, q, s));
    });
    this.sceneryGroup.add(rocks);
  }

  // Lowpoly terén: zvlněný heightfield s faceted shadingem (flatShading), barvený
  // per-facetu podle výšky (louka/les/skála). `amplitude` škáluje vlny (slider sklonu).
  private buildTerrain(amplitude: number): void {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEG, TERRAIN_SEG);
    geo.rotateX(-Math.PI / 2); // do roviny XZ, +Y nahoru
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i), amplitude));
    }

    // toNonIndexed rozpojí sdílené vrcholy → každá faceta má vlastní 3 vrcholy:
    // dovolí ostré per-facetu barvy (lowpoly look) i korektní flat normály.
    const mesh = geo.toNonIndexed();
    mesh.computeVertexNormals();

    // barva po trojúhelníku (3 vrcholy = 1 faceta): průměrná výška → jeden odstín na facetu.
    const fp = mesh.attributes.position;
    const colors = new Float32Array(fp.count * 3);
    const c = new THREE.Color();
    for (let t = 0; t < fp.count; t += 3) {
      const yAvg = (fp.getY(t) + fp.getY(t + 1) + fp.getY(t + 2)) / 3;
      terrainColor(yAvg, c);
      for (let k = 0; k < 3; k++) {
        colors[(t + k) * 3] = c.r;
        colors[(t + k) * 3 + 1] = c.g;
        colors[(t + k) * 3 + 2] = c.b;
      }
    }
    mesh.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
    this.terrainMesh = new THREE.Mesh(mesh, mat);
    this.scene.add(this.terrainMesh);
  }

  // jeden malý marker na spřáhlo (N−1 pro N vozů); barvu řídí renderCouplers().
  private buildCouplers(train: Train): THREE.Mesh[] {
    // sdílená geometrie (všechny markery stejný tvar); materiál per kus — každý nese vlastní
    // barvu/jas napětí, který renderCouplers() mutuje podle režimu spřáhla.
    const geo = new THREE.SphereGeometry(0.7, 12, 8);
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < train.couplers.length; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SLACK_COLOR }));
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  // kvádr na vůz; lokomotiva (index 0) šedá (volnoběh — semafor řídí render), vozy modré.
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
