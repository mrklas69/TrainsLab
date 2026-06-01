import type { PhysicsParams } from '../sim/params';

// Počet výfuků páry na jednu otáčku hnacího kola. Klasická dvojčinná dvojválcová
// parní lokomotiva vyfoukne 4× za otáčku (2 válce × 2 zdvihy) — ten ikonický
// rytmus „čch-čch-čch-čch", který se zrychluje s rychlostí.
const PULSES_PER_REV = 4;

// Nad touhle rychlostí (m/s) se pufy slévají v rachot („kulomet"): interval výfuku klesne
// pod délku chuffu (~159 ms při 7,4 m/s vs ~0,2 s výdech). Frekvenci výfuku proto stropujeme
// — takt se nad prahem ustálí, místo aby rostl donekonečna. Sdílený clock → cap platí pro
// zvukový chuff i puf kouře současně (drží DD-23 sladění z jednoho zdroje).
const CHUFF_FUSE_SPEED = 7.4;

/**
 * ExhaustClock = sdílený zdroj rytmu parního výfuku (čistě view, DD-01). Není to
 * zvuk ani obraz — jen takt: kdy padl další výfuk. Obě view vrstvy (AudioView puf
 * zvuku, SmokeView puf kouře) ho čtou, aby byly **sladěné z jediného zdroje** (DRY) —
 * jinak by si každá časovala výfuk po svém a fáze by se rozjely.
 *
 * Rytmus je **fyzikálně odvozený**, ne fenomenologický: frekvence výfuku = otáčky
 * kola × {@link PULSES_PER_REV}. Otáčky = rychlost / obvod hnacího kola (π·D), takže
 * pomalý rozjezd dá pomalé oddělené pufy a rychlá jízda hustý sykot — emergentně,
 * bez ladění časové konstanty (nika projektu: preferuj emergenci). Nad
 * {@link CHUFF_FUSE_SPEED} se takt stropuje, aby pufy nesplynuly v rachot.
 *
 * `main` volá {@link advance} jednou za frame (drží `dt`), view pak jen čtou
 * {@link fired} — stejný vzor jako per-frame flagy `train.switchFired` apod.
 */
export class ExhaustClock {
  private phase = 0;   // akumulovaná fáze výfuku (v jednotkách „pufů"); celé číslo = jeden výfuk
  fired = false;       // padl tento frame nový výfuk? (read-only pro view vrstvy)

  constructor(private readonly params: PhysicsParams) {}

  /**
   * Posune fázi podle ujeté dráhy za `dt` a nastaví {@link fired}, pokud fáze
   * překročila další celé číslo (= další výfuk). `fired` je bool: při 60 FPS padá
   * < 1 puf/frame i při plné rychlosti, takže o žádný výfuk nepřijdeme (KISS).
   */
  advance(speed: number, dt: number): void {
    const circumference = Math.PI * this.params.driverDiameter; // obvod hnacího kola (m)
    const pulsesPerMeter = PULSES_PER_REV / circumference;      // kolik výfuků na metr dráhy
    // cap rychlosti → nad CHUFF_FUSE_SPEED se takt ustálí (jinak by pufy splynuly v rachot)
    const v = Math.min(Math.abs(speed), CHUFF_FUSE_SPEED);
    const prev = this.phase;
    this.phase += v * dt * pulsesPerMeter;
    // přechod přes celé číslo = nový výfuk (floor skočí o 1+)
    this.fired = Math.floor(this.phase) > Math.floor(prev);
  }
}
