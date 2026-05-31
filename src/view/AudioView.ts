import type { Train } from '../sim/Train';
import type { PhysicsParams } from '../sim/params';
import type { CouplerMode } from '../sim/Coupler';

const MASTER_VOLUME = 0.35;

/** Trvalý hlas (loop), který se jen plynule zapíná/vypíná — prokluz, skřípění brzd. */
interface SustainVoice {
  setActive(on: boolean): void;
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
 *  - chuff (výfuk páry): rytmický burst při otevřeném regulátoru, hustota ∝ rychlost
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
  private chuffTimer = 0;
  private railTimer = 0; // odpočet do dalšího tiku spáry (self-timed jako chuff)
  private muted = false;

  constructor(train: Train, private readonly params: PhysicsParams) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_VOLUME;
    this.master.connect(this.ctx.destination);

    this.noise = this.makeNoise();
    this.slip = this.makeSlipVoice();
    this.squeal = this.makeSquealVoice();
    this.arc = this.makeArcSquealVoice();
    this.prevModes = train.couplers.map((c) => c.mode);
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
    this.updateChuff(train, dt);
    this.updateCouplers(train);
    this.updateRailJoints(train, dt);
    if (train.switchFired) this.playClunk(0.7);     // výhybka / křížení — tupý náraz
    if (train.transitionJerkFired) this.playArcJerk(); // skok křivosti — krátké boční skřípnutí
    this.slip.setActive(train.slipping);
    this.squeal.setActive(train.isBraking && Math.abs(train.speed) > 0.3);
    // skřípění oblouku ∝ příčné zrychlení (v²·κ); práh převrácení ≈ 6 m/s² → /4 doplna před mezí
    this.arc.setLevel(Math.min(train.lateralAcceleration / 4, 1));
  }

  // --- jednorázové události ---

  // výfuk páry: pod párou (notch ≠ 0) vystřeluje burst, interval klesá s rychlostí
  private updateChuff(train: Train, dt: number): void {
    if (train.notch === 0) {
      this.chuffTimer = 0;
      return;
    }
    this.chuffTimer -= dt;
    if (this.chuffTimer > 0) return;
    this.chuffTimer = Math.max(0.1, 0.9 / (Math.abs(train.speed) + 0.4));
    this.playChuff();
  }

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

  // skřípění brzd: vysoký pilový tón s lehkou modulací (ne čistý tón) přes bandpass
  private makeSquealVoice(): SustainVoice {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 3200;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 30;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220; // hloubka kmitání frekvence → „skřípání"
    lfo.connect(lfoGain).connect(osc.frequency);

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 3200;
    band.Q.value = 5;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(band).connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    return {
      setActive: (on) =>
        gain.gain.setTargetAtTime(on ? 0.25 : 0, this.ctx.currentTime, 0.04),
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
