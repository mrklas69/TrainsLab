import * as THREE from 'three';

// Lowpoly modely vozů — faceted (flatShading), izomorfní se scenérií S17 (terén/stromy/kameny).
// Čistá view-vrstva (DD-01): typ vozu je ryze vizuální, sim zná jen 1D těleso s délkou a hmotou.
//
// Konvence orientace (sladěná s render loopem v Rendereru):
//   - délka vozu je podél lokální osy Z, čelo míří do −Z (kam ukazuje lookAt),
//   - šířka podél X, výška podél Y,
//   - počátek skupiny = geometrický střed; render loop posune o CAR_HEIGHT/2 nad kolej.
// Svislé vrstvení: kola dnem na FLOOR_Y (temeno kolejnice), skříň vozu je v podskupině
//   zvednuté o poloměr kola (`bodyLift`) → kola vykukují zpod vozu, nejsou „utopená".

export const CAR_WIDTH = 2.6;   // šířka skříně (m) — single source pro model i render offset
export const CAR_HEIGHT = 3.0;  // nominální výška (m); dno kol = −CAR_HEIGHT/2

const FLOOR_Y = -CAR_HEIGHT / 2;            // lokální y dna kol (úroveň temene kolejnice)
const RADIAL_SEG = 8;                       // segmentů válce — nízké číslo = faceted lowpoly vzhled

// kola: poloměry, rozchod (kola sedí pod hranami skříně, zhruba nad kolejnicemi) a klika spojnice
const WHEEL_X = 0.85;            // poloviční rozchod kol (m) — vně osy, nad kolejnicemi
const WAGON_WHEEL_R = 0.5;       // poloměr kola vagonu (m)
const LOCO_WHEEL_R = 0.8;        // poloměr hnacího kola lokomotivy (m) — větší (parní driver)
export const CRANK_RADIUS = 0.34;// poloměr kliky = offset hnací spojnice od středu kola (render loop ji animuje)

// barvy doplňků (komín, dóm, rám, podvozek) — tmavá ocel, netintuje se semaforem/žárem
const DETAIL_COLOR = new THREE.Color(0x2a2d30);

// sdílené materiály kol/spojnic (immutable → bezpečně sdílené napříč vozy, nikdy se netintují)
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x202225, flatShading: true });
const SPOKE_MAT = new THREE.MeshStandardMaterial({ color: 0x808488, flatShading: true }); // příčka pro viditelnost otáčení
const ROD_MAT = new THREE.MeshStandardMaterial({ color: 0x9a9da0, flatShading: true });    // hnací spojnice (leštěná ocel)

// základní barvy skříně podle typu vozu (loko řídí stavový semafor v render loopu, tady jen fallback)
const TANK_COLOR = new THREE.Color(0x8b9095);    // cisterna — ocelová šeď
const BOXCAR_COLOR = new THREE.Color(0x8a4b2f);  // krytý vůz — oxidová červenohnědá
const GONDOLA_COLOR = new THREE.Color(0x4f5a52); // otevřený vůz — tmavá olivová
const FLATCAR_COLOR = new THREE.Color(0x6b6f73); // plošinový vůz (plato) — šedá ocel
const LOCO_BASE = new THREE.Color(0x555a5e);     // loko fallback (semafor obvykle přebíjí)

export type CarType = 'loco' | 'tank' | 'boxcar' | 'gondola' | 'flatcar';

// výsledek factory: kontejner (transformovaný v render loop) + skin (tintovaný stavem) + pohyblivé části
export interface CarVisual {
  group: THREE.Group;                  // celý model — render loop mu nastaví pozici/orientaci/náklon
  skin: THREE.MeshStandardMaterial;    // hlavní těleso — render loop mutuje color (semafor) + emissive (žár)
  baseColor: THREE.Color;              // klidová barva skříně (vozy); loko ji přebíjí semaforem
  wheels: THREE.Mesh[];                // kola — render loop jim nastaví rotation.x (valení ∝ ujetá dráha)
  wheelRadius: number;                 // poloměr kol (m) — fáze otáčení = dráha / poloměr
  wheelDir: number;                    // ±1 směr otáčení kol — sladí flipnuté loko (Y-flip invertuje rotaci) s vagony
  rods: THREE.Mesh[];                  // hnací spojnice loko (u vagonů prázdné); render loop animuje pozici dle kliky
  rodBaseY: number;                    // klidové y spojnice (osa orbity kliky = výška středu hnacích kol)
  chimneyTip?: THREE.Object3D;         // ústí komína (jen loko) — render loop z něj bere world pozici pro emisi kouře
}

// pomocník: faceted mesh z geometrie a materiálu, posazený na danou lokální pozici
function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}

