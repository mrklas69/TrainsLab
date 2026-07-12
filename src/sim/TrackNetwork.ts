import type { Vector3 } from 'three';
import type { TrackCurve, TrackSegment, TrackSample } from './TrackSegment';

export const ROUTE_IDS = ['main', 'branch'] as const;
export type RouteId = typeof ROUTE_IDS[number];
const DEFAULT_ROUTE: RouteId = 'main';

type AdvanceDirection = 'next' | 'prev';
type AdvanceChoice = (opts: readonly number[], from: number, direction: AdvanceDirection) => number;

/** Popis sítě — segmenty + topologie (kdo na koho navazuje). Staví ho factory v trackData. */
export interface NetworkSpec {
  segments: TrackSegment[];
  // možná pokračování za koncem / před začátkem segmentu. Jeden prvek = obyčejné napojení,
  // víc prvků = **výhybka** (volba trasy). Pořadí: [0] = hlavní smyčka (osmička) — deterministická
  // jízda bere vždy [0], náhodná (volný vagon, DD-25 fáze 2) vybírá libovolný.
  next: number[][]; // next[seg] = segmenty za koncem `seg` (exit při s ≥ length)
  prev: number[][]; // prev[seg] = segmenty před začátkem `seg` (exit při s < 0)
  routes: Record<RouteId, number[]>; // route id → uzavřená sekvence segmentů v pořadí jízdy
}

/** Poloha tělesa na síti: na kterém segmentu a kde (lokální arc-length, m). */
export interface TrackLocation {
  seg: number;
  s: number;
  route?: RouteId; // která uzavřená trasa dává polohám na společných segmentech jednoznačný význam
}

/**
 * Síť trati = graf {@link TrackSegment}ů spojených v uzlech (DD-02 rozšířené: 1D model, ale dráha
 * je graf místo jediné smyčky). Navenek nahrazuje dřívější `Track` — místo skalárního `s` adresuje
 * polohu přes {@link TrackLocation} (segment + lokální s).
 *
 * Síť obsahuje větvení (`next`/`prev` s více možnostmi) i deklarované route (`main`/`branch`).
 * Route-aware `globalS`/`gap` dávají společným segmentům jednoznačný význam podle zvolené trasy.
 */
export class TrackNetwork {
  segments!: TrackSegment[];
  totalLength!: number;             // délka hlavní jízdní smyčky (cyklus z next) — gap/rázy/kola wrapují přes ni;
                                    // větve mimo cyklus (rovinky) se do ní nepočítají (DD-25 fáze 2)
  private next!: number[][];        // možná pokračování za koncem `seg` (víc = výhybka)
  private prev!: number[][];        // možná pokračování před začátkem `seg` (víc = výhybka)
  private routes!: Record<RouteId, number[]>;       // uzavřené jízdní trasy přes graf
  private routeStarts!: Record<RouteId, number[]>;  // route → kumulativní začátek segmentu
  private routeLengths!: Record<RouteId, number>;   // route → délka celé smyčky

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
    this.routes = spec.routes;
    this.routeStarts = { main: [], branch: [] };
    this.routeLengths = { main: 0, branch: 0 };

    for (const route of ROUTE_IDS) {
      const starts = Array(spec.segments.length).fill(Number.NaN);
      let acc = 0;
      for (const seg of spec.routes[route]) {
        starts[seg] = acc;
        acc += spec.segments[seg].length;
      }
      this.routeStarts[route] = starts;
      this.routeLengths[route] = acc;
    }

