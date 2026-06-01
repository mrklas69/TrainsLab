# IDEAS — TrainsLab

Raw nápady. Značky `→ TODO` / `→ DONE` u dozralých.
Koncept a kontext: viz `docs/diary/2026-05-29.md`.

## Prostor experimentů (mřížka měřítko × věrnost)
- **Transport Tycoon vrstva** (makro × nízká věrnost) — síť, ekonomika, rozvozy.
  Opačný roh mřížky než PoC; sdílené jádro ho neutáhne bez bobtnání → vlastní experiment.
- **ASCII renderer** (mikro × nízká věrnost) — vyměnitelný renderer nad týmž modelem
  jako PoC. Levný sanity check / nostalgie. Demonstruje sílu sim/view splitu (DD-01).
- **Topologie sítě** — výhybky, větvení, křižovatky. Vlastní těžký problém oddělený
  od fyziky. Brána k makro měřítku.

## Hlubší fyzika
- **Sloshing kapaliny v cisterně** (F5) — pohyb kapaliny mění těžiště vagonu, zpětně
  ovlivňuje dynamiku. „Tu pak rozpohybujeme."
- **Přetržení vlaku** — když draft síla překročí mez spřáhla. Emergentní fail state.
- **Příčná dynamika & vykolejení** → DONE (S6–S9, jádro) — odstředivka v oblouku (`m·v²/r`),
  převrácení kolem vnější kolejnice (výška těžiště × rozchod). Úroveň A: 1D + příčná
  **diagnostika**, vykolejení = emergentní fail state (drží DD-02), homomorfní s přetržením
  vlaku. **Otevřená rozšíření:**
  klopení (cant) — slider nebo auto z vyrovnávací rychlosti, up-vektor koleje ve view;
  Nadalovo kritérium (vyšplhání okolku, `L/V ≤ (tanβ−μ)/(1+μ·tanβ)`); proměnná geometrie
  trati (oblouky o různém r). Multi-body (Úroveň B) = jiný roh mřížky věrnosti, mimo PoC.
- **Opuštění monorailu — žebřík DOF** (S7) — dnešní model je *monorail*: 1 těleso = skalár `s`
  na 1 křivce (osa koleje), z 6 DOF tuhého tělesa máme jen surge. Úrovně rozšíření:
  - **Úr. 1 — kývání skříně** → DONE (S9): roll (z odstředivky `v²·κ`) + pitch (z `dv/dt`)
    jako tlumené torzní oscilátory. **Neopouští monorail** (rotace nemění `s`/`v`), drží DD-02.
  - **Úr. 2 — dva podvozky na 1 křivce**: vůz = 2 body na téže centerline → yaw natočení
    vůči tečně + přesah (overhang) v oblouku. Geometrie dlouhých vozů. Napůl opouští.
  - **Úr. 3 — příčný DOF kola**: okolky, kuželový jízdní obrys, **hunting** (vrtění),
    vykolejení jako *fyzika* (kolo opustí kolejnici), ne flag. **Tady fakt opouštíme
    monorail** — vzniká příčná výchylka `y` dvojkolí, boří DD-02 = Úroveň B z DD-11.
    Slouží jiné nice (vedení kola), ne slack action → **jiný roh mřížky, vědomě, ne plíživě.**
  - **Úr. 4 — síť, výhybky**: graf místo smyčky (viz Topologie sítě výše), makro osa.
