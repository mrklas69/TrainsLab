/**
 * Laditelné fyzikální parametry — single source of truth (DRY).
 * Tutéž instanci sdílí fyzika ({@link Body}) i UI slidery, takže posun
 * slideru mění chování okamžitě za běhu (laboratoř = knoby na hypotézy).
 */
export interface PhysicsParams {
  carMass: number;           // hmotnost vagonu (kg)
  locomotiveMass: number;    // hmotnost lokomotivy (kg) — i adhezní tíha N
  gravity: number;           // tíhové zrychlení (m/s²)
  rollingResistance: number; // valivý odpor Crr za jízdy (ocel-ocel ≈ 0.002)
  startingResistanceFactor: number; // statický odpor = Crr × tento faktor (rozběh)
  dragCoefficient: number;   // odpor vzduchu b ve F = b·v·|v| (kg/m)
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
  trackAmplitude: number;    // výška mostu nad/pod střednicí (m) — geometrie světa, viz makeLoopControlPoints
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
  dragCoefficient: 1.2,
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
  trackAmplitude: 4,
  trackGauge: 1.435, // normální rozchod
  comHeight: 1.2,    // těžiště níže posazeného vozu — práh převrácení výš, méně náchylné k vykolejení
  suspensionFreq: 0.6,     // pomalé houpání skříně (Hz)
  suspensionDamping: 0.25, // lehce dotlumené — pár kmitů doznívá
  coalCapacity: 1500,  // ~250 s plného výkonu (demo dojezd)
  waterCapacity: 5000, // při waterRate dojde dřív než uhlí (~130 s) — zastávky na vodu
  coalRate: 6,
  waterRate: 38,       // voda dochází první i při míchaném režimu (idle uhlí ji jinak dotáhne)
};
