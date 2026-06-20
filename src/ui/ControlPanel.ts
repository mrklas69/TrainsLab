import type { PhysicsParams } from '../sim/params';
import type { DroneParams } from '../view/CameraController';
import type { WindParams } from '../view/SteamView';
import type { Train } from '../sim/Train';

// Jeden zdroj pravdy o klávesové akci: pohání keydown handler (codes), nápovědu
// v panelu (hint) i tlačítko (label). Dřív bylo mapování rozeseté na 3 místa.
export interface KeyAction {
  codes: string[];          // e.code hodnoty, na které akce reaguje (víc = aliasy)
  hint: string;             // popis kláves pro nápovědu/tlačítko, např. 'B / mezerník'
  label: string;            // co akce dělá, např. 'Stupeň +'
  preventDefault?: boolean; // šipky/mezerník jinak scrollují stránku
  run: () => void;          // při keydown (held-key akce: zapnutí)
  onRelease?: () => void;   // při keyup/blur — pro held-key akce (drž pro efekt), např. pískování
}

// Side-effekty sliderů nad rámec zápisu do params (runtime callbacky z main).
export interface PanelHandlers {
  onAmplitudeChange: () => void;                  // slider sklonu → přestavba tratě (sim + view)
  onCouplerMarkers: (visible: boolean) => void;   // checkbox → zobrazení markerů napětí spřáhel (view)
}

interface SliderDef {
  key: string;        // klíč v cílovém objektu params dle `source`
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  source?: 'drone' | 'wind'; // výchozí fyzika; ostatní = view parametry
  // volitelná akce po posunu (vedle zápisu do params) — např. přestavba tratě.
  // Většina sliderů jen mutuje sdílenou params; tahle hrstka má i side effect.
  action?: (h: PanelHandlers) => void;
}

interface Section {
  title: string;
  sliders: SliderDef[];
}