- **Rázy z trati (track impulses)** → DONE (S19, DD-21) — sjednocený balík nespojitostí buzení kývání
  skříně (rozšíření Úr. 1 / DD-13, drží DD-02: impuls do roll/pitch, **nemění `s`/`v`**). Tři zdroje,
  jeden mechanismus = kick do **existujících** oscilátorů (recyklace, žádný nový bounce DOF — volba A2):
  - **rail joints** (dilatační spáry) — periodická nespojitost `s mod railLength` → **pitch** ráz,
    pravidelný tikot ∝ rychlost (klikety-klak). Detekce přes ujetou vzdálenost (frame-rate indep.).
  - **κ-skok / chybějící přechodnice** — **fenomenologický** roll-kick v místech velké `|dκ/ds|`
    (náběhy laloků; volba A4 b — ne přepis geometrie lemniskáty) → boční trh. „Přechodnice on/off" = Lab knob.
  - **výhybky / radiální rázy** — bodové perturbace `{s_i, rollKick, pitchKick}` v `trackData` → clunk.
    Pozn.: „výhybka" tu = **bodový ráz na smyčce**, ne topologický uzel (síť = Úr. 4, jiný roh mřížky).
  Klíč: κ-skok, výhybka i radiální ráz jsou **týž mechanismus** (bodová perturbace na `s_i`); rail joint
  je jen jejich periodická varianta. Emergence: per-vůz `s` → klikot/trh proběhne soupravou **jako vlna**
  (homomorfní se slack action). Zvuk (AudioView, DD-01): tikot spár, skřípění oblouku ∝ `v²·|κ|`, clunk
  výhybky — izomorfní s chuff/clank.
  **Doladěno S20:** typy rozštěpeny (`transition`/`switch`), „kvalita přechodnic" jako slider (tlumí jen
  κ-trh), zvuk výhybky (clunk) odlišen od trhu přechodnice (skřípnutí). Pozice ověřeny profilem κ.
- **Brzdy soupravy** — pneumatická soustava, prodleva šíření tlaku soupravou (další vlna).
  (Brzda lokomotivy hotová v F2; v S3 přepsána na řízené tření — souboj sil, DD-09.)
- **`μ(v)` brzdy** *(→ DONE, S26)* — součinitel tření špalíkové brzdy klesá s rychlostí →
  decelerace *roste*, jak vlak zpomaluje (konkávní profil místo čistě lineárního). Realizováno jako
  `brakeFadeFactor = (1−fade) + fade/(1+k·|v|)` škálující brzdnou sílu: `f(0)=1` (Coulombův základ S25
  zachován), `f(∞)=1−fade` (asymptota — tření nezmizí), `brakeFade=0` = konstantní. Skid-check proti
  faded síle. Davisův `B·v` člen odporu **také DONE (S26)** — dokompletoval `R=A+B·v+C·v²`, zlepší dojezd.
- **Dynamický prokluz** → TODO (rozšíření F2) — kolo s vlastní setrvačností + creep křivka
  (μ roste do ~1–2 % skluzu, pak padá). Doslovné „roztáčení kol", ne jen clamp. Pak písek.
- **Mokrá kolej + písek** → DONE (S14, DD-17) — `railFactor` (stav koleje) škáluje adhezi, písek
  (spotřební zásoba, held-key P) ji vrací na suchou. Sdílený `adhesionLimit` → platí pro tah i
  brzdu; skid při brzdě indikován (DD-16). Mokrá μ sjednocena herně na ~0,1 (kontrast vůči suchu).
  *Otevřené (nezralé):* **dynamický prokluz** (creep křivka, viz výše) by dal písku ještě hlubší smysl.
- **Otáčkový / mechanický strop rychlosti** → DONE (S11, DD-15) — `v_mech = maxPistonSpeed·π·D
  /(2·zdvih)`; tah plný do 0,75·v_mech, pak lineárně k 0. Velikost kola `D` = převod (větší →
  vyšší v_max). Default ~23 m/s místo ~67 (čistě `P/v`). Násobí tah jako další faktor (izomorfní
  se `steamPressure`), jen při zrychlování (plugging limituje adheze). Slidery kolo + mez pístu.
- **Adheze kol** — základ hotov v F2 (clamp `μ·N`, prokluz, indikace). → DONE.
- **Gradient blízkosti meze = osciloskop slack action** (pozorování, kandidát na DD / diary) —
  žár skříně je ∝ `v²·κ` per-vůz. Protože je to **kvadrát rychlosti** a na rovince `κ=0`,
  oblouk funguje jako „obrazovka": podélné kmity `v` ze slack action (spřáhla = pružiny s vůlí)
  se zviditelní **jen v zatáčce**, jako rudá vlna běžící soupravou. Při couvání (protiproudé
  brzdění naplno → stick-slip, DD-08/10) se vlna silně budí a **odráží na koncích soupravy** →
  „cca 5× za oblouk". Emergentní propojení podélné (F1) a příčné (S8) dynamiky — nikde explicitně
  nenaprogramované, vyplynulo z toho, že žár čte `v²/r`. Pozorováno uživatelem při testu kývání.

