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

## Sezení 7 (2026-05-29)

### Příčná dynamika — poloměr oblouku & odstředivka (DD-11, krok 1)
- `Track.radius(s)` — lokální poloměr z křivosti **horizontálního průmětu** (XZ): centrální diference polohy + vzorec křivosti rovinné křivky; rovinka → `Infinity`. Izomorfní s `grade` (vertikála → gravitace, horizontála → odstředivka).
- `Train.lateralAcceleration` (getter) — `max |v²/r|` přes vozy, odvozená příčná diagnostika; nemění `s`/`v` (drží DD-02), podklad pro budoucí převrácení i kývání.
- Status panel rozšířen o příčné zrychlení (`příč X.X m/s²`).
- Numericky ověřeno: délka tratě 251.3 m = obvod kruhu r=40; radius 33–44 m kolem 40; a_lat 6.78 m/s² @15 m/s.

### Diskuse (→ IDEAS / TODO)
- **Žebřík opuštění monorailu** (Úr. 0–4) → IDEAS: kývání skříně (Úr. 1) monorail neopouští (drží DD-02); příčný DOF kola (Úr. 3, hunting) = jiný roh mřížky.
- **Kývání skříně** → TODO: roll z `v²/r` + pitch z `dv/dt` jako tlumené oscilátory v simu.

## Sezení 8 (2026-05-29)

### Esíčko + most — geometrie tratě (DD-12)
- **Trať = ležatá osmička** (Bernoulliho lemniskáta `/(1+sin²t)`, `A=B=120`, 24 bodů): laloky `r≈26 m`, střed = inflexe (`r→∞`) → esíčko (proměnný poloměr). Délka 629 m.
- **Most + podjezd**: osmička se v půdorysu kříží; profil `Y=amplitude·sin(t)` posadí jeden průchod středem nahoru (most), druhý dolů (podjezd), clearance = 2×amplitude.
- Emergentní oddělení domén: most/podjezd leží na inflexi (slack action), ostré laloky v rovině (převrácení) — izomorfní s grade/radius (S7).
- Gerono lemniskáta zamítnuta probem (špičaté laloky `r_min≈5 m` = nehratelné).
- Renderer: kamera + terén + tuba odzoomované na ~240m trať.

### Kritérium převrácení → fail state (DD-11 dotažen)
- `params.trackGauge` (1.435 m), `params.comHeight` (1.8 m); slidery v nové sekci **Příčná dynamika**.
- `Train.overturnThreshold = (gauge/2)/comHeight·g`; při `lateralAcceleration > threshold` → **vykolejení**: souprava se zastaví, celá zrudne (`DERAILED_COLOR`), čeká na `R`.
- Status: `příč X/Y m/s²` (aktuální/práh) + `VYKOLEJENO při Z m/s` (`derailSpeed`).
- Slider sklonu přemapován na výšku mostu (0–8 m).

### Reality check vykolejení
- Reportované „vykolejuje nad 3 m/s" ověřeno **věrnou node-replikou celé simulace** → vykolejení až při **12.7 m/s** (fyzika správně). Dojem vznikl tím, že fail state nuluje `v` → rychlost nárazu mizela ze statusu; opraveno `derailSpeed`. Uživatel potvrdil 12.7 m/s.

## Sezení 9 (2026-05-30)

### Kývání skříně (DD-13)
- Rotační stav na `Body` (`roll`/`pitch` + úhlové rychlosti) — **rotace nemění `s`/`v`**, drží DD-02.
- Tlumený torzní oscilátor `θ'' = ω²(θ_cíl − θ) − 2ζω·θ'`; rovnovážný úhel `θ = gain·a/(ω²·h)` (měkčí vypružení = větší výchylka i pomalejší kmit).
- Roll z příčného `v²·κ` (znaménková křivost → strana náklonu), pitch z podélného `dv/dt`.
- `Track.signedCurvature(s)` — znaménková křivost půdorysu (strana); `radius()` refaktorován na ni (DRY).
- Slidery v nové sekci **Vypružení** (frekvence Hz + tlumení ζ). Amplitudy laděny realisticky (`ROLL_GAIN=0.2`, `PITCH_GAIN=0.1`); pitch poloviční — vlaky klovou vpřed/vzad minimálně.
- Kritérium převrácení záměrně oddělené od rollu (roll = spojitá předzvěst, převrácení = tvrdá mez).

