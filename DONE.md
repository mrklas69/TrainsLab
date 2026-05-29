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

## Sezení 5 (2026-05-29)

### README
- `README.md` — identita, odkaz na demo, ovládání (tabulka kláves ověřená proti kódu), Lab knoby, tabulka stavu fází F0–F5, architektura (sim/view split, strom `src/`), vývoj, odkazy na docs.

### Vizuální ověření slack run-out (F1 `[~]` → `[x]`)
- **Slider sklonu tratě** (Lab knob): `trackAmplitude` v `PhysicsParams`, `makeLoopControlPoints(amplitude)`, `Track.rebuild()` in-place, `Renderer.rebuildTrack()` (dispose + nová tuba). Obecný `SliderDef.action?` hook (rebuild jako side effect slideru). Mění sklon za jízdy bez resetu.
- **Vizualizace napětí ve spřáhlech**: `Coupler.force` (znaménková síla, izomorfně k `mode`/`relVel`); koule-marker mezi vozy — barva dle režimu (tah červená / tlak modrá / vůle šedá), jas ∝ `|force|`. Run-out přímo vidět: do kopce vlna červená odpředu, z kopce modrá.

### Stavový semafor lokomotivy
- Barva loko dle stavu (priorita prokluz > brzda > tah > volnoběh): oranžová / červená / zelená / šedá. Renderer čte `train.notch` + `isBraking` + `slipping`.

### DD-10 — skid při protiproudém brzdění
- `Train.applyLocomotive`: při `counterPressure` (reverz proti pohybu) `fraction = 1` místo dělení `MAX_FORWARD`. Plná `F_max` (200 kN) > adheze (177 kN) → prokluz + razantní brzdění. Couvání z klidu zůstává jemné. Řeší i původní stížnost S3 „reverz zpomaloval pomalu".

## Sezení 6 (2026-05-29)

### `%AUDIT:CODE` — úklid kódu (build + `tsc` zelené, žádná změna chování)
- **D1 (DRY):** adhezní strop `μ·N` extrahován do getteru `Train.adhesionLimit`; sdílí `brakeForce()` i `applyLocomotive()` (dřív počítán 2×).
- **D2:** pryč zastaralé fázové markery z UI (`index.html` „— F0", panel „— F2") → „TrainsLab"; stav fází zůstává single-source v README.
- **D3:** `V_POWER` rozdělen na `V_POWER` (floor pro `P/v`) a `V_PLUGGING` (práh protiproudé brzdění vs. couvání).
- **K1:** `KeyAction[]` jako single source pro keydown + nápovědu + tlačítka (dřív 3 místa); `switch` zmizel, `PanelControls` → `KeyAction[]` + `PanelHandlers`.
- **K2:** barvy lokomotivy jednotně `THREE.Color`, přibyl `CAR_COLOR`.
- **K3:** `massOf` ve `step()` do lokální `const` (3 volání/těleso → 2).

### Diskuse fyziky (→ IDEAS, návrh)
- Omezení max rychlosti: máme výkon vs. odpory; chybí otáčkový/mechanický strop (mean piston speed, pokles tlaku páry) → IDEAS, kandidát k F3.
- **DD-11 — příčná dynamika jako 1D diagnostika, vykolejení = fail state** (Úroveň A, drží DD-02). Rozpracováno do TODO (odstředivka, převrácení, proměnná geometrie); klopení a Nadal odloženy do IDEAS.
