import * as THREE from 'three';
import type { Track } from '../sim/Track';
import type { Train } from '../sim/Train';
import { buildCarModel, CAR_HEIGHT, CRANK_RADIUS, type CarType, type CarVisual } from './carModels';
import { SmokeView } from './SmokeView';
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
 * sim ({@link Body} na {@link Track}); nikdy stav nemění. Stará se o **aktéry** (vozy, markery
 * spřáhel, kouř) a render loop; statickou scénu (terén, dekorace, trať) drží {@link WorldView},
 * kameru {@link CameraController} (SLAP — vytaženo v S25/S31).
 */
export class Renderer {
  private readonly scene = new THREE.Scene();
  private readonly gl: THREE.WebGLRenderer;
  private readonly world: WorldView;            // statická scéna (terén + dekorace + trať/pilíře)
  private readonly cameraCtrl: CameraController; // veškeré řízení kamery (orbit/dron/WASD)
  private readonly carVisuals: CarVisual[]; // lowpoly modely vozů (group + tintovaný skin materiál)
  private readonly couplerMeshes: THREE.Mesh[]; // marker napětí mezi sousedními vozy
  private readonly smoke: SmokeView;        // faceted kouř z komína loko (čistě view)
  private readonly chimneyWorld = new THREE.Vector3(); // přepoužitý buffer pro world pozici ústí komína
  private readonly lookTarget = new THREE.Vector3();   // přepoužitý buffer pro orientaci vozů (lookAt)

  // animace prokluzu hnacích kol loko (view-only): navýšení fáze otáčení, akumuluje se při slipping
  private driverSlipPhase = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly track: Track,
    private readonly train: Train, // živý sim, čtený per-frame (symetrie s track)
    drone: DroneParams, // sdílená instance kamery — předá se CameraControlleru (slidery ji ladí)
    trackAmplitude: number, // počáteční amplituda terénu (slider sklonu) — terén vede trať (DD-20)
    private readonly carTypes: CarType[], // typ modelu per vůz (ryze view — DD-01); délka 1:1 s train.bodies
    private readonly exhaust: ExhaustClock, // sdílený rytmus výfuku — kouř pufá v taktu se zvukem
  ) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(window.devicePixelRatio);

    this.cameraCtrl = new CameraController(canvas, track, train, drone);

    this.scene.background = new THREE.Color(0x87ceeb);
    // nižší ambient + silnější slunce = směrový kontrast mezi facetami → lowpoly vzhled
    // (rovnoměrné světlo by faceting setřelo, i kdyby geometrie byla zubatá).
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404030, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(50, 80, 30);
    this.scene.add(sun);

    this.world = new WorldView(this.scene, track, trackAmplitude);
    this.carVisuals = this.buildCars(train);
    this.couplerMeshes = this.buildCouplers(train);
    this.smoke = new SmokeView(this.scene);

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  // čte sim stav a promítá ho do scény — žádný zápis do modelu.
  render(dt: number): void {
    const train = this.train;
    this.cameraCtrl.update(dt); // dron/orbit/WASD — kamera je samostatná view starost (SLAP)
    train.bodies.forEach((body, i) => {
      const { position, tangent } = this.track.at(body.s);
      const vis = this.carVisuals[i];
      const group = vis.group;
      group.position.copy(position);
      group.position.y += CAR_HEIGHT / 2 + RAIL_RADIUS;
      group.lookAt(this.lookTarget.copy(group.position).add(tangent)); // čelo (−Z) ve směru jízdy
      // kývání skříně: po orientaci podél tratě nakloň lokálně — pitch kolem příčné osy (X),
      // roll kolem podélné (Z). lookAt kvaternion každý frame resetuje, takže se náklon nehromadí.
      group.rotateX(body.pitch);
      group.rotateZ(body.roll);

      // valení kol: úhel ∝ ujetá dráha / poloměr (každý vůz dle své pozice s).
      // Loko při prokluzu navíc „závodí" — driverSlipPhase se akumuluje, takže se hnací kola
      // protáčejí rychleji než jede vlak (viditelný prokluz) a spojnice zběsile krouží.
      if (i === 0 && train.slipping) {
        const dir = train.notch >= 0 ? 1 : -1; // směr protáčení dle stupně regulátoru (reverz = couvá)
        this.driverSlipPhase += dir * SLIP_SPIN_RATE * dt;
      }
      const phase = -body.s / vis.wheelRadius + (i === 0 ? this.driverSlipPhase : 0);
      for (const w of vis.wheels) w.rotation.x = phase * vis.wheelDir;
      // hnací spojnice loko: čep kliky obíhá kolem středu kola → tyč krouží v rovině Y-Z.
      // Záporná fáze ladí směr obíhání s otáčením kol (jinak by se spojnice točila opačně).
      for (const rod of vis.rods) {
        rod.position.y = vis.rodBaseY + CRANK_RADIUS * Math.sin(-phase);
        rod.position.z = CRANK_RADIUS * Math.cos(-phase);
      }

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
    this.renderCouplers(train);

    // kouř z komína loko: emisní bod = world pozice ústí (getWorldPosition vyřeší flip/náklon
    // za nás). Pufá v taktu výfuku (ExhaustClock) jen pod párou; mimo páru jen líný idle kouř.
    // Hustota/velikost/tmavost ∝ otevření regulátoru × parní tlak (bez páry není co kouřit).
    const loco = this.carVisuals[0];
    if (loco.chimneyTip) {
      loco.chimneyTip.getWorldPosition(this.chimneyWorld);
      const power = train.throttleFraction * train.steamPressure;
      // puf jen pod párou — sladěno se zvukovým chuffem (týž ExhaustClock, izomorfní podmínka).
      // power už nese steamPressure (puf zhasne při pára=0), flag to drží explicitně na jednom místě.
      // fireLit (je uhlí) řídí idle kouř: vyhaslý kotel nekouří, kotel bez vody kouří dál.
      this.smoke.update(
        dt, this.chimneyWorld, power,
        this.exhaust.fired && train.notch !== 0 && train.steamPressure > 0,
        train.coalFraction > 0,
      );
    }

    this.gl.render(this.scene, this.cameraCtrl.camera);
  }

  /** Toggle auto-kamery „dron" (klávesa C) — deleguje na CameraController. */
  toggleDrone(): void {
    this.cameraCtrl.toggleDrone();
  }

  /** Slider sklonu: přestav statickou scénu (terén + dekorace + trať). Křivka už je v Track.rebuild(). */
  rebuildWorld(amplitude: number): void {
    this.world.rebuild(amplitude);
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

  // lowpoly model na každý vůz dle typu z `carTypes` (loko/cisterna/skříň/otevřený).
  // Délku bere ze sim tělesa (per vůz). Barvu skříně řídí render loop: loko semaforem, vozy klidovou.
  private buildCars(train: Train): CarVisual[] {
    return train.bodies.map((body, i) => {
      const vis = buildCarModel(this.carTypes[i], body.length);
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
}
