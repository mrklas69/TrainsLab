# PROMPTS.md — projektová makra TrainsLab

Projektová makra `%BEGIN` a `%END` (start a konec sezení). Ostatní makra
(`%THINK`, `%DOCS`, `%AUDIT:CODE`, `%AUDIT:DOCS`, `%CALIBRATE`) jsou definovaná
**globálně** v `~/.claude/CLAUDE.md` — zde se neopakují (DRY). Doménové rozšíření
`%THINK` pro TrainsLab je v projektovém `CLAUDE.md`.

---

## `%BEGIN` — zahájení sezení

1. **`git fetch` + `git status`** — VŽDY první krok (projekt běží z více strojů;
   lekce S10 — souběžná sezení duplikovala kývání skříně). Pokud je remote napřed,
   sesynchronizuj se před prací.
2. **Načti kontext:** README (sekce Stav), `TODO.md`, poslední `docs/diary/YYYY-MM-DD.md`,
   `IDEAS.md`. Audit cadence čísla = poslední výskyt auditu v diáři (single source).
3. **Audit cadence check** (prahy v `~/.claude/CLAUDE.md`): vyhodnoť, kolik sezení /
   LOC uplynulo od posledního `%AUDIT:CODE` / `%AUDIT:DOCS` / pruning / `%CALIBRATE`.
   Práh překročen o ≥ 2 sezení → **⚠ PŘEKROČEN — spustit jako první bod sezení**.
4. **Stale „Příště" check:** položka opakovaná v „Příště" ≥ 5 sezení po sobě →
   **⚠ Stale Příště (N) — rozhodnout DO/DROP**. (Milníky z README sem nepočítej — viz `%END`.)
5. **Návrh fokusu:** vypiš „Příště" z posledního diáře jako první bod programu;
   zahrň doporučené audity z kroku 3. Nech uživatele rozhodnout (žádný kód předem).

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

### „Příště" vs. milník (lekce S16/%CALIBRATE)
Do „Příště" piš **konkrétní příští řez**, ne velký milník. Milníky (F4 záclony, F5
sloshing) žijí v README (Stav) a `IDEAS.md` — opisovat je do „Příště" každé sezení je
šum, který falešně spouští Stale check.
