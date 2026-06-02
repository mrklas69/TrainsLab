import { Body } from './Body';
import { Coupler } from './Coupler';
import { TRACK_PERTURBATIONS } from './trackData';
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

const PISTON_STROKE = 0.66;  // m — zdvih pístu (konstrukční konstanta; intuitivní knoby jsou kolo + mez)
const RPM_KNEE = 0.75;       // tah drží plný do 75 % mezní rychlosti, pak lineárně padá k 0

const BRAKE_SKID_TOLERANCE = 1.1; // brzda smí přesáhnout adhezi o 10 %, než hlásíme skid — za sucha
                                  // leží plná brzda těsně nad adhezí (180 vs 177 kN), ať to neblikne
const V_SKID = 0.1;               // m/s — pod tím vůz stojí; skid (klouzání kol) dává smysl jen za jízdy

const BRAKE_FADE_RATE = 0.1;      // 1/(m/s) — strmost poklesu tření brzdy s rychlostí; 0.1 → půl-pokles ~10 m/s

const JOINT_WEIGHT = 0.4; // spárový ráz je jemnější než bodová perturbace (časté tiknutí, ne trh)

/**
 * Přejel-li vůz „fázový" bod `sI` s periodou `period` mezi pozicemi `sBefore` a `sNow`?
 * Floor-trik na **nezabaleném** (monotónním) arc-length `s`: funguje pro oba směry jízdy
 * i přes smyčku, beze stavu. Sjednocuje detekci dilatačních spár (`sI=0, period=railLength`)
 * i bodových perturbací (`sI=u·délka, period=délka`) — jádro „jednoho balíku" rázů z trati.
 */
