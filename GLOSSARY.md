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
  oblouku na nábězích/výjezdech laloků (`TRACK_PERTURBATIONS`), ne přepis geometrie hladké lemniskáty.
  Sílu tlumí **kvalita přechodnice** (`1−transitionQuality`) — jen tenhle typ, spáry/výhybky nezávisle.
- **výhybka (jako bodový ráz)** — perturbace `kind:'switch'` u **křížení** osmičky (`u≈0.25/0.75`, inflexe
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
- **chuff (výfuk páry)** — nárazový výdech páry komínem **pod párou** (otevřený regulátor `notch≠0`
  **a** `steamPressure>0` — bez páry píst nepracuje). Časován **`ExhaustClock`** (4 pufy/otáčku kola),
  ne podle rychlosti přímo → věrný zrychlující se rytmus. Hybrid: nahraný sample (`steam_chuff.wav`),
  dokud se nenačte / když chybí → procedurální burst šumu.
- **ExhaustClock (rytmus výfuku)** — *(DD-23)* sdílený view zdroj taktu parního výfuku: fáze ∝ ujetá
  dráha kol (`v/(π·D) × 4 pufy/otáčku` — dvojčinná dvojválcová mašina). `main` ji posouvá jednou za frame,
  obě view vrstvy (zvukový chuff, puf kouře) čtou flag `fired` → jsou **sladěné z jednoho zdroje** (DRY).
  Fyzikálně odvozený rytmus = emergentně pomalý rozjezdový „čch… čch…" i hustý sykot, bez ladění konstanty.
- **chuff fuse (`CHUFF_FUSE_SPEED`)** — *(S25)* strop rychlosti v `ExhaustClock.advance` (7,4 m/s): nad ním
  by interval výfuku (~159 ms) klesl pod délku chuffu (~0,2 s) a pufy by splynuly v rachot („kulomet").
  Cap **na sdíleném clocku** → takt se ustálí pro zvuk i kouř současně (drží DD-23). Práh = fyzikální „interval
  = délka výdechu", vázán na default `driverDiameter`.
- **kouř (`SmokeView`)** — *(DD-23)* faceted obláčky (ikosaedry, flatShading) emitované z ústí komína loko.
  Žijí ve **world-space** (children scény, ne loko) → jak loko ujede, kouř visí a vzniká **vlečka**
  emergentně (bez skriptu). Pod párou výrazné pufy v taktu výfuku (`ExhaustClock`), hustota/velikost/**tmavost**
  ∝ `throttleFraction·steamPressure` (uhlíkový kouř při zátěži ↔ světlá pára); volnoběh = líné světlé obláčky.
  Idle kouř je vázán na **hořící oheň** (`fireLit = coalFraction > 0`, S25): došlo uhlí → kotel vyhasne,
  žádný kouř; došla jen voda → kotel kouří idle dál, ale bez páry = bez chuffu/výfuku.
- **tikot / klapot spár** — „klikety-klak" na dilatačních spárách. **Hybrid (S25):** sample
  (`clattering_wheels.wav`) jako **smyčka** s `playbackRate ∝ rychlost` (`makeRateLoop`, `RAIL_REF_SPEED`)
  → frekvence klapotu úměrná rychlosti. Fallback = procedurální self-timed tikot (interval `railLength/v`,
  jako chuff — AudioView čte stav, negeneruje z eventů simu). Vypne `trackImpulse=0` / svařovaná kolej.
- **skřípění oblouku (flange squeal)** — kvílení okolků v zatáčce; trvalý hlas s hlasitostí plynule
  řízenou příčným zrychlením (`v²·κ`) — sílí v ostřejším oblouku. ≠ on/off skřípění brzd.
- **clunk výhybky vs. trh přechodnice** — odlišené zvuky bodových perturbací (S20): výhybka/křížení
  (`switchFired`) = tupý kovový clunk; skok křivosti (`transitionJerkFired`) = krátké skřípnutí
  (`playArcJerk`, sklouznutí frekvence dolů — příbuzné trvalému skřípění oblouku, ale jednorázové).
- **únik páry (steam leak)** — *(S24)* syčení kotle pod tlakem: sample smyčka (`makeSampleLoop`, úsek
  1.–11. s na 1/3 hlasitosti) běžící pořád, slyšitelná dokud `steamPressure > 0` (po vyčerpání zásob utichne).
- **houkačka (horn)** — *(S24)* one-shot na vyžádání (tlačítko / klávesa H), `playHorn`. Hlasitá (3× nad
  běžné hlasy). Bez procedurálního fallbacku.
- **brzdy (sample)** — *(S24)* `makeRandomizedLoop`: smyčka, jejíž hranice (`loopStart ∈ [0,1;0,3]`,
  `loopEnd ∈ [0,6;0,9]` délky) se **přelosují po každém průchodu** → šev pevné smyčky se neozývá periodicky.
  `playbackRate ∝ rychlost` (= otáčení kol, `RateVoice.setRate`), aktivní jen za jízdy (`isBraking && |v|>0,3`)
  → stojící vlak s brzdou je tichý. Fallback = procedurální skřípění (3 neharmonické frekvence se jitterem).
  **Rate cap (`BRAKE_FUSE_SPEED`, S25):** rychlost přehrávání roste lineárně 0 → 3,8 m/s, pak strop
  (`rate ∈ [0,5; 1,15]`) — bez capu by při vysoké rychlosti rate vyletěl na ~1,9 a skřípání znělo jako
  „zubní vrtačka" (analogie chuff fuse).
- **AudioView** — zvuk jako další „view" nad simem (DD-01): čte stav, ozvučuje události (chuff, únik páry,
  houkačka, clank/náraz spřáhla, sykot prokluzu, skřípění/sample brzd, tikot spár, skřípění oblouku, clunk
  výhybky, trh přechodnice). **Hybrid** (S23–S24): nahrané samply z `public/audio/` (`loadSample` přes
  `BASE_URL` + `decodeAudioData`), s fallbackem na procedurální generátor — když sample chybí/nenačte, vždy
  zní něco. Tvary hlasů: one-shot (`playSample`), trvalý loop (`makeSampleLoop`), loop s náhodnými hranicemi
  + rychlostí (`makeRandomizedLoop`/`RateVoice`).

## Kamera (view)
- **dron (auto-kamera)** — *(DD-19)* režim kamery (toggle `C`), který sleduje soupravu zezadu-shora
  ve směru jízdy a kouká na její střed. Vypne ruční ovládání (myš + WASD/QE/ZX). Pozice i bod pohledu
  se **tlumeně dohánějí** k cíli (`α = 1−exp(−tuhost·dt)`, nezávislé na FPS) → při **reverzu** se cíl
  překlopí na druhý konec a kamera plynule *přeletí*. **Hystereze** směru u `v≈0` (drží poslední, jinak
  slack-couvání třese dronem). Ryze view — parametry (`DroneParams`: výška/odstup/tuhost) mimo `PhysicsParams`,
  sim o kameře neví (DD-01).

## Krajina a trať (view)
- **lowpoly terén (heightfield)** — *(DD-20)* zvlněná deska, jejíž výšku dává `terrainHeight(x,z)`
  (deterministický šum, amplituda vln roste se vzdáleností od středu — pod tratí mírné, na horizontu
  kopce). **Single source** v `sim/terrain.ts` — čte ji sim (výška trati) i view (mesh). Barvení facet
  podle výšky (louka → les → skála) je ryze view.
- **faceting (flat shading)** — lowpoly vzhled = ostré ploché facety. Vzniká z `flatShading` +
  `toNonIndexed`, ale **viditelný je až směrovým kontrastem světla** (nízký ambient + silné slunce);
  rovnoměrné světlo facety setře, i kdyby byla geometrie zubatá.
- **párové kolejnice / pražce** — vizuální ztvárnění tratě: dvě trubky offsetnuté ±rozchod/2 do
  horizontální kolmice + příčné pražce (`InstancedMesh`). Sim zná jen osu koleje (`track.curve`, DD-02);
  kolejnice jsou ryze vizuální offset.
- **mostní pilíře** — *(DD-20)* svislé podpěry tam, kde se trať odlepí od terénu (most nad podjezdem).
  **Emergentní**: žádná znalost „kde je most", staví se podle skutečného převýšení trati nad terénem
  (`trackY − terrainHeight > práh`) → fungují i pro budoucí estakády/náspy.
- **dekorace (stromy / kameny)** — faceted lowpoly: strom = kužel (koruna) + válec (kmen), kámen =
  ikosaedr. `InstancedMesh`, deterministické rozmístění (`hash` z indexu) mimo zónu trati (`r > 180 m`).
  Sedí na terénu, přestaví se se sliderem sklonu.

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
- **proceduralAudio** — *(S25)* knihovna procedurálních generátorů zvuku (čisté funkce nad `AudioContext`)
  = fallback vrstva `AudioView` pro chybějící samply (hybrid: sample má přednost, jinak „vždy zní něco").
- **DD-NN** — design decision; tabulky v `docs/diary/`.