// válec uložený podélně (osa do Z) — CylinderGeometry má osu defaultně v Y, otočíme o 90° kolem X
function lyingCylinder(radius: number, length: number): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, length, RADIAL_SEG);
  geo.rotateX(Math.PI / 2);
  return geo;
}

// společný tmavý materiál doplňků (immutable → bezpečně sdílený přes díly jednoho vozu)
function detailMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: DETAIL_COLOR, flatShading: true });
}

// podskupina pro skříň vozu, zvednutá o poloměr kola — díly se sázejí relativně k FLOOR_Y,
// ale výsledně sedí nad koly (kola vykukují zpod vozu)
function bodyGroup(parent: THREE.Object3D, wheelRadius: number): THREE.Group {
  const g = new THREE.Group();
  g.position.y = wheelRadius; // zvednutí o poloměr kola = dno skříně ve výši středu kol
  parent.add(g);
  return g;
}

// jedno kolo: disk (osa do X = náprava) + příčka, ať je otáčení vidět i na holém disku
function makeWheel(radius: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, 0.18, RADIAL_SEG);
  geo.rotateZ(Math.PI / 2); // osa válce do X (náprava) — rotation.x kola = valení
  const wheel = new THREE.Mesh(geo, WHEEL_MAT);
  // příčka přes průměr (rotuje s kolem) — kontrastní pruh, na faceted disku jinak otáčení skoro nevidět
  wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, radius * 1.7, 0.06), SPOKE_MAT));
  return wheel;
}

// přidá nápravy (po dvou kolech) na zadané z-pozice; kola registruje do `wheels` pro animaci
function addAxles(target: THREE.Object3D, wheels: THREE.Mesh[], radius: number, zs: number[]): void {
  for (const z of zs) {
    for (const sx of [-WHEEL_X, WHEEL_X]) {
      const w = makeWheel(radius);
      w.position.set(sx, FLOOR_Y + radius, z); // střed kola = poloměr nad temenem kolejnice
      target.add(w);
      wheels.push(w);
    }
  }
}

// parní lokomotiva: rám + kotel (válec) + kabina vzadu + komín + parní dóm + 3 hnací nápravy se spojnicemi.
// Díly stavíme do vnitřní `model` skupiny otočené o 180° kolem Y — render loop orientuje vnější
// `group` přes lookAt (čelo = −Z), takže komín/přída musí být v modelu na +Z, aby po flipu vedly.
function buildLoco(length: number): CarVisual {
  const group = new THREE.Group();
  const model = new THREE.Group();
  model.rotation.y = Math.PI; // flip: přída lokomotivy ať míří po směru jízdy
  group.add(model);
  const skin = new THREE.MeshStandardMaterial({ color: LOCO_BASE, flatShading: true });
  const detail = detailMat();
  const body = bodyGroup(model, LOCO_WHEEL_R); // skříň zvednutá nad hnací kola

  // rám pod celým vozem
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.3, 0.4, length), detail, 0, FLOOR_Y + 0.2, 0));
  // kotel — válec v přední polovině, mírně nad rámem
  body.add(part(lyingCylinder(1.0, length * 0.62), skin, 0, FLOOR_Y + 1.2, -length * 0.16));
  // kabina strojvedoucího — box u zádi (+Z)
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.2, 2.0, length * 0.28), skin, 0, FLOOR_Y + 1.6, length * 0.33));
  // komín — svislý válec nad přídí kotle
  body.add(part(new THREE.CylinderGeometry(0.28, 0.32, 0.9, RADIAL_SEG), detail, 0, FLOOR_Y + 2.6, -length * 0.34));
  // marker ústí komína (těsně nad vrškem) — emisní bod kouře. Prázdný Object3D ve stejném
  // parentu jako komín → render loop přečte world pozici přes getWorldPosition (flip/náklon
  // vyřeší three sám, žádné ruční počítání znamének po Y-flipu loko).
  const chimneyTip = new THREE.Object3D();
  chimneyTip.position.set(0, FLOOR_Y + 3.15, -length * 0.34);
  body.add(chimneyTip);
  // parní dóm — kratší svislý válec na temeni kotle
  body.add(part(new THREE.CylinderGeometry(0.4, 0.4, 0.5, RADIAL_SEG), detail, 0, FLOOR_Y + 2.5, -length * 0.02));

  // hnací kola — 3 nápravy (symetrické v Z → flip nevadí), na kořeni modelu (na kolejnici)
  const wheels: THREE.Mesh[] = [];
  addAxles(model, wheels, LOCO_WHEEL_R, [-length * 0.24, 0, length * 0.24]);

  // hnací spojnice („páky") — tyč podél Z vně kol na obou stranách; render loop ji rozhýbe po kruhu kliky
  const rods: THREE.Mesh[] = [];
  const rodGeo = new THREE.BoxGeometry(0.12, 0.2, length * 0.5);
  const rodBaseY = FLOOR_Y + LOCO_WHEEL_R; // osa kliky = výška středu hnacích kol
  for (const sx of [-(WHEEL_X + 0.14), WHEEL_X + 0.14]) {
    const rod = part(rodGeo, ROD_MAT, sx, rodBaseY, 0); // y,z animuje render loop dle fáze
    model.add(rod);
    rods.push(rod);
  }

  // loko je Y-flipnuté → rotation.x kol se ve světě obrací; +1 vychází správně (vagony dostanou −1)
  return { group, skin, baseColor: LOCO_BASE, wheels, wheelRadius: LOCO_WHEEL_R, wheelDir: 1, rods, rodBaseY, chimneyTip };
}