    // Zpětná kompatibilita pro místa, která pořád znamenají „hlavní smyčka".
    this.totalLength = this.routeLengths.main;
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
    spec.next.forEach((options, from) => {
      for (const to of options) {
        if (!spec.prev[to].includes(from)) {
          throw new Error(`TrackNetwork: hrana next ${from}→${to} chybí v prev[${to}].`);
        }
      }
    });
    spec.prev.forEach((options, from) => {
      for (const to of options) {
        if (!spec.next[to].includes(from)) {
          throw new Error(`TrackNetwork: hrana prev ${from}→${to} chybí v next[${to}].`);
        }
      }
    });
    for (const route of ROUTE_IDS) {
      const sequence = spec.routes[route];
      if (!sequence || sequence.length === 0) {
        throw new Error(`TrackNetwork: route ${route} musí obsahovat alespoň jeden segment.`);
      }
      const seen = new Set<number>();
      sequence.forEach((seg, i) => {
        if (!Number.isInteger(seg) || seg < 0 || seg >= count) {
          throw new Error(`TrackNetwork: route ${route} obsahuje neplatný segment ${seg}.`);
        }
        if (seen.has(seg)) throw new Error(`TrackNetwork: route ${route} obsahuje segment ${seg} víckrát.`);
        seen.add(seg);
        const nextSeg = sequence[(i + 1) % sequence.length];
        const prevSeg = sequence[(i - 1 + sequence.length) % sequence.length];
        if (!spec.next[seg].includes(nextSeg)) {
          throw new Error(`TrackNetwork: route ${route} nemá hranu next ${seg}→${nextSeg}.`);
        }
        if (!spec.prev[seg].includes(prevSeg)) {
          throw new Error(`TrackNetwork: route ${route} nemá hranu prev ${seg}→${prevSeg}.`);
        }
      });
    }
  }

  /** Unikátní master křivky (pořadí vložení) — view z nich kreslí kolejnice a pražce. */
  get masterCurves(): TrackCurve[] {
    return [...new Set(this.segments.map((s) => s.curve))];
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
    // Jediná cesta: zavolej segment na lokální s. Segment sám ošetří boundary případy (otevřená křivka).
    // Na uzlu mezi segmenty: segment "vidí" svůj začátek/konec, takže κ je spojitá (master křivka je hladká).
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
  advance(loc: TrackLocation, choose?: AdvanceChoice): void {
    const chooser = choose ?? this.routeChoice(this.routeOf(loc));
    for (let guard = 0; guard < 100; guard++) {
      const seg = this.segments[loc.seg];
      if (loc.s >= seg.length) {
        loc.s -= seg.length;
        const options = this.next[loc.seg];
        const selected = chooser(options, loc.seg, 'next');
        if (!options.includes(selected)) {
          throw new Error(`TrackNetwork.advance: zvolený segment ${selected} není mezi [${options.join(', ')}].`);
        }
        loc.seg = selected;
      } else if (loc.s < 0) {
        const options = this.prev[loc.seg];
        const selected = chooser(options, loc.seg, 'prev');
        if (!options.includes(selected)) {
          throw new Error(`TrackNetwork.advance: zvolený segment ${selected} není mezi [${options.join(', ')}].`);
        }
        loc.seg = selected;
        loc.s += this.segments[loc.seg].length;
      } else {
        return;
      }
    }
    throw new Error('TrackNetwork.advance překročil 100 hran; topologie nebo krok jsou neplatné.');
  }

  /**
   * Výběr pokračování podle explicitní route. Směr `next`/`prev` je důležitý při couvání:
   * na sloučení se musí zvolit předchozí segment stejné trasy (main: 2, branch: 4).
   */
  routeChoice(route: RouteId): AdvanceChoice {
    return (options, from, direction) => {
      const sequence = this.routes[route];
      const i = sequence.indexOf(from);
      if (i < 0) throw new Error(`Segment ${from} neleží na trase ${route}.`);
      const target = direction === 'next'
        ? sequence[(i + 1) % sequence.length]
        : sequence[(i - 1 + sequence.length) % sequence.length];
      if (!options.includes(target)) {
        throw new Error(`Trasa ${route} zvolila segment ${target}, který není mezi [${options.join(', ')}].`);
      }
      return target;
    };
  }

  /** Délka uzavřené trasy (m). */
  routeLength(route: RouteId): number {
    return this.routeLengths[route];
  }

  /** Může se poloha promítnout do dané trasy? Společné segmenty patří do obou, větev jen do branch. */
  isSegmentOnRoute(seg: number, route: RouteId): boolean {
    return Number.isFinite(this.routeStarts[route][seg]);
  }

  /**
   * Globální arc-length polohy podél vybrané trasy (m) — kumulativní začátek segmentu + lokální s.
   * Route je nutná, protože společný segment za sloučením má jiný offset na hlavní trase a na odbočce.
   */
  globalS(loc: TrackLocation, route = this.routeOf(loc)): number {
    const start = this.routeStarts[route][loc.seg];
    if (!Number.isFinite(start)) {
      throw new Error(`Segment ${loc.seg} neleží na trase ${route}; globalS není jednoznačné.`);
    }
    return start + loc.s;
  }

  /**
   * Nejkratší rozdíl pozic po smyčce (m): globalS(to) − globalS(from) zabalený do [−L/2, L/2).
   * Kladné = `to` je před `from` (ve směru rostoucího s). Pro spřáhla, kontakty a rázy, které
   * počítají rozteč těles — funguje i přes hranici segmentu i přes wrap smyčky.
   */
  gap(from: TrackLocation, to: TrackLocation, route = this.sharedRoute(from, to)): number {
    const L = this.routeLength(route);
    let d = (this.globalS(to, route) - this.globalS(from, route)) % L;
    if (d > L / 2) d -= L;
    else if (d < -L / 2) d += L;
    return d;
  }

  private routeOf(loc: TrackLocation): RouteId {
    return loc.route ?? DEFAULT_ROUTE;
  }

  private sharedRoute(from: TrackLocation, to: TrackLocation): RouteId {
    const a = this.routeOf(from);
    const b = this.routeOf(to);
    if (a !== b) throw new Error(`Polohy leží na různých trasách (${a}/${b}); gap není jednoznačný.`);
    return a;
  }
}
