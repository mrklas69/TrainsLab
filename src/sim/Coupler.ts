import type { Body } from './Body';
import type { PhysicsParams } from './params';

/** Režim spřáhla: −1 = buff (tlak nárazníků), 0 = ve vůli, +1 = draft (tah). */
export type CouplerMode = -1 | 0 | 1;

/**
 * Spřáhlo mezi dvěma sousedními vozy = pružina s vůlí — jádro slack action.
 *
 * V rozsahu vůle (mrtvé pásmo kolem klidové rozteče) je síla nulová: vozy se
 * vůči sobě volně pohnou. Za hranou vůle spřáhlo táhne (draft) nebo přes
 * nárazník tlačí (buff), modelováno jako spring-damper. Vůle, která se při
 * rozjezdu/brzdění postupně vybírá vozem za vozem, je hledaný slack run-out —
 * podélná vlna soupravou.
 */
export class Coupler {
  mode: CouplerMode = 0; // aktuální režim — čte audio/vizualizace (DD-01), zapisuje apply()
  relVel = 0;            // relativní rychlost konců (m/s) — hlasitost nárazu/cvaknutí

  constructor(
    private readonly front: Body, // vůz vepředu (větší s)
    private readonly rear: Body,  // vůz vzadu (menší s)
    private readonly restGap: number, // rozteč středů ve středu vůle (m)
  ) {}

  apply(params: PhysicsParams): void {
    const stretch = this.front.s - this.rear.s - this.restGap; // + natažení, − stlačení
    const half = params.couplerSlack / 2;
    this.relVel = this.front.v - this.rear.v;

    let displacement: number;
    if (stretch > half) { displacement = stretch - half; this.mode = 1; }        // draft — tah
    else if (stretch < -half) { displacement = stretch + half; this.mode = -1; } // buff — tlak
    else { this.mode = 0; return; }                                              // vůle → 0 síly

    const force =
      params.couplerStiffness * displacement + params.couplerDamping * this.relVel;

    // tah (force > 0) žene zadní vůz dopředu a přední brzdí; tlak (force < 0) opačně
    this.rear.applyForce(force);
    this.front.applyForce(-force);
  }
}
