import { CatmullRomCurve3, Vector3 } from 'three';
import { terrainHeight } from './terrain';
import { TrackSegment } from './TrackSegment';
import type { NetworkSpec } from './TrackNetwork';

const BRIDGE_HEIGHT = 8;  // m — výška mostu nad podjezdem; clearance > výška vozu (~5,8 m)
const BRIDGE_WIDTH = 0.5; // rad — pološířka náběhu mostu v parametru t (rampa stoupání/klesání)

// VÝHYBKY — spojka 2→1 (objížďka pravého laloku). Odbočí „kousek pod mostem", levou zatáčkou objede
// lalok a tečně se napojí zpět za ním (S37, DD-25 fáze 2). Poloha i geometrie ověřeny
// `tools/check-switch.ts` + `tools/check-connector.ts` PŘED zápisem (lekce S36: žádné slepé iterace).
const SWITCH_U = 0.713;     // výhybka 1 (rozbočení) — kousek za podjezdem (inflexe, r≈4400 m, sklon 3 %)
const MERGE_U = 0.86;       // výhybka 2 (sloučení) — na pravém laloku za mostem
const BRANCH_OFFSET = 12;   // m — max boční odsazení odbočky od hlavní trati (uprostřed úseku)
const BRANCH_SIDE = 1;      // strana offsetu: +1 = vlevo od směru jízdy, −1 = vpravo

/**
 * Hrb mostu kolem `t=π/2`: jedna větev křížení se zvedne na estakádu, druhá (`t=3π/2`)
 * zůstane na terénu = podjezd pod mostem. Gaussovský náběh = plynulá rampa (žádný zlom).
 * Fixní výška (mimo slider sklonu) — clearance je inženýrská konstanta, ne věc krajiny.
 */
function bridgeLift(t: number): number {
  let d = t - Math.PI / 2;
  // kruhová vzdálenost do [−π, π] — most je periodický v t
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return BRIDGE_HEIGHT * Math.exp(-(d * d) / (BRIDGE_WIDTH * BRIDGE_WIDTH));
}

/**
 * Kontrolní body ležaté osmičky (Bernoulliho lemniskáta) v rovině XZ; výšku `Y` diktuje terén.
 *
 * Osmička dělá dvě věci jedním tahem:
 *  - **esíčko** — laloky jsou zatáčky (r ≈ 33 m), střed je inflexe (r → ∞); souprava zatáčí
 *    doleva, projede středem, pak doprava. Proměnný poloměr živí příčnou dynamiku (odstředivka).
 *  - **křížení** — trať se v půdorysu protne ve středu osmičky (`t=π/2` i `t=3π/2` → bod (0,0)).
 *    Řeší se **mostem** ({@link bridgeLift}): větev u `t=π/2` jde po estakádě nad druhou.
 *
 * **Výška `Y = terrainHeight(x,z) + most`** (DD-20): koleje vedou po povrchu krajiny, sklony
 * pro slack action vznikají z terénu (emergence, ne skript). `amplitude` škáluje terénní vlny
 * (slider sklonu → Track.rebuild + Renderer.rebuildWorld); most zůstává fixní.
 */
