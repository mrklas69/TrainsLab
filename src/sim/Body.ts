import type { TrackNetwork } from './TrackNetwork';
import type { PhysicsParams } from './params';

const V_STATIC = 0.05; // m/s — pod tímhle se těleso považuje za stojící
const MAX_LEAN = 0.7;  // rad (~40°) — strop náklonu/klování skříně, ať se mesh nepřetočí naruby
// empirický útlum výchylky: bodová hmota θ=a/(ω²h) výchylku přestřeluje — skutečná skříň má
// větší moment setrvačnosti a střed klopení výš, reálný náklon je jen zlomek.
const ROLL_GAIN = 0.2;  // náklon v oblouku
const PITCH_GAIN = 0.1; // klování o polovinu jemnější — vlaky vpřed/vzad klovou minimálně

// ořež úhel do ±MAX_LEAN (extrémně měkké vypružení by jinak skříň přetočilo)
function clampAngle(a: number): number {
  return Math.min(Math.max(a, -MAX_LEAN), MAX_LEAN);
}

/**
 * Jedno vozidlo soupravy jako 1D hmota na trati.
 *
 * Drží stav (`s`, `v`) a akumulátor sil pro aktuální krok. Vlastní hmotnost
 * nedrží — předává ji {@link Train} (lokomotiva je těžší než vagon). Integraci
 * řídí {@link Train}, protože spřáhla tělesa provazují.
 */
export class Body {
  v = 0;
  accel = 0; // podélné zrychlení z posledního kroku (dv/dt) — buzení klování (pitch)
  private force = 0;

  // --- vypružení skříně: rotační stav (DD-02: rotace nemění s/v, model zůstává 1D) ---
  roll = 0;     // náklon kolem podélné osy (rad) — vyklonění v oblouku
  rollVel = 0;  // úhlová rychlost rollu (rad/s)
  pitch = 0;    // klování kolem příčné osy (rad) — z podélného zrychlení
  pitchVel = 0; // úhlová rychlost pitche (rad/s)

  constructor(
    public seg: number,      // index segmentu trati, na kterém vůz je (viz TrackNetwork)
    public s: number,        // lokální arc-length pozice středu vozu na segmentu (m)
    readonly length: number, // délka vozu (m), pro render i rozteč spřáhel
  ) {}

  /** Přičti sílu do akumulátoru tohoto kroku (volá {@link Coupler}, trakce, brzda). */
  applyForce(force: number): void {
    this.force += force;
  }

  /**
   * Začátek kroku: akumulátor sil nezávislých na spřáhlech a trakci, dvě skupiny:
   *
   * **Geometrické** (z polohy `s` na trati, rychlostně nezávislé v magnitudě):
   *  - **gravitace** (−m·g·sinθ) — `grade(s)` = sin sklonu; do kopce brzdí.
   *  - **odpor v oblouku** (−C·|κ|·m·g) — tření okolků + prokluz kol na pevné nápravě
   *    (vnější kolo urazí delší dráhu). Specifický odpor `C·|κ|` je úměrný křivosti
   *    (Röcklův charakter `c/r`, ale `κ` je konečné → bez exploze u malých `r` jako u nás).
   *    Branžově **rychlostně nezávislý** — proto jen `sign(v)`, ne `v` v magnitudě.
   *
   * **Rychlostní** (Davisova rovnice `R(v) = A + B·v + C·v²`, člen A = {@link applyFriction}):
   *  - **B·v** (`davisB`) — lineární: tření v ložiskách, dynamické ztráty náprav.
   *  - **C·v²** (`dragCoefficient`) — odpor vzduchu (kvadratický).
   *
   * Všechny odporové členy proti pohybu (znaménko `v`). Drží DD-02: `κ` je jen skalár,
   * křivkový odpor je podélná síla (mění `v` podél `s`), nezavádí příčný DOF.
   */
  beginStep(network: TrackNetwork, params: PhysicsParams, mass: number): void {
    const grade = network.grade(this);                 // sin(θ)
    const curvature = network.signedCurvature(this);   // 1/m; přes uzel vzorkuje sousední segment
    const fGravity = -mass * params.gravity * grade;   // do kopce brzdí
    // odpor v oblouku: specifický C·|κ| (bezrozm.) krát tíha; proti pohybu (sign), na rovince κ=0 → 0
    const fCurve = -Math.sign(this.v) * params.curveResistance * Math.abs(curvature) * mass * params.gravity;
    const fDavisB = -params.davisB * this.v;                    // lineární člen B·v
    const fDrag = -params.dragCoefficient * this.v * Math.abs(this.v); // kvadratický člen C·v²
    this.force = fGravity + fCurve + fDavisB + fDrag;
  }

