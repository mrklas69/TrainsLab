# PROMPTS.md — projektová makra TrainsLab

Projektová makra `%BEGIN` a `%END` (start a konec sezení). Ostatní makra
(`%THINK`, `%DOCS`, `%AUDIT:CODE`, `%AUDIT:DOCS`, `%CALIBRATE:PROJ`) jsou
definovaná **globálně** v `~/.claude/PROMPTS.md` — zde se neopakují (DRY).
Doménové rozšíření `%THINK` je v projektovém overlayi (`AGENTS.md`).

**Skládání s globálními makry** (pravidlo v globálním `PROMPTS.md`, sekce
*Skládání s projektovými makry*): projektová definice globální **rozšiřuje,
nepřebíjí**. Zápis sezení: podstata sem do `docs/diary/`, globální deník
dostane jen stub + `Kudos!`/`Censure!`.

---

## `%BEGIN` — zahájení sezení

1. **Proveď globální `%BEGIN`** (`~/.claude/PROMPTS.md`) — pull sdílených
   pravidel, datum, stub sezení v globálním deníku, cíl. Kroky se neopisují,
   provádějí se odtamtud.
2. **`git fetch` + `git status`** — VŽDY první projektový krok (projekt běží z více strojů;
   lekce S10 — souběžná sezení duplikovala kývání skříně). Pokud je remote napřed,
   sesynchronizuj se před prací.
3. **Načti kontext:** README (sekce Stav), `TODO.md`, poslední `docs/diary/YYYY-MM-DD.md`,
   `IDEAS.md`. Cadence čti z ledgeru níže; jeho odkazy vedou k podkladům v diáři.
4. **Audit cadence check** (prahy + ledger v sekci „Cadence" níže): vyhodnoť, kolik sezení /
   LOC uplynulo od posledního `%AUDIT:CODE` / `%AUDIT:DOCS` / pruning / `%CALIBRATE:PROJ`.
   Práh překročen o ≥ 2 sezení → **⚠ PŘEKROČEN — spustit jako první bod sezení**.
5. **Stale „Příště" check:** položka opakovaná v „Příště" ≥ 5 sezení po sobě →
   **⚠ Stale Příště (N) — rozhodnout DO/DROP**. (Milníky z README sem nepočítej — viz `%END`.)
6. **Návrh fokusu:** vypiš „Příště" z posledního diáře jako první bod programu;
   zahrň doporučené audity z kroku 4. Nech uživatele rozhodnout (žádný kód předem).

---

## `%END` — ukončení sezení

1. **`%DOCS`** (globální makro) — refresh dokumentace dle dnešního sezení: diář +
   `DIARY.md`, `TODO.md`→`DONE.md`, `GLOSSARY.md`, `IDEAS.md`, případně README.
   **Nové DD zapiš i do `docs/DESIGN_DECISIONS.md`** (rejstřík), nejen do diáře.
   Při opravě dřívějšího tvrzení dorovnej také index a dotčené TODO tak, aby
   odkazovaly na korekci. Historický narativ zachovej; opravený stav musí být
   dohledatelný už z rozcestníku, který čte `%BEGIN` (lekce S43/S44).
2. **Kód:** žádné debug výpisy / zakomentované bloky; `npm run check` +
   `npm run build` zelené, stejně jako v CI. Build už obsahuje `tsc`.
   Samotná dokumentační změna bez dopadu na build tyto příkazy nevyžaduje.
   Neprovedenou kontrolu označ jako neověřenou; starý úspěšný běh nenahrazuje
   ověření změny. Výsledek z jiného stroje nebo CI musí odpovídat danému
   commitu. Funkční účinek posuzuj podle podmínek přijetí z projektového `%THINK`.
   Po přejmenování (symbol / soubor / koncept) grep starého názvu přes `src/` i `*.md`.
3. **Permission cleanup:** v `.claude/settings.local.json` smaž jednorázové patterny
   (konkrétní příkazy, smazané skripty, `echo`/fragmenty) a konsoliduj na wildcardy.
4. **Commit pravidla** (viz globální `%DOCS`): jeden commit/sezení; pokud se měnil kód,
   **dva commity** — `feat/fix/refactor: …` (kód), pak `docs(session): YYYY-MM-DD [N] — …`.
   Commit message piš přes **Bash tool**, ne PowerShell here-string `@'…'@` (rozbije titulek).
5. **`git push`.**
6. **Proveď globální `%END`** (`~/.claude/PROMPTS.md`) — stub v globálním
   deníku, zpětná vazba, TODO/DONE, oprávnění, push sdílených pravidel. Běží
   **poslední**: končí závěrečnou větou, za kterou už nic nesmí následovat.

### „Příště" vs. milník (lekce S16/%CALIBRATE:PROJ)
Do „Příště" piš **konkrétní příští řez**, ne velký milník. Milníky (F4 záclony, F5
sloshing) žijí v README (Stav) a `IDEAS.md` — opisovat je do „Příště" každé sezení je
šum, který falešně spouští Stale check.

