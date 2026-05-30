# GLOSSARY — TrainsLab

Termíny projektu. Anglické identifikátory v kódu, české vysvětlení.

## Slack action (vůle v soupravě)
- **slack action** — souhrnný jev podélného pohybu vůlí mezi vozy; jádrová nika projektu.
- **draft** — natažení spřáhel (tah), typicky do kopce a při rozjezdu.
- **buff** — stlačení nárazníků (tlak), typicky z kopce a při brzdění.
- **slack run-out** — postupné vybírání vůle vozem za vozem → podélná vlna soupravou.
- **coupler (spřáhlo)** — spoj mezi sousedními vozy = pružina s **vůlí** (mrtvým pásmem):
  v rozsahu vůle síla 0, za hranou spring-damper (táhne/tlačí).

## Trať a kinematika
- **arc-length parametrizace** — poloha vozu daná délkou `s` (m) podél křivky, ne parametrem
  křivky. Drží fyziku 1D; 3D pozice až při renderu (DD-02).
- **grade (sklon)** — `sin(θ)` trati = y-složka jednotkové tečny; vstup do gravitace.
- **radius (poloměr oblouku)** — lokální poloměr zatáčky z křivosti **horizontálního**
  průmětu trati (`r = 1/κ`); rovinka → ∞. Izomorfní s grade: grade = vertikální chování
  (gravitace), radius = horizontální zakřivení (odstředivka). Svislé zvlnění do něj nepatří.
- **příčné (odstředivé) zrychlení** — `a_lat = v²/r`, kolmé k jízdě; **nemění** `s`/`v`
  (drží koleje), proto je to odvozená *diagnostika*, ne síla v 1D modelu (DD-02, DD-11).
- **monorail** — náš model: 1 těleso = skalár `s` na 1 křivce (osa koleje), z 6 DOF tuhého
  tělesa jen surge. Kývání skříně (roll/pitch) ho neopouští; příčný DOF kola (hunting) ano.
- **ležatá osmička (lemniskáta)** — tvar tratě (DD-12): křivka s jedním půdorysným křížením.
  Použita **Bernoulliho** (kulaté laloky) místo Gerono (špičaté, `r_min≈5 m` = nehratelné).
  Laloky = ostré zatáčky (`r≈26 m`), střed = inflexe (`r→∞`) → proměnný poloměr (esíčko).
- **most / podjezd** — místo, kde se trať v půdorysu kříží: profil `Y=amplitude·sin(t)` vede
  jeden průchod středem nahoře (most), druhý dole (podjezd). Most leží na inflexi osmičky
  (podélná dynamika / slack), ostré laloky v rovině (příčná dynamika / převrácení).
- **rozchod koleje (gauge)** — vzdálenost kolejnic (normální 1,435 m); polovina = rameno tíhy
  proti převrácení.
- **výška těžiště (comHeight)** — výška těžiště vozu nad kolejí; páka, na kterou tlačí
  odstředivka při převrácení. Vyšší → snazší převrácení.
- **kritérium převrácení** — `a_lat > (gauge/2)/comHeight · g`: odstředivka přes výšku těžiště
  překoná tíhu přes poloviční rozchod → vůz se přetočí přes vnější kolo. Statická momentová
  rovnováha na ploché koleji (bez klopení, DD-11).
- **vykolejení (derailment)** — fail state po překročení kritéria převrácení: souprava se
  zastaví, zrudne, čeká na reset (`R`). První fail state projektu (homomorfní s budoucím
  přetržením vlaku).
- **znaménková křivost (signed curvature)** — křivost půdorysu `κ` se znaménkem; magnituda
  `1/r` (odstředivka), znaménko rozlišuje stranu zatáčky (na kterou se skříň naklání).
- **gradient blízkosti meze** — vizuální předzvěst převrácení: skříň žhne (emissive) úměrně
  `tipRatio = a_lat/práh` daného vozu. Per-vůz → výstraha „cestuje" soupravou; vykolejení = plný žár.

## Kývání skříně (DOF skříně)
- **kývání skříně (carbody sway)** — rotace skříně na vypružení (roll + pitch); diagnostika nad
  1D modelem, **nemění** `s`/`v` (drží DD-02, Úr. 1 žebříku opuštění monorailu). Mez = převrácení.
