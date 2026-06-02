import type { Train } from '../sim/Train';
import type { PhysicsParams } from '../sim/params';
import type { CouplerMode } from '../sim/Coupler';
import type { ExhaustClock } from './ExhaustClock';
import { smoothstep } from '../sim/terrain';

const MASTER_VOLUME = 0.35;
// Distanční útlum: hlasitost klesá se vzdáleností kamery od lokomotivy. Do REF plná (kamera
// u soupravy), dál ~1/d (fyzikální pokles intenzity zvuku), s měkkým dotlumením k nule u horizontu
// mlhy (vzdálená scéna utichne docela, sladěno s Fog far ≈ 340). Násobí master gain (vedle mute).
const AUDIO_REF_DISTANCE = 30;      // m — uvnitř plná hlasitost (zhruba poloměr orbitu dronu)
const AUDIO_SILENCE_DISTANCE = 320; // m — za touhle ticho (souhlasí s koncem mlhy)

function distanceGain(d: number): number {
  const inverse = AUDIO_REF_DISTANCE / Math.max(d, AUDIO_REF_DISTANCE);    // 1 do REF, pak 1/d
  const horizon = 1 - smoothstep(AUDIO_REF_DISTANCE, AUDIO_SILENCE_DISTANCE, d); // měkce k 0 u mlhy
  return inverse * horizon;
}
// brzdová smyčka: rychlost přehrávání (= výška/tempo skřípání) roste lineárně s rychlostí
// jen do BRAKE_FUSE_SPEED, pak drží strop (analogie chuff fuse v ExhaustClock). Nahrávka je
// ~2× delší a sama skřípe rychle („cikáda") → playbackRate poloviční, aby tón sjel na realistické
// pomalé skřípání kovu o kov.
const BRAKE_FUSE_SPEED = 3.8; // m/s — nad tím už playbackRate neroste
const BRAKE_RATE_MIN = 0.25;  // sotva jede → hluboké pomalé skřípání
const BRAKE_RATE_MAX = 0.6;   // od BRAKE_FUSE_SPEED výš → strop, jen mírně zrychlené (žádná cikáda)
const RAIL_REF_SPEED = 12;    // m/s — rychlost, při níž hraje smyčka klapotu spár nominálně (playbackRate 1)
// clunk: ×1,1 = mírné zesílení nárazu, /3 = globální ztlumení (na přání — byl příliš hlasitý)
const CLUNK_GAIN = 1.1 / 3;

/** Trvalý hlas (loop) jen se zapínáním/vypínáním — prokluz, únik páry. */
interface SustainVoice {
  setActive(on: boolean): void;
}

/** Trvalý hlas s plynule řízenou hlasitostí (0..1) — skřípění oblouku ∝ příčné zrychlení. */
interface LevelVoice {
  setLevel(level: number): void;
}

/** Trvalý hlas se zapínáním + řízenou rychlostí přehrávání (smyčka brzd/klapotu ∝ otáčení kol). */
interface RateVoice extends SustainVoice {
  setRate(rate: number): void;
}

/**
 * AudioView = zvuk jako další „view" nad simem (DD-01): každý frame čte stav soupravy a
 * ozvučuje události z nahraných samplů (`public/audio/`). Samply se načítají asynchronně
 * přes Web Audio (fetch → decodeAudioData); dokud sample nedorazí (nebo když soubor chybí),
 * příslušný hlas mlčí. (Procedurální generátory byly odstraněny — set samplů je kompletní.)
 *
 * Mapování událostí → zvuk:
 *  - chuff (výfuk páry): puf v taktu ExhaustClock (4×/otáčku kola), jen pod párou — sladěný s kouřem
 *  - clank / clunk: přechod spřáhla do draft (tah) / buff (nárazníky), hlasitost ∝ relVel
 *  - sykot prokluzu: trvalá smyčka, dokud loko protáčí kola
 *  - skřípění brzd: trvalá smyčka při brzdění za jízdy, playbackRate ∝ rychlost
 *  - klapot spár: smyčka klapotu kol, playbackRate ∝ rychlost
 *  - skřípění oblouku: trvalá smyčka, hlasitost ∝ příčné zrychlení (v²·κ)
 *  - clunk výhybky: tupý náraz na výhybce/křížení (switchFired)
 *  - trh přechodnice: krátké skřípnutí na skoku křivosti (transitionJerkFired)
 *  - houkačka: one-shot na klávesu/tlačítko
 */
