import { Body } from './Body';
import { Coupler } from './Coupler';
import type { Track } from './Track';
import type { PhysicsParams } from './params';

const SUBSTEPS = 8;        // tužší spřáhla → víc substepů pro stabilitu integrátoru
const COUPLER_GAP = 0.6;   // konstrukční mezera mezi vozy ve středu vůle (m)
const MAX_FORWARD = 3;     // stupňů regulátoru vpřed
const MAX_REVERSE = 1;     // stupňů vzad (couvání slabší)
const V_POWER = 1.0;       // m/s — pod tím drží konstantní max síla (jinak P/v → ∞)
const V_PLUGGING = 1.0;    // m/s — nad tím je reverz proti pohybu protiproudé brzdění, ne couvání

/**
 * Souprava = řetězec {@link Body} propojený {@link Coupler}y, v čele lokomotiva.
 *
 * Řídí integraci za celou soupravu (spřáhla tělesa provazují) a drží stav řízení
 * lokomotivy: regulátor (notch), brzda. Tažná síla je omezená výkonem (P/v) i
 * adhezí kolo-kolej; překročení adheze = prokluz ({@link slipping}).
 */
export class Train {
  readonly bodies: Body[];
  slipping = false; // prokluz hnacích kol — čte renderer (DD-01)

  readonly couplers: Coupler[]; // stav spřáhel čte audio/vizualizace (DD-01)
  private readonly restGaps: number[];
  private throttle = 0; // −MAX_REVERSE..MAX_FORWARD
  private braking = false;

  constructor(
    private readonly track: Track,
    private readonly params: PhysicsParams,
    carLengths: number[], // [0] = lokomotiva (čelo), dál vagony
    private readonly startS = 0,
  ) {
    this.bodies = carLengths.map((length) => new Body(0, length));

    this.restGaps = [];
    for (let i = 0; i < this.bodies.length - 1; i++) {
      this.restGaps.push(
        this.bodies[i].length / 2 + COUPLER_GAP + this.bodies[i + 1].length / 2,
      );
    }
    this.couplers = this.restGaps.map(
      (gap, i) => new Coupler(this.bodies[i], this.bodies[i + 1], gap),
    );

    this.reset();
  }

  // --- řízení lokomotivy ---

  notchUp(): void {
    this.throttle = Math.min(this.throttle + 1, MAX_FORWARD);
  }

  notchDown(): void {
    this.throttle = Math.max(this.throttle - 1, -MAX_REVERSE);
  }

  toggleBrake(): void {
    this.braking = !this.braking;
  }

  get notch(): number {
    return this.throttle;
  }

  get isBraking(): boolean {
    return this.braking;
  }

  /** Rychlost lokomotivy (m/s) — pro UI. */
  get speed(): number {
    return this.bodies[0].v;
  }

  /** Souprava do klidu, vozy v klidové rozteči za lokomotivou, řízení vynulováno. */
  reset(): void {
    let s = this.startS;
    this.bodies[0].s = s;
    this.bodies[0].v = 0;
    for (let i = 1; i < this.bodies.length; i++) {
      s -= this.restGaps[i - 1];
      this.bodies[i].s = s;
      this.bodies[i].v = 0;
    }
    this.throttle = 0;
    this.braking = false;
    this.slipping = false;
  }

  update(dt: number): void {
    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this.step(h);
  }

  // jeden substep: vlastní síly → spřáhla → trakce/brzda → tření → integrace.
  private step(h: number): void {
    for (let i = 0; i < this.bodies.length; i++) {
      this.bodies[i].beginStep(this.track, this.params, this.massOf(i));
    }
    for (const coupler of this.couplers) coupler.apply(this.params);

    this.applyLocomotive();

    // brzda působí jen na lokomotivu (index 0), jako řízený odpor v tření (DD-09)
    const brake = this.brakeForce();
    for (let i = 0; i < this.bodies.length; i++) {
      const mass = this.massOf(i);
      this.bodies[i].applyFriction(this.params, mass, i === 0 ? brake : 0);
      this.bodies[i].integrate(h, mass);
    }
  }

  // adhezní strop μ·N (tíha lokomotivy = adhezní tíha N) — max přenositelná síla
  // kolo-kolej; společný limit pro tah, protiproudé brzdění i provozní brzdu.
  private get adhesionLimit(): number {
    return this.params.adhesionCoeff * this.params.locomotiveMass * this.params.gravity;
  }

  // brzdná síla lokomotivy, limitovaná adhezí (μ·N); 0 = nebrzdí
  private brakeForce(): number {
    if (!this.braking) return 0;
    return Math.min(this.params.brakeForceMax, this.adhesionLimit);
  }

  // lokomotiva (index 0) je těžší — a její tíha je adhezní tíha N.
  private massOf(index: number): number {
    return index === 0 ? this.params.locomotiveMass : this.params.carMass;
  }

  // tah omezený výkonem (P/v) i adhezí (μ·N). Brzda je řízené tření (DD-09), řeší se
  // v applyFriction — tah a brzda se tak perou ve společném akumulátoru sil.
  // Tah proti směru pohybu = protiproudé brzdění (plugging): limit jen adheze, ne P/v (DD-08).
  private applyLocomotive(): void {
    const loco = this.bodies[0];
    const adhesionLimit = this.adhesionLimit; // μ·N

    if (this.throttle === 0) {
      this.slipping = false;
      return;
    }

    // požadovaný směr tahu (±1)
    const dir = Math.sign(this.throttle);

    // Tah proti směru pohybu = protiproudé brzdění (plugging). Výkonová hyperbola
    // P/v platí jen pro zrychlování (motor sype energii do pohybu); proti pohybu sílu
    // nelimituje — strop je adheze (a konstrukční F_max), tedy plný tah na brzdění.
    const counterPressure = Math.abs(loco.v) > V_PLUGGING && Math.sign(loco.v) !== dir;

    // Velikost úsilí (0..1). Při zrychlování jemně po stupních (MAX_FORWARD). Protiproudé
    // brzdění je naopak inherentně naplno — motor zabírá proti rotujícím kolům, snadno
    // překoná adhezi → skid (prokluz při brzdění). Proto fraction = 1, ne dělení stupni (DD-10).
    const fraction = counterPressure ? 1 : Math.abs(this.throttle) / MAX_FORWARD;
    const available = counterPressure
      ? this.params.tractiveForceMax
      : Math.min(
          this.params.tractiveForceMax,
          this.params.maxPower / Math.max(Math.abs(loco.v), V_POWER),
        );
    const requested = dir * fraction * available;

    // adheze: nad limitem kola prokluzují (i při brzdění reverzem = skid), přenese se jen μ·N
    this.slipping = Math.abs(requested) > adhesionLimit;
    const tractive = this.slipping
      ? Math.sign(requested) * adhesionLimit
      : requested;
    loco.applyForce(tractive);
  }
}
