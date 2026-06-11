import type { Vector3 } from 'three';
import type { TrackCurve, TrackSegment, TrackSample } from './TrackSegment';

/** Popis sítě — segmenty + topologie (kdo na koho navazuje). Staví ho factory v trackData. */
export interface NetworkSpec {
  segments: TrackSegment[];
  // možná pokračování za koncem / před začátkem segmentu. Jeden prvek = obyčejné napojení,
  // víc prvků = **výhybka** (volba trasy). Pořadí: [0] = hlavní smyčka (osmička) — deterministická
  // jízda bere vždy [0], náhodná (volný vagon, DD-25 fáze 2) vybírá libovolný.
  next: number[][]; // next[seg] = segmenty za koncem `seg` (exit při s ≥ length)
  prev: number[][]; // prev[seg] = segmenty před začátkem `seg` (exit při s < 0)
}

/** Poloha tělesa na síti: na kterém segmentu a kde (lokální arc-length, m). */
export interface TrackLocation {
  seg: number;
  s: number;
}

/**
 * Síť trati = graf {@link TrackSegment}ů spojených v uzlech (DD-02 rozšířené: 1D model, ale dráha
 * je graf místo jediné smyčky). Navenek nahrazuje dřívější `Track` — místo skalárního `s` adresuje
 * polohu přes {@link TrackLocation} (segment + lokální s).
 *
 * Síť už může obsahovat větvení (`next`/`prev` s více možnostmi). Výchozí volba `[0]`
 * drží hlavní smyčku; route-aware souřadnice a řízení výhybek doplní další fáze DD-25.
 */
export class TrackNetwork {
  segments!: TrackSegment[];
  totalLength!: number;             // délka hlavní jízdní smyčky (cyklus z next) — gap/rázy/kola wrapují přes ni;
                                    // větve mimo cyklus (rovinky) se do ní nepočítají (DD-25 fáze 2)
  private next!: number[][];        // možná pokračování za koncem `seg` (víc = výhybka)
  private prev!: number[][];        // možná pokračování před začátkem `seg` (víc = výhybka)
  private startGlobal!: number[];   // kumulativní arc-length začátku každého segmentu

  constructor(spec: NetworkSpec) {
    this.apply(spec);
  }

  /** Přestaví síť z nové specifikace (slider sklonu → nová geometrie). In-place, referenci drží sim i view. */
  rebuild(spec: NetworkSpec): void {
    this.apply(spec);
  }

  private apply(spec: NetworkSpec): void {
    this.validate(spec);
    this.segments = spec.segments;
    this.next = spec.next;
    this.prev = spec.prev;
    // Globální souřadnice existuje zatím jen na hlavní trase next[·][0]. Větve dostanou NaN,
    // aby se jejich použití v gap/globalS nepočítalo potichu podle náhodného pořadí pole.
    this.startGlobal = Array(spec.segments.length).fill(Number.NaN);
    let acc = 0;
    let segIndex = 0;
    const seen = new Set<number>();
    while (!seen.has(segIndex)) {
      seen.add(segIndex);
      this.startGlobal[segIndex] = acc;
      acc += spec.segments[segIndex].length;
      segIndex = spec.next[segIndex][0]; // [0] = hlavní smyčka
    }
    if (segIndex !== 0) throw new Error('Hlavní trasa next[·][0] musí tvořit cyklus zpět do segmentu 0.');
    this.totalLength = acc;
  }

  private validate(spec: NetworkSpec): void {
    const count = spec.segments.length;
    if (count === 0) throw new Error('TrackNetwork vyžaduje alespoň jeden segment.');
    if (spec.next.length !== count || spec.prev.length !== count) {
      throw new Error('TrackNetwork: segments, next a prev musí mít stejnou délku.');
    }
    for (const [label, edges] of [['next', spec.next], ['prev', spec.prev]] as const) {
      edges.forEach((options, from) => {
        if (options.length === 0) throw new Error(`TrackNetwork: ${label}[${from}] nesmí být prázdné.`);
        for (const to of options) {
          if (!Number.isInteger(to) || to < 0 || to >= count) {
            throw new Error(`TrackNetwork: ${label}[${from}] obsahuje neplatný segment ${to}.`);
          }
        }
      });
    }
  }

