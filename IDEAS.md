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
- **Brzdy soupravy** — pneumatická soustava, prodleva šíření tlaku soupravou (další vlna).
  (Brzda lokomotivy hotová v F2.)
- **Dynamický prokluz** → TODO (rozšíření F2) — kolo s vlastní setrvačností + creep křivka
  (μ roste do ~1–2 % skluzu, pak padá). Doslovné „roztáčení kol", ne jen clamp. Pak písek.
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

## Lab knoby & nástroje
- **Slider sklonu tratě** — živá změna amplitudy kopců s přestavbou geometrie
  (`TubeGeometry` + kontrolní body). Názorný knob: vztah sklon × výkon × hmotnost.
- **Kalkulačka silové bilance** — z dnešního ověření (max sklon vs. adhezní/výkonový strop
  vs. hmotnost soupravy). Buď jako Lab panel, nebo skript v `tools/`.