- **náklon (roll)** — naklonění skříně kolem podélné osy; v oblouku ven z něj (z příčného `v²·κ`).
- **klování (pitch)** — naklonění skříně kolem příčné osy z podélného zrychlení `dv/dt` (slack-trh).
  U vlaků reálně minimální (malá zrychlení + tuhé vypružení), proto v modelu utlumené (poloviční gain).
- **vypružení (suspension)** — pružné uložení skříně; zde tlumený torzní oscilátor řízený
  frekvencí (Hz) a poměrným tlumením ζ. Měkčí (nižší ω) = větší výchylka i pomalejší kmit.

## Trakce a adheze
- **tractive effort (tažná síla, TE)** — síla, kterou lokomotiva žene soupravu.
- **výkonový limit** — `TE = min(F_max, P/v)`; při vyšší rychlosti omezuje výkon (hyperbola).
- **adheze (μ)** — součinitel tření kolo-kolej; strop přenositelné síly `μ·N`
  (`N` = adhezní tíha lokomotivy). Sucho ≈ 0,30, mokro ≈ 0,15.
- **prokluz (wheel slip)** — požadovaná TE > `μ·N`; kola se protáčejí, tah se zhroutí.
- **notch (stupeň regulátoru)** — diskrétní poloha regulátoru tahu (3 vpřed · 0 · 1 vzad).
- **reverzér / cutoff** — u parní lokomotivy plnění válce + směr (zatím nemodelováno; notch
  je hratelné zjednodušení).
- **rozběhový odpor (starting/breakaway resistance)** — klidové tření > valivé za jízdy;
  fyzikální *důvod*, proč slack action funguje (rozjezd vozů postupně).
- **valivý odpor (Crr)** — kinetický odpor valení za jízdy (ocel-ocel ≈ 0,002).
- **protiproudé brzdění (plugging / counter-pressure)** — tah motoru proti směru jízdy =
  brzdění. Limit je adheze (`μ·N`), ne výkon `P/v` (ten platí jen pro zrychlování). V modelu
  notch −1 za jízdy vpřed (DD-08). Zabírá **plným úsilím** (`fraction=1`, ne dělené stupni),
  takže `F_max` překoná adhezi → **skid** (prokluz při brzdění), DD-10.
- **brzda jako řízené tření** — provozní brzda lokomotivy modelovaná jako dodatečný odpor
  (zvyšuje statický práh i kinetický odpor), ne zvláštní síla. Tah a brzda se perou ve
  společném akumulátoru sil (DD-09).
- **dragging brakes** — tah překoná hranu, ale brzda + tření vlak udrží: kola prokluzují
  proti stojící soupravě. Emergentní důsledek souboje sil (DD-09).

## Palivo (F3)
- **zásoby (uhlí / voda)** — spotřební zdroje v tendru (kg). Spotřeba úměrná otevření
  regulátoru; uhlí hoří i na volnoběh (idle — udržování ohně), voda jen tvorbou páry.
  Historicky **voda dochází dřív** (spotřeba ~4–6:1 vůči uhlí hmotnostně).
- **parní tlak (steamPressure)** — `∈ [0,1]`, odvozený z menší ze zásob: drží 1 nad rezervou
  (15 %), pod ní lineárně klesá k 0. Škáluje tažnou sílu v obou směrech (pára žene písty).
  Po vyčerpání → tah 0 → vlak dojede setrvačností a zastaví na odporech. Brzda nezávisí (vzduchová).
- **pískování (sanding)** — *(odloženo, DD-14)* sypání písku pod hnací kola zvyšuje adhezi μ.
  Smysl má jen při nízké adhezi (mokro/listí); na suché koleji neviditelný → čeká na mokrou kolej.

## Zvuk
- **chuff (výfuk páry)** — nárazový výdech páry komínem při otevřeném regulátoru; hustota
  roste s rychlostí. V `AudioView` rytmický burst šumu.
- **AudioView** — zvuk jako další „view" nad simem (DD-01): čte stav, ozvučuje události
  (chuff, clank/náraz spřáhla, sykot prokluzu, skřípění brzd). Procedurální, bez souborů.

## Numerika a architektura
- **semi-implicitní Euler** — integrátor: nejdřív rychlost z aktuálních sil, pak poloha.
- **substepping** — dělení časového kroku; nutné pro stabilitu tuhých pružin (spřáhel).
- **sim/view split (DD-01)** — model nezná renderer; renderer = čistá funkce stavu → obraz.
- **DD-NN** — design decision; tabulky v `docs/diary/`.
