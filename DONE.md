# DONE — TrainsLab

Dokončené úkoly. Detaily a rozhodnutí: `docs/diary/`.

## Sezení 2 (2026-05-29)

### F0 — jednotělesová dynamika
- Kostra Vite + TypeScript + ThreeJS, build/typecheck zelený.
- ThreeJS scéna: kamera, světla, OrbitControls, render loop.
- `Track` — uzavřená `CatmullRomCurve3`, arc-length `at(s)`, sklon `grade(s)`.
- Zvlněná smyčka (`trackData`).
- `Body` jako 1D hmota (`s`, `v`), síly: gravitace `g·sin(θ)`, valivý odpor, odpor vzduchu.
- Semi-implicitní Euler se substeppingem.
- Šťouchnutí impulzem (klávesnice) + reset.
- UI panel se slidery fyzikálních parametrů (živé ladění).
- Sim/view split (DD-01) od první řádky.

### F1 — slack action
- Souprava jako `Body` ×N řízená `Train`.
- `Coupler` = pružina s vůlí (mrtvé pásmo) — draft (tah) i buff (tlak přes nárazník).
- Šťouchnutí do lokomotivy → run-out vůle soupravou (podélná vlna).
- Slidery vůle / tuhost / tlumení spřáhla.

### F2 — trakce & adheze (DD-07)
- Hmotnost per vůz (lokomotiva těžší — adhezní tíha).
- Regulátor jako notch páka (3 vpřed · 0 · 1 vzad) místo šťouchnutí.
- Tractive effort s výkonovým limitem `TE = min(F_max, P/v)`.
- Adheze: clamp na `μ·N`, prokluz při překročení (vizuálně: žlutá lokomotiva).
- Brzda jen u lokomotivy (limit adhezí).
- Rozběhové/statické tření (`Crr_start = Crr × faktor`) — dá vůli funkční smysl, sjednotí auto-stop.
- Slidery: výkon, max síla, μ, hmotnosti, brzda, rozběhový faktor.
- Oprava sklonu tratě dle ověřené silové bilance (amplitude 6 → 1,2; sklon 28 % → 5,7 %).

### Dokumentace / housekeeping
- Diář narovnán do `docs/diary/YYYY-MM-DD.md` + index `DIARY.md`.
- Reframe F0 (DD-06): „tuhý tah dokola" → jednotělesová dynamika.

## Sezení 3 (2026-05-29)

### Reality check & doladění fyziky
- **DD-08 — reverz = protiproudé brzdění:** tah proti pohybu limitován adhezí (`μ·N`), ne `P/v`. Opraven `P/v` bug na brzdné síle (reverz za jízdy byl uměle slabý).
- **DD-09 — brzda = řízené tření:** zrušen early `return`; brzda je dodatečný odpor v `applyFriction` (jen loko), tah se počítá vždy. Emergentně: dragging brakes, držení na svahu (parkovací brzda), plynulé dojetí bez cukání. Odstraněna konstanta `V_BRAKE`.
- Reálně potvrzeno jízdou: prokluz při rozjezdu, reverz, brzda.

### AudioView — prototyp ozvučení (F4 záclona, vědomě předsunuto)
- Zvuk jako další view nad simem (DD-01): čte stav, nic nezapisuje.
- Procedurální Web Audio (žádné externí soubory): chuff (∝ rychlost), clank/náraz spřáhla (∝ relVel), sykot prokluzu, skřípění brzd.
- Mute (klávesa `M` + tlačítko), resume na první vstup (autoplay policy).
- Sim vystavil `Coupler.mode`/`relVel` + `Train.couplers` — využije i budoucí vizualizace napětí.
- Rešerše otevřených zvukových databází (zdroje + licence) → IDEAS.md.

## Sezení 4 (2026-05-29)

### Publikace dema na GitHub Pages
- `vite.config.ts` — `base: '/TrainsLab/'` při buildu, `'/'` v dev (oprava bílé stránky: absolutní `/assets` cesty mířily na kořen domény).
- `.github/workflows/deploy.yml` — auto build + deploy na push do `main`; `dist/` zůstává v `.gitignore`.
- Oprava Pages `build_type: legacy → workflow` (servíroval zdrojový `index.html` s `/src/main.ts` místo buildu).
- Bump actions na Node 24 runtime (checkout v6, setup-node v6, upload-pages-artifact v5, deploy-pages v5) — pryč deprecation warning.
- Demo živé: https://mrklas69.github.io/TrainsLab/ (vč. zvuků, ověřeno).
