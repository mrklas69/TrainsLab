import type { CatmullRomCurve3, Vector3 } from 'three';
import type { TrackSegment, TrackSample } from './TrackSegment';

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
 * **Fáze 1 (zatím):** orientovaná smyčka — každý segment má jednoho následníka (`next`, exit na
 * konci) a předchůdce (`prev`, exit na začátku); žádné větvení. Výhybky (fáze 3) změní `next` na
 * volbu mezi víc segmenty. Topologie tak drží stávající chování (jedna trasa dokola), jen po grafu.
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
    this.segments = spec.segments;
    this.next = spec.next;
    this.prev = spec.prev;
    // kumulativní arc-length začátku každého segmentu (v pořadí pole; pro globalS na hlavní smyčce
    // jsou segmenty smyčky 0..k-1 v pořadí cyklu, větve za nimi)
    this.startGlobal = [];
    let acc = 0;
    for (const seg of spec.segments) {
      this.startGlobal.push(acc);
      acc += seg.length;
    }
    // délka hlavní jízdní smyčky = součet segmentů v cyklu z next[0] (osmička). Větve (rovinky) jsou
    // mimo → do smyčkové délky nepatří; gap/rázy by jinak wrapovaly na špatnou (delší) délku.
    let loopLen = 0;
    let s = 0;
    const seen = new Set<number>();
    while (!seen.has(s)) {
      seen.add(s);
      loopLen += spec.segments[s].length;
      s = spec.next[s][0]; // [0] = hlavní smyčka (osmička)
    }
    this.totalLength = loopLen;
  }

  /** Unikátní master křivky (pořadí vložení) — view z nich kreslí kolejnice/pražce (fáze 1: jedna). */
  get masterCurves(): CatmullRomCurve3[] {
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
    return this.segments[loc.seg].signedCurvature(loc.s);
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
    return this.startGlobal[loc.seg] + loc.s;
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