// Deklarativní popis sliderů ve skupinách — všechny se generují stejně (izomorfismus).
const SECTIONS: Section[] = [
  {
    title: 'Trať',
    sliders: [
      // amplituda terénních vln pod tratí (DD-20) — vyšší = strmější krajina = výraznější slack
      // action (do kopce draft, z kopce buff). Přestaví terén i trať (action). Most je fixní (clearance
      // = inženýrská konstanta, ne věc slideru), proto se s ním nemění.
      { key: 'trackAmplitude', label: 'Sklon (vlny terénu)', min: 0, max: 16, step: 0.2, unit: 'm',
        action: (h) => h.onAmplitudeChange() },
      // rázy z trati (rozšíření kývání skříně): dilatační spáry (klikot ∝ rychlost) + skok křivosti
      // / výhybky (boční trh). railLength = rozteč spár (vyšší = řidší tik, „svařovaná" na maximu);
      // trackImpulse = master síla všech rázů (0 = ideální hladká trať); transitionQuality tlumí
      // jen κ-trh (přechodnice/klotoida → boční trh rozetřen; nezávislé na spárách a výhybkách).
      { key: 'railLength', label: 'Rozteč spár', min: 5, max: 50, step: 1, unit: 'm' },
      { key: 'trackImpulse', label: 'Síla rázů (kvalita trati)', min: 0, max: 0.05, step: 0.002, unit: '' },
      { key: 'transitionQuality', label: 'Přechodnice (kvalita oblouků)', min: 0, max: 1, step: 0.05, unit: '' },
    ],
  },
  {
    title: 'Hmotnosti',
    sliders: [
      { key: 'locomotiveMass', label: 'Lokomotiva', min: 20000, max: 120000, step: 2000, unit: 'kg' },
      { key: 'carMass', label: 'Vagon', min: 5000, max: 100000, step: 1000, unit: 'kg' },
      // rotující hmota λ: efektivní setrvačná hmota m·(1+λ) — línější rozjezd/dobrzdění; loko > vůz
      { key: 'rotatingMassFactorLoco', label: 'Rotující hmota (loko)', min: 0, max: 0.4, step: 0.01, unit: '' },
      { key: 'rotatingMassFactorCar', label: 'Rotující hmota (vagon)', min: 0, max: 0.4, step: 0.01, unit: '' },
    ],
  },
  {
    title: 'Odpory',
    sliders: [
      { key: 'gravity', label: 'Gravitace', min: 0, max: 20, step: 0.1, unit: 'm/s²' },
      { key: 'rollingResistance', label: 'Valivý odpor', min: 0, max: 0.05, step: 0.001, unit: '' },
      { key: 'startingResistanceFactor', label: 'Rozběhový faktor', min: 1, max: 6, step: 0.1, unit: '×' },
      // lineární člen B·v Davisovy rovnice (ložiska/dynamické ztráty); doladí dojezd mezi valivým (A) a vzduchem (C·v²)
      { key: 'davisB', label: 'Lineární odpor (B·v)', min: 0, max: 100, step: 5, unit: 'N·s/m' },
      { key: 'dragCoefficient', label: 'Odpor vzduchu', min: 0, max: 50, step: 0.5, unit: '' },
      // odpor v oblouku: specifický C·|κ|·m·g (tření okolků, prokluz kol); rychlostně nezávislý. 0 = vypnuto, výš = víc brzdí v zatáčce
      { key: 'curveResistance', label: 'Odpor v oblouku', min: 0, max: 1, step: 0.02, unit: 'm' },
    ],
  },
  {
    title: 'Spřáhlo',
    sliders: [
      { key: 'couplerSlack', label: 'Vůle', min: 0, max: 1, step: 0.05, unit: 'm' },
      { key: 'couplerStiffness', label: 'Tuhost', min: 0, max: 5_000_000, step: 100_000, unit: 'N/m' },
      { key: 'couplerDamping', label: 'Tlumení', min: 0, max: 300_000, step: 5_000, unit: 'N·s/m' },
    ],
  },
  {
    title: 'Trakce & adheze',
    sliders: [
      { key: 'maxPower', label: 'Výkon', min: 0, max: 2_000_000, step: 50_000, unit: 'W' },
      { key: 'tractiveForceMax', label: 'Max tažná síla', min: 0, max: 400_000, step: 10_000, unit: 'N' },
      { key: 'adhesionCoeff', label: 'Adheze μ (sucho)', min: 0, max: 0.5, step: 0.01, unit: '' },
      // stav koleje: 1 = sucho, níž = mokro/listí → eff. μ = adheze·faktor. Pod ~0.4 začne loko prokluzovat → písek
      { key: 'railFactor', label: 'Stav koleje', min: 0, max: 1, step: 0.05, unit: '×' },
      { key: 'brakeForceMax', label: 'Brzda', min: 0, max: 400_000, step: 10_000, unit: 'N' },
      // μ(v) špalíkové brzdy: 0 = konstantní tření (Coulomb), výš = víc klesá s rychlostí → konkávní zpomalení
      { key: 'brakeFade', label: 'Pokles tření brzdy s v', min: 0, max: 0.8, step: 0.05, unit: '' },
      // otáčkový strop: v_mech = maxPistonSpeed·π·D/(2·zdvih); větší kolo / vyšší mez = vyšší v_max
      { key: 'driverDiameter', label: 'Průměr hnacího kola', min: 1, max: 2.2, step: 0.05, unit: 'm' },
      { key: 'maxPistonSpeed', label: 'Mez pístové rychlosti', min: 3, max: 14, step: 0.5, unit: 'm/s' },
    ],
  },
  {
    // práh převrácení = (rozchod/2)/výška_těžiště · g; užší rozchod nebo vyšší těžiště → dřív
    title: 'Příčná dynamika',
    sliders: [
      { key: 'trackGauge', label: 'Rozchod koleje', min: 1, max: 2, step: 0.05, unit: 'm' },
      { key: 'comHeight', label: 'Výška těžiště', min: 0.5, max: 4, step: 0.1, unit: 'm' },
      // energie srážky (½·m_red·v_close²) nad tímhle prahem → vykolejení; vyšší = odolnější vůči nárazu
      { key: 'collisionDerailEnergy', label: 'Mez srážky (vykolejení)', min: 0, max: 3000, step: 50, unit: 'kJ' },
    ],
  },
  {
    // písek = spotřební zásoba (jako palivo); drž P → sype a násobí suchou adhezi účinností.
    title: 'Pískování',
    sliders: [
      { key: 'sandAdhesionBoost', label: 'Účinnost písku', min: 1, max: 1.5, step: 0.05, unit: '× μ' },
      { key: 'sandCapacity', label: 'Kapacita písku', min: 0, max: 500, step: 10, unit: 'kg' },
      { key: 'sandRate', label: 'Spotřeba písku', min: 1, max: 20, step: 1, unit: 'kg/s' },
    ],
  },
  {
    // kývání skříně: tlumený oscilátor buzený příčným (roll) a podélným (pitch) zrychlením
    title: 'Vypružení',
    sliders: [
      { key: 'suspensionFreq', label: 'Frekvence kývání', min: 0.2, max: 2, step: 0.05, unit: 'Hz' },
      { key: 'suspensionDamping', label: 'Tlumení kývání', min: 0, max: 1, step: 0.05, unit: 'ζ' },
    ],
  },
  {
    // Náhodný world-space vítr pro kouř/páru. Síla 0 = bezvětří; směr se mění
    // po omezených náhodných krocích a SteamView mezi nimi plynule přechází.
    title: 'Vítr',
    sliders: [
      { key: 'strength', label: 'Síla větru', min: 0, max: 12, step: 0.5, unit: 'm/s', source: 'wind' },
      { key: 'directionVariability', label: 'Proměnlivost směru', min: 0, max: 180, step: 5, unit: '°', source: 'wind' },
      { key: 'changeInterval', label: 'Doba změny', min: 2, max: 30, step: 1, unit: 's', source: 'wind' },
    ],
  },
  {
    // auto-kamera „dron" (klávesa C): krouží kolem lokomotivy; poloměr + výška + rychlost
    // kroužení; tuhost = jak ostře dohání pohyb vlaku. Ryze view → zapisuje do DroneParams, ne do fyziky.
    title: 'Dron (kamera)',
    sliders: [
      { key: 'height', label: 'Výška dronu', min: 5, max: 60, step: 1, unit: 'm', source: 'drone' },
      { key: 'distance', label: 'Poloměr kroužení', min: 10, max: 100, step: 2, unit: 'm', source: 'drone' },
      { key: 'orbitSpeed', label: 'Rychlost kroužení', min: 0, max: 1.5, step: 0.05, unit: 'rad/s', source: 'drone' },
      { key: 'stiffness', label: 'Tuhost dohánění', min: 0.3, max: 6, step: 0.1, unit: '1/s', source: 'drone' },
    ],
  },
  {
    // zásoby tendru: menší (poměrově) určuje parní tlak. Vyšší spotřeba = dřív dojede.
    // Po vyčerpání tah → 0, vlak dojede setrvačností. R doplní obě zásoby.
    title: 'Palivo',
    sliders: [
      { key: 'coalCapacity', label: 'Kapacita uhlí', min: 0, max: 4000, step: 100, unit: 'kg' },
      { key: 'waterCapacity', label: 'Kapacita vody', min: 0, max: 12000, step: 200, unit: 'kg' },
      { key: 'coalRate', label: 'Spotřeba uhlí', min: 1, max: 30, step: 1, unit: 'kg/s' },
      { key: 'waterRate', label: 'Spotřeba vody', min: 1, max: 100, step: 1, unit: 'kg/s' },
    ],
  },
];

