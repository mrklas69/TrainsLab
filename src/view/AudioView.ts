import type { Train } from '../sim/Train';
import type { PhysicsParams } from '../sim/params';
import type { CouplerMode } from '../sim/Coupler';
import type { ExhaustClock } from './ExhaustClock';

const MASTER_VOLUME = 0.35;
const BRAKE_REF_SPEED = 12; // m/s — rychlost, při níž hraje brzdová smyčka nominálně (playbackRate 1)

/** Trvalý hlas (loop), který se jen plynule zapíná/vypíná — prokluz, skřípění brzd. */
interface SustainVoice {
  setActive(on: boolean): void;
}

/** Trvalý hlas se zapínáním + řízenou rychlostí přehrávání (sample smyčka brzd ∝ otáčení kol). */
interface RateVoice extends SustainVoice {
  setRate(rate: number): void;
}

/** Trvalý hlas s plynule řízenou hlasitostí (0..1) — skřípění oblouku ∝ příčné zrychlení. */
interface LevelVoice {
  setLevel(level: number): void;
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

  constructor(train: Train, private readonly params: PhysicsParams, private readonly exhaust: ExhaustClock) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_VOLUME;
    this.master.connect(this.ctx.destination);

    this.noise = this.makeNoise();
    this.slip = this.makeSlipVoice();
    this.squeal = this.makeSquealVoice();
    this.arc = this.makeArcSquealVoice();
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
      if (buf) this.brakeLoop = this.makeRandomizedLoop(buf, 0.8, [0.1, 0.3], [0.6, 0.9]);
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
    // výfuk páry: puf v taktu sdíleného ExhaustClock (sladěný s kouřem), jen pod párou (notch ≠ 0)
    if (this.exhaust.fired && train.notch !== 0) this.playChuff();
    this.updateCouplers(train);
    this.updateRailJoints(train, dt);
    if (train.switchFired) this.playClunk(0.7);     // výhybka / křížení — tupý náraz
    if (train.transitionJerkFired) this.playArcJerk(); // skok křivosti — krátké boční skřípnutí
    this.slip.setActive(train.slipping);
    // brzdy skřípou jen za jízdy (tření kolo↔špalík) — stojící vlak s brzdou je tichý.
    // Sample smyčka má přednost (rychlost přehrávání ∝ otáčení kol), jinak procedurální skřípění.
    const speed = Math.abs(train.speed);
    const braking = train.isBraking && speed > 0.3;
    if (this.brakeLoop) {
      this.brakeLoop.setActive(braking);
      // playbackRate ∝ rychlost; clamp ať při krajních rychlostech nezní extrémně hluboce/pištivě
      this.brakeLoop.setRate(Math.min(2.2, Math.max(0.4, speed / BRAKE_REF_SPEED)));
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
    this.metalHit([90, 150, 240], 0.05, 0.45); // nízký tupý „klak" — krátký, kovově temný
  }

  // boční trh na skoku křivosti (chybějící přechodnice): krátké skřípnutí okolku, příbuzné
  // trvalému skřípění oblouku (sawtooth/bandpass ~2,2 kHz), ale jednorázové se sklouznutím
  // frekvence dolů („škríp") — odlišuje κ-trh od tupého kovového clunku výhybky.
  private playArcJerk(): void {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1500, t + 0.12); // sklouznutí dolů = kvílivý trh
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200;
    band.Q.value = 6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.008); // ostrý nástup
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); // rychlé doznění
    osc.connect(band).connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private playChuff(): void {
    // hybrid: nahraný sample má přednost; dokud se nenačte (nebo chybí), zní procedurální „čch"
    if (this.chuffSample) {
      this.playSample(this.chuffSample, 0.9);
      return;
    }
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 280; // nízkofrekvenční výdech
    band.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.015); // ostrý nádech
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); // výdech
    src.connect(band).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }

  private playClank(volume: number): void {
    this.metalHit([1200, 1840, 2650], 0.08, volume); // kovové, jasné — tah spřáhla
  }

  private playClunk(volume: number): void {
    this.metalHit([300, 470, 700], 0.14, volume * 1.1); // nižší, delší — tupý náraz nárazníků
  }

  // krátký úder z několika netónových harmonických s rychlým decayem
  private metalHit(freqs: number[], decay: number, volume: number): void {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.03, volume) * 0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    gain.connect(this.master);
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + decay);
    }
  }

  // --- trvalé hlasy a zdroje ---

  // sykot prokluzu: vysoký filtrovaný šum
  private makeSlipVoice(): SustainVoice {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(hp).connect(gain).connect(this.master);
    src.start();
    return {
      setActive: (on) =>
        gain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05),
    };
  }

  // skřípění brzd: skřípání kovu o kov složené ze **tří neharmonických** vysokých frekvencí
  // (disonance = „skříp", ne hudební tón), každá s vlastním pomalým jitterem frekvence →
  // nestabilní, neperiodické škrundání. Složky sečtené přes společný bandpass; hlasitost on/off.
  private makeSquealVoice(): SustainVoice {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 3000;
    band.Q.value = 1.2; // širší pásmo než u jednoho tónu — projdou všechny tři složky
    band.connect(gain).connect(this.master);

    // neharmonické poměry (ne celočíselné násobky základní) → kovová disonance místo tónu
    const freqs = [2150, 3070, 4350];
    const lfoRates = [24, 31, 39]; // různé rychlosti jitteru → složitá modulace bez slyšitelné periody
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = lfoRates[i];
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = f * 0.04; // hloubka kmitání ∝ frekvence → výraznější „skřípání"
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(band);
      osc.start();
      lfo.start();
    });
    return {
      setActive: (on) =>
        gain.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.04), // 3 zdroje → mírně níž
    };
  }

  // skřípění okolků v oblouku (flange squeal): vysoký kvílivý tón s pomalou modulací,
  // hlasitost plynule řízená příčným zrychlením (≠ on/off brzd) — sílí v ostřejší zatáčce
  private makeArcSquealVoice(): LevelVoice {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 2200;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 8;       // pomalejší než brzdový pískot → „kvílení", ne „skřípot"
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(osc.frequency);

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200;
    band.Q.value = 7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(band).connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    return {
      setLevel: (level) =>
        gain.gain.setTargetAtTime(Math.max(0, Math.min(level, 1)) * 0.18, this.ctx.currentTime, 0.08),
    };
  }

  // 2 s bílého šumu, sdílený zdroj pro chuff i sykot prokluzu
  private makeNoise(): AudioBuffer {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
