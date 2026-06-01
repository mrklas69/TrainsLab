import type { Train } from '../sim/Train';
import type { PhysicsParams } from '../sim/params';
import type { CouplerMode } from '../sim/Coupler';
import type { ExhaustClock } from './ExhaustClock';
import {
  makeNoise, makeSlipVoice, makeSquealVoice, makeArcSquealVoice,
  playMetalHit, playChuffBurst, playArcJerk,
  type SustainVoice, type LevelVoice,
} from './proceduralAudio';

const MASTER_VOLUME = 0.35;
// brzdová smyčka: rychlost přehrávání (= výška/tempo skřípání) roste lineárně s rychlostí
// jen do BRAKE_FUSE_SPEED, pak drží strop. Bez capu by při plné rychlosti rate vyletěl
// (~1,9) a skřípání by znělo jako „zubní vrtačka" (analogie chuff fuse v ExhaustClock).
const BRAKE_FUSE_SPEED = 3.8; // m/s — nad tím už playbackRate neroste
const BRAKE_RATE_MIN = 0.5;   // sotva jede → hluboké pomalé skřípání
const BRAKE_RATE_MAX = 1.15;  // od BRAKE_FUSE_SPEED výš → strop, jen mírně zrychlené (žádná vrtačka)
const RAIL_REF_SPEED = 12;    // m/s — rychlost, při níž hraje smyčka klapotu spár nominálně (playbackRate 1)

/** Trvalý hlas se zapínáním + řízenou rychlostí přehrávání (sample smyčka brzd ∝ otáčení kol). */
interface RateVoice extends SustainVoice {
  setRate(rate: number): void;
}

/**
 * AudioView = zvuk jako další „view" nad simem (DD-01): každý frame čte stav
 * soupravy a ozvučuje události. Zvuky jsou syntetizované procedurálně přes Web
 * Audio (žádné externí soubory) — generátor je vyměnitelný za nahrané samply
 * stejně, jako je vyměnitelný renderer.
 *
 * Mapování událostí → zvuk:
 *  - chuff (výfuk páry): burst v taktu ExhaustClock (4×/otáčku kola), jen pod párou — sladěný s kouřem
 *  - clank / náraz: přechod spřáhla do draft (tah) / buff (nárazníky), hlasitost ∝ relVel
 *  - sykot prokluzu: trvalý šum, dokud loko prokluzuje
 *  - skřípění brzd: trvalý pískot při brzdění za jízdy
 *  - tikot spár: „klikety-klak" na dilatačních spárách, interval = railLength / rychlost
 *  - skřípění oblouku: trvalý kvílivý tón v zatáčce, hlasitost ∝ příčné zrychlení (v²·κ)
 *  - clunk výhybky: tupý náraz na výhybce/křížení (switchFired)
 *  - trh přechodnice: krátké skřípnutí na skoku křivosti (transitionJerkFired)
 */
export class AudioView {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly noise: AudioBuffer;
  private readonly slip: SustainVoice;
  private readonly squeal: SustainVoice;
  private readonly arc: LevelVoice;

  private prevModes: CouplerMode[];
  private railTimer = 0; // odpočet do dalšího tiku spáry (self-timed)
  private muted = false;

  // nahraný sample výfuku (hybrid vrstva, S21): null dokud se nenačte / když chybí nebo
  // se nedekóduje → playChuff padne na procedurální generátor (vždy zní něco).
  private chuffSample: AudioBuffer | null = null;

  // trvalý hlas úniku páry (sample loop): syčí kotel pod tlakem — hraje, dokud je pára
  // (steamPressure > 0), umlkne po vyčerpání zásob. Vznikne až po načtení samplu.
  private steamLeak: SustainVoice | null = null;

  // houkačka (one-shot na vyžádání) — null dokud se nenačte; bez fallbacku (procedurální houkačka není)
  private hornSample: AudioBuffer | null = null;

  // brzdy (sample smyčka s náhodnými hranicemi): hraje za jízdy, dokud se brzdí; rychlost
  // přehrávání ∝ rychlost (= otáčení kol). Hybrid — chybí sample → procedurální skřípění. null do načtení.
  private brakeLoop: RateVoice | null = null;

