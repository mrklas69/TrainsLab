import { CatmullRomCurve3, Vector3 } from 'three';

export interface TrackSample {
  position: Vector3; // 3D bod na trati
  tangent: Vector3;  // jednotková tečna (směr rostoucího s)
}

/**
 * Trať = uzavřená parametrická křivka (DD-02).
 *
 * Navenek se adresuje arc-length souřadnicí `s` v metrech. Fyzika je tím 1D;
 * 3D pozice a sklon se z `s` dopočítají až na hranici s rendererem.
 *
 * `three` je tu použit jen jako matematická knihovna (křivka, vektor) — model
 * stále nezná pixely, scénu ani renderer (DD-01).
 */
export class Track {
  readonly curve: CatmullRomCurve3;
  readonly length: number;

  constructor(controlPoints: Vector3[]) {
    // uzavřená (closed=true) centripetální Catmull-Rom — bez self-intersection smyček
    this.curve = new CatmullRomCurve3(controlPoints, true, 'centripetal');
    this.length = this.curve.getLength();
  }

  /** s (arc-length, m) → bod + jednotková tečna. `s` se zabalí přes délku (smyčka). */
  at(s: number): TrackSample {
    const u = this.wrap(s) / this.length; // normalizovaná arc-length [0,1)
    return {
      position: this.curve.getPointAt(u),
      tangent: this.curve.getTangentAt(u),
    };
  }

  /**
   * Sklon trati v `s`: sin(θ) = dy/ds = y-složka jednotkové tečny.
   * > 0 do kopce (ve směru rostoucího s), < 0 z kopce. Vstup pro gravitaci.
   */
  grade(s: number): number {
    return this.at(s).tangent.y;
  }

  /** Zabalení arc-length do [0, length) — trať je smyčka. */
  private wrap(s: number): number {
    return ((s % this.length) + this.length) % this.length;
  }
}