export class AudioView {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;

  private prevModes: CouplerMode[];
  private muted = false;
  private distanceVolume = 1; // distanční útlum (0..1), přepočítává update() z cameraDistance

  // Nahrané samply (public/audio/). One-shoty drží AudioBuffer (přehrají se přes playSample),
  // trvalé hlasy drží voice objekt (loop + gain). Vše null, dokud async load nedoběhne / když soubor chybí.
  private chuffSample: AudioBuffer | null = null;    // výfuk páry (one-shot v taktu ExhaustClock)
  private hornSample: AudioBuffer | null = null;     // houkačka (one-shot)
  private clankSample: AudioBuffer | null = null;    // tah spřáhla (draft) — jasný kovový cvak
  private clunkSample: AudioBuffer | null = null;    // nárazník (buff) + výhybka — tupý náraz
  private arcJerkSample: AudioBuffer | null = null;  // trh přechodnice (skok křivosti) — krátké skřípnutí

  private steamLeak: SustainVoice | null = null;     // únik páry — loop, dokud je kotel pod tlakem
  private slipLoop: SustainVoice | null = null;      // sykot prokluzu — loop, dokud loko protáčí kola
  private brakeLoop: RateVoice | null = null;        // skřípění brzd — loop za jízdy, playbackRate ∝ rychlost
  private railLoop: RateVoice | null = null;         // klapot spár — loop, playbackRate ∝ rychlost
  private arcLoop: LevelVoice | null = null;         // skřípění oblouku — loop, gain ∝ příčné zrychlení

  constructor(train: Train, private readonly params: PhysicsParams, private readonly exhaust: ExhaustClock) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_VOLUME;
    this.master.connect(this.ctx.destination);
    this.prevModes = train.couplers.map((c) => c.mode);

