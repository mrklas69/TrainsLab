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
- **radius (poloměr oblouku)** — lokální poloměr zatáčky `r = 1/|κ|`; rovinka → ∞. Koncept
  (vstup pro odstředivku `v²/r`); v kódu je primitivem `signedCurvature` a poloměr je jeho
  odvozenina (S12: samostatná metoda `radius()` zrušena, jádrem je znaménková křivost).
- **příčné (odstředivé) zrychlení** — `a_lat = v²/r`, kolmé k jízdě; **nemění** `s`/`v`
  (drží koleje), proto je to odvozená *diagnostika*, ne síla v 1D modelu (DD-02, DD-11).
- **monorail** — náš model: 1 těleso = skalár `s` na 1 křivce (osa koleje), z 6 DOF tuhého
  tělesa jen surge. Kývání skříně (roll/pitch) ho neopouští; příčný DOF kola (hunting) ano.
- **ležatá osmička (lemniskáta)** — tvar tratě (DD-12): křivka s jedním půdorysným křížením.
  Použita **Bernoulliho** (kulaté laloky) místo Gerono (špičaté, `r_min≈5 m` = nehratelné).
  Laloky = ostré zatáčky (`r≈33 m`), střed = inflexe (`r→∞`) → proměnný poloměr (esíčko).
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
- **znaménková křivost (signed curvature)** — křivost **horizontálního** průmětu trati `κ`
  se znaménkem; **primitiv příčné dynamiky** (S12). Magnituda `1/r` (odstředivka `v²·κ`),
  znaménko rozlišuje stranu zatáčky (na kterou se skříň naklání). Izomorfní s **grade**: grade =
  svislá složka tečny (gravitace), křivost = horizontální zakřivení (odstředivka). Svislé zvlnění
  do ní nepatří (jen XZ).
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
- **otáčkový strop (mechanický limit rychlosti)** — tvrdý strop pevného převodu, nezávislý na
  `P/v`. Mezní rychlost `v_mech = maxPistonSpeed·π·D/(2·zdvih)`; nad kolenem (0,75·v_mech) tah
  lineárně padá k 0 (`tractionDerating`). Vlak `v_mech` fyzicky nepřekročí (DD-15).
- **střední pístová rychlost (mean piston speed)** — průměrná rychlost pístu (`c = 2·zdvih·otáčky`);
  její mez (setrvačnost ojnic „hammer blow" + plnění válce párou) určuje otáčkový strop.
- **průměr hnacího kola (driver diameter)** — velikost hnacího kola je **převod**: při dané mezi
  pístové rychlosti větší kolo = vyšší maximální rychlost vlaku.
- **adheze (μ)** — součinitel tření kolo-kolej; strop přenositelné síly `μ·N`
  (`N` = adhezní tíha lokomotivy). Suchá adheze (`adhesionCoeff`) ≈ 0,30; **efektivní** adheze
  ji škáluje stavem koleje (viz **stav koleje**) — mokro/listí výrazně níž (herně ~0,1 pro
  zřetelný kontrast, ať je efekt písku vidět). Jeden strop (`adhesionLimit`) pro tah i brzdu (S14).
- **stav koleje (railFactor)** — počasí/povrch koleje jako násobitel adheze `∈ [0,1]`: sucho = 1,
  mokro/listí níž → efektivní μ = `adhesionCoeff·railFactor` (DD-17). Stav světa (jako sklon),
  ladí se sliderem. Pod prahem začne loko prokluzovat/klouzat → smysl pro **písek**.
- **prokluz / skid (wheel slip / slide)** — kola ztratí adhezi: při **tahu** požadovaná TE > `μ·N`
  (protáčejí se, tah se zhroutí); při **brzdě** požadovaná brzda > `μ·N` (kloužou, delší dráha, DD-16).
  Oboje indikováno týmž `slipping` flagem (oranžová loko + `PROKLUZ`) — izomorfní směr tam i zpět.
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
  Historicky **voda dochází dřív** (spotřeba ~6:1 vůči uhlí hmotnostně).
- **parní tlak (steamPressure)** — `∈ [0,1]`, odvozený z menší ze zásob: drží 1 nad rezervou
  (15 %), pod ní lineárně klesá k 0. Škáluje tažnou sílu v obou směrech (pára žene písty).
  Po vyčerpání → tah 0 → vlak dojede setrvačností a zastaví na odporech. Brzda nezávisí (vzduchová).
- **pískování (sanding)** — *(DD-17)* sypání písku pod hnací kola vrací adhezi na suchou hodnotu
  (`isSanding ? adhesionCoeff : adhesionCoeff·railFactor`). **Písek** = spotřební zásoba (jako uhlí/voda):
  `sandCapacity`, spotřeba `sandRate` jen po dobu sypání, `R` doplní. Ovládání **held-key** (drž P /
  drž tlačítko). Smysl má jen při nízké adhezi (mokro/listí) — na suchu je tah pod stropem, písek
  neviditelný. Zachrání rozjezd (prokluz) i brzdění (skid).

## Zvuk
- **chuff (výfuk páry)** — nárazový výdech páry komínem při otevřeném regulátoru; hustota
  roste s rychlostí. V `AudioView` rytmický burst šumu.
- **AudioView** — zvuk jako další „view" nad simem (DD-01): čte stav, ozvučuje události
  (chuff, clank/náraz spřáhla, sykot prokluzu, skřípění brzd). Procedurální, bez souborů.

## Kamera (view)
- **dron (auto-kamera)** — *(DD-19)* režim kamery (toggle `C`), který sleduje soupravu zezadu-shora
  ve směru jízdy a kouká na její střed. Vypne ruční ovládání (myš + WASD/QE/ZX). Pozice i bod pohledu
  se **tlumeně dohánějí** k cíli (`α = 1−exp(−tuhost·dt)`, nezávislé na FPS) → při **reverzu** se cíl
  překlopí na druhý konec a kamera plynule *přeletí*. **Hystereze** směru u `v≈0` (drží poslední, jinak
  slack-couvání třese dronem). Ryze view — parametry (`DroneParams`: výška/odstup/tuhost) mimo `PhysicsParams`,
  sim o kameře neví (DD-01).

## Numerika a architektura
- **semi-implicitní Euler** — integrátor: nejdřív rychlost z aktuálních sil, pak poloha.
- **substepping** — dělení časového kroku; nutné pro stabilitu tuhých pružin (spřáhel).
- **sim/view split (DD-01)** — model nezná renderer; renderer = čistá funkce stavu → obraz.
- **DD-NN** — design decision; tabulky v `docs/diary/`.
