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
- **Příčná dynamika & vykolejení** → TODO (S6) — odstředivka v oblouku (`m·v²/r`), převrácení
  kolem vnější kolejnice (výška těžiště × rozchod). Úroveň A: 1D + příčná **diagnostika**,
  vykolejení = emergentní fail state (drží DD-02), homomorfní s přetržením vlaku. Rozšíření:
  klopení (cant) — slider nebo auto z vyrovnávací rychlosti, up-vektor koleje ve view;
  Nadalovo kritérium (vyšplhání okolku, `L/V ≤ (tanβ−μ)/(1+μ·tanβ)`); proměnná geometrie
  trati (oblouky o různém r). Multi-body (Úroveň B) = jiný roh mřížky věrnosti, mimo PoC.
- **Brzdy soupravy** — pneumatická soustava, prodleva šíření tlaku soupravou (další vlna).
  (Brzda lokomotivy hotová v F2; v S3 přepsána na řízené tření — souboj sil, DD-09.)
- **Dynamický prokluz** → TODO (rozšíření F2) — kolo s vlastní setrvačností + creep křivka
  (μ roste do ~1–2 % skluzu, pak padá). Doslovné „roztáčení kol", ne jen clamp. Pak písek.
- **Otáčkový / mechanický strop rychlosti** (kandidát k F3) — dnes je max rychlost čistě
  rovnováha výkon vs. odpory (`P/v = Crr·m·g + b·v²`, ~67 m/s s defaulty). Chybí druhý
  reálný limit: pohon s pevným převodem má strop otáček kol. U parní loko = **mean piston
  speed** (setrvačnost ojnic/pístů ~v², „hammer blow") → velká hnací kola = vyšší v_max
  (velikost kola JE převod). Druhý efekt: při vysokých otáčkách válec nestihne plnit párou
  → střední tlak klesá → TE padá rychleji než `P/v`. Patří k F3 (tentýž stroj jako pára).
  KISS verze: parametr `maxPistonSpeed` → nad odpovídající `v` plynulý pokles `TE` k nule.
- **Adheze kol** — základ hotov v F2 (clamp `μ·N`, prokluz, indikace). → DONE.

## Výzkumná osa: „proč je uspokojivé sledovat vláčky"
Udělat z A2 měřitelné hypotézy, ne filozofování (proto Lab):
- H1: uspokojení roste s plynulostí a předvídatelností pohybu.
- H2: emergence z navazování (slack action) > skriptovaná animace.
- H3: pomalost a opakování (smyčka) má meditativní hodnotu.
- Každý experiment testuje jednu hypotézu.

## Vizualizace
- Kamera „sledující" konkrétní vagon vs. nadhled celé smyčky.
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