    // asynchronně natáhni samply (fire-and-forget; do načtení příslušný hlas mlčí)
    void this.loadSample('steam_chuff.wav').then((buf) => (this.chuffSample = buf));
    void this.loadSample('horn_on.wav').then((buf) => (this.hornSample = buf));
    void this.loadSample('clank.wav').then((buf) => (this.clankSample = buf));
    void this.loadSample('clunk.wav').then((buf) => (this.clunkSample = buf));
    void this.loadSample('arc_jerk.wav').then((buf) => (this.arcJerkSample = buf));
    // únik páry: loop 1.–11. s na 1/3 hlasitosti, řízený stavem páry (viz update)
    void this.loadSample('steam_leak.wav').then((buf) => {
      if (buf) this.steamLeak = this.makeSampleLoop(buf, 1 / 3, 1, 11);
    });
    // prokluz: loop celé nahrávky, on/off podle train.slipping
    void this.loadSample('steam_slip.wav').then((buf) => {
      if (buf) this.slipLoop = this.makeSampleLoop(buf, 0.8, 0, buf.duration);
    });
    // brzdy: smyčka s náhodnými hranicemi (rozbíjí 2s periodu pevné smyčky) + playbackRate ∝ rychlost
    void this.loadSample('brakes_on.wav').then((buf) => {
      if (buf) this.brakeLoop = this.makeRandomizedLoop(buf, 1.6, [0.1, 0.3], [0.6, 0.9]);
    });
    // klapot spár: smyčka celé nahrávky + playbackRate ∝ rychlost (frekvence úměrná rychlosti)
    void this.loadSample('clattering_wheels.wav').then((buf) => {
      if (buf) this.railLoop = this.makeRateLoop(buf, 1.2);
    });
    // skřípění oblouku: smyčka, gain řízený úrovní (∝ příčné zrychlení) — viz update
    void this.loadSample('arc_squeal.wav').then((buf) => {
      if (buf) this.arcLoop = this.makeSampleLevelLoop(buf, 1.0);
    });
  }

  /** Zahoukání (one-shot) — vyvolané tlačítkem/klávesou. Bez samplu se nic nestane. */
  playHorn(): void {
    if (this.hornSample) this.playSample(this.hornSample, 2.7); // hlasitá houkačka (3× proti běžným hlasům)
  }

  /**
   * Načte zvukový sample z `public/audio/` přes Web Audio (fetch → decodeAudioData).
   * URL přes `BASE_URL` (dev `/`, GitHub Pages `/TrainsLab/`) — jinak by build házel 404.
   * Při jakékoli chybě (chybí soubor, prohlížeč neumí kodek) vrátí null → hlas zůstane tichý.
   */
  private async loadSample(file: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/${file}`);
      if (!res.ok) return null;
      return await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null; // sample se nenačetl → hlas mlčí
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
   * Trvalý hlas ze smyčky samplu: zdroj běží pořád, slyšitelnost řídí jen gain (0 ↔ `volume`).
   * Loopuje úsek [`loopStart`, `loopEnd`] sekund. `start()` lze volat jen jednou — voice se proto
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
   * navíc `setRate`). Celý sample se loopuje bez losování hranic; `playbackRate` ∝ rychlost
   * zrychluje obsah (frekvence úměrná rychlosti). Používá klapot spár.
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
   * Trvalá smyčka samplu s plynule řízenou hlasitostí (jako {@link makeSampleLoop}, jen místo
   * on/off bere spojitou úroveň): zdroj běží pořád, gain = `level · maxVolume` (level 0..1).
   * Pro skřípění oblouku ∝ příčné zrychlení.
   */
  private makeSampleLevelLoop(buffer: AudioBuffer, maxVolume: number): LevelVoice {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0; // start zticha, update řídí úrovní
    src.connect(gain).connect(this.master);
    src.start();
    return {
      setLevel: (level) =>
        gain.gain.setTargetAtTime(Math.max(0, Math.min(level, 1)) * maxVolume, this.ctx.currentTime, 0.08),
    };
  }

  /**
   * Sample smyčka s **náhodnými hranicemi**, přenastavovanými po každém průchodu. Loop běží
   * plynule (`loop=true`, bez gapů), ale `loopStart`/`loopEnd` se po době jednoho průchodu
   * přelosují v zadaných rozsazích (zlomky délky) → smyčka nemá pevnou periodu, takže se
   * neopakuje slyšitelný rys nahrávky (rozbíjí ~2s periodicitu). `setActive` vytvoří/zruší
   * zdroj na hranách (lze volat každý frame); `setRate` mění playbackRate ∝ otáčení kol.
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
    this.applyMasterGain();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  // Výsledná hlasitost = základní × distanční útlum (nebo 0 při mute). Jeden zdroj pravdy pro
  // master gain, kam přispívají mute i vzdálenost kamery. setTargetAtTime = plynulý přechod bez lupnutí.
  private applyMasterGain(): void {
    const target = this.muted ? 0 : MASTER_VOLUME * this.distanceVolume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  /**
   * @param cameraDistance vzdálenost kamery od lokomotivy ve world-space (m) — řídí distanční
   *   útlum hlasitosti (čistě view výpočet, dělá ho Renderer; AudioView nezná kameru → drží DD-01).
   */
  update(train: Train, cameraDistance: number): void {
    // distanční hlasitost: kamera dál od soupravy → tišší (∝ 1/d, ticho u horizontu mlhy)
    this.distanceVolume = distanceGain(cameraDistance);
    this.applyMasterGain();

    // výfuk páry: puf v taktu sdíleného ExhaustClock (sladěný s kouřem), jen pod párou —
    // otevřený regulátor (notch ≠ 0) A pára v kotli (steamPressure > 0). Bez páry píst
    // nepracuje → žádný výfuk, i když vlak dojíždí setrvačností s otevřeným regulátorem.
    if (this.exhaust.fired && train.notch !== 0 && train.steamPressure > 0) this.playChuff();
    this.updateCouplers(train);
    if (this.railLoop) this.updateRailLoop(train);   // klapot spár (frekvence ∝ rychlost)
    if (train.switchFired) this.playClunk(0.7);      // výhybka / křížení — tupý náraz
    if (train.transitionJerkFired) this.playTransitionJerk(); // skok křivosti — krátké boční skřípnutí
    this.slipLoop?.setActive(train.slipping);        // sykot, dokud loko protáčí kola
    // brzdy skřípou jen za jízdy (tření kolo↔špalík) — stojící vlak s drženou brzdou je tichý
    const speed = Math.abs(train.speed);
    if (this.brakeLoop) {
      this.brakeLoop.setActive(train.isBraking && speed > 0.3);
      // playbackRate lineárně roste 0 → BRAKE_FUSE_SPEED, pak konstantní strop (cap)
      const t = Math.min(speed, BRAKE_FUSE_SPEED) / BRAKE_FUSE_SPEED; // 0..1
      this.brakeLoop.setRate(BRAKE_RATE_MIN + t * (BRAKE_RATE_MAX - BRAKE_RATE_MIN));
    }
    this.steamLeak?.setActive(train.steamPressure > 0); // syčí, dokud je kotel pod párou
    // skřípění oblouku ∝ příčné zrychlení (v²·κ); práh převrácení ≈ 6 m/s² → /4 doplna před mezí
    this.arcLoop?.setLevel(Math.min(train.lateralAcceleration / 4, 1));
  }

  // --- jednorázové události ---

  // přechod spřáhla z vůle do kontaktu → cvaknutí (draft) nebo náraz (buff)
  private updateCouplers(train: Train): void {
    train.couplers.forEach((coupler, i) => {
      if (coupler.mode !== this.prevModes[i] && coupler.mode !== 0) {
        const volume = Math.min(1, Math.abs(coupler.relVel) / 2);
        if (coupler.mode === 1) this.playClank(volume);
        else this.playClunk(volume / 3); // nárazníky o další 1/3 tišší než výhybka (switchFired) — globální ztlumení clunk řeší playClunk
      }
      this.prevModes[i] = coupler.mode;
    });
  }

  // klapot spár ze samplu: souvislá smyčka klapotu, jejíž rychlost přehrávání ∝ rychlost vlaku
  // → frekvence klapotu přímo úměrná rychlosti. Aktivní za jízdy + kvalita trati + nesvařovaná kolej.
  private updateRailLoop(train: Train): void {
    const speed = Math.abs(train.speed);
    const active = this.params.trackImpulse > 0 && this.params.railLength > 0 && speed > 0.5;
    this.railLoop!.setActive(active);
    // playbackRate ∝ rychlost; clamp ať při krajních rychlostech klapot nezamrzne / nezní jako chipmunk
    this.railLoop!.setRate(Math.min(2.0, Math.max(0.4, speed / RAIL_REF_SPEED)));
  }

  private playChuff(): void {
    if (this.chuffSample) this.playSample(this.chuffSample, 0.9);
  }

  private playClank(volume: number): void {
    if (this.clankSample) this.playSample(this.clankSample, volume); // hlasitost ∝ síla rázu
  }

  private playClunk(volume: number): void {
    if (this.clunkSample) this.playSample(this.clunkSample, volume * CLUNK_GAIN);
  }

  private playTransitionJerk(): void {
    if (this.arcJerkSample) this.playSample(this.arcJerkSample, 1.0);
  }
}