export function makeLoopControlPoints(amplitude: number): Vector3[] {
  const points: Vector3[] = [];
  const A = 150; // šířka osmičky (poloviční rozpětí v X, m) — větší = mírnější oblouky
  const B = 150; // výška laloků (rozpětí v Z, m)
  // asymetrie laloků: pravý lalok (t≈0) zvětšíme, levý (t≈π) necháme beze změny. Klíčové je
  // škálovat lalok IZOTROPNĚ (x i z týmž faktorem) — tím roste i jeho poloměr (větší lalok =
  // mírnější oblouk). Dřív jsme škálovali jen x → lalok se zploštil a vznikla neprojetelná špička.
  // Faktor (1+cos t)/2: pravý vrchol → 1, levý → 0; v křížení (cos t=0) nevadí, protože cos t=0
  // tam stejně vynuluje x i z (most drží v počátku). E = míra zvětšení pravého laloku.
  //
  // MINIMÁLNÍ POLOMĚR & CLEARANCE: ověřeno `tools/check-radius.ts`. Při E=0.5 a count=96 je
  // min r ≈ 52 m (projetelné do ~20 m/s, bezpečně nad baseline 33 m symetrické osmičky). count
  // je hustota kontrolních bodů: musí být dost vysoká, aby Catmull-Rom mezi nimi nepodstřelil
  // zvlněný terén (trať pod zem) — při řídkých 24 bodech a vlnité krajině zapadala kolej pod terén.
  // count=96 drží clearance ≈ 0 i pro nejvlnitější trať (slider sklonu na maximu). Sklon je
  // horizontálně nezávislý (poloměr drží při jakékoli amplitudě), takže vlnitost poloměr neohrozí.
  const E = 0.5;
  const count = 96;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const denom = 1 + Math.sin(t) * Math.sin(t); // Bernoulli — kulaté laloky místo špičatých (Gerono)
    const stretch = 1 + E * (1 + Math.cos(t)) / 2; // pravý lalok zvětšen o E, levý beze změny
    const x = (A * stretch * Math.cos(t)) / denom;
    const z = (B * stretch * Math.sin(t) * Math.cos(t)) / denom;
    points.push(new Vector3(x, terrainHeight(x, z, amplitude) + bridgeLift(t), z));
  }
  return points;
}

/**
 * Kontrolní body odbočky (3. hrana θ-grafu) jako **boční offset** hlavní trati: bod = hlavní(u) +
 * δ(s)·horizontální normála, kde δ(s) = {@link BRANCH_OFFSET}·sin⁴(π·t), t∈[0,1] mapuje úsek
 * [{@link SWITCH_U}, {@link MERGE_U}]. **Proč sin⁴:** profil má δ=δ'=δ''=0 na obou koncích, takže
 * odbočka v obou výhybkách navazuje na hlavní trať polohou, tečnou **i křivostí** (plně C² — spojitá,
 * shora omezená změna vektoru rychlosti, požadavek uživatele; žádný „trh" na výhybce). A protože δ≥0,
 * odbočka se drží **na jedné straně** trati → konstrukčně **nemůže křížit** (žádná falešná 2↔2 výhybka).
 * Cena za C² hladkost: odbočka se odděluje pozvolna (souběh ~30 m/konec). Ověřeno `tools/check-connector.ts`
 * (κ spojitá, max |κ|≈0,02 → r≈47 m, odstup od druhé větve u mostu 10 m).
 */
function makeBranchControlPoints(loop: CatmullRomCurve3, amplitude: number): Vector3[] {
  const N = 80; // vzorků podél odbočky (hustá síť → CatmullRom věrně kopíruje hladký offset)
  const pts: Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = SWITCH_U + (MERGE_U - SWITCH_U) * t; // úsek hlavní trati, podél kterého offset vede
    const p = loop.getPointAt(u);
    const tan = loop.getTangentAt(u);
    const nl = Math.hypot(tan.x, tan.z); // horizontální normála = tečna otočená o 90° v XZ
    const nx = -tan.z / nl, nz = tan.x / nl;
    const delta = BRANCH_SIDE * BRANCH_OFFSET * Math.sin(Math.PI * t) ** 4; // C² bump (0 na koncích)
    const x = p.x + nx * delta, z = p.z + nz * delta;
    pts.push(new Vector3(x, terrainHeight(x, z, amplitude), z));
  }
  return pts;
}

/**
 * Síť trati (graf segmentů) z osmičky + **spojka 2→1** (objížďka pravého laloku, S37). Hlavní jízdní
 * smyčka je jedna hladká lemniskáta rozdělená na 4 segmenty se **dvěma uzly výhybek** ({@link SWITCH_U}
 * rozbočení, {@link MERGE_U} sloučení); mezi nimi vede 5. segment (otevřená spojka,
 * {@link makeBranchControlPoints}). `next`/`prev` jsou seznamy možností (DD-25): jeden prvek = jednoznačné
 * napojení, víc = výhybka (volba v `advance`). Souprava i volný vagon zatím jedou deterministicky `[0]`
 * (hlavní smyčka) — po spojce nikdo nejede (jízda + gap/globalS přes větve = příští partes, DD-25 fáze 4).
 */
