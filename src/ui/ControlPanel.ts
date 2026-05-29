import type { PhysicsParams } from '../sim/params';
import type { Train } from '../sim/Train';

interface SliderDef {
  key: keyof PhysicsParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  // volitelná akce po posunu (vedle zápisu do params) — např. přestavba tratě.
  // Většina sliderů jen mutuje sdílenou params; tahle hrstka má i side effect.
  action?: (controls: PanelControls) => void;
}

interface Section {
  title: string;
  sliders: SliderDef[];
}

export interface PanelControls {
  onReset: () => void;
  onNotchUp: () => void;
  onNotchDown: () => void;
  onBrake: () => void;
  onMute: () => void;
  onAmplitudeChange: () => void; // slider sklonu → přestavba tratě (sim + view)
}

// Deklarativní popis sliderů ve skupinách — všechny se generují stejně (izomorfismus).
const SECTIONS: Section[] = [
  {
    title: 'Trať',
    sliders: [
      // sklon přestaví geometrii (action) — vidíš slack action: do kopce draft, z kopce buff
      { key: 'trackAmplitude', label: 'Sklon (výška kopců)', min: 0, max: 4, step: 0.1, unit: 'm',
        action: (c) => c.onAmplitudeChange() },
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
];

/**
 * Overlay panel: živý status soupravy, slidery fyzikálních parametrů (mutují
 * sdílenou {@link PhysicsParams} → fyzika reaguje hned) a tlačítka řízení.
 * Vrací funkci pro aktualizaci statusu, volanou každý frame.
 */
export function createControlPanel(
  params: PhysicsParams,
  controls: PanelControls,
): (train: Train) => void {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'padding:12px 14px',
    'background:rgba(20,22,26,0.82)', 'color:#e6e6e6', 'border-radius:8px',
    'font:13px/1.5 system-ui,sans-serif', 'min-width:280px', 'user-select:none',
    'max-height:calc(100vh - 24px)', 'overflow:auto',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'TrainsLab — F2';
  title.style.cssText = 'font-weight:600;margin-bottom:6px';
  panel.appendChild(title);

  const status = document.createElement('div');
  status.style.cssText = 'margin-bottom:8px;font-variant-numeric:tabular-nums';
  panel.appendChild(status);

  for (const section of SECTIONS) {
    const head = document.createElement('div');
    head.textContent = section.title;
    head.style.cssText = 'margin:10px 0 2px;opacity:0.6;font-size:11px;text-transform:uppercase';
    panel.appendChild(head);
    for (const def of section.sliders) panel.appendChild(buildSlider(params, def, controls));
  }

  const keys = document.createElement('div');
  keys.style.cssText = 'margin-top:10px;opacity:0.78;font-size:12px;line-height:1.7';
  keys.innerHTML = [
    '<b>Klávesy</b>',
    'W / ↑ &nbsp;—&nbsp; přidat stupeň',
    'S / ↓ &nbsp;—&nbsp; ubrat stupeň',
    'B / mezerník &nbsp;—&nbsp; brzda',
    'R &nbsp;—&nbsp; reset',
    'M &nbsp;—&nbsp; zvuk on/off',
  ].join('<br>');
  panel.appendChild(keys);

  panel.appendChild(makeButton('Stupeň +  (W)', controls.onNotchUp));
  panel.appendChild(makeButton('Stupeň −  (S)', controls.onNotchDown));
  panel.appendChild(makeButton('Brzda (B)', controls.onBrake));
  panel.appendChild(makeButton('Zvuk (M)', controls.onMute));
  panel.appendChild(makeButton('Reset (R)', controls.onReset));

  document.body.appendChild(panel);

  return (train: Train): void => {
    const n = train.notch;
    const notch = n > 0 ? `+${n}` : String(n);
    const flags =
      (train.isBraking ? ' · BRZDA' : '') + (train.slipping ? ' · PROKLUZ' : '');
    status.textContent = `Regulátor ${notch} · ${train.speed.toFixed(1)} m/s${flags}`;
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
function buildSlider(params: PhysicsParams, def: SliderDef, controls: PanelControls): HTMLElement {
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
    def.action?.(controls); // side effect navíc (např. přestavba tratě), pokud slider má
  });
  show();

  row.append(head, input);
  return row;
}
