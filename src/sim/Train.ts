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

const COAL_IDLE_FRACTION = 0.1; // oheň hoří i naprázdno: idle spotřeba = 10 % plné (jen uhlí)
const STEAM_RESERVE = 0.15;     // pod 15 % menší zásoby klesá parní tlak → tah (vlak dojíždí)

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
  derailed = false; // vykolejeno převrácením — fail state, čeká na reset (čte renderer)
  derailSpeed = 0;  // rychlost lokomotivy v okamžiku vykolejení (m/s) — diagnostika do UI

  readonly couplers: Coupler[]; // stav spřáhel čte audio/vizualizace (DD-01)
  private readonly restGaps: number[];
  private throttle = 0; // −MAX_REVERSE..MAX_FORWARD
  private braking = false;
  coal = 0;  // zásoba uhlí (kg) — čte UI
  water = 0; // zásoba vody (kg) — čte UI

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

  /**
   * Největší příčné (odstředivé) zrychlení v soupravě (m/s²): max |v²/r| přes vozy.
   *
   * Odvozená diagnostika příčné dynamiky (DD-11): kolmá k jízdě → nemění `s`/`v`,
   * takže drží 1D model (DD-02). Podklad pro budoucí kritérium převrácení a klopení
   * skříně. Na rovince r = ∞ → příspěvek 0.
   */
  get lateralAcceleration(): number {
    let max = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const aLat = this.lateralAccelerationOf(i);
      if (aLat > max) max = aLat;
    }
    return max;
  }

  /** Příčné (odstředivé) zrychlení vozu `index` (m/s²): v²/r v jeho aktuální pozici. */
  lateralAccelerationOf(index: number): number {
    const body = this.bodies[index];
    return (body.v * body.v) / this.track.radius(body.s);
  }

  /**
   * Blízkost převrácení vozu `index`: poměr příčného zrychlení k prahu převrácení.
   * 0 = rovinka, 1 = přesně na mezi, > 1 = převrácení. Podklad pro barevný gradient
   * blízkosti meze ve vizualizaci (žár skříně) — spojitá předzvěst tvrdého fail state.
   */
  tipRatio(index: number): number {
    return this.lateralAccelerationOf(index) / this.overturnThreshold;
  }

  /**
   * Práh příčného zrychlení pro převrácení (m/s²): (gauge/2)/comHeight · g.
   *
   * Statická momentová rovnováha na ploché koleji (bez klopení, DD-11): odstředivka
   * `m·a_lat` přes výšku těžiště `h` vytvoří klopný moment, tíha `m·g` přes rameno
   * poloviny rozchodu (gauge/2) ho drží. Když a_lat·h > g·(gauge/2), vůz se přetočí
   * přes vnější kolo. Vyšší těžiště nebo užší rozchod → nižší práh (snazší převrácení).
   */
  get overturnThreshold(): number {
    return ((this.params.trackGauge / 2) / this.params.comHeight) * this.params.gravity;
  }

  /** Podíl zbývajícího uhlí / vody (0..1) — pro UI. Prázdná kapacita → 0 (bez NaN). */
  get coalFraction(): number {
    return this.params.coalCapacity > 0 ? this.coal / this.params.coalCapacity : 0;
  }
  get waterFraction(): number {
    return this.params.waterCapacity > 0 ? this.water / this.params.waterCapacity : 0;
  }

  /**
   * Parní tlak (0..1) — škáluje tažnou sílu. Drží se na 1, dokud menší ze zásob
   * neklesne pod rezervu (STEAM_RESERVE); pod ní lineárně padá k 0, takže vlak
   * postupně ztrácí tah, dojede setrvačností a zastaví na odporech (původní vize).
   * Limituje ta zásoba, která dojde dřív (uhlí i voda jsou nutné pro páru).
   */
  get steamPressure(): number {
    return Math.min(Math.min(this.coalFraction, this.waterFraction) / STEAM_RESERVE, 1);
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
    // vynuluj i rotační stav vypružení (roll/pitch), ať reset srovná skříně
    for (const body of this.bodies) {
      body.roll = 0; body.rollVel = 0; body.pitch = 0; body.pitchVel = 0;
    }
    this.throttle = 0;
    this.braking = false;
    this.slipping = false;
    this.derailed = false;
    this.derailSpeed = 0;
    this.coal = this.params.coalCapacity;   // doplnit zásoby (R = nabrat uhlí i vodu)
    this.water = this.params.waterCapacity;
  }

  update(dt: number): void {
    if (this.derailed) return; // vykolejená souprava leží — žádná dynamika, čeká na reset (R)
    this.consumeFuel(dt);      // uhlí + voda → klesající parní tlak (čte applyLocomotive)
    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this.step(h);

    // kritérium převrácení (DD-11): odstředivka na nejostřejším oblouku překoná rameno
    // báze kol → vůz se přetočí přes vnější kolo. Tvrdý fail state — souprava se zastaví.
    if (this.lateralAcceleration > this.overturnThreshold) {
      this.derailed = true;
      this.derailSpeed = Math.abs(this.bodies[0].v); // zachyť rychlost před zastavením
      for (const body of this.bodies) body.v = 0;
    }
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

    // vypružení skříně (DD-02: rotace, nemění s/v) — buzení z příčného (v²·κ se znaménkem)
    // a podélného (dv/dt) zrychlení; integruje se ve stejných substepech jako zbytek
    for (const body of this.bodies) {
      const latSigned = body.v * body.v * this.track.signedCurvature(body.s);
      body.updateSuspension(this.params, latSigned, body.accel, h);
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

  /**
   * Spotřeba zásob úměrná otevření regulátoru (kolik páry teče). Uhlí hoří i na
   * volnoběh (idle — udržování ohně), voda se spotřebovává jen tvorbou páry. Obě
   * clampnuté na 0; po vyčerpání klesá parní tlak (viz {@link steamPressure}).
   */
  private consumeFuel(dt: number): void {
    const demand = Math.abs(this.throttle) / MAX_FORWARD; // 0..1 — otevření regulátoru
    this.coal = Math.max(0, this.coal - this.params.coalRate * (COAL_IDLE_FRACTION + demand) * dt);
    this.water = Math.max(0, this.water - this.params.waterRate * demand * dt);
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
    // parní tlak škáluje tah v obou směrech (pára žene písty); při vyčerpání zásob → 0
    const requested = dir * fraction * available * this.steamPressure;

    // adheze: nad limitem kola prokluzují (i při brzdění reverzem = skid), přenese se jen μ·N
    this.slipping = Math.abs(requested) > adhesionLimit;
    const tractive = this.slipping
      ? Math.sign(requested) * adhesionLimit
      : requested;
    loco.applyForce(tractive);
  }
}
