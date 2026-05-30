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
  curve: CatmullRomCurve3;
  length: number;

  constructor(controlPoints: Vector3[]) {
    // uzavřená (closed=true) centripetální Catmull-Rom — bez self-intersection smyček
    this.curve = new CatmullRomCurve3(controlPoints, true, 'centripetal');
    this.length = this.curve.getLength();
  }

  /**
   * Přestaví křivku z nových kontrolních bodů (slider sklonu za běhu). Reference
   * na Track drží sim i renderer — proto in-place, ne nová instance. Pozice vozů
   * `s` jsou v metrech a wrap() je zabalí přes novou délku, takže souprava jede dál.
   */
  rebuild(controlPoints: Vector3[]): void {
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

  /**
   * Lokální poloměr oblouku v `s` (m) — z křivosti **horizontálního** průmětu trati.
   *
   * Izomorfní s {@link grade}: grade bere svislou složku tečny (kopec → podélná
   * gravitace), radius bere zakřivení v půdorysu (zatáčka → příčná odstředivka v²/r).
   * Svislé zvlnění (přejezd kopce/údolí) dává nadlehčení, ne boční převrácení —
   * proto jen XZ, ne plná 3D křivost.
   *
   * Rovný úsek → `Infinity` (κ → 0; odstředivka v²/r → 0). Křivost κ z konečných
   * diferencí polohy (vzorec křivosti rovinné křivky: |x'·z'' − z'·x''| / |r'|³).
   */
  radius(s: number): number {
    const k = Math.abs(this.signedCurvature(s));
    return k < 1e-6 ? Infinity : 1 / k;
  }

  /**
   * Znaménková křivost půdorysu (1/m) v `s`. Magnituda = 1/poloměr (vstup pro odstředivku),
   * **znaménko** rozlišuje stranu zatáčky — to potřebuje náklon skříně (roll), aby se vyklonila
   * na správnou stranu (ven z oblouku). Rovinka → ~0. Vzorec křivosti rovinné křivky:
   * (x'·z'' − z'·x'') / |r'|³, z centrálních diferencí polohy v XZ.
   */
  signedCurvature(s: number): number {
    const ds = 0.5; // m — krok centrální diference (kompromis přesnost × hladkost)
    const p0 = this.at(s - ds).position;
    const p1 = this.at(s).position;
    const p2 = this.at(s + ds).position;

    // 1. a 2. derivace polohy v půdorysu (XZ), centrální diference
    const d1x = (p2.x - p0.x) / (2 * ds);
    const d1z = (p2.z - p0.z) / (2 * ds);
    const d2x = (p2.x - 2 * p1.x + p0.x) / (ds * ds);
    const d2z = (p2.z - 2 * p1.z + p0.z) / (ds * ds);

    const speed = Math.hypot(d1x, d1z); // |r'| v půdorysu (~1, je-li trať skoro vodorovná)
    return (d1x * d2z - d1z * d2x) / (speed * speed * speed);
  }

  /** Zabalení arc-length do [0, length) — trať je smyčka. */
  private wrap(s: number): number {
    return ((s % this.length) + this.length) % this.length;
  }
}
