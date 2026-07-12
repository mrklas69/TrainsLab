import * as THREE from 'three';
import type { TrackNetwork } from '../sim/TrackNetwork';
import type { Train } from '../sim/Train';
import type { Body } from '../sim/Body';
import { buildCarModel, CAR_HEIGHT, CRANK_RADIUS, type CarType, type CarVisual } from './carModels';
import { SteamView, type WindParams } from './SteamView';
import { WorldView, RAIL_RADIUS } from './WorldView';
import { CameraController, type DroneParams } from './CameraController';
import type { ExhaustClock } from './ExhaustClock';

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
const DERAILED_COLOR = new THREE.Color(0x8a0f0f); // vykolejeno (převrácení) — tmavě rudá, celá souprava
const SLIP_SPIN_RATE = 26;  // rad/s — o kolik „závodí" hnací kola loko navíc při prokluzu (viditelný protáčející se)

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
 * Renderer = čistá funkce stavu → obraz (DD-01). Drží ThreeJS scénu a každý frame jen čte
 * sim ({@link Body} na {@link TrackNetwork}); nikdy stav nemění. Stará se o **aktéry** (vozy, markery
 * spřáhel, kouř) a render loop; statickou scénu (terén, dekorace, trať) drží {@link WorldView},
 * kameru {@link CameraController} (SLAP — vytaženo v S25/S31).
 */
export class Renderer {
  private readonly scene = new THREE.Scene();
  private readonly gl: THREE.WebGLRenderer;
  private readonly world: WorldView;            // statická scéna (terén + dekorace + trať/pilíře)
  private readonly cameraCtrl: CameraController; // veškeré řízení kamery (orbit/dron/WASD)
  private readonly carVisuals: CarVisual[]; // lowpoly modely vozů soupravy (group + tintovaný skin materiál)
  private readonly freeCarVisuals: CarVisual[]; // modely volných (nespřažených) vozů — odstavené na trati
  private readonly couplerMeshes: THREE.Mesh[]; // marker napětí mezi sousedními vozy
  private readonly steam: SteamView;        // měkké částice kouře a parních úniků lokomotivy
  private readonly lookTarget = new THREE.Vector3();   // přepoužitý buffer pro orientaci vozů (lookAt)