  /**
   * Tření kolo-kolej jako statické/kinetické. Stojící těleso drží statický odpor
   * (vyšší — rozběhový), dokud ho ostatní síly nepřekonají; pak se „utrhne" na
   * kinetický valivý odpor. Tohle dává vůli ve spřáhle funkční smysl: lokomotiva
   * vybírá vůli a utrhává vozy postupně, ne celou soupravu naráz.
   *
   * `brakeForce` (≥ 0) je řízená brzda jako dodatečný odpor (jen lokomotiva, DD-09):
   * zvyšuje statický práh → drží stojící vlak i na svahu; přidává kinetický odpor
   * → brzdí za jízdy. Tah se počítá nezávisle, takže o pohybu rozhodne souboj sil.
   */
  applyFriction(params: PhysicsParams, mass: number, brakeForce = 0): void {
    const rolling = mass * params.gravity * params.rollingResistance;
    const kinetic = rolling + brakeForce;
    const isStanding = Math.abs(this.v) < V_STATIC;

    if (isStanding) {
      const staticMax = rolling * params.startingResistanceFactor + brakeForce;
      if (Math.abs(this.force) <= staticMax) {
        // statické tření (+ brzda) udrží těleso v klidu
        this.force = 0;
        this.v = 0;
      } else {
        // utrhlo se — odpor proti směru působící síly
        this.force -= Math.sign(this.force) * kinetic;
      }
    } else {
      this.force -= Math.sign(this.v) * kinetic;
    }
  }

  /**
   * Semi-implicitní Euler z naakumulované síly: nejdřív rychlost, pak poloha.
   *
   * `rotatingFactor` (λ) je rotující hmota: efektivní **setrvačná** hmota je `m·(1+λ)`
   * (roztáčení kol/náprav/ojnic přidá setrvačnost). Jen převod síla→zrychlení — síly už
   * jsou spočtené ze skutečného `mass` (gravitace/odpory/adheze). λ=0 → beze změny.
   */
  integrate(h: number, mass: number, rotatingFactor = 0): void {
    const inertialMass = mass * (1 + rotatingFactor);
    this.accel = this.force / inertialMass; // ulož zrychlení pro klování skříně (pitch)
    this.v += this.accel * h;
    this.s += this.v * h;
  }

  /**
   * Vypružení skříně jako tlumený torzní oscilátor (DD-02: jen rotace, nemění s/v).
   *
   * Cílový (rovnovážný) úhel je úměrný zrychlení: příčné `a_lat` klopí skříň do strany (roll),
   * podélné `a` klová nos (pitch). Měkčí vypružení (nižší ω) se klopí víc i kýve pomaleji —
   * tuhost a výchylka jsou tak fyzikálně provázané (θ_rovn = a / (ω²·h)). Pružina + tlumení
   * úhel dohánějí: θ'' = ω²(θ_cíl − θ) − 2ζω·θ' (semi-implicitní Euler jako zbytek integrace).
   *
   * @param latAccelSigned znaménkové příčné zrychlení v²·κ (m/s²) — znaménko = strana náklonu
   * @param longAccel      podélné zrychlení dv/dt (m/s²) — klování
   */
  updateSuspension(params: PhysicsParams, latAccelSigned: number, longAccel: number, h: number): void {
    const omega = 2 * Math.PI * params.suspensionFreq; // vlastní úhlová frekvence (rad/s)
    const zeta = params.suspensionDamping;             // poměrné tlumení
    const k = omega * omega * params.comHeight;         // jmenovatel rovnovážného úhlu

    // rovnovážné úhly. roll: − = vyklonění VEN z oblouku. clamp brání přetočení skříně.
    const rollTarget = clampAngle(-ROLL_GAIN * latAccelSigned / k);
    const pitchTarget = clampAngle(PITCH_GAIN * longAccel / k);

    // tlumený oscilátor, semi-implicitně (nejdřív úhlová rychlost, pak úhel)
    const rollAcc = omega * omega * (rollTarget - this.roll) - 2 * zeta * omega * this.rollVel;
    this.rollVel += rollAcc * h;
    this.roll += this.rollVel * h;

    const pitchAcc = omega * omega * (pitchTarget - this.pitch) - 2 * zeta * omega * this.pitchVel;
    this.pitchVel += pitchAcc * h;
    this.pitch += this.pitchVel * h;
  }

  /**
   * Vnější impuls do kývání skříně — ťuknutí do úhlové rychlosti oscilátoru (rázy z trati:
   * dilatační spáry → pitch, skok křivosti / výhybky → roll). Mění **jen rotaci, ne `s`/`v`**
   * (drží DD-02). Oscilátor v {@link updateSuspension} kmit následně dotlumí — tak vznikne
   * klikot (periodické spáry) i boční trh (bodová nespojitost), emergentně jako vlna soupravou.
   */
  applyImpulse(rollKick: number, pitchKick: number): void {
    this.rollVel += rollKick;
    this.pitchVel += pitchKick;
  }
}
