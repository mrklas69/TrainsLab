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
    constructor(front, // vůz vepředu (větší s)
    rear, // vůz vzadu (menší s)
    restGap) {
        this.front = front;
        this.rear = rear;
        this.restGap = restGap;
    }
    apply(params) {
        const stretch = this.front.s - this.rear.s - this.restGap; // + natažení, − stlačení
        const half = params.couplerSlack / 2;
        let displacement;
        if (stretch > half)
            displacement = stretch - half; // draft — tah
        else if (stretch < -half)
            displacement = stretch + half; // buff — tlak přes nárazník
        else
            return; // vůle → žádná síla
        const relVel = this.front.v - this.rear.v;
        const force = params.couplerStiffness * displacement + params.couplerDamping * relVel;
        // tah (force > 0) žene zadní vůz dopředu a přední brzdí; tlak (force < 0) opačně
        this.rear.applyForce(force);
        this.front.applyForce(-force);
    }
}