// společný vzhled tlačítek dolního baru (řízení + Nastavení) — kompaktní, touch-friendly
const BTN_CSS = [
  'padding:9px 13px', 'cursor:pointer', 'border-radius:6px', 'border:1px solid #555',
  'background:rgba(42,45,51,0.92)', 'color:#e6e6e6', 'font:13px system-ui,sans-serif',
].join(';');

/**
 * Ovládací vrstva nad scénou, rozdělená podle role (hraní vs laboratoř):
 *  - status bar (nahoře, centrovaný) — živá telemetrie viditelná za jízdy,
 *  - dolní bar (centrovaný) — tlačítka řízení soupravy + vstup do nastavení,
 *  - modální dialog „Nastavení" — slidery parametrů (multi-column) + nápověda kláves.
 *
 * Slidery mutují sdílenou {@link PhysicsParams} → fyzika reaguje hned. Vrací funkci
 * pro aktualizaci statusu, volanou každý frame.
 */
export function createControlPanel(
  params: PhysicsParams,
  drone: DroneParams,
  wind: WindParams,
  actions: KeyAction[],
  handlers: PanelHandlers,
): (train: Train) => void {
  // --- status bar (nahoře, centrovaný): telemetrie pozorovaná za jízdy ---
  const status = document.createElement('div');
  status.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
    'padding:8px 16px', 'background:rgba(20,22,26,0.82)', 'color:#e6e6e6',
    'border-radius:8px', 'font:13px/1.4 system-ui,sans-serif', 'text-align:center',
    'font-variant-numeric:tabular-nums', 'user-select:none', 'z-index:10',
    'max-width:calc(100vw - 24px)',
  ].join(';');
  document.body.appendChild(status);

  // --- modální dialog „Nastavení" (slidery + nápověda); otevírá tlačítko dole ---
  const settings = buildSettingsModal(params, drone, wind, actions, handlers);
  document.body.appendChild(settings.backdrop);

  // --- dolní bar (centrovaný): řízení soupravy + vstup do nastavení ---
  const bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed', 'bottom:12px', 'left:50%', 'transform:translateX(-50%)',
    'display:flex', 'flex-wrap:wrap', 'gap:6px', 'justify-content:center',
    'max-width:calc(100vw - 24px)', 'z-index:10',
  ].join(';');
  for (const a of actions) bar.appendChild(makeButton(a.label, a));
  const settingsBtn = document.createElement('button');
  settingsBtn.textContent = '⚙ Nastavení';
  settingsBtn.style.cssText = BTN_CSS;
  settingsBtn.addEventListener('click', () => { settings.open(); settingsBtn.blur(); });
  bar.appendChild(settingsBtn);
  document.body.appendChild(bar);

  return (train: Train): void => {
    const n = train.notch;
    const notch = n > 0 ? `+${n}` : String(n);
    const flags =
      (train.derailed
        ? ` · VYKOLEJENO (${train.derailReason === 'collision' ? 'srážka' : 'převrácení'}) při ${train.derailSpeed.toFixed(1)} m/s`
        : '') +
      (train.isBraking ? ' · BRZDA' : '') +
      (train.slipping ? ' · PROKLUZ' : '') +
      // klesající/nulový parní tlak — vidět jen při otevřeném regulátoru (jinak tah neřešíme)
      (train.notch !== 0 && train.steamPressure === 0 ? ' · BEZ PÁRY'
        : train.notch !== 0 && train.steamPressure < 1 ? ' · DOCHÁZÍ PÁRA' : '') +
      // otáčkový strop — tah utlumen blízkostí mezní rychlosti (jen při zrychlování vpřed)
      (train.notch > 0 && train.tractionDerating < 1 ? ' · OTÁČKY' : '') +
      // pískování — aktivní jen dokud je zásoba (pak páka bez efektu)
      (train.isSanding ? ' · PÍSEK' : '') +
      // servisní místo na odbočce: loko stojí u vodního jeřábu a postupně bere uhlí/vodu
      (train.isRefilling ? ' · DOPLŇUJE' : '') +
      // route lock: výhybka je obsazená nebo souprava leží na exkluzivní větvi → nepřestavuj
      (!train.routeCanChange ? ' · VÝHYBKA ZÁMEK' : '');
    // příčné (odstředivé) zrychlení / práh převrácení — blízkost meze je vidět v čísle
    const lat = train.lateralAcceleration.toFixed(1);
    const limit = train.overturnThreshold.toFixed(1);
    const coal = (train.coalFraction * 100).toFixed(0);
    const water = (train.waterFraction * 100).toFixed(0);
    const sand = (train.sandFraction * 100).toFixed(0);
    status.textContent =
      `Trasa ${train.route === 'branch' ? 'odbočka' : 'hlavní'} · Regulátor ${notch} · ${train.speed.toFixed(1)} m/s · příč ${lat}/${limit} m/s²` +
      ` · uhlí ${coal} % · voda ${water} % · písek ${sand} %${flags}`;
  };
}

