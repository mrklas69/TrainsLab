import { CatmullRomCurve3, Vector3 } from 'three';

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
    readonly curve: CatmullRomCurve3, // master křivka (sdílená víc segmenty)
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

  /** Zabalí u do [0,1) — master křivka je uzavřená, takže vzorky u krajů segmentu nepřetečou. */
  private wrapU(u: number): number {
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
   * Znaménková křivost horizontálního průmětu (1/m) z centrálních diferencí polohy v XZ
   * (jako dřív v Track). Vzorky s±ds se mapují na master křivku spojitě → na hranici segmentu
   * vyjde tatáž křivost jako uvnitř sousedního (žádný zlom). Rovinka → ~0.
   */
  signedCurvature(s: number): number {
    const ds = 0.5; // m — krok centrální diference
    const p0 = this.positionAt(s - ds);
    const p1 = this.positionAt(s);
    const p2 = this.positionAt(s + ds);

    const d1x = (p2.x - p0.x) / (2 * ds);
    const d1z = (p2.z - p0.z) / (2 * ds);
    const d2x = (p2.x - 2 * p1.x + p0.x) / (ds * ds);
    const d2z = (p2.z - 2 * p1.z + p0.z) / (ds * ds);

    const speed = Math.hypot(d1x, d1z);
    return (d1x * d2z - d1z * d2x) / (speed * speed * speed);
  }
}
