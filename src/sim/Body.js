const V_STATIC = 0.05; // m/s — pod tímhle se těleso považuje za stojící
/**
 * Jedno vozidlo soupravy jako 1D hmota na trati.
 *
 * Drží stav (`s`, `v`) a akumulátor sil pro aktuální krok. Vlastní hmotnost
 * nedrží — předává ji {@link Train} (lokomotiva je těžší než vagon). Integraci
 * řídí {@link Train}, protože spřáhla tělesa provazují.
 */
export class Body {
    constructor(s, // arc-length pozice středu vozu (m)
    length) {
        this.s = s;
        this.length = length;
        this.v = 0;
        this.force = 0;
    }
    /** Přičti sílu do akumulátoru tohoto kroku (volá {@link Coupler}, trakce, brzda). */
    applyForce(force) {
        this.force += force;
    }
    /** Začátek kroku: akumulátor = gravitace + odpor vzduchu (tření řeší {@link applyFriction}). */
    beginStep(track, params, mass) {
        const grade = track.grade(this.s); // sin(θ)
        const fGravity = -mass * params.gravity * grade; // do kopce brzdí
        const fDrag = -params.dragCoefficient * this.v * Math.abs(this.v);
        this.force = fGravity + fDrag;
    }
    /**
     * Tření kolo-kolej jako statické/kinetické. Stojící těleso drží statický odpor
     * (vyšší — rozběhový), dokud ho ostatní síly nepřekonají; pak se „utrhne" na
     * kinetický valivý odpor. Tohle dává vůli ve spřáhle funkční smysl: lokomotiva
     * vybírá vůli a utrhává vozy postupně, ne celou soupravu naráz.
     */
    applyFriction(params, mass) {
        const kinetic = mass * params.gravity * params.rollingResistance;
        const isStanding = Math.abs(this.v) < V_STATIC;
        if (isStanding) {
            const staticMax = kinetic * params.startingResistanceFactor;
            if (Math.abs(this.force) <= staticMax) {
                // statické tření udrží těleso v klidu
                this.force = 0;
                this.v = 0;
            }
            else {
                // utrhlo se — odpor proti směru působící síly
                this.force -= Math.sign(this.force) * kinetic;
            }
        }
        else {
            this.force -= Math.sign(this.v) * kinetic;
        }
    }
    /** Semi-implicitní Euler z naakumulované síly: nejdřív rychlost, pak poloha. */
    integrate(h, mass) {
        this.v += (this.force / mass) * h;
        this.s += this.v * h;
    }
}