export function buildLoopNetwork(amplitude: number): NetworkSpec {
  const curve = new CatmullRomCurve3(makeLoopControlPoints(amplitude), true, 'centripetal');
  const len = curve.getLength();
  // spojka = otevřená křivka (closed=false → TrackSegment.wrapU clampuje místo wrapu)
  const connector = new CatmullRomCurve3(makeBranchControlPoints(curve, amplitude), false, 'centripetal');
  const segments = [
    new TrackSegment(curve, 0, 0.5, len),                     // 0: hlavní (start → půlka)
    new TrackSegment(curve, 0.5, SWITCH_U, len),              // 1: hlavní do výhybky 1
    new TrackSegment(curve, SWITCH_U, MERGE_U, len),          // 2: hlavní mezi výhybkami (objížděný lalok)
    new TrackSegment(curve, MERGE_U, 1, len),                 // 3: hlavní za výhybkou 2 → zpět na 0 (smyčka)
    new TrackSegment(connector, 0, 1, connector.getLength()), // 4: spojka (výhybka 1 → výhybka 2)
  ];
  // hlavní smyčka 0→1→2→3→0; výhybka 1 (konec seg1): rovně seg2 ([0]) / spojka seg4; výhybka 2 (konec
  // seg2 i seg4): obě slévají na seg3. Couvání zrcadlově (prev). totalLength bere cyklus next[·][0] = lemniskáta.
  return {
    segments,
    next: [[1], [2, 4], [3], [0], [3]],
    prev: [[3], [0], [1], [2, 4], [1]],
  };
}

/** Typ bodové nespojitosti — rozlišuje fyzikálně různé jevy (zvuk i škálování v {@link Train}). */
export type PerturbationKind =
  | 'transition' // skok křivosti / chybějící přechodnice → boční trh (tlumí slider „kvalita přechodnic")
  | 'switch';    // výhybka / křížení → radiální clunk (na kvalitě přechodnic nezávisí)

/** Bodová nespojitost trati — zdroj rázu do kývání skříně (zpracuje {@link Train}). */
export interface TrackPerturbation {
  u: number;             // pozice na trati jako zlomek délky [0,1) — přežije rebuild (s = u·délka)
  kind: PerturbationKind;
  roll: number;          // relativní váha bočního trhu; znaménko dá Train ze strany oblouku
  pitch: number;         // relativní váha svislého rázu
}

/**
 * Bodové nespojitosti osmičky — dva fyzikálně různé jevy ({@link PerturbationKind}):
 *  - **transition** — **fenomenologický** skok křivosti (A4 b): místo přepisu geometrie hladké
 *    lemniskáty se na náběhy/výjezdy laloků (kde by reálná trať potřebovala přechodnici) posadí
 *    roll-ráz = boční trh. Pozice ověřeny profilem `signedCurvature` — leží na strmých úsecích κ
 *    mezi inflexí (křížení) a vrcholem laloku (max |κ|, r≈33 m).
 *  - **switch** — výhybka/srdcovka u **křížení** osmičky (`u≈0.25` i `0.75` = inflexe κ≈0, kde se
 *    větve protínají = most/podjezd) → svislý radiální clunk + lehký roll.
 *
 * Sjednoceno s dilatačními spárami: {@link Train} obě řeší týmž `crossed()` testem (jen jiná perioda).
 * Pozice jako zlomky délky → přežijí slider sklonu (Track.rebuild mění délku trati).
 */
export const TRACK_PERTURBATIONS: TrackPerturbation[] = [
  { u: 0.10, kind: 'transition', roll: 1.0, pitch: 0.0 }, // výjezd z pravého laloku
  { u: 0.25, kind: 'switch',     roll: 0.5, pitch: 0.9 }, // křížení (horní větev / most) — radiální clunk
  { u: 0.40, kind: 'transition', roll: 1.0, pitch: 0.0 }, // náběh do levého laloku
  { u: 0.60, kind: 'transition', roll: 1.0, pitch: 0.0 }, // výjezd z levého laloku
  { u: 0.75, kind: 'switch',     roll: 0.5, pitch: 0.9 }, // křížení (dolní větev / podjezd)
  { u: 0.90, kind: 'transition', roll: 1.0, pitch: 0.0 }, // náběh do pravého laloku
];
