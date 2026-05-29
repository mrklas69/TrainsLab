import type { Track } from './Track';
import type { PhysicsParams } from './params';

const V_STATIC = 0.05; // m/s — pod tímhle se těleso považuje za stojící

/**
 * Jedno vozidlo soupravy jako 1D hmota na trati.
 *
 * Drží stav (`s`, `v`) a akumulátor sil pro aktuální krok. Vlastní hmotnost
 * nedrží — předává ji {@link Train} (lokomotiva je těžší než vagon). Integraci
 * řídí {@link Train}, protože spřáhla tělesa provazují.
 */
export class Body {
  v = 0;
  private force = 0;

  constructor(
    public s: number,        // arc-length pozice středu vozu (m)
    readonly length: number, // délka vozu (m), pro render i rozteč spřáhel
  ) {}

  /** Přičti sílu do akumulátoru tohoto kroku (volá {@link Coupler}, trakce, brzda). */
  applyForce(force: number): void {
    this.force += force;
  }

  /** Začátek kroku: akumulátor = gravitace + odpor vzduchu (tření řeší {@link applyFriction}). */
  beginStep(track: Track, params: PhysicsParams, mass: number): void {
    const grade = track.grade(this.s); // sin(θ)
    const fGravity = -mass * params.gravity * grade;            // do kopce brzdí
    const fDrag = -params.dragCoefficient * this.v * Math.abs(this.v);
    this.force = fGravity + fDrag;
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

  /** Semi-implicitní Euler z naakumulované síly: nejdřív rychlost, pak poloha. */
  integrate(h: number, mass: number): void {
    this.v += (this.force / mass) * h;
    this.s += this.v * h;
  }
}
