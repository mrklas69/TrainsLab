# AGENTS.md — TrainsLab (projektový overlay)

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
| sim | `sim/TrackSegment.ts` | úsek master křivky, lokální `s`, `grade`/`signedCurvature`/`positionAt` (DD-25) |
| sim | `sim/TrackNetwork.ts` | graf segmentů + topologie, `advance`/`globalS`/`gap`, validace hlavní trasy (DD-25) |
| sim | `sim/trackData.ts` | asymetrická lemniskáta + C² spojka; výška `Y` z terénu + most (DD-20/DD-26) |
| sim | `sim/terrain.ts` | `terrainHeight` — výšková matematika, single source pro sim (trať) i view (mesh), DD-20 |
| sim | `sim/Body.ts` | 1D hmota (`seg`,`s`,`v`), tření, rotační stav (kývání skříně, DD-13) |
| sim | `sim/Coupler.ts` | pružina s vůlí — draft/buff; rozteč přes `network.gap` |
| sim | `sim/Train.ts` | souprava + volné vozy, integrace, kontakty/srážky, trakce/brzda, diagnostika |
| view | `view/Renderer.ts` | aktéři, markery, kouř a render loop; deleguje svět a kameru |
| view | `view/WorldView.ts` | terén/dekorace, koleje, most/pilíře; rebuild včetně disposal GPU prostředků |
| view | `view/CameraController.ts` | orbit/dron/WASD, `DroneParams` (DD-19) |
| view | `view/AudioView.ts` | sample-based Web Audio view nad simem (DD-01) |
| view | `view/SteamView.ts` | měkké world-space částice kouře/páry + plynule proměnný vítr (`WindParams`); komín, válce, rozvod, píšťala (DD-23) |
| ui | `ui/ControlPanel.ts` | slidery (dvouzdrojové params/drone) + status + tlačítka |
| — | `main.ts` | skládá sim + view + ui, drží render loop |

## Makra
Projektová `%BEGIN` / `%END` → `docs/PROMPTS.md`. Ostatní (`%THINK`, `%DOCS`,
`%AUDIT:CODE`, `%AUDIT:DOCS`, `%CALIBRATE`) → globální `~/.claude/PROMPTS.md`
(routing maker definuje `~/AGENTS.md`).
