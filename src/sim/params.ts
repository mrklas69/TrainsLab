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
  adhesionCoeff: number;     // součinitel adheze kolo-kolej μ (sucho ≈ 0.30)
  brakeForceMax: number;     // max brzdná síla lokomotivy (N)
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
  adhesionCoeff: 0.3,
  brakeForceMax: 180_000,
};