  // klapot dilatačních spár (sample smyčka): souvislá nahrávka klapotu kol přes spáry, hraje
  // za jízdy; playbackRate ∝ rychlost → frekvence klapotu přímo úměrná rychlosti. Hybrid —
  // chybí sample → self-timed procedurální tikot (interval railLength/v, updateRailJoints). null do načtení.
  private railLoop: RateVoice | null = null;

  constructor(train: Train, private readonly params: PhysicsParams, private readonly exhaust: ExhaustClock) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_VOLUME;
    this.master.connect(this.ctx.destination);

    this.noise = makeNoise(this.ctx);
    this.slip = makeSlipVoice(this.ctx, this.master, this.noise);
    this.squeal = makeSquealVoice(this.ctx, this.master);
    this.arc = makeArcSquealVoice(this.ctx, this.master);
    this.prevModes = train.couplers.map((c) => c.mode);

    // asynchronně natáhni samply (fire-and-forget; do načtení hraje procedurální fallback)
    void this.loadSample('steam_chuff.wav').then((buf) => (this.chuffSample = buf));
    // únik páry: loop 1.–11. s na 1/3 hlasitosti, řízený stavem páry (viz update)
    void this.loadSample('steam_leak.wav').then((buf) => {
      if (buf) this.steamLeak = this.makeSampleLoop(buf, 1 / 3, 1, 11);
    });
    void this.loadSample('horn_on.wav').then((buf) => (this.hornSample = buf));
    // brzdy: smyčka s náhodnými hranicemi (loopStart ∈ [0,1; 0,3], loopEnd ∈ [0,6; 0,9] délky),
    // přenastavovanými po každém průchodu → rozbije periodicky slyšitelný šev pevné smyčky.
    void this.loadSample('brakes_on.wav').then((buf) => {
      if (buf) this.brakeLoop = this.makeRandomizedLoop(buf, 1.6, [0.1, 0.3], [0.6, 0.9]);
    });
    // klapot spár: prostá smyčka celé nahrávky + řízená rychlost přehrávání (frekvence ∝ rychlost)
    void this.loadSample('clattering_wheels.wav').then((buf) => {
      if (buf) this.railLoop = this.makeRateLoop(buf, 1.2);
    });
  }

  /** Zahoukání (one-shot) — vyvolané tlačítkem/klávesou. Bez samplu se nic nestane. */
  playHorn(): void {
    if (this.hornSample) this.playSample(this.hornSample, 2.7); // hlasitá houkačka (3× proti běžným hlasům)
  }

  /**
   * Načte zvukový sample z `public/audio/` přes Web Audio (fetch → decodeAudioData).
   * URL přes `BASE_URL` (dev `/`, GitHub Pages `/TrainsLab/`) — jinak by build házel 404.
   * Při jakékoli chybě (chybí soubor, prohlížeč neumí kodek) vrátí null → hybrid fallback.
   */
  private async loadSample(file: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/${file}`);
      if (!res.ok) return null;
      return await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null; // hybrid: nezní sample → zazní procedurální generátor
    }
  }

  /** Jednorázové přehrání nahraného bufferu danou hlasitostí (přes master gain). */
  private playSample(buffer: AudioBuffer, volume: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.master);
    src.start();
  }

  /**
   * Trvalý hlas ze smyčky samplu (analogie procedurálních SustainVoice, jen z nahrávky):
   * zdroj běží pořád, slyšitelnost řídí jen gain (0 ↔ `volume`). Loopuje úsek
   * [`loopStart`, `loopEnd`] sekund. `start()` lze volat jen jednou — voice se proto
   * vytvoří jednou (po načtení bufferu); na suspended kontextu se rozběhne až po `resume`.
   */
  private makeSampleLoop(buffer: AudioBuffer, volume: number, loopStart: number, loopEnd: number): SustainVoice {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;
    const gain = this.ctx.createGain();
    gain.gain.value = 0; // start zticha, update ho zapne podle stavu
    src.connect(gain).connect(this.master);
    src.start();
    return {
      setActive: (on) => gain.gain.setTargetAtTime(on ? volume : 0, this.ctx.currentTime, 0.15),
    };
  }

  /**
   * Prostá smyčka celé nahrávky s řízenou rychlostí přehrávání (jako {@link makeSampleLoop},
   * navíc `setRate`). Na rozdíl od {@link makeRandomizedLoop} hranice nelosuje — klapot spár
   * MÁ být periodický; `playbackRate` ∝ rychlost zrychluje klapot (frekvence úměrná rychlosti).
   */
  private makeRateLoop(buffer: AudioBuffer, volume: number): RateVoice {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0; // start zticha, update ho zapne podle stavu
    src.connect(gain).connect(this.master);
    src.start();
    return {
      setActive: (on) => gain.gain.setTargetAtTime(on ? volume : 0, this.ctx.currentTime, 0.12),
      setRate: (rate) => src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05),
    };
  }

  /**
   * Sample smyčka s **náhodnými hranicemi**, přenastavovanými po každém průchodu. Loop běží
   * plynule (`loop=true`, bez gapů), ale `loopStart`/`loopEnd` se po době jednoho průchodu
   * přelosují v zadaných rozsazích (zlomky délky) → smyčka nemá pevnou periodu, takže šev
   * není slyšet jako pravidelné lupnutí. Timer ladí přenastavení do rytmu segmentů.
   * `setActive` vytvoří/zruší zdroj na hranách (lze volat každý frame).
   */
  private makeRandomizedLoop(buffer: AudioBuffer, volume: number, startRange: [number, number], endRange: [number, number]): RateVoice {
    const dur = buffer.duration;
    const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
    let src: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    let timer: number | undefined;

    // přelosuj hranice a naplánuj další přelosování po délce právě nastaveného úseku
    const reshuffle = (): void => {
      if (!src) return;
      const ls = rand(startRange[0], startRange[1]) * dur;
      const le = rand(endRange[0], endRange[1]) * dur;
      src.loopStart = ls;
      src.loopEnd = le;
      timer = window.setTimeout(reshuffle, (le - ls) * 1000);
    };

    return {
      setActive: (on) => {
        if (on && !src) {
          src = this.ctx.createBufferSource();
          src.buffer = buffer;
          src.loop = true;
          const ls = rand(startRange[0], startRange[1]) * dur;
          src.loopStart = ls;
          src.loopEnd = rand(endRange[0], endRange[1]) * dur;
          gain = this.ctx.createGain();
          gain.gain.value = volume;
          src.connect(gain).connect(this.master);
          src.start(0, ls); // začni od první náhodné hranice
          timer = window.setTimeout(reshuffle, (src.loopEnd - ls) * 1000);
        } else if (!on && src) {
          if (timer !== undefined) clearTimeout(timer);
          gain!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); // fade out, ať konec nelupne
          src.stop(this.ctx.currentTime + 0.3);
          src = null; // uvolni → příští zabrzdění začne znovu
          gain = null;
        }
      },
      // rychlost přehrávání ∝ otáčení kol (skřípění zrychluje/zpomaluje s vlakem); plynule, ať netrhá
      setRate: (rate) => {
        if (src) src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05);
      },
    };
  }

  /** Prohlížeč povolí zvuk až po interakci uživatele — voláno z prvního vstupu. */
  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  update(train: Train, dt: number): void {
    // výfuk páry: puf v taktu sdíleného ExhaustClock (sladěný s kouřem), jen pod párou —
    // otevřený regulátor (notch ≠ 0) A pára v kotli (steamPressure > 0). Bez páry píst
    // nepracuje → žádný výfuk, i když vlak dojíždí setrvačností s otevřeným regulátorem.
    if (this.exhaust.fired && train.notch !== 0 && train.steamPressure > 0) this.playChuff();
    this.updateCouplers(train);
    // klapot spár: sample smyčka (frekvence ∝ rychlost) má přednost, jinak self-timed procedurální tikot
    if (this.railLoop) this.updateRailLoop(train);
    else this.updateRailJoints(train, dt);
    if (train.switchFired) this.playClunk(0.7);     // výhybka / křížení — tupý náraz
    if (train.transitionJerkFired) playArcJerk(this.ctx, this.master); // skok křivosti — krátké boční skřípnutí
    this.slip.setActive(train.slipping);
    // brzdy skřípou jen za jízdy (tření kolo↔špalík) — stojící vlak s brzdou je tichý.
    // Sample smyčka má přednost (rychlost přehrávání ∝ otáčení kol), jinak procedurální skřípění.
    const speed = Math.abs(train.speed);
    const braking = train.isBraking && speed > 0.3;
    if (this.brakeLoop) {
      this.brakeLoop.setActive(braking);
      // rychlost přehrávání lineárně roste 0 → BRAKE_FUSE_SPEED, pak konstantní strop (cap)
      const t = Math.min(speed, BRAKE_FUSE_SPEED) / BRAKE_FUSE_SPEED; // 0..1
      this.brakeLoop.setRate(BRAKE_RATE_MIN + t * (BRAKE_RATE_MAX - BRAKE_RATE_MIN));
    } else {
      this.squeal.setActive(braking);
    }
    this.steamLeak?.setActive(train.steamPressure > 0); // syčí, dokud je kotel pod párou
    // skřípění oblouku ∝ příčné zrychlení (v²·κ); práh převrácení ≈ 6 m/s² → /4 doplna před mezí
    this.arc.setLevel(Math.min(train.lateralAcceleration / 4, 1));
  }

  // --- jednorázové události ---

  // přechod spřáhla z vůle do kontaktu → cvaknutí (draft) nebo náraz (buff)
  private updateCouplers(train: Train): void {
    train.couplers.forEach((coupler, i) => {
      if (coupler.mode !== this.prevModes[i] && coupler.mode !== 0) {
        const volume = Math.min(1, Math.abs(coupler.relVel) / 2);
        if (coupler.mode === 1) this.playClank(volume);
        else this.playClunk(volume);
      }
      this.prevModes[i] = coupler.mode;
    });
  }

  // tikot dilatačních spár: interval = railLength / rychlost (rychleji → hustší „klikety-klak").
  // Self-timed jako chuff — AudioView čte stav (rychlost + params), negeneruje z eventů simu.
  // Vypnuté rázy (trackImpulse 0), svařovaná kolej (railLength 0) nebo stání → ticho.
  private updateRailJoints(train: Train, dt: number): void {
    const speed = Math.abs(train.speed);
    const L = this.params.railLength;
    if (this.params.trackImpulse <= 0 || L <= 0 || speed < 0.5) {
      this.railTimer = 0;
      return;
    }
    this.railTimer -= dt;
    if (this.railTimer > 0) return;
    this.railTimer = L / speed; // čas na ujetí jedné rozteče spár
    this.playRailTick();
  }

  private playRailTick(): void {
    playMetalHit(this.ctx, this.master, [90, 150, 240], 0.05, 0.45); // nízký tupý „klak" — krátký, kovově temný
  }

  // klapot spár ze samplu (hybrid varianta updateRailJoints): souvislá smyčka klapotu, jejíž
  // rychlost přehrávání ∝ rychlost vlaku → frekvence klapotu přímo úměrná rychlosti. Aktivní za
  // stejných podmínek jako self-timed tikot (jede + kvalita trati + nesvařovaná kolej).
  private updateRailLoop(train: Train): void {
    const speed = Math.abs(train.speed);
    const active = this.params.trackImpulse > 0 && this.params.railLength > 0 && speed > 0.5;
    this.railLoop!.setActive(active);
    // playbackRate ∝ rychlost; clamp ať při krajních rychlostech klapot nezamrzne / nezní jako chipmunk
    this.railLoop!.setRate(Math.min(2.0, Math.max(0.4, speed / RAIL_REF_SPEED)));
  }

  private playChuff(): void {
    // hybrid: nahraný sample má přednost; dokud se nenačte (nebo chybí), zní procedurální „čch"
    if (this.chuffSample) {
      this.playSample(this.chuffSample, 0.9);
      return;
    }
    playChuffBurst(this.ctx, this.master, this.noise);
  }

  private playClank(volume: number): void {
    playMetalHit(this.ctx, this.master, [1200, 1840, 2650], 0.08, volume); // kovové, jasné — tah spřáhla
  }

  private playClunk(volume: number): void {
    playMetalHit(this.ctx, this.master, [300, 470, 700], 0.14, volume * 1.1); // nižší, delší — tupý náraz nárazníků
  }
}
