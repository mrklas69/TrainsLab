import { Curve, Vector3 } from 'three';

export type TrackCurve = Curve<Vector3> & { closed: boolean };

export interface TrackSample {
  position: Vector3; // 3D bod na trati
  tangent: Vector3;  // jednotková tečna (směr rostoucího s)
}

/**
 * Segment trati = úsek jedné hladké „master" křivky vymezený rozsahem normalizované
 * arc-length [uStart, uEnd]. Navenek se adresuje **lokální** arc-length `s` ∈ [0, length].
 *
 * Klíč k bezešvému napojení: sklon i křivost čtou **master křivku spojitě** (vzorky u±du
 * leží na téže křivce, i když přesahují hranice segmentu), takže na uzlu mezi segmenty
 * není zlom — geometrie je pořád původní hladká osmička, jen rozsekaná na úseky.
 *
 * Více segmentů + uzly skládá {@link TrackNetwork} (graf → výhybky). `three` je tu jen
 * matematika (křivka, vektor) — model nezná renderer (DD-01).
 */
export class TrackSegment {
  readonly length: number; // délka segmentu v metrech (část arc-length master křivky)

  constructor(
    readonly curve: TrackCurve,       // master křivka (sdílená víc segmenty)
    private readonly uStart: number,  // začátek úseku v normalizované arc-length [0,1)
    private readonly uEnd: number,    // konec úseku (uEnd > uStart; getPointAt je arc-length param)
    curveLength: number,              // celková délka master křivky (curve.getLength())
  ) {
    this.length = (uEnd - uStart) * curveLength; // u je normalizovaná arc-length → délka je lineární
  }

  /** Lokální s (m) → parametr u na master křivce. Extrapoluje i mimo [0,length] (spojitá křivost). */
  private u(s: number): number {
    return this.uStart + (s / this.length) * (this.uEnd - this.uStart);
  }

  /**
   * Namapuje u na platný rozsah master křivky. **Uzavřená** křivka (osmička): zabal do [0,1)
   * — vzorky u krajů segmentu i wrap-segment (uEnd > 1) přetečou hladce přes u=1≡0. **Otevřená**
   * křivka (rovinka): u=1 je konec, ne ekvivalent začátku → jen clamp do [0,1] (zabalení by konec
   * rovinky chybně mapovalo na začátek). `curve.closed` říká, který případ nastal.
   */
  private wrapU(u: number): number {
    if (!this.curve.closed) return Math.min(1, Math.max(0, u));
    return ((u % 1) + 1) % 1;
  }

  /** s → bod + jednotková tečna. */
  at(s: number): TrackSample {
    const u = this.wrapU(this.u(s));
    return { position: this.curve.getPointAt(u), tangent: this.curve.getTangentAt(u) };
  }

  /** s → jen 3D bod (lehčí cesta než {@link at}). */
  positionAt(s: number): Vector3 {
    return this.curve.getPointAt(this.wrapU(this.u(s)));
  }

  /** Sklon sin(θ) = y-složka jednotkové tečny (> 0 do kopce ve směru rostoucího s). */
  grade(s: number): number {
    return this.curve.getTangentAt(this.wrapU(this.u(s))).y;
  }

  /**
   * Znaménková křivost horizontálního průmětu (1/m) z diferencí polohy v XZ.
   * U uzavřené master křivky i uvnitř otevřené používá centrální rozdíl. Na koncích
   * otevřené křivky přepne na jednostranný rozdíl, aby clamp nevyráběl falešnou derivaci.
   * C² napojené segmenty tak na uzlu dávají shodnou křivost až na numerickou chybu.
   */
  signedCurvature(s: number): number {
    const ds = 0.5; // m — krok centrální diference
    let d1x: number;
    let d1z: number;
    let d2x: number;
    let d2z: number;

    if (!this.curve.closed && s < ds) {
      const p0 = this.positionAt(0);
      const p1 = this.positionAt(ds);
      const p2 = this.positionAt(2 * ds);
      d1x = (-3 * p0.x + 4 * p1.x - p2.x) / (2 * ds);
      d1z = (-3 * p0.z + 4 * p1.z - p2.z) / (2 * ds);
      d2x = (p0.x - 2 * p1.x + p2.x) / (ds * ds);
      d2z = (p0.z - 2 * p1.z + p2.z) / (ds * ds);
    } else if (!this.curve.closed && s > this.length - ds) {
      const p0 = this.positionAt(this.length);
      const p1 = this.positionAt(this.length - ds);
      const p2 = this.positionAt(this.length - 2 * ds);
      d1x = (3 * p0.x - 4 * p1.x + p2.x) / (2 * ds);
      d1z = (3 * p0.z - 4 * p1.z + p2.z) / (2 * ds);
      d2x = (p0.x - 2 * p1.x + p2.x) / (ds * ds);
      d2z = (p0.z - 2 * p1.z + p2.z) / (ds * ds);
    } else {
      const p0 = this.positionAt(s - ds);
      const p1 = this.positionAt(s);
      const p2 = this.positionAt(s + ds);
      d1x = (p2.x - p0.x) / (2 * ds);
      d1z = (p2.z - p0.z) / (2 * ds);
      d2x = (p2.x - 2 * p1.x + p0.x) / (ds * ds);
      d2z = (p2.z - 2 * p1.z + p0.z) / (ds * ds);
    }

    const speed = Math.hypot(d1x, d1z);
    return (d1x * d2z - d1z * d2x) / (speed * speed * speed);
  }
}
