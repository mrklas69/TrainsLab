import type { PhysicsParams } from '../sim/params';
import type { Train } from '../sim/Train';

// Jeden zdroj pravdy o klávesové akci: pohání keydown handler (codes), nápovědu
// v panelu (hint) i tlačítko (label). Dřív bylo mapování rozeseté na 3 místa.
export interface KeyAction {
  codes: string[];          // e.code hodnoty, na které akce reaguje (víc = aliasy)
  hint: string;             // popis kláves pro nápovědu/tlačítko, např. 'W / ↑'
  label: string;            // co akce dělá, např. 'Stupeň +'
  preventDefault?: boolean; // šipky/mezerník jinak scrollují stránku
  run: () => void;
}

// Side-effekty sliderů nad rámec zápisu do params (runtime callbacky z main).
export interface PanelHandlers {
  onAmplitudeChange: () => void; // slider sklonu → přestavba tratě (sim + view)
}

interface SliderDef {
  key: keyof PhysicsParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
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
      // výška mostu přestaví geometrii (action) — strmější najezd = výraznější slack action
      // (k mostu draft, pod most buff); zároveň clearance mostu = 2× tahle hodnota
      { key: 'trackAmplitude', label: 'Sklon (výška mostu)', min: 0, max: 8, step: 0.2, unit: 'm',
        action: (h) => h.onAmplitudeChange() },
    ],
  },
  {
    title: 'Hmotnosti',
    sliders: [
      { key: 'locomotiveMass', label: 'Lokomotiva', min: 20000, max: 120000, step: 2000, unit: 'kg' },
      { key: 'carMass', label: 'Vagon', min: 5000, max: 100000, step: 1000, unit: 'kg' },
    ],
  },
  {
    title: 'Odpory',
    sliders: [
      { key: 'gravity', label: 'Gravitace', min: 0, max: 20, step: 0.1, unit: 'm/s²' },
      { key: 'rollingResistance', label: 'Valivý odpor', min: 0, max: 0.05, step: 0.001, unit: '' },
      { key: 'startingResistanceFactor', label: 'Rozběhový faktor', min: 1, max: 6, step: 0.1, unit: '×' },
      { key: 'dragCoefficient', label: 'Odpor vzduchu', min: 0, max: 50, step: 0.5, unit: '' },
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
      { key: 'adhesionCoeff', label: 'Adheze μ', min: 0, max: 0.5, step: 0.01, unit: '' },
      { key: 'brakeForceMax', label: 'Brzda', min: 0, max: 400_000, step: 10_000, unit: 'N' },
    ],
  },
  {
    // práh převrácení = (rozchod/2)/výška_těžiště · g; užší rozchod nebo vyšší těžiště → dřív
    title: 'Příčná dynamika',
    sliders: [
      { key: 'trackGauge', label: 'Rozchod koleje', min: 1, max: 2, step: 0.05, unit: 'm' },
      { key: 'comHeight', label: 'Výška těžiště', min: 0.5, max: 4, step: 0.1, unit: 'm' },
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

/**
 * Overlay panel: živý status soupravy, slidery fyzikálních parametrů (mutují
 * sdílenou {@link PhysicsParams} → fyzika reaguje hned) a tlačítka řízení.
 * Vrací funkci pro aktualizaci statusu, volanou každý frame.
 */
export function createControlPanel(
  params: PhysicsParams,
  actions: KeyAction[],
  handlers: PanelHandlers,
): (train: Train) => void {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'padding:12px 14px',
    'background:rgba(20,22,26,0.82)', 'color:#e6e6e6', 'border-radius:8px',
    'font:13px/1.5 system-ui,sans-serif', 'min-width:280px', 'user-select:none',
    'max-height:calc(100vh - 24px)', 'overflow:auto',
  ].join(';');

  // --- hlavička: titulek + minimalizační přepínač + živý status ---
  // Hlavička je oddělená od ovládání (slidery/tlačítka v `body`): klik na ni
  // schová jen tělo, titulek a telemetrie zůstanou vidět i po minimalizaci.
  const header = document.createElement('div');

  const titleRow = document.createElement('div');
  // celá řádka je klikací přepínač; cursor:pointer to napovídá
  titleRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;cursor:pointer';
  const title = document.createElement('div');
  title.textContent = 'TrainsLab';
  title.style.cssText = 'font-weight:600';
  const toggle = document.createElement('span'); // indikátor stavu: − rozbaleno / + sbaleno
  toggle.style.cssText = 'opacity:0.7;font-size:16px;line-height:1;padding-left:10px';
  titleRow.append(title, toggle);

  const status = document.createElement('div');
  status.style.cssText = 'margin:6px 0 4px;font-variant-numeric:tabular-nums';

  header.append(titleRow, status);
  panel.appendChild(header);

  // --- tělo: vlastní ovládání (slidery + nápověda + tlačítka), minimalizovatelné ---
  const body = document.createElement('div');

  for (const section of SECTIONS) {
    const head = document.createElement('div');
    head.textContent = section.title;
    head.style.cssText = 'margin:10px 0 2px;opacity:0.6;font-size:11px;text-transform:uppercase';
    body.appendChild(head);
    for (const def of section.sliders) body.appendChild(buildSlider(params, def, handlers));
  }

  // nápověda kláves i tlačítka se generují ze stejného seznamu akcí (single source)
  const keys = document.createElement('div');
  keys.style.cssText = 'margin-top:10px;opacity:0.78;font-size:12px;line-height:1.7';
  keys.innerHTML = [
    '<b>Klávesy</b>',
    ...actions.map((a) => `${a.hint} &nbsp;—&nbsp; ${a.label}`),
    // ovládání kamery žije v Rendereru (held-key model), tady jen popis
    '<b>Kamera</b>',
    'WASD &nbsp;—&nbsp; posun',
    'Q / E &nbsp;—&nbsp; výška',
    'Z / X &nbsp;—&nbsp; zoom',
    'myš &nbsp;—&nbsp; orbit',
  ].join('<br>');
  body.appendChild(keys);

  for (const a of actions) body.appendChild(makeButton(`${a.label}  (${a.hint})`, a.run));

  panel.appendChild(body);

  // přepínač minimalizace: klik na hlavičku sbalí/rozbalí tělo a překlopí indikátor
  let collapsed = false;
  const applyCollapsed = (): void => {
    body.style.display = collapsed ? 'none' : 'block';
    toggle.textContent = collapsed ? '+' : '−';
  };
  titleRow.addEventListener('click', () => {
    collapsed = !collapsed;
    applyCollapsed();
  });
  applyCollapsed(); // výchozí stav = rozbaleno

  document.body.appendChild(panel);

  return (train: Train): void => {
    const n = train.notch;
    const notch = n > 0 ? `+${n}` : String(n);
    const flags =
      (train.derailed ? ` · VYKOLEJENO při ${train.derailSpeed.toFixed(1)} m/s` : '') +
      (train.isBraking ? ' · BRZDA' : '') +
      (train.slipping ? ' · PROKLUZ' : '') +
      // klesající/nulový parní tlak — vidět jen při otevřeném regulátoru (jinak tah neřešíme)
      (train.notch !== 0 && train.steamPressure === 0 ? ' · BEZ PÁRY'
        : train.notch !== 0 && train.steamPressure < 1 ? ' · DOCHÁZÍ PÁRA' : '');
    // příčné (odstředivé) zrychlení / práh převrácení — blízkost meze je vidět v čísle
    const lat = train.lateralAcceleration.toFixed(1);
    const limit = train.overturnThreshold.toFixed(1);
    const coal = (train.coalFraction * 100).toFixed(0);
    const water = (train.waterFraction * 100).toFixed(0);
    status.textContent =
      `Regulátor ${notch} · ${train.speed.toFixed(1)} m/s · příč ${lat}/${limit} m/s²` +
      ` · uhlí ${coal} % · voda ${water} %${flags}`;
  };
}

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = 'margin-top:6px;width:100%;padding:6px;cursor:pointer';
  // blur() vrací focus z tlačítka, jinak by klávesy mířily na tlačítko, ne na hru
  btn.addEventListener('click', () => {
    onClick();
    btn.blur();
  });
  return btn;
}

// Jeden řádek: popisek + živá hodnota + slider, obousměrně svázaný s params[key].
function buildSlider(params: PhysicsParams, def: SliderDef, handlers: PanelHandlers): HTMLElement {
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
  input.value = String(params[def.key]);
  input.style.width = '100%';

  const show = (): void => {
    value.textContent = `${params[def.key]}${def.unit ? ' ' + def.unit : ''}`;
  };
  input.addEventListener('input', () => {
    params[def.key] = Number(input.value);
    show();
    def.action?.(handlers); // side effect navíc (např. přestavba tratě), pokud slider má
  });
  show();

  row.append(head, input);
  return row;
}