  /** Unikátní master křivky (pořadí vložení) — view z nich kreslí kolejnice a pražce. */
  get masterCurves(): TrackCurve[] {
    return [...new Set(this.segments.map((s) => s.curve))];
  }

  segmentOf(seg: number): TrackSegment {
    return this.segments[seg];
  }

  at(loc: TrackLocation): TrackSample {
    return this.segments[loc.seg].at(loc.s);
  }
  positionAt(loc: TrackLocation): Vector3 {
    return this.segments[loc.seg].positionAt(loc.s);
  }
  grade(loc: TrackLocation): number {
    return this.segments[loc.seg].grade(loc.s);
  }
  signedCurvature(loc: TrackLocation): number {
    const ds = 0.5;
    const before = { seg: loc.seg, s: loc.s - ds };
    const after = { seg: loc.seg, s: loc.s + ds };
    this.advance(before);
    this.advance(after);
    const p0 = this.positionAt(before);
    const p1 = this.positionAt(loc);
    const p2 = this.positionAt(after);
    const d1x = (p2.x - p0.x) / (2 * ds);
    const d1z = (p2.z - p0.z) / (2 * ds);
    const d2x = (p2.x - 2 * p1.x + p0.x) / (ds * ds);
    const d2z = (p2.z - 2 * p1.z + p0.z) / (ds * ds);
    const speed = Math.hypot(d1x, d1z);
    return (d1x * d2z - d1z * d2x) / (speed * speed * speed);
  }

  /**
   * Znormalizuje polohu po pohybu: přeteče-li lokální `s` za konec segmentu (≥ length) nebo pod
   * začátek (< 0), přejde na navazující/předchozí segment a přenese přebytek. Smyčka projde víc
   * uzlů, je-li krok velký (guard proti zacyklení). Mění `loc` in-place.
   *
   * `choose` vybírá pokračování ve **výhybce** (uzel s víc možnostmi). Default = `[0]` (hlavní
   * smyčka, osmička) → deterministická jízda soupravy. Volný vagon předá náhodný výběr (DD-25 fáze 2).
   */
  advance(loc: TrackLocation, choose: (opts: number[]) => number = (o) => o[0]): void {
    for (let guard = 0; guard < 100; guard++) {
      const seg = this.segments[loc.seg];
      if (loc.s >= seg.length) {
        loc.s -= seg.length;
        loc.seg = choose(this.next[loc.seg]);
      } else if (loc.s < 0) {
        loc.seg = choose(this.prev[loc.seg]);
        loc.s += this.segments[loc.seg].length;
      } else {
        return;
      }
    }
  }

  /**
   * Globální arc-length polohy podél smyčky (m) — kumulativní začátek segmentu + lokální s.
   * Pro kontakty volných vozů (rozteč po dráze) a fázi otáčení kol (spojitá přes hranice segmentů).
   * Platí pro orientovanou smyčku (fáze 1); s větvením (fáze 3) přestane být jednoznačné.
   */
  globalS(loc: TrackLocation): number {
    const start = this.startGlobal[loc.seg];
    if (!Number.isFinite(start)) {
      throw new Error(`Segment ${loc.seg} neleží na hlavní trase; globalS pro větev zatím není definováno.`);
    }
    return start + loc.s;
  }

  /**
   * Nejkratší rozdíl pozic po smyčce (m): globalS(to) − globalS(from) zabalený do [−L/2, L/2).
   * Kladné = `to` je před `from` (ve směru rostoucího s). Pro spřáhla, kontakty a rázy, které
   * počítají rozteč těles — funguje i přes hranici segmentu i přes wrap smyčky. (Orientovaná
   * smyčka, fáze 1; s větvením přestane být jednoznačné jako globalS.)
   */
  gap(from: TrackLocation, to: TrackLocation): number {
    const L = this.totalLength;
    let d = (this.globalS(to) - this.globalS(from)) % L;
    if (d > L / 2) d -= L;
    else if (d < -L / 2) d += L;
    return d;
  }
}