/**
 * Modální dialog „Nastavení": slidery parametrů v multi-column layoutu (CSS Grid
 * auto-fill → 1 sloupec na mobilu, víc na wide bez media-queries, DD-18) a nápověda
 * kláves. Zavírá tlačítko OK, klik na pozadí i Esc. Vrací backdrop + open().
 */
function buildSettingsModal(
  params: PhysicsParams,
  drone: DroneParams,
  wind: WindParams,
  actions: KeyAction[],
  handlers: PanelHandlers,
): { backdrop: HTMLElement; open: () => void } {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.55)', 'display:none',
    'align-items:flex-start', 'justify-content:center', 'padding:24px', 'z-index:20',
  ].join(';');

  const dialog = document.createElement('div');
  dialog.style.cssText = [
    'background:rgba(24,26,30,0.98)', 'color:#e6e6e6', 'border-radius:10px',
    'padding:18px 22px', 'font:13px/1.5 system-ui,sans-serif', 'user-select:none',
    'width:min(900px,calc(100vw - 48px))', 'max-height:calc(100vh - 48px)',
    'overflow:auto', 'box-shadow:0 10px 40px rgba(0,0,0,0.5)',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'TrainsLab — nastavení';
  title.style.cssText = 'font-weight:600;font-size:16px;margin-bottom:10px';
  dialog.appendChild(title);

  // mřížka sekcí: auto-fill vytvoří tolik sloupců, kolik se vejde (min 16rem na sloupec)
  // → 1 sloupec na mobilu, víc na wide; bez media-queries. align-items:start = sekce
  // nahoře buňky (neroztahují se na výšku nejvyšší v řádku).
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:2px 24px;align-items:start';
  for (const section of SECTIONS) {
    const sec = document.createElement('div');
    const head = document.createElement('div');
    head.textContent = section.title;
    head.style.cssText = 'margin:8px 0 2px;opacity:0.6;font-size:11px;text-transform:uppercase';
    sec.appendChild(head);
    for (const def of section.sliders) {
      // cast přes unknown: cílové params objekty mají jen number pole, ale bez index signatury
      // (slider klíč je string — deklarativní mapování nedrží typovou vazbu na konkrétní interface)
      const target = (
        def.source === 'drone' ? drone :
        def.source === 'wind' ? wind :
        params
      ) as unknown as Record<string, number>;
      sec.appendChild(buildSlider(target, def, handlers));
    }
    grid.appendChild(sec);
  }

  // sekce „Zobrazení": view přepínače (ne params). Zatím jeden — markery napětí spřáhel,
  // default vypnuté (čistá scéna), Lab nástroj na vyžádání. Stejný layout jako sekce sliderů.
  const viewSec = document.createElement('div');
  const viewHead = document.createElement('div');
  viewHead.textContent = 'Zobrazení';
  viewHead.style.cssText = 'margin:8px 0 2px;opacity:0.6;font-size:11px;text-transform:uppercase';
  viewSec.appendChild(viewHead);
  viewSec.appendChild(buildCheckbox('Markery napětí spřáhel', false, (v) => handlers.onCouplerMarkers(v)));
  grid.appendChild(viewSec);

  dialog.appendChild(grid);

  // nápověda kláves ze stejného seznamu akcí (single source); kamera žije v Rendereru
  const keys = document.createElement('div');
  keys.style.cssText = 'margin-top:14px;opacity:0.78;font-size:12px;line-height:1.7;break-inside:avoid';
  keys.innerHTML = [
    '<b>Klávesy</b>',
    ...actions.map((a) => `${a.hint} &nbsp;—&nbsp; ${a.label}`),
    '<b>Kamera</b>',
    'WASD &nbsp;—&nbsp; posun', 'Q / E &nbsp;—&nbsp; výška',
    'Z / X &nbsp;—&nbsp; zoom', 'myš &nbsp;—&nbsp; orbit',
  ].join('<br>');
  dialog.appendChild(keys);

  const ok = document.createElement('button');
  ok.textContent = 'OK';
  ok.style.cssText = BTN_CSS + ';margin-top:14px;padding:8px 28px;background:#2e9e3f;color:#fff;border-color:#2e9e3f';
  dialog.appendChild(ok);

  backdrop.appendChild(dialog);

  const close = (): void => { backdrop.style.display = 'none'; };
  const open = (): void => { backdrop.style.display = 'flex'; };
  ok.addEventListener('click', close);
  // klik na pozadí (mimo dialog) zavře; Esc taky — standardní chování modalu
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') close(); });

  return { backdrop, open };
}

