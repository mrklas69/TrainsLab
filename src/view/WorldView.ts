import * as THREE from 'three';
import type { Track } from '../sim/Track';
import { terrainHeight, smoothstep } from '../sim/terrain';

// WorldView = statická scéna kolem soupravy (terén, dekorace, trať/pilíře) jako samostatná
// view vrstva (SLAP) — vytaženo z Rendereru (S31), aby Renderer řešil jen aktéry (vozy, spřáhla,
// kouř, kamera) a render loop. Drží DD-01: čistě view, sim zná jen osu koleje (track.curve, DD-02).
//
// Vše „postaveno jednou" v konstruktoru; slider sklonu přestaví terén i trať přes {@link rebuild}
// (výškovou matematiku drží `sim/terrain.ts`, mesh/barvy jsou ryze render).

const RAIL_GAUGE = 1.7;     // vizuální rozchod kolejnic (m) — širší než fyzický 1.435 pro čitelnost pod vozy
const SLEEPER_SPACING = 3;  // rozteč pražců podél trati (m)
const SLEEPER_COLOR = 0x5a4632; // pražec — hnědá
const PIER_SPACING = 6;     // rozteč mostních pilířů podél trati (m)
const PIER_MIN_CLEARANCE = 1.2; // nad tímhle převýšením trati nad terénem už staví pilíř (m)
const PIER_COLOR = 0x807a70; // pilíř i mostovka — betonová šeď (jeden most = jedna konstrukce)
const DECK_SPACING = 2;     // rozteč segmentů mostovky podél trati (m) — hustá, segmenty se překrývají
const DECK_THICKNESS = 0.4; // tloušťka nosníku mostovky (m)
const DECK_DROP = 0.35;     // o kolik je střed mostovky pod osou koleje (m) — sedí pod pražci

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

// místo pro kus dekorace (strom/kámen) na terénu
type Spot = { x: number; z: number; y: number; scale: number; rot: number };

export class WorldView {
  private trackGroup!: THREE.Group;   // dvě kolejnice + pražce + pilíře — přestavitelné sliderem sklonu
  private terrainMesh!: THREE.Mesh;   // lowpoly heightfield — přestavitelný sliderem sklonu
  private sceneryGroup!: THREE.Group; // stromy + kameny — sedí na terénu (rebuild se sklonem)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly track: Track,
    trackAmplitude: number, // počáteční amplituda terénu (slider sklonu) — terén vede trať (DD-20)
  ) {
    this.buildTerrain(trackAmplitude);
    this.buildScenery(trackAmplitude);
    this.buildTrack(trackAmplitude);
  }

  /** Přestaví terén, dekoraci i trať po změně sklonu (slider). Křivka už je v Track.rebuild(). */
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
    // dispose staré geometrie (kolejnice = Tube, pražce/pilíře = InstancedMesh) než vyčistíme group
    this.trackGroup.children.forEach((c) => {
      if (c instanceof THREE.Mesh) c.geometry.dispose();
    });
    this.trackGroup.clear();
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
      const side = new THREE.Vector3().crossVectors(UP, tan).normalize(); // horizontální kolmice (stejná konvence jako pražce/pilíře)
      leftPts.push(p.clone().addScaledVector(side, -RAIL_GAUGE / 2));
      rightPts.push(p.clone().addScaledVector(side, RAIL_GAUGE / 2));
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

    this.buildDeck(amplitude);
    this.buildPiers(amplitude);
  }

  // Body podél trati, kde se kolej odlepí od terénu (clearance > práh) — emergentní detekce
  // „kde je most", sdílená pro mostovku i pilíře (DRY). `spacing` řídí hustotu vzorků
  // (mostovka hustá → souvislý nosník, pilíře řidší). Funguje i pro budoucí estakády/náspy.
  private elevatedSamples(
    amplitude: number,
    spacing: number,
  ): { pts: THREE.Vector3[]; tangents: THREE.Vector3[]; heights: number[] } {
    const curve = this.track.curve;
    const count = Math.floor(this.track.length / spacing);
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
    this.terrainMesh.geometry.dispose();
    this.scene.remove(this.terrainMesh);
    this.buildTerrain(amplitude);

    this.sceneryGroup.children.forEach((c) => { if (c instanceof THREE.Mesh) c.geometry.dispose(); });
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
