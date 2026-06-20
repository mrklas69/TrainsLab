import * as THREE from 'three';
import type { RouteId, TrackNetwork } from '../sim/TrackNetwork';
import type { TrackCurve } from '../sim/TrackSegment';
import { SERVICE_SEG, SERVICE_U } from '../sim/serviceSite';
import { terrainHeight, smoothstep } from '../sim/terrain';

// WorldView = statická scéna kolem soupravy (terén, dekorace, trať/pilíře) jako samostatná
// view vrstva (SLAP) — vytaženo z Rendereru (S31), aby Renderer řešil jen aktéry (vozy, spřáhla,
// kouř, kamera) a render loop. Drží DD-01: čistě view, sim zná jen síť os kolejí (DD-02/DD-25).
//
// Vše „postaveno jednou" v konstruktoru; slider sklonu přestaví terén i trať přes {@link rebuild}
// (výškovou matematiku drží `sim/terrain.ts`, mesh/barvy jsou ryze render).

const RAIL_GAUGE = 1.7;     // vizuální rozchod kolejnic (m) — širší než fyzický 1.435 pro čitelnost pod vozy
const SLEEPER_SPACING = 1.5; // rozteč pražců podél trati (m) — hustší (2× víc pražců)
const SLEEPER_COLOR = 0x5a4632; // pražec — hnědá
const PIER_SPACING = 12;    // rozteč mostních pilířů podél trati (m) — řidší (poloviční počet)
const PIER_MIN_CLEARANCE = 1.2; // nad tímhle převýšením trati nad terénem už staví pilíř (m)
const PIER_COLOR = 0x807a70; // pilíř i mostovka — betonová šeď (jeden most = jedna konstrukce)
const DECK_SPACING = 2;     // rozteč segmentů mostovky podél trati (m) — hustá, segmenty se překrývají
const DECK_THICKNESS = 0.4; // tloušťka nosníku mostovky (m)
const DECK_DROP = 0.35;     // o kolik je střed mostovky pod osou koleje (m) — sedí pod pražci
const SWITCH_STAND_OFFSET = 5.2; // m — výměnový terč vedle koleje, mimo průjezdný profil
const ROUTE_MAIN_COLOR = new THREE.Color(0x35a05a);   // hlavní trasa — zelená
const ROUTE_BRANCH_COLOR = new THREE.Color(0xd6a33a); // odbočka — okrová jako mechanický terč
const ROUTE_LOCK_COLOR = new THREE.Color(0xc33a2e);   // zámek při obsazené výhybce — červená
const SERVICE_SITE_OFFSET = 11;    // m — odstup od osy odbočky; bouda je mimo průjezdný profil
const SERVICE_CRANE_OFFSET = 6.8;  // m — sloup je blíž ke koleji, rameno dosáhne nad tendr
const SERVICE_PAD_COLOR = 0x6b6254;
const SERVICE_HOUSE_COLOR = 0x9a6a42;
const SERVICE_ROOF_COLOR = 0x6e2b24;
const SERVICE_DARK_COLOR = 0x2c241d;
const SERVICE_WINDOW_COLOR = 0x9fc4d0;
const SERVICE_METAL_COLOR = 0x415b62;
const SERVICE_COAL_COLOR = 0x171717;

// poloměr trubky kolejnice (m) — štíhlá pro párový vzhled. Exportováno: render loop i markery
// spřáhel ho potřebují jako výšku temene koleje nad osou (vozy sedí na koleji).
export const RAIL_RADIUS = 0.12;

// svislá osa — kolmice pro offset kolejnic, orientaci pražců/pilířů a rozmístění dekorace.
const UP = new THREE.Vector3(0, 1, 0);

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
const SCENERY_STEP = 18;     // m — rozteč mřížky kandidátních míst pro dekoraci (hustší = víc zeleně)
const SCENERY_MAX_R = 340;   // m — za horizontem desky už nesázíme
// kolem osy trati nic nesázíme, aby strom/kámen nestál na koleji (vlak by jím projížděl). Práh =
// rozchod + koruna stromu (~5 m při scale) + rezerva. Nahrazuje dřívější radiální zónu (MIN_R) →
// dekorace teď roste i uprostřed osmičky, jen ne na trati.
const TRACK_CLEARANCE = 14;
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