function makeButton(label: string, action: KeyAction): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.title = action.hint; // klávesová zkratka jako tooltip
  btn.style.cssText = BTN_CSS;
  // blur() vrací focus z tlačítka, jinak by klávesy mířily na tlačítko, ne na hru
  if (action.onRelease) {
    // held-key akce (písek): drž tlačítko = aktivní, pusť / odjeď myší = konec — jako
    // přidržení klávesy. Pointer events kvůli myši i dotyku; pointerleave/cancel ošetří
    // „ujetí" mimo tlačítko, aby akce nezůstala viset zapnutá (symetrie s blur u kláves).
    let held = false;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); held = true; action.run(); });
    const stop = (): void => { if (!held) return; held = false; action.onRelease!(); btn.blur(); };
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  } else {
    btn.addEventListener('click', () => {
      action.run();
      btn.blur();
    });
  }
  return btn;
}

// Jeden řádek: popisek + živá hodnota + slider, obousměrně svázaný s target[key].
// target = sdílený params objekt (fyzika nebo dron); oba jsou Record<string, number>.
function buildSlider(target: Record<string, number>, def: SliderDef, handlers: PanelHandlers): HTMLElement {
  const row = document.createElement('label');
  row.style.cssText = 'display:block;margin:4px 0';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between';
  const name = document.createElement('span');
  name.textContent = def.label;
  const value = document.createElement('span');
  value.style.opacity = '0.85';
  head.append(name, value);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(def.min);
  input.max = String(def.max);
  input.step = String(def.step);
  input.value = String(target[def.key]);
  input.style.width = '100%';

  const show = (): void => {
    value.textContent = `${target[def.key]}${def.unit ? ' ' + def.unit : ''}`;
  };
  input.addEventListener('input', () => {
    target[def.key] = Number(input.value);
    show();
    def.action?.(handlers); // side effect navíc (např. přestavba tratě), pokud slider má
  });
  show();

  row.append(head, input);
  return row;
}

// Jeden řádek: checkbox + popisek pro view přepínač (boolean stav mimo params).
// `initial` musí odpovídat výchozímu stavu ve view (jinak by UI lhalo o realitě).
function buildCheckbox(label: string, initial: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initial;
  input.addEventListener('change', () => onChange(input.checked));

  const name = document.createElement('span');
  name.textContent = label;

  row.append(input, name);
  return row;
}