## Výzkumná osa: „proč je uspokojivé sledovat vláčky"
Udělat z A2 měřitelné hypotézy, ne filozofování (proto Lab):
- H1: uspokojení roste s plynulostí a předvídatelností pohybu.
- H2: emergence z navazování (slack action) > skriptovaná animace.
- H3: pomalost a opakování (smyčka) má meditativní hodnotu.
- Každý experiment testuje jednu hypotézu.

## Vizualizace
- Kamera „sledující" konkrétní vagon vs. nadhled celé smyčky. → **DONE** (S15) — **auto-kamera „dron"**
  (toggle `C`): za+nad zadním vozem, lookAt střed soupravy, přelet při reverzu, hystereze směru (DD-19).
- **Svět (F4)** → **DONE** (S17): lowpoly terén (heightfield, faceted), párové kolejnice + pražce,
  **trať vede po povrchu** (sklony z krajiny, DD-20), most u křížení s emergentními pilíři, stromy + kameny.
  *Otevřené (nezralé) doladění:* mostovka mezi pilíři; mlha na horizontu pro hloubku; hustota/velikost stromů;
  barevná pásma terénu. Modely vozů → DONE (S22), kouř z komína → DONE (S23). Hlavní zbytek F4 = **zvukové
  samply** (hybrid vrstva rozjeta S23, zbývá 7 zvuků z manifestu).
- Vizuální zvýraznění napětí ve spřáhlech (barva / deformace) — fyzika viditelná.
  → DONE (S5) — koule-marker mezi vozy, barva dle `Coupler.mode`, jas ∝ `force`.
- Stavový semafor lokomotivy (prokluz / brzda / tah / volnoběh barvou). → DONE (S5).
- **Jiskry při skidu / prokluzu** — částicový efekt u kol (F4 záclona). Doslovné
  „létání jisker" při protiproudém brzdění (DD-10) / prokluzu rozjezdu.

## Zvuk / audio view
- **AudioView prototyp hotový** (S3) — zvuk jako další view nad simem (DD-01), procedurální
  Web Audio. Mapuje události: chuff (výfuk páry ∝ rychlost), clank/náraz spřáhla (∝ relVel),
  sykot prokluzu, skřípění brzd. → DONE (prototyp); samply jsou F4.