### Gradient blízkosti meze
- Žár skříně (emissive) ∝ `tipRatio = (v²/r)/práh` daného vozu; `Train.tipRatio(i)` + `lateralAccelerationOf(i)` (DRY z `lateralAcceleration`).
- Per-vůz → výstraha „cestuje" soupravou. Smoothstep náběh od ~30 % rezervy, vykolejení = plný žár.
- Pozorování (uživatel): gradient = **osciloskop slack action** — `v²·κ` zviditelní podélné kmity jen v oblouku; couvání budí odrážející se vlnu. → IDEAS.

### Tuning vykolejení
- Těžiště `comHeight` 1.8 → 1.2 m (práh 3.9 → 5.9 m/s²); esíčko rozvolněno (`A,B` 120 → 150, laloky r≈26 → 33 m). Bezpečná rychlost na laloku ~10 → ~14 m/s.

### Minimalizace panelu
- Hlavička (titulek + přepínač −/+ + živý status) oddělená od těla (slidery + nápověda + tlačítka). Klik na hlavičku sbalí tělo, telemetrie zůstane vidět.

## Sezení 10 (2026-05-30)

*Souběžné sezení z téže báze S8 (jiný stroj). Kývání skříně vzniklo nezávisle i tady — po kolizi s pushnutým S9 ponecháno S9 řešení, přeneseny jen unikátní kusy níže.*

### Klávesové ovládání kamery
- Held-key model v `Renderer` (`heldKeys` + keydown/keyup/blur), aplikace každý frame v `updateCamera(dt)`; interakce, ne stav simu (DD-01 drží). `render(train, dt)`.
- WASD posun v rovině (hýbe kamerou i cílem), QE výška, ZX dolly (zoom k cíli, min. odstup). Myší orbit beze změny.
- Regulátor přemapován **jen na šipky ↑/↓** (W/S šly kameře). Zoom na `KeyZ` (ne `KeyY`) kvůli US/programátorské klávesnici — `e.code` = fyzická pozice vedle `X`.

### F3 — palivo: uhlí + voda (DD-14)
- `params` — `coalCapacity`/`waterCapacity`/`coalRate`/`waterRate`. `Train` — stav `coal`/`water`, `consumeFuel()` (uhlí idle + dle poptávky, voda jen poptávka), gettery `coalFraction`/`waterFraction`/`steamPressure`.
- `steamPressure ∈ [0,1]` z menší zásoby (plný nad rezervou 15 %, pod ní lineárně k 0) škáluje tah v obou směrech v `applyLocomotive`. Brzda nezávisí (vzduchová). `R` doplní zásoby.
- Vlak postupně ztratí tah, dojede setrvačností, zastaví na odporech — ověřeno „Test OK". Voda dochází dřív (věrný detail), `waterRate` doladěn na 38.
- `Renderer` — loko nesvítí zeleně bez páry. `ControlPanel` — sekce **Palivo**, status `uhlí % · voda %` + flagy `DOCHÁZÍ PÁRA`/`BEZ PÁRY`.

## Sezení 11 (2026-05-30)

### Otáčkový strop rychlosti (DD-15) — uzavření tématu z S6
- `params` — `driverDiameter` (1,5 m), `maxPistonSpeed` (6,5 m/s). `Train` — konst. `PISTON_STROKE` (0,66 m), `RPM_KNEE` (0,75); gettery `vMechMax` a `tractionDerating`.
- `v_mech = maxPistonSpeed·π·D/(2·zdvih)`; tah plný do 0,75·v_mech, pak lineárně k 0 → vlak fyzicky nepřekročí mezní rychlost. Násobí tah v `applyLocomotive` (jen zrychlování; plugging limituje adheze, DD-08).
- Default → v_mech ≈ 23 m/s (~83 km/h); vlak se ustálí ~22 m/s místo ~67 (ověřeno). Větší kolo / vyšší mez = vyšší v_max („kolo je převod").
- `ControlPanel` — slidery průměr kola + mez pístové rychlosti (sekce Trakce); status flag `OTÁČKY`.
