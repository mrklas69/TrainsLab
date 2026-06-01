/**
 * Laditelné fyzikální parametry — single source of truth (DRY).
 * Tutéž instanci sdílí fyzika ({@link Body}) i UI slidery, takže posun
 * slideru mění chování okamžitě za běhu (laboratoř = knoby na hypotézy).
 */
export interface PhysicsParams {
  carMass: number;           // hmotnost vagonu (kg)
  locomotiveMass: number;    // hmotnost lokomotivy (kg) — i adhezní tíha N
  gravity: number;           // tíhové zrychlení (m/s²)
  rollingResistance: number; // valivý odpor Crr za jízdy (ocel-ocel ≈ 0.002) — člen A Davisovy rovnice
  startingResistanceFactor: number; // statický odpor = Crr × tento faktor (rozběh)
  davisB: number;            // lineární člen B·v Davisovy rovnice odporu (N·s/m) — ložiska, dynamické ztráty
  dragCoefficient: number;   // odpor vzduchu b ve F = b·v·|v| (kg/m) — člen C·v² Davisovy rovnice
  curveResistance: number;   // odpor v oblouku: specifický odpor = curveResistance·|κ| (jako Crr, bezrozm.), ·m·g; rychlostně nezávislý (Röcklův charakter c/r), [m]
  couplerSlack: number;      // vůle spřáhla — šířka mrtvého pásma (m)
  couplerStiffness: number;  // tuhost pružiny spřáhla za vůlí (N/m)
  couplerDamping: number;    // tlumení spřáhla (N·s/m)
  maxPower: number;          // výkon lokomotivy (W) — TE = min(F_max, P/v)
  tractiveForceMax: number;  // strop tažné síly při nízké rychlosti (N)
  driverDiameter: number;    // průměr hnacího kola (m) — „převod": větší kolo → vyšší v_max
  maxPistonSpeed: number;    // mezní střední pístová rychlost (m/s) — otáčkový strop tahu
  adhesionCoeff: number;     // součinitel adheze kolo-kolej μ za sucha (≈ 0.30) — pískovaná μ
  railFactor: number;        // stav koleje 0..1: 1 = sucho, níž = mokro/listí. eff. μ = adhesionCoeff·railFactor
  sandCapacity: number;      // kapacita pískoven (kg) — spotřební zásoba jako uhlí/voda
  sandRate: number;          // spotřeba písku při pískování (kg/s)
  brakeForceMax: number;     // max brzdná síla lokomotivy (N)
  brakeFade: number;         // 0..1 — pokles tření špalíkové brzdy s rychlostí (μ(v)); 0 = konstantní, 0.4 = −40 % při vysoké v
  trackAmplitude: number;    // amplituda terénních vln pod tratí (m) — sklon pro slack action (DD-20); most fixní
  railLength: number;        // m — rozteč dilatačních spár (klikot ∝ rychlost); velká = svařovaná kolej (bez tiku)
  trackImpulse: number;      // bezrozm. síla rázů z trati (spáry + skok křivosti/výhybky); 0 = ideální hladká trať
  transitionQuality: number; // 0..1 — kvalita přechodnic (klotoid): 1 = dokonalá (0 κ-trh), 0 = žádná (plný boční trh)
  trackGauge: number;        // rozchod koleje (m) — báze kol, polovina = rameno proti převrácení
  comHeight: number;         // výška těžiště vozu nad kolejí (m) — páka odstředivky při převrácení
  suspensionFreq: number;    // Hz — vlastní frekvence kývání skříně (nižší = měkčí, víc se klopí)
  suspensionDamping: number; // poměrné tlumení ζ kývání (0 = nedotlumené, 1 = kritické)
  coalCapacity: number;      // kapacita uhlí v tendru (kg)
  waterCapacity: number;     // kapacita vody v tendru (kg)
  coalRate: number;          // spotřeba uhlí při plně otevřeném regulátoru (kg/s)
  waterRate: number;         // spotřeba vody při plně otevřeném regulátoru (kg/s)
}

export const DEFAULT_PARAMS: PhysicsParams = {
  carMass: 30000,
  locomotiveMass: 60000,
  gravity: 9.81,
  rollingResistance: 0.002,
  startingResistanceFactor: 3,
  davisB: 20,          // lineární odpor (N·s/m per vůz): při 20 m/s ≈ 400 N, řádově jako valivý — doladí dojezd
  dragCoefficient: 1.2,
  curveResistance: 0.15,  // v laloku (r≈33 m, κ≈0,03) specifický odpor ≈ 0,0045 ≈ 2× valivý — citelné přibrzdění v zatáčce
  couplerSlack: 0.4,
  couplerStiffness: 2_000_000,
  couplerDamping: 60_000,
  maxPower: 600_000,
  tractiveForceMax: 200_000,
  driverDiameter: 1.5,  // smíšená lokomotiva → v_mech ≈ 23 m/s (~83 km/h)
  maxPistonSpeed: 6.5,  // klasická mez střední pístové rychlosti (moderní stroje víc)
  adhesionCoeff: 0.3,
  railFactor: 1.0,     // výchozí suchá kolej — hráč ji stáhne na mokro/listí, pak dá písek smysl
  sandCapacity: 100,   // ~20 s pískování při sandRate (krátké dávky v krizi adheze)
  sandRate: 5,
  brakeForceMax: 180_000,
  brakeFade: 0.4,      // litinový špalík: tření při vysoké rychlosti ~−40 % → decelerace roste, jak vlak zpomaluje

  trackAmplitude: 4,
  railLength: 20,       // klasická kolejnice ~18–25 m → tikot „klikety-klak" se škáluje rychlostí
  trackImpulse: 0.012,  // jemné cuknutí skříně; 0 = dokonalá trať (svařovaná + přechodnice)
  transitionQuality: 0.3, // mírná přechodnice — κ-trh znát, ale ne plný (1 = úplně rozetřený, 0 = ostrý)
  trackGauge: 1.435, // normální rozchod
  comHeight: 0.9,    // nízké těžiště (rám, kola, nápravy, podvozek dole) → práh převrácení ~7,8 m/s²; výrazně méně náchylné k překlopení
  suspensionFreq: 0.6,     // pomalé houpání skříně (Hz)
  suspensionDamping: 0.25, // lehce dotlumené — pár kmitů doznívá
  coalCapacity: 1500,  // ~250 s plného výkonu (demo dojezd)
  waterCapacity: 5000, // při waterRate dojde dřív než uhlí (~130 s) — zastávky na vodu
  coalRate: 6,
  waterRate: 38,       // voda dochází první i při míchaném režimu (idle uhlí ji jinak dotáhne)
};