- **Vyměnit generátor za nahrané samply** (F4) — izomorfně s vyměnitelným rendererem.
  **Hybrid vrstva realizována S23–S25** (`loadSample` přes `BASE_URL` + `decodeAudioData`; tvary hlasů:
  `playSample` one-shot, `makeSampleLoop` trvalý loop, `makeRandomizedLoop` loop s náhodnými hranicemi,
  `makeRateLoop` prostá smyčka + `playbackRate`). **5 z 8:** chuff (`ExhaustClock.fired`), únik páry (∝ parní
  tlak), houkačka (tlačítko/H), brzdy (náhodné hranice proti švu + `playbackRate` ∝ rychlost), klapot spár
  (`clattering_wheels`, loop + `playbackRate` ∝ rychlost). Zbývá: clank, clunk, arc-jerk / loopy (slip,
  arc-squeal). `.wav` bezpečnější než `.m4a` (AAC na Firefoxu vrtkavé).
  Otevřené zdroje ověřené rešerší (S3):
  - výfuk páry: Wikimedia Commons `Steam_engine.ogg` — **Public Domain** (0-4-0 do kopce);
    freesound Benboncan „Trains" pack (CC-BY).
  - spřáhlo / nárazníky: freesound toam #198605 — **CC-BY 3.0** (nasekat na one-shoty).
  - brzdy: Orange Free Sounds — ⚠ **CC-BY-NC** (nekomerční!); raději hledat CC0 na freesound.
  - prokluz: freesound „wheel slip" CC0.
  - **Licenční hygiena:** držet CC0/CC-BY, vyhnout se NC (mřížka míří i k publikovatelnému).
    Freesound vyžaduje login ke stažení → soubory musí přinést uživatel.
  - **Manifest k sehnání (S21)** — 8 souborů 1:1 s hlasy `AudioView` (žádné nové → izomorfismus).
    Formát `.ogg`/`.mp3`, mono, 44,1 kHz, bez clippingu. Cíl `public/audio/`. Fallback = **hybrid**
    (chybí/nenačte se → padni na procedurální generátor, vždy zní něco). One-shoty:
    `chuff` (0,2–0,4 s, výdech páry), `clank` (0,1–0,3 s, tah spřáhla — jasné), `clunk` (0,2–0,4 s,
    nárazník + výhybka — tupé), `rail-tick` (0,05–0,15 s, spára), `arc-jerk` (0,15–0,3 s, trh přechodnice).
    Loopy (⚠ **seamless**, jinak lupají): `slip-loop` / `brake-squeal-loop` / `arc-squeal-loop` (á 1–2 s).
  - **Knihovny (S21):** primárně **Pixabay** (licence ≈ CC0, bez atribuce — nejmíň starostí) a
    **Freesound** s filtrem licence na CC0/Attribution (login → soubory nese uživatel). Parní výfuk PD na
    **Wikimedia Commons**; herní balíčky na **OpenGameArt**. ⚠ **vyhnout se:** BBC Sound Effects (RemArc =
    jen osobní/vzdělávací), Orange Free Sounds (NC), Zapsplat/SoundSnap (atribuční/redistribuční háčky).
    Loopy stříhat z delší stacionární nahrávky (Audacity → Crossfade Loop).
- **Rytmus výfuku jako sdílený zdroj** → DONE (S23, DD-23) — `ExhaustClock`: fyzikální takt
  (4 pufy/otáčku kola, `v/(π·D)`), jediný zdroj pro zvukový chuff i puf kouře (`SmokeView`). Nahradil
  fenomenologický `0.9/(v+0.4)` → věrný zrychlující se „čch… čch…".
  *Otevřené (nezralé):* takt z **otáček kol** místo rychlosti vlaku → při **prokluzu** zběsilý
  zrychlený výfuk (charakteristický zvuk parní mašiny, když loko „protáčí"). `ExhaustClock` to umožní
  snadno (advance z efektivní obvodové rychlosti kol, kterou view už zná z `driverSlipPhase`).
  *Chuff fuse (S25):* `CHUFF_FUSE_SPEED=7,4 m/s` (práh „kulometu") je vázán na **default `driverDiameter`** —
  při ladění průměru kola sliderem se fyzikální frekvence posune, ale práh ne. Dokonalá vazba (cap odvodit
  z aktuálního `D` tak, aby interval = délka chuffu) by byla čistší, ale pro demo over-engineering.

## Optimalizace (nezralé)
- **Zlevnit `signedCurvature`** *(S25, místo zamítnuté memoizace `lateralAcceleration`)* — getter příčného
  zrychlení se volá vícekrát/frame (`Train.update`, status, `AudioView.arc`, `Renderer.tipRatio` per vůz),
  každé volání = 3× `getPointAt` na CatmullRom. Memoizace getteru zamítnuta (K4 S25): cache v simu závislá
  na `v`/`s` (mění se každý substep) = stavová složitost + riziko zastaralé cache, proti KISS; výkon při
  6 vozech @ 60 FPS není měřitelný problém. Lepší budoucí řez, kdyby vadilo: **cache vzorků křivky** v `Track`
  (předpočítat poloha/tečna v N bodech, interpolovat) — zlevní `positionAt`/`getTangentAt` na horké cestě.

## Lab knoby & nástroje
- **Slider sklonu tratě** → DONE (S5) — `trackAmplitude` v params, `Track.rebuild()`
  in-place + `Renderer.rebuildTrack()`. Mění sklon za jízdy. Knob sklon × výkon × hmotnost.
- **Kalkulačka silové bilance** — z dnešního ověření (max sklon vs. adhezní/výkonový strop
  vs. hmotnost soupravy). Buď jako Lab panel, nebo skript v `tools/`.