---

## Cadence — prahy a ledger *(prahy S28, přezkoumány S45)*

`%BEGIN` krok 4 čte tuto sekci. **Ledger je jediný zdroj stavu kadence:**
poslední přijatá kontrola, sezení, výchozí commit pro CODE a odkaz na zápis.
Přijatá kontrola má doložený rozsah a výsledek; otevřené nálezy mohou zůstat
v TODO, ale neúplná nebo vyvrácená kontrola neposouvá základ automaticky.
Ledger aktualizuj při dokončení kontroly, nečekej na `%END`; nový CODE commit
eviduj po jeho vytvoření, do té doby ponech předchozí základ a zapiš čekající
aktualizaci v deníku. Zápis popisuje důkazy a důvod přijetí, nenahrazuje ledger.
**Práh** překročen o ≥ 2 sezení → spustit jako první bod sezení.

| Audit | Naposledy | Výchozí commit CODE | Zápis | Práh |
|-------|-----------|---------------------|-------|------|
| `%AUDIT:CODE` | **S41** | `f7f0485` | [S41](diary/2026-06-20.md) | ≥ 6 sez. **nebo** +250 LOC v `src/` |
| `%AUDIT:DOCS` | **S40** | — | [S40](diary/2026-06-12.md) | ≥ 12 sez. |
| pruning (IDEAS/TODO) | **S40** | — | [S40](diary/2026-06-12.md) | ≥ 12 sez. |
| `%CALIBRATE:PROJ` | **S45** | — | [S45](CALIBRATION_2026-09-09.md) | ≥ 15 sez. |

**LOC** = součet přidaných řádků v diffu `src/` proti evidovanému commitu,
nikoli čistý přírůstek velikosti stromu. Měř
`git diff --numstat --find-renames <commit> -- src/` (první sloupec) a přičti
nové soubory, které Git dosud nesleduje. Pracovní změny se počítají také;
binární položky `-` nejsou čísla. Rozsáhlé mazání nebo změnu modelu posuď
i pod prahem. Při rozpoznaném přesunu beze změny obsahu se LOC nezvyšuje;
číslo je podnět, ne náhrada úsudku.

Revize S45 (2026-09-09) číselné prahy ponechala. CODE zůstává konzervativně
S41: audit S43 proběhl, ale jeho závěry a tvrzení o opravách S44 byly částečně
vyvráceny. Zdůvodnění přijatých změn pravidel a zachování prahů:
[`CALIBRATION_2026-09-09.md`](CALIBRATION_2026-09-09.md).

Prahy odvozené z reálné kadence projektu: `%AUDIT:CODE` běžel S6/S12/S18/S25 (~6 sez.),
`%AUDIT:DOCS` S13/S26/S40 (13/14), pruning S13/S26/S40 (13/14),
`%CALIBRATE:PROJ` S16/S28 (12, tehdy pod jménem `%CALIBRATE` — přejmenováno
2026-07-12 kvůli kolizi s globální revizí spolupráce). LOC práh
u kódu je sekundární spouštěč (rozsah změn `src/` i mezi audity).
