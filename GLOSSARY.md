# GLOSSARY — TrainsLab

Termíny projektu. Anglické identifikátory v kódu, české vysvětlení.

## Slack action (vůle v soupravě)
- **slack action** — souhrnný jev podélného pohybu vůlí mezi vozy; jádrová nika projektu.
- **draft** — natažení spřáhel (tah), typicky do kopce a při rozjezdu.
- **buff** — stlačení nárazníků (tlak), typicky z kopce a při brzdění.
- **slack run-out** — postupné vybírání vůle vozem za vozem → podélná vlna soupravou.
- **coupler (spřáhlo)** — spoj mezi sousedními vozy = pružina s **vůlí** (mrtvým pásmem):
  v rozsahu vůle síla 0, za hranou spring-damper (táhne/tlačí).
- **volný vagon (`freeBodies`)** — *(DD-24)* odstavené nespřažené těleso na téže trati, mimo
  couplerový řetězec soupravy. Projede týž integrátor (gravitace, odpor, **statické tření ho drží
  stát**, kývání), ale bez trakce/brzdy. Souprava ho dokola dožene a ťukne do něj.
- **kontaktní náraz (buff bez spřažení)** — *(DD-24)* `applyContacts`: jednostranná pružina **jen
  v tlaku** mezi konci soupravy (loko/poslední vůz) ↔ volné vozy (a volné navzájem). Působí jen při
  překryvu skříní; žádný draft/vůle → vozy se odrazí, ale **nespřáhnou**. Recykluje tuhost/tlumení
  spřáhla (náraz „cítí" jako buff nárazníku). Rozteč po dráze počítá `TrackNetwork.gap`.
- **energie srážky → vykolejení** — *(DD-24)* `½·m_red·v_close²` (kJ, redukovaná hmota dvojice ×
  rychlost sblížení²), maximum přes substepy. Nad práh `collisionDerailEnergy` (slider, default
  500 kJ ≈ náraz loko↔vagon nad ~7 m/s) souprava vykolejí. Diagnostika `derailReason` (collision
  vs. overturn) + rychlost do statusu.

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
  Laloky = ostré zatáčky (aktuální asymetrická trať má `r_min≈52 m`), střed = inflexe
  (`r→∞`) → proměnný poloměr (esíčko).
- **most / podjezd** — místo, kde se trať v půdorysu kříží (`t=π/2` i `t=3π/2` → týž bod (0,0)).
  Trať jinak **vede po povrchu terénu** (`Y=terrainHeight`, DD-20); u křížení `bridgeLift(s)`
  zvedne jednu větev na **most** (estakáda s pilíři), druhá zůstane na terénu = **podjezd** pod ním.
  Výška je funkce `s` (ne (x,z)) — jinak by se obě větve ve středu protnuly. Most leží na inflexi
  osmičky (podélná dynamika / slack), ostré laloky v rovině (příčná dynamika / převrácení).
- **rozchod koleje (gauge)** — vzdálenost kolejnic (normální 1,435 m); polovina = rameno tíhy
  proti převrácení.
- **výška těžiště (comHeight)** — výška těžiště vozu nad kolejí; páka, na kterou tlačí
  odstředivka při převrácení. Vyšší → snazší převrácení.
- **kritérium převrácení** — `a_lat > (gauge/2)/comHeight · g`: odstředivka přes výšku těžiště
  překoná tíhu přes poloviční rozchod → vůz se přetočí přes vnější kolo. Statická momentová
  rovnováha na ploché koleji (bez klopení, DD-11).
- **vykolejení (derailment)** — fail state: souprava se zastaví, zrudne, čeká na reset (`R`).
  Dvě příčiny *(S35)*: **převrácení** (odstředivka > kritérium) nebo **srážka** (energie nárazu >
  práh). Sjednoceno do `derail(reason, speed)` — zastaví soupravu i volné vozy; `derailReason`
  rozliší příčinu ve statusu. Homomorfní s budoucím přetržením vlaku.
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

## Rázy z trati (track impulses)
- **rázy z trati (track impulses)** — *(DD-21)* nespojitosti trati budí kývání skříně **impulsem**
  (ťuk do úhlové rychlosti oscilátoru, `Body.applyImpulse`), ne spojitým rovnovážným úhlem. Tři zdroje
  (spáry / skok křivosti / výhybky) = **jeden mechanismus**: `Train.crossed()` (floor-trik na
  arc-length) detekuje přejezd, síla ∝ rychlost × `trackImpulse`. Per-vůz `s` → ráz proběhne soupravou
  jako vlna. Mění jen rotaci (drží DD-02), rozšiřuje DD-13.
- **dilatační spára (rail joint)** — mezera mezi kolejnicemi (nesvařovaná trať, rozteč `railLength`
  ≈ 20 m). Kolo přes ni přejede → svislý ráz → **pitch** impuls se střídavou paritou = **klikot**
  („klikety-klak"); frekvence i hlasitost rostou s rychlostí. `trackImpulse=0` / svařovaná = ticho.
- **přechodnice (transition curve / klotoida)** — vkládaný úsek, kde křivost roste lineárně z 0 na
  `1/r`, aby odstředivka `v²·κ` nenastoupila skokem. Chybí-li → **skok křivosti**. Kvalita je laditelná
  (`transitionQuality ∈ [0,1]`, slider „Přechodnice"): 1 = dokonalá (trh rozetřen na 0), 0 = žádná (plný trh).
- **skok křivosti (curvature jump)** — nespojitá změna `κ` → skok příčného zrychlení = **boční trh**
  (jerk). V modelu **fenomenologicky** (DD-21, A4 b): perturbace `kind:'transition'` = roll-impuls ve směru
  oblouku na nábězích/výjezdech laloků (`trackPerturbationsFor(route)`), ne přepis geometrie hladké
  lemniskáty. Sílu tlumí **kvalita přechodnice** (`1−transitionQuality`) — jen tenhle typ,
  spáry/výhybky nezávisle.
- **výhybka (jako bodový ráz)** — perturbace `kind:'switch'` u **křížení** asymetrické osmičky
  (`u≈0.2966/0.7033`, inflexe
  κ≈0, kde se větve protínají = most/podjezd): **bodový** roll+pitch clunk, ne topologický uzel (síť/větvení =
  Úr. 4 žebříku, jiný roh mřížky). Týž `crossed()` mechanismus jako skok křivosti, na přechodnici nezávislá.

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
- **valivý odpor (Crr)** — kinetický odpor valení za jízdy (ocel-ocel ≈ 0,002). Člen **A** Davisovy rovnice.
- **Davisova rovnice odporu** — empirický rozklad jízdního odporu `R(v) = A + B·v + C·v²`: **A** = valivý
  (`rollingResistance`, konstantní), **B·v** = lineární (`davisB` — ložiska, dynamické ztráty náprav),
  **C·v²** = aerodynamický (`dragCoefficient`). V modelu A je v `applyFriction`, B·v a C·v² v `Body.beginStep`
  (S26). Lineární člen doladí hlavně **dojezd** ve středním pásmu rychlostí (mezi valivým a vzduchem).
- **odpor v oblouku (curve resistance)** — *(S29)* přídavný jízdní odpor v zatáčce z tření okolků o vnější
  kolejnici a prokluzu kol na pevné nápravě (vnější kolo urazí delší dráhu). Model `R = curveResistance·|κ|·m·g`:
  specifický odpor `curveResistance·|κ|` (bezrozm., jako Crr) je úměrný křivosti — **Röcklův charakter** `c/r`,
  ale `κ` je konečné → bez exploze u ostrých laloků. Empirický Röcklův jmenovatel
  `500/(r−30)` je navíc nevhodný poblíž své singularity; náš model zůstává spojitý.
  Branžově **rychlostně nezávislý** (proto jen směr ze `sign(v)`, ne `v` v magnitudě). **Geometrický** člen
  (z polohy `s` na trati, vedle gravitace v `Body.beginStep`), ne čtvrtý člen Davisovy rovnice. Drží DD-02:
  `κ` zůstává skalár, výstup je podélná síla (mění `v`), nezavádí příčný DOF. Na rovince `κ=0` → mizí.
- **rotující hmota (rotating mass factor, `λ`)** — *(S30)* přídavná **setrvačnost** od roztáčených
  kol/náprav/ojnic. Efektivní setrvačná hmota `m_eff = m·(1+λ)` → línější rozjezd i dobrzdění. Mění
  **jen převod síla→zrychlení** (`Body.integrate`: `accel = force/m_eff`), **ne tíhu** — gravitace,
  odpory a adheze drží skutečné `m`. Branžově **rychlostně nezávislé** (fixní přirážka); celý vlak
  ~6–8 % tara, samotná lokomotiva ~10 % (těžká hnací kola). V modelu **per-vůz** (`rotatingFactorOf`):
  loko `λ=0,15` (hnací kola + ojnice) > vůz `0,06` (jen valivá kola). Drží DD-02 (skalár, žádný DOF).
- **protiproudé brzdění (plugging / counter-pressure)** — tah motoru proti směru jízdy =
  brzdění. Limit je adheze (`μ·N`), ne výkon `P/v` (ten platí jen pro zrychlování). V modelu
  notch −1 za jízdy vpřed (DD-08). Zabírá **plným úsilím** (`fraction=1`, ne dělené stupni),
  takže `F_max` překoná adhezi → **skid** (prokluz při brzdění), DD-10.
- **brzda jako řízené tření** — provozní brzda lokomotivy modelovaná jako dodatečný odpor
  (zvyšuje statický práh i kinetický odpor), ne zvláštní síla. Tah a brzda se perou ve
  společném akumulátoru sil (DD-09).
- **fade tření brzdy (μ(v), `brakeFade`)** — *(S26)* tření litinového špalíku klesá s rychlostí.
  Brzdná síla se škáluje faktorem `f(v) = (1−fade) + fade/(1+k·|v|)`: `f(0)=1` (Coulombův základ
  při nízké rychlosti zachován, model S25), `f(∞)=1−fade` (**asymptota** — tření nezmizí). Důsledek:
  decelerace **roste, jak vlak zpomaluje** (konkávní `v(t)`). `brakeFade=0` = konstantní tření (Coulomb).
  Multiplikativní faktor nad silou — izomorfní se `steamPressure` / `tractionDerating` u tahu.
- **dragging brakes** — tah překoná hranu, ale brzda + tření vlak udrží: kola prokluzují
  proti stojící soupravě. Emergentní důsledek souboje sil (DD-09).

## Palivo (F3)
- **zásoby (uhlí / voda)** — spotřební zdroje v tendru (kg). Spotřeba úměrná otevření
  regulátoru; uhlí hoří i na volnoběh (idle — udržování ohně), voda jen tvorbou páry.
  Historicky **voda dochází dřív** (spotřeba ~6:1 vůči uhlí hmotnostně).
- **parní tlak (steamPressure)** — `∈ [0,1]`, odvozený z menší ze zásob: drží 1 nad rezervou
  (15 %), pod ní lineárně klesá k 0. Škáluje tažnou sílu v obou směrech (pára žene písty).
  Po vyčerpání → tah 0 → vlak dojede setrvačností a zastaví na odporech. Brzda nezávisí (vzduchová).
- **pískování (sanding)** — *(DD-17)* sypání písku pod hnací kola zvyšuje adhezi nad suchou
  hodnotu (`isSanding ? adhesionCoeff·sandAdhesionBoost : adhesionCoeff·railFactor`).
  Výchozí účinnost `1,20` dává μ=0,36, takže max. tah 200 kN nepřekročí adhezní limit.
  **Písek** = spotřební zásoba (jako uhlí/voda):
  `sandCapacity`, spotřeba `sandRate` jen po dobu sypání, `R` doplní. Ovládání **held-key** (drž P /
  drž tlačítko). Zachrání rozjezd (prokluz) i brzdění (skid); účinnost je živý Lab parametr.

## Zvuk
- **chuff (výfuk páry)** — nárazový výdech páry komínem **pod párou** (otevřený regulátor `notch≠0`
  **a** `steamPressure>0` — bez páry píst nepracuje). Časován **`ExhaustClock`** (4 pufy/otáčku kola),
  ne podle rychlosti přímo → věrný zrychlující se rytmus. Nahraný sample (`steam_chuff.wav`), přehraný
  one-shot v každém taktu; dokud se nenačte (nebo když chybí) je chuff tichý.
- **ExhaustClock (rytmus výfuku)** — *(DD-23)* sdílený view zdroj taktu parního výfuku: fáze ∝ ujetá
  dráha kol (`v/(π·D) × 4 pufy/otáčku` — dvojčinná dvojválcová mašina). `main` ji posouvá jednou za frame,
  obě view vrstvy (zvukový chuff, puf kouře) čtou flag `fired` → jsou **sladěné z jednoho zdroje** (DRY).
  Fyzikálně odvozený rytmus = emergentně pomalý rozjezdový „čch… čch…" i hustý sykot, bez ladění konstanty.
- **chuff fuse (`CHUFF_FUSE_SPEED`)** — *(S25)* strop rychlosti v `ExhaustClock.advance` (7,4 m/s): nad ním
  by interval výfuku (~159 ms) klesl pod délku chuffu (~0,2 s) a pufy by splynuly v rachot („kulomet").
  Cap **na sdíleném clocku** → takt se ustálí pro zvuk i kouř současně (drží DD-23). Práh = fyzikální „interval
  = délka výdechu", vázán na default `driverDiameter`.
- **kouř a pára (`SteamView`)** — *(DD-23, rozšířeno S38)* měkké průsvitné billboard částice
  s procedurální radiální texturou; žádné lowpoly facety. Žijí ve **world-space** → vlečka za lokomotivou
  vzniká emergentně. Komín nese turbulentní spaliny (tmavost ∝ výkon) a pufy v taktu `ExhaustClock`;
  odvodňovací kohouty válců vypouštějí hustou bílou páru při rozjezdu, ucpávky rozvodu jemně prosakují
  pod výkonem a píšťala má krátký parní výtrysk synchronní se zvukem píšťaly. Pojistné ventily nejsou
  modelovány, protože `steamPressure` zatím není dynamický tlak kotle.
- **vítr (`WindParams`)** — view-only vodorovná rychlost vzduchu pro world-space částice.
  Náhodně mění cílový směr i sílu a mezi stavy plynule přechází. Tři Lab knoby:
  `strength` (0 = bezvětří), `directionVariability` a `changeInterval`. Pára se větru
  přizpůsobuje rychleji než hutnější kouř; fyziku vlaku vítr neovlivňuje (DD-01).
- **tikot / klapot spár** — „klikety-klak" na dilatačních spárách. Sample (`clattering_wheels.wav`)
  jako **smyčka** s `playbackRate ∝ rychlost` (`makeRateLoop`, `RAIL_REF_SPEED`) → frekvence klapotu
  úměrná rychlosti. Aktivní za jízdy; vypne `trackImpulse=0` / svařovaná kolej.
- **skřípění oblouku (flange squeal)** — kvílení okolků v zatáčce; sample smyčka (`arc_squeal.wav`,
  `makeSampleLevelLoop`) s hlasitostí plynule řízenou příčným zrychlením (`v²·κ`) — sílí v ostřejším
  oblouku. ≠ on/off skřípění brzd.
- **clunk výhybky vs. trh přechodnice** — odlišené zvuky bodových perturbací (S20): výhybka/křížení
  (`switchFired`) = tupý kovový clunk (sample `clunk.wav`); skok křivosti (`transitionJerkFired`) =
  krátké skřípnutí (sample `arc_jerk.wav`, one-shot). Týž `clunk` sample slouží i nárazníkům spřáhel
  (buff). Celý clunk je globálně ztlumený (`CLUNK_GAIN = 1,1/3`, S31 — byl příliš hlasitý); nárazník má
  navíc relativní `/3` proti výhybce → výhybka je hlasitější.
- **únik páry (steam leak)** — *(S24)* syčení kotle pod tlakem: sample smyčka (`makeSampleLoop`, úsek
  1.–11. s na 1/3 hlasitosti) běžící pořád, slyšitelná dokud `steamPressure > 0` (po vyčerpání zásob utichne).
- **parní píšťala (steam whistle)** — *(S24)* one-shot na vyžádání (tlačítko / klávesa H),
  `playWhistle`. Zvukový asset se z historických důvodů jmenuje `horn_on.wav`.
- **prokluz (slip, sample)** — *(S27)* sykot protáčejících se hnacích kol: sample smyčka (`steam_slip.wav`,
  `makeSampleLoop`) on/off podle `train.slipping`. Vizuální protějšek = `driverSlipPhase` (víření spojnic).
- **brzdy (sample)** — *(S24)* `makeRandomizedLoop`: smyčka, jejíž hranice (`loopStart ∈ [0,1;0,3]`,
  `loopEnd ∈ [0,6;0,9]` délky) se **přelosují po každém průchodu** → smyčka nemá pevnou periodu (rozbíjí
  ~2s opakování rysu nahrávky). `playbackRate ∝ rychlost` (= otáčení kol, `RateVoice.setRate`), aktivní jen
  za jízdy (`isBraking && |v|>0,3`) → stojící vlak s brzdou je tichý.
  **Rate cap (`BRAKE_FUSE_SPEED`):** rychlost přehrávání roste lineárně 0 → 3,8 m/s, pak strop
  (`rate ∈ [0,25; 0,6]`, S27 zpomaleno kvůli rychlé nahrávce) — bez capu by skřípání znělo jako „cikáda".
- **AudioView** — zvuk jako další „view" nad simem (DD-01): čte stav, ozvučuje události (chuff, únik páry,
  píšťalu, clank/náraz spřáhla, sykot prokluzu, skřípění brzd, tikot spár, skřípění oblouku, clunk
  výhybky, trh přechodnice). **Čistě sample-based** (S27): nahrané samply z `public/audio/` (`loadSample`
  přes `BASE_URL` + `decodeAudioData`); chybí-li sample → hlas mlčí (procedurální vrstva odstraněna —
  set kompletní). Tvary hlasů: one-shot (`playSample`), trvalý loop on/off (`makeSampleLoop`), loop ∝ úroveň
  (`makeSampleLevelLoop`), loop s náhodnými hranicemi (`makeRandomizedLoop`), prostá smyčka ∝ rychlost
  (`makeRateLoop`). Interfacy `SustainVoice`/`LevelVoice`/`RateVoice` žijí zde.

## Kamera (view)
- **dron (auto-kamera)** — *(DD-19)* režim kamery (toggle `C`), který **krouží kolem jedoucí
  lokomotivy** (`bodies[0]`) a kouká na ni. Střed orbity i bod pohledu = loko; azimut roste konstantní
  úhlovou rychlostí (`orbitSpeed`), drží poloměr (`distance`) i výšku. Vypne ruční ovládání (myš + WASD/QE),
  aktivní zůstává jen **zoom** (`Z`/`X` i kolečko myši → mění poloměr kroužení, jediná cesta
  `adjustOrbitRadius`). Pozice i bod pohledu se **tlumeně dohánějí** k cíli (`α = 1−exp(−tuhost·dt)`,
  nezávislé na FPS) → sledování pohybu vlaku je hladké. Ryze view — parametry (`DroneParams`:
  výška/poloměr/rychlost kroužení/tuhost) mimo `PhysicsParams`, sim o kameře neví (DD-01). *(S15 chase →
  S32 orbit kolem loko; orbit je na směru jízdy nezávislý → odpadla hystereze směru i reverz-přelet.)*

## Krajina a trať (view)
- **lowpoly terén (heightfield)** — *(DD-20)* zvlněná deska, jejíž výšku dává `terrainHeight(x,z)`
  (deterministický šum, amplituda vln roste se vzdáleností od středu — pod tratí mírné, na horizontu
  kopce). **Single source** v `sim/terrain.ts` — čte ji sim (výška trati) i view (mesh). Barvení facet
  podle výšky (louka → les → skála) je ryze view.
- **faceting (flat shading)** — lowpoly vzhled = ostré ploché facety. Vzniká z `flatShading` +
  `toNonIndexed`, ale **viditelný je až směrovým kontrastem světla** (nízký ambient + silné slunce);
  rovnoměrné světlo facety setře, i kdyby byla geometrie zubatá.
- **párové kolejnice / pražce** — vizuální ztvárnění tratě: dvě trubky offsetnuté ±rozchod/2 do
  horizontální kolmice + příčné pražce (`InstancedMesh`). Sim zná jen síť os kolejí (DD-02/DD-25);
  kolejnice jsou ryze vizuální offset.
- **mostní pilíře** — *(DD-20)* svislé podpěry tam, kde se trať odlepí od terénu (most nad podjezdem).
  **Emergentní**: žádná znalost „kde je most", staví se podle skutečného převýšení trati nad terénem
  (`trackY − terrainHeight > práh`) → fungují i pro budoucí estakády/náspy.
- **mostovka (bridge deck)** — *(S32)* souvislý nízký betonový nosník pod kolejnicemi v úsecích, kde je
  trať vyvýšená (most na pilířích). Plná deska (lowpoly styl), hustě vzorkované překrývající se box-segmenty
  (`InstancedMesh`) → souvislá i v oblouku, orientace sleduje sklon koleje. **Sdílí** s pilíři emergentní
  detekci vyvýšení (`elevatedSamples`, jen hustší vzorkování) → žádná znalost „kde je most" (DRY).
- **mlha / opar na horizontu** — *(S32)* `THREE.Fog` (lineární, bělavý), čistý do `near`, plný opar od `far`.
  Počítá vzdálenost **od kamery** → souprava i blízké stromy ostré, jen vzdálené facety blednou → dodá
  hloubku. Atmosféra scény (Renderer). *(S35)* dohlednost zdvojnásobena (130/340 → **260/680**) — pozor:
  deska má poloměr ~350 m, takže za ní může okraj prosvítat (řeší se zvětšením desky, zatím otevřené).
- **dekorace (stromy / kameny)** — faceted lowpoly: strom = kužel (koruna) + válec (kmen), kámen =
  ikosaedr. `InstancedMesh`, deterministické rozmístění (`hash` z indexu). *(S35)* Filtr je
  **clearance od osy trati** (`nearTrack`, < 14 m → nesázet; nahradil radiální zónu `r>180`) → vlak
  nikým neprojíždí a dekorace roste **i uprostřed osmičky**. Hustota kolísá **lesnatostí**
  (`forestDensity`, nízkofrekvenční pole) → shluky = lesy. Sedí na terénu, přestaví se se sliderem sklonu.

## Modely vozů (view)
- **model vozu (`CarVisual`)** — *(DD-22)* lowpoly faceted reprezentace vozu: `group` (transformovaný
  render loopem stejně jako dřív box), `skin` materiál (nese stavové tintování — semafor loko, žár, derail),
  kola a u loko hnací spojnice. Typ vozu (`CarType`) je **view metadata 1:1 s tělesy** — sim zná jen 1D
  těleso (délka + hmota), vzhled je ryze view (drží DD-01/DD-02). Factory `buildCarModel(type, length)`.
- **typy vozů** — `loco` (parní: kotel + kabina + komín + dóm), `tank` (cisterna = vodorovný válcový tank),
  `boxcar` (krytý vůz = uzavřená skříň), `flatcar` (**plošinový vůz „plato"** = holá deska, pro techniku/
  kontejnery), `gondola` (otevřený vůz = nízká korba bez střechy).
- **valení kol** — kola se otáčejí (`rotation.x`) úměrně ujeté dráze (`body.s / wheelRadius`), dozadu při
  couvání. Kontrastní příčka přes disk zviditelní rotaci. `wheelDir` (±1) srovnává směr otáčení mezi
  Y-flipnutou loko a vagony. Skříň je v podskupině zvednuté o poloměr kola → kola vykukují zpod vozu.
- **hnací spojnice (coupling rod, „páky")** — tyč spojující hnací kola loko; čep kliky (`CRANK_RADIUS`)
  obíhá střed kola, takže tyč krouží v rovině jako u parní mašiny. Ryze vizuální (sim nemá rotující hmoty).
- **vizualizace prokluzu (`driverSlipPhase`)** — při `slipping` se hnací kola loko „rozzávodí" navíc
  (`SLIP_SPIN_RATE`) → protáčejí se rychleji než jede vlak a spojnice víří. **View-only stav**: sim dává
  jen bool `slipping`, vizuální protáčení si view dopočítá samo (drží DD-01).

## Numerika a architektura
- **semi-implicitní Euler** — integrátor: nejdřív rychlost z aktuálních sil, pak poloha.
- **substepping** — dělení časového kroku; nutné pro stabilitu tuhých pružin (spřáhel).
- **sim/view split (DD-01)** — model nezná renderer; renderer = čistá funkce stavu → obraz.
- **CameraController** — *(S25)* veškeré řízení kamery (orbit/dron/WASD) jako samostatná view třída
  vytažená z Rendereru (SLAP): drží `camera`, Renderer ji jen čte při `gl.render`. `DroneParams` žijí tady.
- **WorldView** — *(S31)* statická scéna (lowpoly terén + dekorace + párové koleje/pražce/pilíře) jako
  samostatná view třída vytažená z Rendereru (SLAP, izomorfně s `CameraController`): drží `terrainMesh`/
  `trackGroup`/`sceneryGroup`, `rebuild` na slider sklonu. Renderer pak řeší jen **aktéry** (vozy, markery
  spřáhel, kouř) + render loop. Exportuje `RAIL_RADIUS` (výška temene koleje, čte ji render loop).
- **TrackSegment** — *(DD-25)* úsek trati = okno `[uStart, uEnd]` nad jednou hladkou „master"
  křivkou, adresované **lokální** arc-length `s ∈ [0, length]`. Sklon i křivost čtou master křivku
  **spojitě** (vzorky u±du i přes hranice segmentu) → na uzlu mezi segmenty **žádný zlom**.
- **TrackNetwork** — *(DD-25)* graf segmentů + uzly (kdo na koho navazuje, `next`/`prev`). Nahradil
  dřívější `Track`: poloha tělesa = `(seg, s)`, `advance` ji posune přes hranice segmentů, `globalS`
  (kumulativní arc-length po zvolené route) a `gap` (nejkratší rozteč po dráze) slouží spřáhlům,
  kontaktům, rázům i valení kol. Síť obsahuje hlavní smyčku i C² spojku.
- **route / route identity** — uzavřená jízdní trasa přes graf: `main = 0→1→2→3→0`,
  `branch = 0→1→4→3→0`. Je nutná, protože společné segmenty před/za výhybkou mají na různých
  trasách jinou kumulativní souřadnici. Bez route by `globalS`/`gap` na větvi tiše míchaly dvě
  topologie.
- **route lock (zámek výhybky)** — přestavení trasy je povolené jen tehdy, když celá souprava leží
  na segmentech společných pro obě trasy a není těsně u uzlu. Konzervativní první řez: chrání před
  přepsáním route identity uprostřed průjezdu výhybkou.
- **segment / uzel / výhybka (topologie)** — *(DD-25)* segment = úsek koleje mezi uzly; uzel = bod
  napojení segmentů. **Výhybka** = uzel s víc než jedním pokračováním (volba trasy, `next/prev` =
  seznam možností, `advance(choose)`). Tím se opouští „jedna smyčka" (Úr. 4 žebříku / DD-04), ale
  drží DD-02 (vůz je pořád 1D `s` podél dráhy).
- **odbočka / θ-graf** — *(S37, DD-26)* 3. hrana grafu mezi dvěma výhybkami: odbočka jako **boční
  offset** hlavní trati `δ(s)=BRANCH_OFFSET·sin⁴(π·t)`. Profil **sin⁴** má `δ=δ'=δ''=0` na koncích →
  C² napojení (spojitá omezená křivost, žádný trh) a `δ≥0` → drží se na jedné straně (nekříží).
  Kolejiště = **θ-graf**: 2 uzly (výhybky), 3 hrany (krátký/dlouhý úsek lemniskáty + odbočka).
- **projektování trati profilem κ(s)** — *(S37, DD-26)* trať se neskládá z kruhových oblouků + přímek
  (skoky `κ` = skoky `v²·κ` = boční trh), ale navrhuje se **spojitým, shora omezeným profilem křivosti**
  (přechodnice/klotoidy). Klíčový princip projektování větví — viz `tools/check-connector.ts`.
- **DD-NN** — design decision; tabulky v `docs/diary/`.
