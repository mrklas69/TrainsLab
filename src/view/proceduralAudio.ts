// Procedurální generátory zvuku (Web Audio) — fallback vrstva AudioView pro chybějící
// samply (DD-01: zvuk je view, žádný stav simu). Čisté tovární funkce nad AudioContext
// a cílovým uzlem (master gain) — žádná znalost soupravy; AudioView je orchestruje a
// rozhoduje, kdy hrají (hybrid: nahraný sample má přednost, jinak tyhle „vždy zní něco").

/** Trvalý hlas (loop), který se jen plynule zapíná/vypíná — prokluz, skřípění brzd. */
export interface SustainVoice {
  setActive(on: boolean): void;
}

/** Trvalý hlas s plynule řízenou hlasitostí (0..1) — skřípění oblouku ∝ příčné zrychlení. */
export interface LevelVoice {
  setLevel(level: number): void;
}

/** 2 s bílého šumu — sdílený zdroj pro chuff burst i sykot prokluzu. */
export function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Sykot prokluzu: vysoký filtrovaný šum, zapínaný/vypínaný gainem. */
export function makeSlipVoice(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer): SustainVoice {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(hp).connect(gain).connect(dest);
  src.start();
  return {
    setActive: (on) => gain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05),
  };
}

/**
 * Skřípění brzd: skřípání kovu o kov složené ze **tří neharmonických** vysokých frekvencí
 * (disonance = „skříp", ne hudební tón), každá s vlastním pomalým jitterem frekvence →
 * nestabilní, neperiodické škrundání. Složky sečtené přes společný bandpass; hlasitost on/off.
 */
export function makeSquealVoice(ctx: AudioContext, dest: AudioNode): SustainVoice {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3000;
  band.Q.value = 1.2; // širší pásmo než u jednoho tónu — projdou všechny tři složky
  band.connect(gain).connect(dest);

  // neharmonické poměry (ne celočíselné násobky základní) → kovová disonance místo tónu
  const freqs = [2150, 3070, 4350];
  const lfoRates = [24, 31, 39]; // různé rychlosti jitteru → složitá modulace bez slyšitelné periody
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoRates[i];
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f * 0.04; // hloubka kmitání ∝ frekvence → výraznější „skřípání"
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(band);
    osc.start();
    lfo.start();
  });
  return {
    setActive: (on) => gain.gain.setTargetAtTime(on ? 0.2 : 0, ctx.currentTime, 0.04), // 3 zdroje → mírně níž
  };
}

/**
 * Skřípění okolků v oblouku (flange squeal): vysoký kvílivý tón s pomalou modulací,
 * hlasitost plynule řízená příčným zrychlením (≠ on/off brzd) — sílí v ostřejší zatáčce.
 */
export function makeArcSquealVoice(ctx: AudioContext, dest: AudioNode): LevelVoice {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 2200;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 8;       // pomalejší než brzdový pískot → „kvílení", ne „skřípot"
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain).connect(osc.frequency);

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2200;
  band.Q.value = 7;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(band).connect(gain).connect(dest);
  osc.start();
  lfo.start();
  return {
    setLevel: (level) =>
      gain.gain.setTargetAtTime(Math.max(0, Math.min(level, 1)) * 0.18, ctx.currentTime, 0.08),
  };
}

/** Krátký úder z několika netónových harmonických s rychlým decayem (clank/clunk/tikot spár). */
export function playMetalHit(ctx: AudioContext, dest: AudioNode, freqs: number[], decay: number, volume: number): void {
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.03, volume) * 0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  gain.connect(dest);
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + decay);
  }
}

/** Procedurální chuff (fallback, není-li sample): nízkofrekvenční výdech páry z burstu šumu. */
export function playChuffBurst(ctx: AudioContext, dest: AudioNode, noise: AudioBuffer): void {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 280; // nízkofrekvenční výdech
  band.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.9, t + 0.015); // ostrý nádech
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); // výdech
  src.connect(band).connect(gain).connect(dest);
  src.start(t);
  src.stop(t + 0.2);
}

/**
 * Boční trh na skoku křivosti (chybějící přechodnice): krátké skřípnutí okolku, příbuzné
 * trvalému skřípění oblouku (sawtooth/bandpass ~2,2 kHz), ale jednorázové se sklouznutím
 * frekvence dolů („škríp") — odlišuje κ-trh od tupého kovového clunku výhybky.
 */
export function playArcJerk(ctx: AudioContext, dest: AudioNode): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2400, t);
  osc.frequency.exponentialRampToValueAtTime(1500, t + 0.12); // sklouznutí dolů = kvílivý trh
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2200;
  band.Q.value = 6;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.008); // ostrý nástup
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); // rychlé doznění
  osc.connect(band).connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + 0.16);
}
