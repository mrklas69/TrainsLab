import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Track } from '../sim/Track';
import type { Train } from '../sim/Train';

const CAR_WIDTH = 2.6;
const CAR_HEIGHT = 3.0;
const RAIL_RADIUS = 0.3;

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

  constructor(
    canvas: HTMLCanvasElement,
    private readonly track: Track,
    train: Train,
  ) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(window.devicePixelRatio);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(150, 140, 150); // dál — osmička je ~240 m napříč

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
  }

  // čte sim stav a promítá ho do scény — žádný zápis do modelu.
  render(train: Train): void {
    train.bodies.forEach((body, i) => {
      const { position, tangent } = this.track.at(body.s);
      const mesh = this.carMeshes[i];
      mesh.position.copy(position);
      mesh.position.y += CAR_HEIGHT / 2 + RAIL_RADIUS;
      mesh.lookAt(mesh.position.clone().add(tangent)); // čelo (−Z) ve směru jízdy

      // barva: vykolejení přebíjí vše (celá souprava rudá); jinak lokomotiva
      // stavovým semaforem (prokluz > brzda > tah > volnoběh), vozy modré.
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(
        train.derailed ? DERAILED_COLOR :
        i !== 0 ? CAR_COLOR :
        train.slipping ? LOCO_SLIP :
        train.isBraking ? LOCO_BRAKE :
        train.notch !== 0 ? LOCO_POWER :
        LOCO_IDLE,
      );
    });
    this.renderCouplers(train);
    this.controls.update();
    this.gl.render(this.scene, this.camera);
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