// true, je-li bod (x,z) blíž k ose trati než TRACK_CLEARANCE — tam dekoraci nesázíme (vlak projíždí).
// Vzdálenost k nejbližšímu z předvzorkovaných bodů osy (XZ); hrubší vzorkování trati stačí.
function nearTrack(x: number, z: number, trackPts: { x: number; z: number }[]): boolean {
  for (const p of trackPts) {
    if (Math.hypot(x - p.x, z - p.z) < TRACK_CLEARANCE) return true;
  }
  return false;
}

// Lesnatost: nízkofrekvenční pole 0..1 (vlnová délka ~500 m → pár oblastí na desce). Kde je vysoká,
// sázíme hustě = shluk stromů (les); kde nízká, jen řídce. Tím vznikají lesy místo rovnoměrného rozsypu.
function forestDensity(x: number, z: number): number {
  const n = Math.sin(x * 0.013 + 1.3) * Math.cos(z * 0.011 - 0.7);
  return (n + 1) / 2;
}

// místo pro kus dekorace (strom/kámen) na terénu
type Spot = { x: number; z: number; y: number; scale: number; rot: number };
type SwitchStand = {
  target: THREE.MeshStandardMaterial;
  arm: THREE.Mesh;
};

// Uvolní unikátní GPU prostředky celé větve scény. Materiál může sdílet víc meshů
// (např. obě kolejnice), proto Set brání opakovanému dispose téhož objektu.
function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export class WorldView {
  private trackGroup!: THREE.Group;   // dvě kolejnice + pražce + pilíře — přestavitelné sliderem sklonu
  private terrainMesh!: THREE.Mesh;   // lowpoly heightfield — přestavitelný sliderem sklonu
  private sceneryGroup!: THREE.Group; // stromy + kameny — sedí na terénu (rebuild se sklonem)
  private switchStands: SwitchStand[] = []; // výměnové terče u uzlů θ-grafu (route stav)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly network: TrackNetwork,
    trackAmplitude: number, // počáteční amplituda terénu (slider sklonu) — terén vede trať (DD-20)
  ) {
    this.buildTerrain(trackAmplitude);
    this.buildScenery(trackAmplitude);
    this.buildTrack(trackAmplitude);
  }

  /** Přestaví terén, dekoraci i trať po změně sklonu; síť už obnovil TrackNetwork.rebuild(). */
  rebuild(amplitude: number): void {
    this.rebuildTerrain(amplitude);
    this.rebuildTrack(amplitude);
  }

  // ── trať: dvě kolejnice + pražce + mostní pilíře ──────────────────────────────────

  private buildTrack(amplitude: number): void {
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);
    this.populateTrack(amplitude);
  }

  private rebuildTrack(amplitude: number): void {
    disposeObject(this.trackGroup);
    this.trackGroup.clear();
    this.switchStands = [];
    this.populateTrack(amplitude);
  }

    // Naplní group kolejnicemi a pražci pro každou master křivku sítě (osmička + spojka)
    // + mostovkou a pilíři tam, kde se trať odlepí od terénu. Sim zná jen osu
  // koleje (DD-02); kolejnice jsou ryze vizuální offset. `amplitude` pro výšku terénu pod pilíři.
  private populateTrack(amplitude: number): void {
    for (const curve of this.network.masterCurves) this.buildCurveRails(curve);
    this.buildDeck(amplitude);
    this.buildPiers(amplitude);
    this.buildSwitchStands();
    this.buildServiceSite(amplitude);
  }

  /**
   * Výměnové terče u obou uzlů θ-grafu. Jsou čistě view: barva a poloha ramene jen ukazují
   * aktuální trasu a zámek, rozhodnutí zůstává v Train/TrackNetwork.
   */
  updateRouteIndicators(route: RouteId, locked: boolean): void {
    const color =
      locked ? ROUTE_LOCK_COLOR :
      route === 'branch' ? ROUTE_BRANCH_COLOR :
      ROUTE_MAIN_COLOR;
    for (const stand of this.switchStands) {
      stand.target.color.copy(color);
      stand.target.emissive.copy(color).multiplyScalar(0.35);
      stand.arm.rotation.z = route === 'branch' ? -0.62 : 0.62;
    }
  }

  private buildSwitchStands(): void {
    const nodes = [
      { seg: 2, s: 0, side: 1 }, // rozbočení do hlavní/odbočné hrany
      { seg: 3, s: 0, side: -1 }, // sloučení zpět na společnou trať
    ];
    const mastGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.35, 6);
    const targetGeo = new THREE.BoxGeometry(0.82, 0.42, 0.08);
    const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, flatShading: true });
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1d1f21, flatShading: true });

    for (const node of nodes) {
      const { position, tangent } = this.network.at({ seg: node.seg, s: node.s, route: 'main' });
      const side = new THREE.Vector3().crossVectors(UP, tangent).normalize().multiplyScalar(node.side * SWITCH_STAND_OFFSET);
      const group = new THREE.Group();
      group.position.copy(position).add(side);
      group.position.y += RAIL_RADIUS;
      // natoč terč podél koleje, aby rameno ukazovalo „rovně/odbočka" ve vztahu k trati
      group.rotation.y = Math.atan2(tangent.x, tangent.z);

      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 0.68;
      group.add(mast);

      const targetMat = new THREE.MeshStandardMaterial({
        color: ROUTE_MAIN_COLOR,
        emissive: ROUTE_MAIN_COLOR.clone().multiplyScalar(0.35),
        flatShading: true,
      });
      const target = new THREE.Mesh(targetGeo, targetMat);
      target.position.y = 1.45;
      group.add(target);

      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.y = 1.82;
      arm.rotation.z = 0.62;
      group.add(arm);

      this.trackGroup.add(group);
      this.switchStands.push({ target: targetMat, arm });
    }
  }

  /**
   * Malé zázemí u odbočky: bouda, vodní jeřáb a uhlí. Je to zatím čistě view řez —
   * sim stále neví o doplňování zásob. Geometrie se váže na segment spojky, takže při změně
   * slideru sklonu sedí na aktuálním terénu a drží se u stejného fyzického místa tratě.
   */
  private buildServiceSite(amplitude: number): void {
    const branch = this.network.segments[SERVICE_SEG];
    if (!branch) return; // pojistka pro případ, že budoucí scénář spojku nemá

    const sample = this.network.at({
      seg: SERVICE_SEG,
      s: branch.length * SERVICE_U,
      route: 'branch',
    });
    const tangent = sample.tangent.clone();
    tangent.y = 0;
    tangent.normalize();

    const sideToTrack = new THREE.Vector3().crossVectors(UP, tangent).normalize();
    const serviceSide = sideToTrack.clone().multiplyScalar(-1);
    const center = sample.position.clone().addScaledVector(serviceSide, SERVICE_SITE_OFFSET);
    const baseY = terrainHeight(center.x, center.z, amplitude);
    const site = new THREE.Group();
    site.position.set(center.x, baseY, center.z);
    site.rotation.y = Math.atan2(tangent.x, tangent.z);

    // Lokální +X míří zpátky ke koleji, +Z po směru jízdy. Výšku dopočítáváme per objekt,
    // protože terén je zvlněný a servisní plocha má přes deset metrů.
    const groundY = (localX: number, localZ: number) => {
      const worldX = center.x + sideToTrack.x * localX + tangent.x * localZ;
      const worldZ = center.z + sideToTrack.z * localX + tangent.z * localZ;
      return terrainHeight(worldX, worldZ, amplitude) - baseY;
    };

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(16.4, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: SERVICE_PAD_COLOR, flatShading: true }),
    );
    pad.position.set(0, 0.04, 0);
    site.add(pad);

    this.addServiceHouse(site, groundY(-1.7, -3.1), -1.7, -3.1);
    this.addWaterCrane(site, groundY(SERVICE_CRANE_OFFSET, 0.2), SERVICE_CRANE_OFFSET, 0.2);
    this.addCoalPile(site, groundY(-2.6, 3.8), -2.6, 3.8);

    this.trackGroup.add(site);
  }

  private addServiceHouse(parent: THREE.Group, groundY: number, x: number, z: number): void {
    const house = new THREE.Group();
    house.position.set(x, groundY, z);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(7, 4, 5.5),
      new THREE.MeshStandardMaterial({ color: SERVICE_HOUSE_COLOR, flatShading: true }),
    );
    body.position.y = 2;
    house.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(5.2, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: SERVICE_ROOF_COLOR, flatShading: true }),
    );
    roof.position.y = 5.1;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.78;
    house.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 2.35, 1.25),
      new THREE.MeshStandardMaterial({ color: SERVICE_DARK_COLOR, flatShading: true }),
    );
    door.position.set(3.56, 1.18, -1.25);
    house.add(door);

    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.9, 1.25),
      new THREE.MeshStandardMaterial({
        color: SERVICE_WINDOW_COLOR,
        emissive: new THREE.Color(SERVICE_WINDOW_COLOR).multiplyScalar(0.12),
        flatShading: true,
      }),
    );
    window.position.set(3.57, 2.75, 1.15);
    house.add(window);

    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.4, 0.7),
      new THREE.MeshStandardMaterial({ color: SERVICE_DARK_COLOR, flatShading: true }),
    );
    chimney.position.set(-1.9, 5.1, -0.8);
    house.add(chimney);

    parent.add(house);
  }

  private addWaterCrane(parent: THREE.Group, groundY: number, x: number, z: number): void {
    const crane = new THREE.Group();
    crane.position.set(x, groundY, z);
    const metal = new THREE.MeshStandardMaterial({ color: SERVICE_METAL_COLOR, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: SERVICE_DARK_COLOR, flatShading: true });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.45, 8), dark);
    base.position.y = 0.23;
    crane.add(base);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.2, 8), metal);
    mast.position.y = 2.85;
    crane.add(mast);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.8, 8), metal);
    arm.position.set(2.9, 5.25, 0);
    arm.rotation.z = Math.PI / 2;
    crane.add(arm);

    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.8, 8), metal);
    spout.position.set(5.65, 4.35, 0);
    crane.add(spout);

    const valve = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.75), dark);
    valve.position.set(0, 5.35, 0);
    valve.rotation.y = Math.PI / 4;
    crane.add(valve);

    parent.add(crane);
  }

  private addCoalPile(parent: THREE.Group, groundY: number, x: number, z: number): void {
    const coal = new THREE.Group();
    coal.position.set(x, groundY, z);
    const coalMat = new THREE.MeshStandardMaterial({ color: SERVICE_COAL_COLOR, roughness: 0.9, flatShading: true });
    const timberMat = new THREE.MeshStandardMaterial({ color: SLEEPER_COLOR, flatShading: true });

    const heap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.35, 7), coalMat);
    heap.position.y = 0.68;
    heap.rotation.y = 0.25;
    heap.scale.z = 0.7;
    coal.add(heap);

    for (const localZ of [-1.9, 1.9]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.32, 0.35), timberMat);
      beam.position.set(0, 0.18, localZ);
      coal.add(beam);
    }

    const lumpGeo = new THREE.DodecahedronGeometry(0.45, 0);
    for (const [lx, ly, lz] of [[-1.1, 1.0, -0.2], [0.7, 1.18, 0.6], [1.5, 0.72, -0.55]] as const) {
      const lump = new THREE.Mesh(lumpGeo, coalMat);
      lump.position.set(lx, ly, lz);
      lump.scale.set(1.1, 0.7, 0.85);
      coal.add(lump);
    }

    parent.add(coal);
  }

  // Dvě kolejnice (Tube ±rozchod/2 do horizontální kolmice) + pražce (InstancedMesh) podél
  // jedné master křivky. Volá se per křivku sítě.
  private buildCurveRails(curve: TrackCurve): void {
    const closed = curve.closed; // uzavřená smyčka (lemniskáta) vs. otevřená spojka výhybky
    const N = 400; // vzorků podél trati — hustota offset křivek i tuby
    const leftPts: THREE.Vector3[] = [];
    const rightPts: THREE.Vector3[] = [];
    // uzavřená: i<N (u=0..(N-1)/N, wrap přes u=1≡0); otevřená: i≤N (u=0..1 včetně konce koleje)
    for (let i = 0; i < (closed ? N : N + 1); i++) {
      const u = i / N;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const side = new THREE.Vector3().crossVectors(UP, tan).normalize(); // horizontální kolmice (stejná konvence jako pražce/pilíře)
      leftPts.push(p.clone().addScaledVector(side, -RAIL_GAUGE / 2));
      rightPts.push(p.clone().addScaledVector(side, RAIL_GAUGE / 2));
    }
    const railMat = new THREE.MeshStandardMaterial({ color: 0x55564f });
    for (const pts of [leftPts, rightPts]) {
      const railCurve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
      const geo = new THREE.TubeGeometry(railCurve, pts.length, RAIL_RADIUS, 6, closed);
      this.trackGroup.add(new THREE.Mesh(geo, railMat));
    }

    // pražce: InstancedMesh kvádrů napříč tratí (osa X = příčně, Z = podél tečny).
    const count = Math.max(1, Math.floor(curve.getLength() / SLEEPER_SPACING));
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
  }

  // Body podél trati, kde se kolej odlepí od terénu (clearance > práh) — emergentní detekce
  // „kde je most", sdílená pro mostovku i pilíře (DRY). `spacing` řídí hustotu vzorků
  // (mostovka hustá → souvislý nosník, pilíře řidší). Funguje i pro budoucí estakády/náspy.
  private elevatedSamples(
    amplitude: number,
    spacing: number,
  ): { pts: THREE.Vector3[]; tangents: THREE.Vector3[]; heights: number[] } {
    const pts: THREE.Vector3[] = [];
    const tangents: THREE.Vector3[] = [];
    const heights: number[] = [];
    for (const curve of this.network.masterCurves) {
      const count = Math.floor(curve.getLength() / spacing);
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
    }
    return { pts, tangents, heights };
  }

  // Mostovka: souvislý nízký nosník pod kolejnicemi v úsecích, kde je trať vyvýšená nad
  // terén. Hustě vzorkované box-segmenty (rozteč DECK_SPACING) se podél trati překrývají →
  // souvislá deska i v oblouku. Orientace sleduje tečnu i sklon koleje (jako pražce).
  private buildDeck(amplitude: number): void {
    const { pts, tangents } = this.elevatedSamples(amplitude, DECK_SPACING);
    if (pts.length === 0) return; // plochá trať (slider sklonu ↓) → žádný most

    // segment delší než rozteč (×1.4) → sousední kusy se překryjí a nevzniknou mezery v oblouku
    const deck = new THREE.InstancedMesh(
      new THREE.BoxGeometry(RAIL_GAUGE + 1.0, DECK_THICKNESS, DECK_SPACING * 1.4),
      new THREE.MeshStandardMaterial({ color: PIER_COLOR }),
      pts.length,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const x = new THREE.Vector3();
    const y = new THREE.Vector3();
    const z = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    pts.forEach((p, i) => {
      z.copy(tangents[i]);               // podél trati
      x.crossVectors(UP, z).normalize(); // příčně (rozchod)
      y.crossVectors(z, x).normalize();  // ~svisle, sleduje sklon koleje
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      pos.set(p.x, p.y - DECK_DROP, p.z); // střed nosníku pod pražci
      m.compose(pos, q, scale);
      deck.setMatrixAt(i, m);
    });
    this.trackGroup.add(deck);
  }

  // Mostní pilíře: tam, kde se trať odlepí od terénu (most nad podjezdem), postaví svislou
  // podpěru od povrchu ke kolejím. Emergentní — žádná znalost „kde je most"; staví se podle
  // skutečného převýšení trati nad terénem (funguje i pro budoucí estakády/náspy).
  private buildPiers(amplitude: number): void {
    const { pts, tangents, heights } = this.elevatedSamples(amplitude, PIER_SPACING);
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

  // ── terén + dekorace ──────────────────────────────────────────────────────────────

  /** Přestaví terén i dekoraci po změně sklonu (slider) — vše drží zákryt (čte terrainHeight). */
  private rebuildTerrain(amplitude: number): void {
    disposeObject(this.terrainMesh);
    this.scene.remove(this.terrainMesh);
    this.buildTerrain(amplitude);

    disposeObject(this.sceneryGroup);
    this.scene.remove(this.sceneryGroup);
    this.buildScenery(amplitude);
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
    geo.dispose(); // toNonIndexed vytvoří novou geometrii; původní už renderer nepoužije
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

  // Lowpoly stromy (kužel koruna + válec kmen) a kameny (ikosaedr) na svazích mimo trať.
  // Deterministická mřížka s jitterem (hash) → stabilní svět; vše InstancedMesh, sedí na terénu.
  private buildScenery(amplitude: number): void {
    this.sceneryGroup = new THREE.Group();
    const trees: Spot[] = [];
    const rocks: Spot[] = [];

    // body osy trati (XZ) pro test clearance — kandidát blíž než TRACK_CLEARANCE se zahodí
    const trackPts = this.sampleTrackXZ(240);

    const half = TERRAIN_SIZE / 2;
    let idx = 0;
    for (let gx = -half; gx <= half; gx += SCENERY_STEP) {
      for (let gz = -half; gz <= half; gz += SCENERY_STEP) {
        idx++;
        const x = gx + (hash(idx, 1) - 0.5) * SCENERY_STEP; // jitter z pravidelné mřížky
        const z = gz + (hash(idx, 2) - 0.5) * SCENERY_STEP;
        if (Math.hypot(x, z) > SCENERY_MAX_R) continue;     // za deskou ne
        if (nearTrack(x, z, trackPts)) continue;            // moc blízko koleji → ne (vlak projíždí)

        // hustota osázení roste s lesnatostí: mimo les řídce (~12 %), v lese hustě (~85 %) → shluky = lesy
        const forest = forestDensity(x, z);
        if (hash(idx, 0) > 0.12 + forest * 0.73) continue;

        const y = terrainHeight(x, z, amplitude);
        const spot: Spot = { x, z, y, scale: 0.7 + hash(idx, 3) * 0.8, rot: hash(idx, 4) * Math.PI * 2 };
        // nad horní hranicí lesa skály, pod ní převážně stromy (les), kameny jen občas
        if (y > TREE_LINE || hash(idx, 5) > 0.85) rocks.push(spot);
        else trees.push(spot);
      }
    }

    this.addTrees(trees);
    this.addRocks(rocks);
    this.scene.add(this.sceneryGroup);
  }

  // Vzorky os trati v XZ (přes všechny master křivky) — pro test vzdálenosti dekorace od koleje
  // (clearance, viz nearTrack). `n` vzorků na křivku.
  private sampleTrackXZ(n: number): { x: number; z: number }[] {
    const pts: { x: number; z: number }[] = [];
    for (const curve of this.network.masterCurves) {
      for (let i = 0; i < n; i++) {
        const p = curve.getPointAt(i / n);
        pts.push({ x: p.x, z: p.z });
      }
    }
    return pts;
  }

  // strom = kmen (válec) + koruna (kužel), dvě InstancedMesh sdílející transformace míst.
  private addTrees(spots: Spot[]): void {
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
  private addRocks(spots: Spot[]): void {
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
}