function crossed(sBefore: number, sNow: number, sI: number, period: number): boolean {
  return Math.floor((sBefore - sI) / period) !== Math.floor((sNow - sI) / period);
}

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
  // bodové perturbace v posledním update — čte AudioView (odlišný zvuk dle typu, DD-01):
  switchFired = false;         // výhybka/křížení → tupý clunk
  transitionJerkFired = false; // skok křivosti (chybějící přechodnice) → krátké skřípnutí
  derailed = false; // vykolejeno — fail state, čeká na reset (čte renderer)
  derailSpeed = 0;  // charakteristická rychlost v okamžiku vykolejení (m/s) — diagnostika do UI
  derailReason: 'overturn' | 'collision' | null = null; // čím vykolejilo (převrácení vs. srážka) — diagnostika
  // nejtvrdší srážka v posledním update (kJ + rychlost sblížení) — vyhodnocuje se po substepech (jako převrácení)
  private collisionEnergy = 0;
  private collisionSpeed = 0;

  readonly couplers: Coupler[]; // stav spřáhel čte audio/vizualizace (DD-01)
  // volná (nespřažená) tělesa na téže trati — odstavené vozy. Mimo couplerový řetězec:
  // interagují se soupravou jen kontaktním nárazem (buff, viz applyContacts, DD-24). Čte renderer.
  readonly freeBodies: Body[] = [];
  private readonly freeStartS: number[] = []; // výchozí pozice volných vozů (pro reset)
  private readonly restGaps: number[];
  private throttle = 0; // −MAX_REVERSE..MAX_FORWARD
  private braking = false;
  private sanding = false; // pískování — held-key stav (zvyšuje adhezi), čte renderer/UI
  coal = 0;  // zásoba uhlí (kg) — čte UI
  water = 0; // zásoba vody (kg) — čte UI
  sand = 0;  // zásoba písku (kg) — čte UI

  constructor(
    private readonly track: Track,
    private readonly params: PhysicsParams,
    carLengths: number[], // [0] = lokomotiva (čelo), dál vagony
    private readonly startS = 0,
    freeCars: { length: number; startS: number }[] = [], // odstavené volné vozy (mimo soupravu)
  ) {
    this.bodies = carLengths.map((length) => new Body(0, length));

    // volné vozy: každý je samostatné těleso na trati se svou výchozí pozicí (mimo řetězec spřáhel)
    for (const car of freeCars) {
      this.freeBodies.push(new Body(car.startS, car.length));
      this.freeStartS.push(car.startS);
    }

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

  /** Pískování (held-key): zapne/vypne sypání písku pod kola — zvedne adhezi, dokud je zásoba. */
  setSanding(on: boolean): void {
    this.sanding = on;
  }

  get notch(): number {
    return this.throttle;
  }

  /** Otevření regulátoru 0..1 (|notch| / max) — single source pro view (hustota kouře/výfuku). */
  get throttleFraction(): number {
    return Math.abs(this.throttle) / MAX_FORWARD;
  }

  get isBraking(): boolean {
    return this.braking;
  }

  /** Pískuje a má ještě písek (jinak je páka bez efektu) — čte renderer/UI pro indikaci. */
  get isSanding(): boolean {
    return this.sanding && this.sand > 0;
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

  /**
   * Znaménkové příčné (odstředivé) zrychlení vozu `index` (m/s²): v²·κ v jeho pozici.
   * Znaménko = strana oblouku (vstup pro náklon skříně, roll). Jediný zdroj příčného
   * zrychlení — magnitudu (kritérium převrácení, gradient) z něj bere {@link lateralAccelerationOf}.
   */
  signedLateralAccelerationOf(index: number): number {
    return this.signedLatAccelOf(this.bodies[index]);
  }

  /** Jádro příčného zrychlení pro libovolné těleso (v²·κ) — sdílí souprava i volné vozy (DRY). */
  private signedLatAccelOf(body: Body): number {
    return body.v * body.v * this.track.signedCurvature(body.s);
  }

  /** Velikost příčného (odstředivého) zrychlení vozu `index` (m/s²): |v²·κ|. */
  lateralAccelerationOf(index: number): number {
    return Math.abs(this.signedLateralAccelerationOf(index));
  }

  /**
   * Blízkost převrácení vozu `index`: poměr příčného zrychlení k prahu převrácení.
   * 0 = rovinka, 1 = přesně na mezi, > 1 = převrácení. Podklad pro barevný gradient
   * blízkosti meze ve vizualizaci (žár skříně) — spojitá předzvěst tvrdého fail state.
   */
  tipRatio(index: number): number {
    return this.tipRatioOf(this.bodies[index]);
  }

  /** Blízkost převrácení libovolného tělesa (souprava i volný vůz) — pro žár skříně ve view. */
  tipRatioOf(body: Body): number {
    return Math.abs(this.signedLatAccelOf(body)) / this.overturnThreshold;
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
  get sandFraction(): number {
    return this.params.sandCapacity > 0 ? this.sand / this.params.sandCapacity : 0;
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

  /**
   * Mechanická mezní rychlost (m/s) z otáčkového stropu: `maxPistonSpeed·π·D/(2·zdvih)`.
   * Píst je ojnicí svázán s hnacím kolem — nad touto rychlostí by střední pístová rychlost
   * překročila mez (setrvačnost ojnic, plnění válce párou). Větší kolo `D` = vyšší v_max
   * (kolo je převod). Tvrdý strop, nezávislý na měkkém výkonovém `P/v`.
   */
  get vMechMax(): number {
    return (this.params.maxPistonSpeed * Math.PI * this.params.driverDiameter) / (2 * PISTON_STROKE);
  }

  /**
   * Útlum tahu od otáčkového stropu (1..0): plný do kolene (RPM_KNEE·vMechMax), pak
   * lineárně k 0 při vMechMax → vlak fyzicky nepřekročí mezní rychlost. Čte se v tahu.
   */
  get tractionDerating(): number {
    const vMax = this.vMechMax; // jednou — getter jinak počítá v_mech dvakrát za volání
    const knee = RPM_KNEE * vMax;
    const v = Math.abs(this.bodies[0].v);
    if (v <= knee) return 1;
    return Math.max(0, 1 - (v - knee) / (vMax - knee));
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
    // volné vozy zpět na výchozí pozice (v klidu)
    this.freeBodies.forEach((body, i) => {
      body.s = this.freeStartS[i];
      body.v = 0;
    });
    // vynuluj i rotační stav vypružení (roll/pitch), ať reset srovná skříně (souprava i volné vozy)
    for (const body of [...this.bodies, ...this.freeBodies]) {
      body.roll = 0; body.rollVel = 0; body.pitch = 0; body.pitchVel = 0;
    }
    this.throttle = 0;
    this.braking = false;
    this.sanding = false;
    this.slipping = false;
    this.derailed = false;
    this.derailSpeed = 0;
    this.derailReason = null;
    this.coal = this.params.coalCapacity;   // doplnit zásoby (R = nabrat uhlí, vodu i písek)
    this.water = this.params.waterCapacity;
    this.sand = this.params.sandCapacity;
  }

  update(dt: number): void {
    if (this.derailed) return; // vykolejená souprava leží — žádná dynamika, čeká na reset (R)
    this.consumeFuel(dt);      // uhlí + voda → klesající parní tlak (čte applyLocomotive)
    // písek se spotřebovává jen při aktivním pískování (zvyšuje adhezi, viz effectiveAdhesion)
    if (this.sanding) this.sand = Math.max(0, this.sand - this.params.sandRate * dt);
    // pozice před krokem — z ujeté vzdálenosti se pak detekují přejezdy spár/perturbací
    const sBefore = this.bodies.map((b) => b.s);
    this.collisionEnergy = 0;   // nejtvrdší srážka tohoto framu — naplní ji contact() v substepech
    const h = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) this.step(h);
    this.applyTrackImpulses(sBefore); // rázy z trati → kick do kývání skříně (DD-02)

    // fail state vyhodnocujeme po substepech (jako převrácení). Dvě nezávislé příčiny:
    //  - **převrácení** (DD-11): odstředivka na nejostřejším oblouku překoná rameno báze kol.
    //  - **srážka**: energie nárazu (½·m_red·v_close²) překročí práh — tvrdý náraz vyhodí vozy z kolejí.
    if (this.lateralAcceleration > this.overturnThreshold) {
      this.derail('overturn', Math.abs(this.bodies[0].v)); // rychlost loko při převrácení
    } else if (this.collisionEnergy > this.params.collisionDerailEnergy) {
      this.derail('collision', this.collisionSpeed); // rychlost sblížení při srážce
    }
  }

  // Vykolejení = tvrdý fail state: souprava i volné vozy stojí a čekají na reset (R).
  // `reason` + `speed` nesou diagnostiku (čím a při jaké rychlosti) do UI.
  private derail(reason: 'overturn' | 'collision', speed: number): void {
    this.derailed = true;
    this.derailReason = reason;
    this.derailSpeed = speed;
    for (const body of this.bodies) body.v = 0;
    for (const fb of this.freeBodies) fb.v = 0;
  }

  // jeden substep: vlastní síly → spřáhla → kontakty → trakce/brzda → tření → integrace.
  private step(h: number): void {
    // akumulátor sil nezávislých na spřáhlech/trakci — souprava i volné vozy
    for (let i = 0; i < this.bodies.length; i++) {
      this.bodies[i].beginStep(this.track, this.params, this.massOf(i));
    }
    for (const fb of this.freeBodies) fb.beginStep(this.track, this.params, this.params.carMass);

    for (const coupler of this.couplers) coupler.apply(this.params);
    this.applyContacts(); // buff náraz mezi nespřaženými tělesy (konce soupravy ↔ volné vozy)

    this.applyLocomotive();

    // brzda působí jen na lokomotivu (index 0), jako řízený odpor v tření (DD-09)
    const brake = this.brakeForce();
    for (let i = 0; i < this.bodies.length; i++) {
      const mass = this.massOf(i);
      this.bodies[i].applyFriction(this.params, mass, i === 0 ? brake : 0);
      // integrace dělí silou setrvačnou hmotu m·(1+λ) — rotující kola/ojnice (massOf drží tíhu)
      this.bodies[i].integrate(h, mass, this.rotatingFactorOf(i));
    }
    // volné vozy: bez trakce i brzdy — jen odpory + případný kontaktní ráz (statické tření je drží stát)
    for (const fb of this.freeBodies) {
      fb.applyFriction(this.params, this.params.carMass, 0);
      fb.integrate(h, this.params.carMass, this.params.rotatingMassFactorCar);
    }

    // vypružení skříně (DD-02: rotace, nemění s/v) — buzení z příčného (v²·κ se znaménkem)
    // a podélného (dv/dt) zrychlení; integruje se ve stejných substepech jako zbytek
    this.bodies.forEach((body, i) => {
      body.updateSuspension(this.params, this.signedLateralAccelerationOf(i), body.accel, h);
    });
    for (const fb of this.freeBodies) {
      fb.updateSuspension(this.params, this.signedLatAccelOf(fb), fb.accel, h);
    }
  }

  /**
   * Kontaktní náraz mezi nespřaženými tělesy = jednostranná pružina jen v tlaku (buff, DD-24).
   * Působí jen když se skříně překrývají (vzdálenost středů < součet půldélek + {@link COUPLER_GAP});
   * jinak nula. Žádný draft ani vůle → vozy se odrazí, ale **nespřáhnou** (scénář A).
   *
   * Recykluje tuhost/tlumení spřáhla (`couplerStiffness`/`couplerDamping`) — náraz se „cítí"
   * jako buff nárazníku (izomorfismus), žádné nové parametry. Kontakt řešíme jen na **odhalených
   * koncích soupravy** (loko / poslední vůz) ↔ volné vozy a volné vozy navzájem; vnitřek soupravy
   * drží spřáhla, takže projet skrz nelze. Na smyčce se rozteč počítá přes {@link wrappedDelta}.
   */
  private applyContacts(): void {
    if (this.freeBodies.length === 0) return;
    // odhalené konce soupravy (s hmotami pro energii srážky): čelo (loko) a záď (poslední vůz);
    // u jednovozové soupravy týž
    const last = this.bodies.length - 1;
    const ends = last === 0
      ? [{ b: this.bodies[0], m: this.massOf(0) }]
      : [{ b: this.bodies[0], m: this.massOf(0) }, { b: this.bodies[last], m: this.massOf(last) }];
    const carMass = this.params.carMass;

    for (const fb of this.freeBodies) {
      for (const end of ends) this.contact(end.b, end.m, fb, carMass);
    }
    // volné vozy navzájem (řada odstavených vozů do sebe ťuká jako biliár)
    for (let i = 0; i < this.freeBodies.length; i++) {
      for (let j = i + 1; j < this.freeBodies.length; j++) {
        this.contact(this.freeBodies[i], carMass, this.freeBodies[j], carMass);
      }
    }
  }

  // jedna kontaktní dvojice: odpudivá síla ∝ překryv skříní + tlumení; zároveň měří energii srážky.
  private contact(a: Body, massA: number, b: Body, massB: number): void {
    const d = this.wrappedDelta(a.s, b.s);                    // + = b je „před" a (rostoucí s)
    const minGap = a.length / 2 + b.length / 2 + COUPLER_GAP; // rozteč středů při dotyku
    const dist = Math.abs(d);
    if (dist >= minGap) return;                               // skříně se nedotýkají → bez síly

    const dir = Math.sign(d) || 1;       // osa kontaktu od a k b
    const overlap = minGap - dist;       // jak hluboko se skříně „vmáčkly" (m)
    const approach = -(b.v - a.v) * dir; // rychlost přibližování (> 0 = blíží se k sobě)

    // energie srážky (nepružná, ½·m_red·v_close²) v kJ — nejvyšší na náběhu kontaktu, než ji
    // pružina zbrzdí. Držíme maximum přes substepy; update() ho porovná s prahem → vykolejení.
    if (approach > 0) {
      const mRed = (massA * massB) / (massA + massB); // redukovaná hmota dvojice
      const energyKJ = (0.5 * mRed * approach * approach) / 1000;
      if (energyKJ > this.collisionEnergy) {
        this.collisionEnergy = energyKJ;
        this.collisionSpeed = approach;
      }
    }

    // pružina (vždy odpudivá) + tlumení (jen při přibližování — odraz nesmí přilepit)
    const force = this.params.couplerStiffness * overlap
      + (approach > 0 ? this.params.couplerDamping * approach : 0);
    a.applyForce(-dir * force);
    b.applyForce(dir * force);
  }

  /**
   * Nejkratší rozdíl pozic po smyčce: `sTo − sFrom` zabalený do [−délka/2, délka/2).
   * Tělesa mají nezabalené (monotónní) `s` na různých „kolech" smyčky — kontakt potřebuje
   * skutečnou rozteč po trati, ne rozdíl surových arc-length. Kladný = `sTo` je před `sFrom`.
   */
  private wrappedDelta(sFrom: number, sTo: number): number {
    const loop = this.track.length;
    let d = (((sTo - sFrom) % loop) + loop) % loop; // [0, loop)
    if (d > loop / 2) d -= loop;                    // → [−loop/2, loop/2)
    return d;
  }

  /**
   * Rázy z trati → impulsy do kývání skříně (rozšíření DD-13). Jeden balík, dva zdroje
   * nespojitosti řešené týmž {@link crossed} testem nad ujetou vzdáleností (`sBefore`→`s`):
   *  - **dilatační spáry** (perioda `railLength`): svislý ráz → **pitch**, znaménko střídá
   *    podle parity spáry (klikety-klak); jemnější ({@link JOINT_WEIGHT}).
   *  - **bodové perturbace** ({@link TRACK_PERTURBATIONS}, perioda = délka smyčky): skok
   *    křivosti → **roll** ve směru oblouku (`sign(κ)` → trh dosedne do náklonu) + výhybka → pitch.
   *
   * Síla ∝ rychlost (rychleji → tvrdší ráz) × `trackImpulse` (kvalita trati; 0 = hladká). Skok
   * křivosti (`kind:'transition'`) navíc škáluje `(1−transitionQuality)` — přechodnice (klotoida)
   * boční trh rozetře (kvalita 1 → 0 trh). Výhybky/spáry jsou na přechodnici nezávislé.
   * Nemění `s`/`v` (DD-02). Per-vůz `s` → ráz proběhne soupravou jako vlna (emergence).
   */
  private applyTrackImpulses(sBefore: number[]): void {
    this.switchFired = false;
    this.transitionJerkFired = false;
    const strength = this.params.trackImpulse;
    if (strength <= 0) return;
    const railLength = this.params.railLength;
    const loop = this.track.length;
    const transitionFactor = 1 - this.params.transitionQuality; // přechodnice tlumí κ-trh

    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const speed = Math.abs(body.v);
      if (speed === 0) continue; // stojící vůz spáru „nepřejede" — žádný ráz

      // dilatační spáry: pitch ráz, znaménko podle parity přejeté spáry (poskok nahoru/dolů)
      if (railLength > 0 && crossed(sBefore[i], body.s, 0, railLength)) {
        const parity = (Math.floor(body.s / railLength) & 1) === 0 ? 1 : -1;
        body.applyImpulse(0, parity * JOINT_WEIGHT * strength * speed);
      }

      // bodové perturbace: roll ve směru oblouku (skok křivosti) + pitch (výhybka)
      for (const p of TRACK_PERTURBATIONS) {
        if (!crossed(sBefore[i], body.s, p.u * loop, loop)) continue;
        // přechodnice rozetře jen skok křivosti; výhybka/křížení je radiální závada (nezávislá)
        const scale = p.kind === 'transition' ? transitionFactor : 1;
        if (scale <= 0) continue; // dokonalá přechodnice → transition ráz zmizí (i jeho zvuk)
        const rollDir = Math.sign(this.track.signedCurvature(body.s)) || 1;
        body.applyImpulse(rollDir * p.roll * strength * speed * scale, p.pitch * strength * speed * scale);
        if (p.kind === 'switch') this.switchFired = true;
        else this.transitionJerkFired = true;
      }
    }
  }

  /**
   * Efektivní součinitel adheze μ. Mokrá kolej / listí (railFactor < 1) ji snižuje;
   * pískování ji vrací na suchou hodnotu (adhesionCoeff), dokud je v pískovnách písek.
   * Jediný zdroj μ — přes {@link adhesionLimit} platí pro tah i brzdu (foundations:
   * bez nízké adheze je písek neviditelný, protože tah je pod adhezním stropem).
   */
  get effectiveAdhesion(): number {
    return this.isSanding
      ? this.params.adhesionCoeff
      : this.params.adhesionCoeff * this.params.railFactor;
  }

  // adhezní strop μ·N (tíha lokomotivy = adhezní tíha N) — max přenositelná síla
  // kolo-kolej; společný limit pro tah, protiproudé brzdění i provozní brzdu.
  private get adhesionLimit(): number {
    return this.effectiveAdhesion * this.params.locomotiveMass * this.params.gravity;
  }

  /**
   * Útlum tření špalíkové brzdy rychlostí (1..1−brakeFade): `f(v) = (1−fade) + fade/(1+k·|v|)`.
   * Litinový špalík má μ klesající s rychlostí → při vysoké rychlosti menší brzdná síla,
   * při dobrzďování roste → konkávní zpomalení (decelerace roste, jak vlak zpomaluje). `f(0)=1`
   * (lineární základ při nízké rychlosti zachován), `f(∞)=1−fade` (asymptota — tření nezmizí).
   * `brakeFade=0` → konstantní (Coulomb), beze změny chování.
   */
  private get brakeFadeFactor(): number {
    const fade = this.params.brakeFade;
    return (1 - fade) + fade / (1 + BRAKE_FADE_RATE * Math.abs(this.bodies[0].v));
  }

  // brzdná síla lokomotivy, limitovaná adhezí (μ·N); 0 = nebrzdí. Síla špalíku klesá s rychlostí
  // (brakeFadeFactor, μ(v)). Když by požadovaná brzda výrazně přesáhla adhezi (mokrá kolej), kola
  // se zablokují a kloužou — skid: delší dráha a vizuální výstraha. Skid se testuje proti faded
  // síle (nižší μ → menší síla → méně náchylné k zablokování, fyzikálně konzistentní). Indikuje se
  // sdíleným slipping flagem (izomorfně s prokluzem při tahu, DD-16); pískování zvedne adhezi → skid
  // zmizí. Nepřepisuje slipping z tahu na false (jen ho zvedá).
  private brakeForce(): number {
    if (!this.braking) return 0;
    const requested = this.params.brakeForceMax * this.brakeFadeFactor;
    const limit = this.adhesionLimit;
    if (requested > limit * BRAKE_SKID_TOLERANCE && Math.abs(this.bodies[0].v) > V_SKID) {
      this.slipping = true;
    }
    return Math.min(requested, limit);
  }

  // lokomotiva (index 0) je těžší — a její tíha je adhezní tíha N.
  private massOf(index: number): number {
    return index === 0 ? this.params.locomotiveMass : this.params.carMass;
  }

  // rotující hmota λ per vůz (izomorfní s massOf): loko má větší (hnací kola + ojnice).
  private rotatingFactorOf(index: number): number {
    return index === 0 ? this.params.rotatingMassFactorLoco : this.params.rotatingMassFactorCar;
  }

  /**
   * Spotřeba zásob úměrná otevření regulátoru (kolik páry teče). Uhlí hoří i na
   * volnoběh (idle — udržování ohně), voda se spotřebovává jen tvorbou páry. Obě
   * clampnuté na 0; po vyčerpání klesá parní tlak (viz {@link steamPressure}).
   */
  private consumeFuel(dt: number): void {
    const demand = this.throttleFraction; // 0..1 — otevření regulátoru (single source)
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
    const fraction = counterPressure ? 1 : this.throttleFraction;
    // při zrychlování limituje výkon (P/v) i otáčkový strop (tractionDerating); protiproudé
    // brzdění je limitováno jen adhezí (DD-08) — otáčky tah nesnižují, brzdí se naplno.
    const available = counterPressure
      ? this.params.tractiveForceMax
      : Math.min(
          this.params.tractiveForceMax,
          this.params.maxPower / Math.max(Math.abs(loco.v), V_POWER),
        ) * this.tractionDerating;
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
