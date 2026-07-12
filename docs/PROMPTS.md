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
   `IDEAS.md`. Audit cadence čísla = poslední výskyt auditu v diáři (single source).
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
2. **Kód:** žádné debug výpisy / zakomentované bloky; `npx tsc` + `npm run build` zelené.
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

## Cadence — prahy a ledger  *(kalibrováno S28, prahy z reálných dat)*

`%BEGIN` krok 4 čte tuto sekci. **Ledger** = poslední výskyt auditu (single source —
když audit doběhne v `%END`, zvedni tu příslušné číslo sezení). **Práh** překročen
o ≥ 2 sezení → spustit jako první bod sezení.

| Audit | Naposledy (sezení) | Práh |
|-------|--------------------|------|
| `%AUDIT:CODE` | **S41** | ≥ 6 sez. **nebo** +250 LOC v `src/` |
| `%AUDIT:DOCS` | **S40** | ≥ 12 sez. |
| pruning (IDEAS/TODO) | **S40** | ≥ 12 sez. |
| `%CALIBRATE:PROJ` | **S28** | ≥ 15 sez. |

Prahy odvozené z reálné kadence projektu: `%AUDIT:CODE` běžel S6/S12/S18/S25 (~6 sez.),
`%AUDIT:DOCS` S13/S26/S40 (13/14), pruning S13/S26/S40 (13/14),
`%CALIBRATE:PROJ` S16/S28 (12, tehdy pod jménem `%CALIBRATE` — přejmenováno
2026-07-12 kvůli kolizi s globální revizí spolupráce). LOC práh
u kódu je sekundární spouštěč (skok velikosti `src/` i mezi audity).
