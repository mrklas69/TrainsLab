import * as THREE from 'three';

// Lowpoly kouř z komína — faceted obláčky (flatShading), izomorfní se scenérií S17
// (terén/stromy/kameny) i s modely vozů. Čistě view (DD-01): sim o kouři neví.
//
// Klíč k realismu (a zadarmo): obláčky žijí ve **world-space** (children scény, ne
// loko), takže jak lokomotiva ujede, kouř zůstane viset a vznikne charakteristická
// vlečka za komínem — emergentně z pohybu, bez skriptování.

const MAX_PUFFS = 48;          // velikost poolu (recyklace — žádná alokace per-frame)
const PUFF_LIFE = 2.6;         // s — jak dlouho obláček žije, než se vrátí do poolu
const IDLE_INTERVAL = 0.45;    // s — rozteč slabých obláčků při volnoběhu (oheň hoří pořád)
const RISE_SPEED = 3.2;        // m/s — počáteční stoupání obláčku
const RISE_DAMP = 0.4;         // 1/s — útlum stoupání s věkem (kouř chladne a zpomaluje)
const SPREAD = 0.7;            // m/s — náhodný boční rozptyl počáteční rychlosti (oblak se rozšiřuje)
const GROWTH = 1.2;            // násobek, o co obláček naroste za celý život (rozplývání) — pozvolné

// barva kouře: tmavá uhlíková pod plnou párou (zátěž = víc spáleného uhlí) ↔ světlá
// pára při volnoběhu/výběhu (kondenzace). Lerp řídí „darkness" (= výkon lokomotivy).
const SMOKE_LIGHT = new THREE.Color(0xd9d9d6); // bílá pára (idle)
const SMOKE_DARK = new THREE.Color(0x35332f);  // uhlíkový kouř (plný výkon)

// jeden obláček: faceted mesh + jeho dynamický stav. Materiál je per-kus (každý
// blednе vlastním tempem opacity); geometrie sdílená přes pool.
interface Puff {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  vel: THREE.Vector3;   // okamžitá rychlost (m/s) — vzhůru + boční rozptyl
  age: number;          // s od emise
  life: number;         // s — celková životnost tohoto obláčku
  baseScale: number;    // počáteční poloměr (m)
  startOpacity: number; // opacity při emisi (puf hustší než idle)
}

/**
 * SmokeView = částicový kouř jako samostatná view utilita (drží SLAP — nezvětšuje
 * Renderer, který už je split-kandidát). Renderer ji vlastní a každý frame volá
 * {@link update} s pozicí ústí komína, výkonem a příznakem výfuku z {@link ExhaustClock}.
 */
export class SmokeView {
  private readonly puffs: Puff[] = [];
  private idleTimer = 0; // odpočet do dalšího volnoběžného obláčku

  constructor(scene: THREE.Scene) {
    // sdílená geometrie: ikosaedr (20 facet) = hrubý faceted obláček
    const geo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < MAX_PUFFS; i++) {
      const mat = new THREE.MeshStandardMaterial({
        flatShading: true,
        transparent: true,
        opacity: 0,
        depthWrite: false, // průhledné obláčky nemají ořezávat to za sebou
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.puffs.push({ mesh, mat, vel: new THREE.Vector3(), age: 0, life: PUFF_LIFE, baseScale: 1, startOpacity: 0 });
    }
  }

  /**
   * @param chimney světová pozice ústí komína (emisní bod)
   * @param power   otevření regulátoru × parní tlak (0..1) — řídí hustotu/velikost/tmavost
   * @param exhaustFired padl tento frame výfuk páry (z {@link ExhaustClock}; jen pod párou)
   */
  update(dt: number, chimney: THREE.Vector3, power: number, exhaustFired: boolean): void {
    // 1) emise nových obláčků
    if (exhaustFired && power > 0) {
      // výfuk pod párou: výrazný puf, velikost i hustota rostou s výkonem, barva tmavne
      // (počáteční mrak menší o 1/4 — rozšíří se až postupně, viz GROWTH)
      this.emit(chimney, 0.6 + power * 0.98, 0.55 + power * 0.25, power);
    } else if (power <= 0) {
      // volnoběh: slabé světlé obláčky líně stoupají v pravidelném taktu (i když stojí)
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = IDLE_INTERVAL;
        this.emit(chimney, 0.38, 0.28, 0); // malý, řídký, světlá pára
      }
    }

    // 2) update živých obláčků: stoupání (s útlumem), rozpínání, blednutí
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.mesh.visible = false; // doznělo → zpět do poolu
        continue;
      }
      const t = p.age / p.life; // 0..1 normalizovaný věk
      // stoupání zpomaluje exponenciálně (chladnoucí kouř ztrácí vztlak)
      p.vel.y -= p.vel.y * RISE_DAMP * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      // rozpínání: lineárně roste do GROWTH× původního poloměru
      const scale = p.baseScale * (1 + t * GROWTH);
      p.mesh.scale.setScalar(scale);
      // blednutí: opacity klesá k 0 (kvadraticky → dlouho viditelný, pak rychle zmizí)
      p.mat.opacity = p.startOpacity * (1 - t) * (1 - t);
    }
  }

  // vezme volný obláček z poolu a vystřelí ho z ústí komína s daným měřítkem/hustotou/tmavostí
  private emit(chimney: THREE.Vector3, scale: number, opacity: number, darkness: number): void {
    const p = this.puffs.find((q) => !q.mesh.visible);
    if (!p) return; // pool vyčerpán — tiše vynech (při hustém výfuku nevadí, hned se uvolní)

    // malý jitter pozice, ať obláčky nestartují z jednoho bodu
    p.mesh.position.set(
      chimney.x + (Math.random() - 0.5) * 0.3,
      chimney.y + 0.1,
      chimney.z + (Math.random() - 0.5) * 0.3,
    );
    // rychlost: vzhůru + náhodný boční rozptyl (oblak se rozšiřuje)
    p.vel.set((Math.random() - 0.5) * SPREAD, RISE_SPEED, (Math.random() - 0.5) * SPREAD);
    p.age = 0;
    p.life = PUFF_LIFE;
    p.baseScale = scale;
    p.startOpacity = opacity;
    p.mat.color.copy(SMOKE_LIGHT).lerp(SMOKE_DARK, darkness);
    p.mesh.scale.setScalar(scale);
    p.mat.opacity = opacity;
    p.mesh.visible = true;
  }
}
