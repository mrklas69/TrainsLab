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
- **Brzdy soupravy** — pneumatická soustava, prodleva šíření tlaku soupravou (další vlna).
  (Brzda lokomotivy hotová v F2; v S3 přepsána na řízené tření — souboj sil, DD-09.)
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
- Kamera „sledující" konkrétní vagon vs. nadhled celé smyčky. → **TODO** (S14, F4) —
  konkretizováno jako **auto-kamera „dron"**: stabilizuje se za+nad zadním vozem, míří na čelní,
  při reverzu přeletí na druhý konec. Rozpis (hystereze směru, lerp přelet, Lab knoby) v TODO.
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
  Otevřené zdroje ověřené rešerší (S3):
  - výfuk páry: Wikimedia Commons `Steam_engine.ogg` — **Public Domain** (0-4-0 do kopce);
    freesound Benboncan „Trains" pack (CC-BY).
  - spřáhlo / nárazníky: freesound toam #198605 — **CC-BY 3.0** (nasekat na one-shoty).
  - brzdy: Orange Free Sounds — ⚠ **CC-BY-NC** (nekomerční!); raději hledat CC0 na freesound.
  - prokluz: freesound „wheel slip" CC0.
  - **Licenční hygiena:** držet CC0/CC-BY, vyhnout se NC (mřížka míří i k publikovatelnému).
    Freesound vyžaduje login ke stažení → soubory musí přinést uživatel.

## Lab knoby & nástroje
- **Slider sklonu tratě** → DONE (S5) — `trackAmplitude` v params, `Track.rebuild()`
  in-place + `Renderer.rebuildTrack()`. Mění sklon za jízdy. Knob sklon × výkon × hmotnost.
- **Kalkulačka silové bilance** — z dnešního ověření (max sklon vs. adhezní/výkonový strop
  vs. hmotnost soupravy). Buď jako Lab panel, nebo skript v `tools/`.
