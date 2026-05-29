import { CatmullRomCurve3 } from 'three';
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
    constructor(controlPoints) {
        // uzavřená (closed=true) centripetální Catmull-Rom — bez self-intersection smyček
        this.curve = new CatmullRomCurve3(controlPoints, true, 'centripetal');
        this.length = this.curve.getLength();
    }
    /** s (arc-length, m) → bod + jednotková tečna. `s` se zabalí přes délku (smyčka). */
    at(s) {
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
    grade(s) {
        return this.at(s).tangent.y;
    }
    /** Zabalení arc-length do [0, length) — trať je smyčka. */
    wrap(s) {
        return ((s % this.length) + this.length) % this.length;
    }
}