  // animace prokluzu hnacích kol loko (view-only): navýšení fáze otáčení, akumuluje se při slipping
  private driverSlipPhase = 0;
  // markery napětí ve spřáhlech (osciloskop slack action) — Lab nástroj, default skryté
  // (čistá scéna); checkbox v Nastavení je zapne (viz setCouplerMarkersVisible).
  private couplerMarkersVisible = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly network: TrackNetwork,
    private readonly train: Train, // živý sim, čtený per-frame (symetrie s network)
    drone: DroneParams, // sdílená instance kamery — předá se CameraControlleru (slidery ji ladí)
    wind: WindParams, // sdílené view parametry větru — SteamView je čte živě
    trackAmplitude: number, // počáteční amplituda terénu (slider sklonu) — terén vede trať (DD-20)
    private readonly carTypes: CarType[], // typ modelu per vůz (ryze view — DD-01); délka 1:1 s train.bodies
    private readonly freeCarTypes: CarType[], // typ modelu per volný vůz; 1:1 s train.freeBodies
    private readonly exhaust: ExhaustClock, // sdílený rytmus výfuku — kouř pufá v taktu se zvukem
  ) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(window.devicePixelRatio);

    this.cameraCtrl = new CameraController(canvas, network, train, drone);

    this.scene.background = new THREE.Color(0x87ceeb);
    // bělavý opar nad krajinou: dodá hloubku a změkčí dálku. Fog počítá vzdálenost od kamery →
    // souprava i blízké stromy zůstanou ostré, jen vzdálené facety blednou k oparu. Lineární:
    // čisté do `near`, plný opar od `far`. Dohlednost zdvojnásobena (260/680) — pozor: terénní
    // deska má poloměr ~350 m, takže za ní může její okraj prosvítat (řeší se zvětšením desky).
    this.scene.fog = new THREE.Fog(0xccd6dd, 260, 680);
    // nižší ambient + silnější slunce = směrový kontrast mezi facetami → lowpoly vzhled
    // (rovnoměrné světlo by faceting setřelo, i kdyby geometrie byla zubatá).
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404030, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(50, 80, 30);
    this.scene.add(sun);

    this.world = new WorldView(this.scene, network, trackAmplitude);
    this.carVisuals = this.buildCars(train.bodies, this.carTypes);
    this.freeCarVisuals = this.buildCars(train.freeBodies, this.freeCarTypes);
    this.couplerMeshes = this.buildCouplers(train);
    this.steam = new SteamView(this.scene, wind);

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  // čte sim stav a promítá ho do scény — žádný zápis do modelu.
  render(dt: number): void {
    const train = this.train;
    this.cameraCtrl.update(dt); // dron/orbit/WASD — kamera je samostatná view starost (SLAP)
    this.world.updateRouteIndicators(train.route, !train.routeCanChange);
    train.bodies.forEach((body, i) => {
      const vis = this.carVisuals[i];
      this.placeCar(body, vis, i === 0, dt); // umístění + orientace + náklon + valení kol (sdíleno s volnými)

      // barva skříně (skin materiál modelu): vykolejení přebíjí vše (celá souprava rudá);
      // jinak lokomotiva stavovým semaforem (prokluz > brzda > tah > volnoběh), vozy klidovou barvou typu.
      vis.skin.color.copy(
        train.derailed ? DERAILED_COLOR :
        i !== 0 ? vis.baseColor :
        train.slipping ? LOCO_SLIP :
        train.isBraking ? LOCO_BRAKE :
        train.notch !== 0 && train.steamPressure > 0 ? LOCO_POWER : // bez páry netáhne → zhasne
        LOCO_IDLE,
      );

      // gradient blízkosti převrácení: žár dle tipRatio tohoto vozu (per-vůz → výstraha
      // „cestuje" soupravou, jak vjíždí do oblouku). Vykolejeno = plný žár, spojitě navazuje.
      const glow = train.derailed ? 1 : tipGlow(train.tipRatio(i));
      vis.skin.emissive.copy(DANGER_GLOW).multiplyScalar(glow * MAX_GLOW);
    });

    // volné (nespřažené) vozy: klidová barva typu + žár blízkosti převrácení (po nárazu se
    // můžou rozjet do oblouku). Nemají stavový semafor (žádná trakce) ani prokluz kol.
    train.freeBodies.forEach((body, i) => {
      const vis = this.freeCarVisuals[i];
      this.placeCar(body, vis, false, dt);
      vis.skin.color.copy(train.derailed ? DERAILED_COLOR : vis.baseColor);
      const glow = train.derailed ? 1 : tipGlow(train.tipRatioOf(body));
      vis.skin.emissive.copy(DANGER_GLOW).multiplyScalar(glow * MAX_GLOW);
    });

    if (this.couplerMarkersVisible) this.renderCouplers(train); // skryté = nemutuj (zbytečná práce)

    // Kouř + pára lokomotivy: komín, válcové kohouty, rozvod a píšťala. Emisní body jsou
    // součást modelu, SteamView je převádí do world-space a drží částice nezávisle na lokomotivě.
    const loco = this.carVisuals[0];
    const power = train.throttleFraction * train.steamPressure;
    this.steam.update(dt, loco, {
      power,
      pressure: train.steamPressure,
      speed: train.speed,
      throttleOpen: train.notch !== 0,
      exhaustFired: this.exhaust.fired && train.notch !== 0 && train.steamPressure > 0,
      fireLit: train.coalFraction > 0,
    });

    this.gl.render(this.scene, this.cameraCtrl.camera);
  }

  /** Toggle auto-kamery „dron" (klávesa C) — deleguje na CameraController. */
  toggleDrone(): void {
    this.cameraCtrl.toggleDrone();
  }

  /** Krátký odběr páry píšťalou; zvuk spouští paralelně tatáž KeyAction v main. */
  triggerWhistleSteam(): void {
    this.steam.triggerWhistle();
  }

  /**
   * Vzdálenost kamery od lokomotivy ve world-space (m) — podklad pro distanční hlasitost zvuku
   * (AudioView). Bere world pozici loko z jejího modelu (nastaví ji render loop); o frame zpožděná
   * proti simu, což je pro hlasitost neznatelné.
   */
  get cameraDistance(): number {
    return this.cameraCtrl.camera.position.distanceTo(this.carVisuals[0].group.position);
  }

  /** Slider sklonu: přestav statickou scénu; síť už obnovil TrackNetwork.rebuild(). */
  rebuildWorld(amplitude: number): void {
    this.world.rebuild(amplitude);
  }

  /** Checkbox v Nastavení: zapni/vypni markery napětí ve spřáhlech (osciloskop slack action). */
  setCouplerMarkersVisible(visible: boolean): void {
    this.couplerMarkersVisible = visible;
    for (const m of this.couplerMeshes) m.visible = visible;
  }

  // marker mezi vozy: pozice ve středu rozteče, barva dle režimu spřáhla
  // (draft/tah teplá, buff/tlak studená), jas ∝ napětí → slack run-out je vidět.
  private renderCouplers(train: Train): void {
    train.couplers.forEach((coupler, i) => {
      const front = train.bodies[i];
      const rear = train.bodies[i + 1];
      const mesh = this.couplerMeshes[i];
      // střed mezi vozy z jejich world pozic (průměr lokálních s by přes hranici segmentu nesedl)
      mesh.position.copy(this.network.at(front).position).lerp(this.network.at(rear).position, 0.5);
      mesh.position.y += RAIL_RADIUS + CAR_HEIGHT;

      const base = coupler.mode > 0 ? DRAFT_COLOR : coupler.mode < 0 ? BUFF_COLOR : SLACK_COLOR;
      const intensity = Math.min(Math.abs(coupler.force) / FORCE_FULL, 1);
      // ze šedé (klid) k plné barvě režimu podle napětí
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(SLACK_COLOR).lerp(base, intensity);
      mat.emissive.copy(base).multiplyScalar(intensity * 0.6);
    });
  }

  // jeden malý marker na spřáhlo (N−1 pro N vozů); barvu řídí renderCouplers().
  private buildCouplers(train: Train): THREE.Mesh[] {
    // sdílená geometrie (všechny markery stejný tvar); materiál per kus — každý nese vlastní
    // barvu/jas napětí, který renderCouplers() mutuje podle režimu spřáhla.
    const geo = new THREE.SphereGeometry(0.7, 12, 8);
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < train.couplers.length; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SLACK_COLOR }));
      mesh.visible = this.couplerMarkersVisible; // default skryté — zapne checkbox v Nastavení
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  // Umístí model vozu na trať podle `s`: pozice + orientace (čelo podél tečny) + náklon skříně
  // (pitch/roll z kývání) + valení kol a hnacích spojnic. Sdíleno soupravou i volnými vozy (DRY);
  // `isLoco` zapíná prokluz hnacích kol (driverSlipPhase) a animaci spojnic.
  private placeCar(body: Body, vis: CarVisual, isLoco: boolean, dt: number): void {
    const { position, tangent } = this.network.at(body);
    const group = vis.group;
    group.position.copy(position);
    group.position.y += CAR_HEIGHT / 2 + RAIL_RADIUS;
    group.lookAt(this.lookTarget.copy(group.position).add(tangent)); // čelo (−Z) ve směru jízdy
    // kývání skříně: po orientaci podél tratě nakloň lokálně — pitch kolem příčné osy (X),
    // roll kolem podélné (Z). lookAt kvaternion každý frame resetuje, takže se náklon nehromadí.
    group.rotateX(body.pitch);
    group.rotateZ(body.roll);

    // valení kol: úhel ∝ ujetá dráha / poloměr. Loko při prokluzu navíc „závodí" — driverSlipPhase
    // se akumuluje, takže se hnací kola protáčejí rychleji než jede vlak (viditelný prokluz).
    if (isLoco && this.train.slipping) {
      // prokluz = obvodová rychlost kol > rychlost vlaku → kola se protáčejí ve směru valení,
      // jen rychleji (ne couvání!). Valecí fáze jde jako -s/r, takže tah vpřed (notch≥0) = záporný
      // přírůstek (kola „vpřed"), reverz (notch<0) = kladný.
      const dir = this.train.notch >= 0 ? -1 : 1;
      this.driverSlipPhase += dir * SLIP_SPIN_RATE * dt;
    }
    // valecí fáze z globální arc-length (spojitá přes hranice segmentů — lokální s by skákalo)
    const phase = -this.network.globalS(body) / vis.wheelRadius + (isLoco ? this.driverSlipPhase : 0);
    for (const w of vis.wheels) w.rotation.x = phase * vis.wheelDir;
    // hnací spojnice loko: čep kliky obíhá kolem středu kola → tyč krouží v rovině Y-Z.
    // Záporná fáze ladí směr obíhání s otáčením kol (jinak by se spojnice točila opačně).
    for (const rod of vis.rods) {
      rod.position.y = vis.rodBaseY + CRANK_RADIUS * Math.sin(-phase);
      rod.position.z = CRANK_RADIUS * Math.cos(-phase);
    }
  }

  // lowpoly model na každé těleso dle typu (loko/cisterna/skříň/otevřený). Délku bere ze sim
  // tělesa (per vůz). Sdílené pro soupravu i volné vozy. Barvu skříně řídí render loop.
  private buildCars(bodies: readonly Body[], types: CarType[]): CarVisual[] {
    return bodies.map((body, i) => {
      const vis = buildCarModel(types[i], body.length);
      this.scene.add(vis.group);
      return vis;
    });
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h);
    this.cameraCtrl.setAspect(w, h);
  }

  /** Uklízí Three.js zdroje a event listenery (DD-01). */
  dispose(): void {
    this.cameraCtrl.dispose();
    this.scene.clear();
    this.gl.dispose();
    this.steam.dispose?.();
    this.world.dispose?.();
  }
}