// společný závěr pro vagony: 2 nápravy (na kolejnici), žádné spojnice
function wagonVisual(group: THREE.Group, skin: THREE.MeshStandardMaterial, baseColor: THREE.Color, length: number): CarVisual {
  const wheels: THREE.Mesh[] = [];
  addAxles(group, wheels, WAGON_WHEEL_R, [-length * 0.3, length * 0.3]);
  // vagon není flipnutý → opačné znaménko než loko, aby se kola valila stejným směrem
  return { group, skin, baseColor, wheels, wheelRadius: WAGON_WHEEL_R, wheelDir: -1, rods: [], rodBaseY: 0 };
}

// cisterna: plochý podvozek + vodorovný válcový tank
function buildTank(length: number): CarVisual {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: TANK_COLOR, flatShading: true });
  const detail = detailMat();
  const body = bodyGroup(group, WAGON_WHEEL_R);

  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.4, 0.4, length), detail, 0, FLOOR_Y + 0.2, 0));
  body.add(part(lyingCylinder(1.2, length * 0.9), skin, 0, FLOOR_Y + 1.5, 0));

  return wagonVisual(group, skin, TANK_COLOR, length);
}

// krytý vůz: rám + uzavřená skříň
function buildBoxcar(length: number): CarVisual {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: BOXCAR_COLOR, flatShading: true });
  const detail = detailMat();
  const body = bodyGroup(group, WAGON_WHEEL_R);

  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.3, 0.3, length), detail, 0, FLOOR_Y + 0.15, 0));
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH, 2.4, length * 0.92), skin, 0, FLOOR_Y + 1.5, 0));

  return wagonVisual(group, skin, BOXCAR_COLOR, length);
}

// otevřený vůz (gondola): nízká korba — podlaha + boční a čelní stěny, bez střechy
function buildGondola(length: number): CarVisual {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: GONDOLA_COLOR, flatShading: true });
  const body = bodyGroup(group, WAGON_WHEEL_R);

  const wallH = 1.4;                 // výška stěn
  const wallY = FLOOR_Y + 0.3 + wallH / 2; // střed stěn (nad podlahou)
  const inner = length * 0.9;        // délka korby
  // podlaha
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.2, 0.3, inner), skin, 0, FLOOR_Y + 0.15, 0));
  // boční stěny (podél Z) na ±X
  body.add(part(new THREE.BoxGeometry(0.15, wallH, inner), skin, (CAR_WIDTH - 0.2) / 2, wallY, 0));
  body.add(part(new THREE.BoxGeometry(0.15, wallH, inner), skin, -(CAR_WIDTH - 0.2) / 2, wallY, 0));
  // čelní stěny (napříč X) na ±Z
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.2, wallH, 0.15), skin, 0, wallY, inner / 2));
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.2, wallH, 0.15), skin, 0, wallY, -inner / 2));

  return wagonVisual(group, skin, GONDOLA_COLOR, length);
}

// plošinový vůz (plato): nízká holá paluba na rámu — pro přepravu techniky (tanky, kontejnery)
function buildFlatcar(length: number): CarVisual {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: FLATCAR_COLOR, flatShading: true });
  const detail = detailMat();
  const body = bodyGroup(group, WAGON_WHEEL_R);

  // rám u dna
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH - 0.3, 0.3, length), detail, 0, FLOOR_Y + 0.15, 0));
  // paluba — plochá deska na rámu, bez nástaveb
  body.add(part(new THREE.BoxGeometry(CAR_WIDTH, 0.4, length * 0.96), skin, 0, FLOOR_Y + 0.5, 0));

  return wagonVisual(group, skin, FLATCAR_COLOR, length);
}

// dispatch dle typu vozu
export function buildCarModel(type: CarType, length: number): CarVisual {
  switch (type) {
    case 'loco': return buildLoco(length);
    case 'tank': return buildTank(length);
    case 'boxcar': return buildBoxcar(length);
    case 'gondola': return buildGondola(length);
    case 'flatcar': return buildFlatcar(length);
  }
}
