# CLAUDE.md — TrainsLab (projektový overlay)

Rozšiřuje globální `~/AGENTS.md`, **nepřevažuje ho.** Jen AI overlay
(instrukce, code style, makra, key files). Fakta o projektu (identita, stav, hierarchie
modelu, milníky, changelog) patří do `README.md` / `docs/DIARY.md` / `docs/DESIGN_DECISIONS.md`.

## Dokumenty
- `README.md` — identita, ovládání, stav fází, architektura, demo.
- `GLOSSARY.md` — termíny (slack action, adheze, trakce, kývání skříně…).
- `docs/PROMPTS.md` — projektová makra `%BEGIN` / `%END` (ostatní jsou globální).
- `docs/DESIGN_DECISIONS.md` — rejstřík DD-NN (narativ v diáři).
- `docs/DIARY.md` + `docs/diary/YYYY-MM-DD.md` — index a záznamy sezení.
- `TODO.md` / `DONE.md` / `IDEAS.md` — úkoly a nápady.

## Code Style
- **Komentáře v kódu: česky** (vysvětluj netriviální fyziku/logiku, ne triviality).
  Identifikátory anglicky.
- **Dotáhni izomorfismus a diagnostiku hned při návrhu** (lekce S3/S5/S8/S14/S16).
  Nová mechanika musí být ošetřená ve **všech souběžných cestách** (tah ↔ brzda,
  klávesa ↔ tlačítko) a fail/skid stav musí nést **diagnostiku** (čím a *při jakém
  stavu* nastal — viz `derailSpeed`). Nejčastější zdroj latentního dluhu: postaveno
  „skoro správně", díra odhalena až auditem nebo uživatelovým dotazem.
- **Sim/view split (DD-01) je tvrdá hranice** — `three` v `sim/` jen jako matematika;
  čistě-view parametry (kamera) nepatří do `PhysicsParams` (viz DD-19).

## `%THINK` — doménové rozšíření
K obecným bodům globálního `%THINK` přidej:
- **Fyzikální věrnost vs. hratelnost:** je jev emergentní z jednoduchých pravidel
  (pružina s vůlí, clamp `μ·N`), nebo se skriptuje? **Preferuj emergenci** — to je nika
  projektu (slack action). Naprogramovaný výsledek je poslední možnost.
- **Domény odděleně:** podélná (`grade` → gravitace) vs. příčná (`signedCurvature` →
  odstředivka) — izomorfní rozdělení vertikála/horizontála. Drží to 1D model (DD-02)?
- **Roh mřížky:** neopouštíme MIKRO × vysoká věrnost plíživě (DD-04). Multi-body, síť,
  výhybky = jiný roh, vědomě (žebřík DOF v IDEAS).

## Key Files (`src/`)
| Vrstva | Soubor | Obsah |
|--------|--------|-------|
| sim | `sim/params.ts` | `PhysicsParams` — laditelné parametry, single source of truth |
| sim | `sim/TrackSegment.ts` | úsek master křivky `[uStart,uEnd]`, lokální `s`; `grade`/`signedCurvature`/`positionAt` spojitě přes hranice (DD-25) |
| sim | `sim/TrackNetwork.ts` | graf segmentů + uzly (`next`/`prev`), `advance`/`globalS`/`gap`, `rebuild`, `masterCurves` (DD-25) |
| sim | `sim/trackData.ts` | ležatá osmička (asymetrická, izotropní stretch); výška `Y` z terénu + most u křížení (DD-20); `buildLoopNetwork` (graf) |
| sim | `sim/terrain.ts` | `terrainHeight` — výšková matematika, single source pro sim (trať) i view (mesh), DD-20 |
| sim | `sim/Body.ts` | 1D hmota (`seg`,`s`,`v`), tření, rotační stav (kývání skříně, DD-13) |
| sim | `sim/Coupler.ts` | pružina s vůlí — draft/buff, `mode`/`relVel`/`force`; rozteč přes `network.gap` |
| sim | `sim/Train.ts` | řetězec těles + volné vozy (`freeBodies`), integrace, trakce/brzda, kontakty/srážky (`applyContacts`, `derail`), příčná diagnostika (DD-24) |
| view | `view/Renderer.ts` | Three.js — čistá funkce stavu → obraz; **aktéři** (vozy, volné vozy, markery spřáhel, kouř/pára) + render loop + světla; deleguje statickou scénu na `WorldView`, kameru na `CameraController` (S25/S31) |
| view | `view/WorldView.ts` | statická scéna (SLAP, vytaženo S31): lowpoly terén/dekorace (clearance od trati, lesy), párové koleje + pražce per master křivku, most+pilíře (DD-20); `rebuild` na slider sklonu; exportuje `RAIL_RADIUS` |
| view | `view/CameraController.ts` | řízení kamery (orbit/dron/WASD), `DroneParams`/`DEFAULT_DRONE` (DD-19) — vytaženo z Rendereru (S25, SLAP) |
| view | `view/AudioView.ts` | zvuk — view nad simem (DD-01): nahrané samply (`loadSample`) + orchestrace; čistě sample-based (S27, `proceduralAudio` odstraněn), tvary hlasů `makeSampleLoop`/`makeRateLoop`/`makeRandomizedLoop`/`makeSampleLevelLoop` |
| view | `view/ExhaustClock.ts` | sdílený rytmus výfuku (DD-23) pro chuff i kouř; cap `CHUFF_FUSE_SPEED` |
| view | `view/SteamView.ts` | měkké world-space částice kouře/páry + plynule proměnný vítr (`WindParams`); komín, válce, rozvod, píšťala (DD-23) |
| view | `view/carModels.ts` | lowpoly factory modelů vozů `buildCarModel` (DD-22) — kola, hnací spojnice |
| ui | `ui/ControlPanel.ts` | slidery (dvouzdrojové params/drone) + status + tlačítka |
| — | `main.ts` | skládá sim + view + ui, drží render loop |

## Makra
Projektová `%BEGIN` / `%END` → `docs/PROMPTS.md`. Ostatní (`%THINK`, `%DOCS`,
`%AUDIT:CODE`, `%AUDIT:DOCS`, `%CALIBRATE`) → globální `~/.claude/PROMPTS.md`
(routing maker definuje `~/AGENTS.md`).
