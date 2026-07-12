# DONE — TrainsLab

Dokončené úkoly. Detaily a rozhodnutí: `docs/diary/`.

*(Sezení 1 = kick-off / koncept, bez kódu — nic k „dokončení", proto začínáme Sezením 2.)*

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

## Sezení 12 (2026-05-30)

### `%AUDIT:CODE` — úklid příčné dynamiky (0 kritických; build + `tsc` zelené, beze změny chování)
- **R1 (DRY/SLAP):** `signedCurvature` jediný primitiv křivosti; `Track.radius()` odstraněn (byl `1/|κ|`). `Train.signedLateralAccelerationOf(i) = v²·κ` jako jedno jádro příčného zrychlení — z něj `lateralAccelerationOf = abs(...)` i buzení rollu ve `step()` (dřív dvě nezávislé cesty). Žádný mrtvý kód; budoucí křivkový odpor vezme `κ` přímo.
- **R2 (efektivita):** `Track.positionAt(s)` (jen `getPointAt`, bez tečny) — `signedCurvature` ho volá 3× místo `at()`, ušetří 3× `getTangentAt` na horké cestě.
- **K1:** `tractionDerating` cachuje `vMechMax` (getter ho počítal 2× za volání).
- **K2:** opraven zastaralý příklad v komentáři `KeyAction.hint` (`'W / ↑'` → `'B / mezerník'`).
- **K3:** `Renderer` drží `train` jako field (symetrie s `track`), `render(dt)` místo `render(train, dt)`.
- **K4 (README číslování fází):** ponecháno (volba a) — `F6` = pořadí vzniku konceptu, pozice = tématická návaznost. Vědomé.

## Sezení 13 (2026-05-31)

### `%AUDIT:DOCS` + IDEAS/TODO pruning (údržbové, bez kódu)
- `%AUDIT:DOCS` (poprvé samostatně): D1 zastaralý poloměr laloků `r≈33 m` v GLOSSARY, K1–K3 drobnosti. Dokumentace v dobré kondici.
- IDEAS/TODO pruning (P1–P4): narovnání DRY mezi TODO a IDEAS — nezralé nápady mají single source v IDEAS, TODO drží jen aktivní úkoly. Oba audit prahy resetovány.

## Sezení 14 (2026-05-31)

### F3 — proměnná adheze + písek (DD-17, realizace odloženého DD-14)
- `params` — `railFactor` (stav koleje 0..1: sucho 1 → mokro/listí), `sandCapacity`/`sandRate` (písek jako spotřební zásoba).
- `Train` — `effectiveAdhesion` getter (`isSanding ? adhesionCoeff : adhesionCoeff·railFactor`), přepojen `adhesionLimit` → proměnná adheze platí pro **tah i brzdu** (jeden strop). Stav `sand`, `setSanding`/`isSanding`/`sandFraction`, spotřeba jen při pískování, `R` doplní.
- `main.ts` — `KeyAction.onRelease` + keyup/blur handler (held-key model); klávesa **P** (drž = sype).
- `ControlPanel` — slider „Stav koleje", sekce „Pískování", status `písek %` + flag `PÍSEK`.
- Ověřeno v prohlížeči: mokro (railFactor 0,3) + tah → prokluz na místě; písek → rozjezd na 4,1 m/s; zásoba klesá. Loko oranžová → zelená.

### Skid při provozní brzdě (DD-16) — dotažení izomorfismu tah ↔ brzda
- `brakeForce()` nastaví sdílený `slipping` flag, když `brakeForceMax > adhesionLimit·BRAKE_SKID_TOLERANCE` (1,1) a vlak jede (`V_SKID`). Nepřepisuje prokluz z tahu na false (jen zvedá).
- Tolerance drží plnou brzdu na suchu (180 vs 177 kN) bez falešného blikání. Indikace = oranžová loko + `PROKLUZ` (Renderer priorita slipping > brzda).
- Ověřeno: sucho NE · mokro ANO (z 8 m/s nezastaví ani za 12 s vs 5,8 s s pískem) · mokro+písek NE.

### Oprava: tlačítko „Písek" v panelu (bug)
- Tlačítka panelu volala jen `a.run` → klik na held-key akci pískování zapnul a nikdy nevypnul (sype donekonečna).
- `makeButton` dostává celou `KeyAction`; má-li `onRelease` → **press-and-hold** (pointerdown → run, pointerup/pointerleave/pointercancel → onRelease). Jednorázové akce zůstaly na click.

### UX redesign ovládání (DD-18)
- Monolitický overlay rozdělen podle role (hraní vs laboratoř): **status bar** nahoře (centr.), **dolní bar** s tlačítky řízení + ⚙ Nastavení (centr., flex-wrap, touch-friendly), **modální dialog** se slidery.
- Modal: CSS Grid `repeat(auto-fill, minmax(16rem, 1fr))` → 3 sloupce na wide, 1 na mobilu, bez media-queries. Nutný `width` (ne `max-width`) na dialogu, jinak shrink-to-fit → 1 sloupec. Zavírá OK / klik na pozadí / Esc.
- Nahradil minimalizační toggle (S9). Ověřeno na 1400×800 i 390×780, žádné page errors.

## Sezení 15 (2026-05-31)

### F4 — auto-kamera „dron" (DD-19), první kus „uspokojivého pozorování"
- `Renderer` — `DroneParams` (výška / odstup / tuhost) + `DEFAULT_DRONE`; stav dronu (`droneDir` s hysterezí, tlumené `dronePos`/`droneLook`). `toggleDrone` (snap na cíl, `controls.enabled=false`, návrat `controls.target` ← pohled dronu), `updateDroneCamera` (hystereze + `lerp` tuhostí `α=1−exp(−stiffness·dt)`), `computeDroneTarget` (přední/zadní vůz dle směru, pozice za zadním vozem proti tečně + výška, lookAt = střed soupravy + výška skříně), `applyDrone`. Přepnutí v `render()`.
- `main.ts` — sdílená `drone` instance (mimo `params`, drží DD-01), předaná rendereru i panelu; akce `C`.
- `ControlPanel` — slider zobecněn na dva zdroje (`SliderDef.source?: 'drone'`, `buildSlider` nad `Record<string, number>`), sekce „Dron (kamera)".
- **Reverz = přelet zdarma**: cíl se překlopí na druhý konec, tlumení doletí plynule (žádný zvláštní kód). lookAt = střed soupravy (volba uživatele proti návrhu „čelní vůz" — klidnější).
- Ověřeno v prohlížeči (Playwright + Edge): snap při zapnutí, sledování za rozjezdu, přelet při reverzu, návrat k orbitu bez skoku, žádné JS chyby.

## Sezení 16 (2026-05-31)

### `%CALIBRATE` — řídící dokumenty AI (poprvé za život projektu; údržbové, bez kódu)
- Založen `docs/PROMPTS.md` (projektová makra `%BEGIN`/`%END`), `docs/DESIGN_DECISIONS.md` (rejstřík DD-01…19), projektový `CLAUDE.md` (AI overlay, izomorfní s PocketStory).
- Permission cleanup v `.claude/settings.local.json`; paměti projektu povýšeny do gitu.

## Sezení 17 (2026-05-31)

### F4 — svět: lowpoly terén, párové koleje, trať na terénu, most s pilíři, stromy/kameny

- **Lowpoly terén** — nový `sim/terrain.ts`: `terrainHeight(x,z,amplitude)` z deterministického šumu
  (3 siny), amplituda vln roste se vzdáleností od středu (pod tratí mírné, na horizontu kopce HILL_H=45).
  `Renderer.buildTerrain` — `PlaneGeometry` 48×48, `toNonIndexed` + `flatShading`, barva per-facetu dle výšky.
- **Faceting** — vyšel hladký i přes flat shading; příčina = silný `HemisphereLight` (rovnoměrné světlo).
  Oprava: ambient 1.0→0.55, slunce 1.5→2.0, segmenty 80→48 → lowpoly vzhled bez změny geometrie vln.
- **Párové kolejnice + pražce** — `populateTrack`: dvě `TubeGeometry` po offset křivkách (±RAIL_GAUGE/2
  do `tangent×UP`) + pražce `InstancedMesh`. `RAIL_RADIUS` 0.3→0.12 (štíhlé). `trackMesh`→`trackGroup`.
- **DD-20 — trať vede po povrchu terénu** — `makeLoopControlPoints` počítá `Y=terrainHeight(x,z,amplitude)+
  bridgeLift(t)`. Sklony pro slack action z krajiny (emergence). `bridgeLift` = gaussovský hrb kolem `t=π/2`
  (most, clearance 8 m); `t=3π/2` zůstane na terénu (podjezd). `trackAmplitude` přemapován na amplitudu vln.
- **Mostní pilíře** (`buildPiers`) — emergentní: kde `trackY − terrainHeight > 1.2 m`, postaví svislý
  `InstancedMesh` box (scale Y = převýšení) od terénu ke kolejím. Žádná znalost „kde je most".
- **Stromy + kameny** (`buildScenery`/`addTrees`/`addRocks`) — faceted lowpoly (Cone+Cylinder / Icosahedron),
  `InstancedMesh`, deterministický `hash` rozmístění na mřížce s jitterem, jen `r∈(180,340)` (mimo trať),
  nad `y>34` kameny. Přestaví se se sliderem sklonu (`rebuildTerrain` dispose+rebuild terén i dekoraci).
- `main.ts` — amplituda předána rendereru; `onAmplitudeChange` přestaví terén + trať + dekoraci.
- Build + `tsc` zelené. Ověřeno v prohlížeči (Playwright + Edge): trať na povrchu, most s pilíři čitelný,
  faceting vidět, stromy/kameny na svazích, žádné JS chyby. Most clearance ověřena i node-výpisem (9.42 vs 1.42).

## Sezení 18 (2026-05-31)

### `%AUDIT:CODE` — úklid po DD-20/DD-18 (LOC práh; 0 funkčních bugů; build + `tsc` zelené)
- **K1:** zastaralý UI label „výška mostu" → „Sklon (vlny terénu)" + zastaralé komentáře po DD-20 (trať na terénu) a DD-18 (UX redesign).
- **D2/D3:** drobné narovnání komentářů/terminologie k aktuálnímu stavu.
- **KO1:** `grade` volán bez pozice; **KO2:** sdílená geometrie spřáhel (méně alokací).
- **KO3:** split `Renderer.ts` (567 ř., mísí kameru + svět + aktéry) → odloženo do backlogu (realizováno S25).

## Sezení 19 (2026-05-31)

### Rázy z trati — dilatační spáry + skok křivosti (DD-21, rozšíření DD-13)

Nápad uživatele (místo nabídnutých řezů F4): drsné impulsy dilatačních spár + skoková změna poloměru
křivosti. Sjednoceno do **jednoho balíku** „rázy z trati" — impulsy do existujících kývacích oscilátorů
(roll/pitch), bez nového DOF; drží DD-02 (mění jen rotaci).

- `Body.applyImpulse(roll, pitch)` — ťuk do `rollVel`/`pitchVel`; oscilátor (DD-13) kmit dotlumí.
- `params` — `railLength` (20 m, rozteč spár), `trackImpulse` (0,012; master síla rázů, 0 = ideální trať).
- `trackData` — `TRACK_PERTURBATIONS` (4 skoky křivosti + 2 výhybky jako zlomky délky → přežijí rebuild);
  κ-skok řešen **fenomenologicky** (A4 b) na nábězích laloků, ne přepisem geometrie lemniskáty.
- `Train` — `crossed()` (floor-trik na nezabaleném `s`: spáry `period=railLength`, perturbace `period=délka`;
  jeden test pro oba), `JOINT_WEIGHT` (0,4), `applyTrackImpulses(sBefore)` (spáry → pitch se střídavou
  paritou = klikot, perturbace → roll ve směru oblouku `sign(κ)` + pitch), `pointImpulseFired` flag.
- `AudioView` (dostal `params`) — tikot spár (self-timed `railLength/v`, jako chuff), skřípění oblouku
  (`LevelVoice`, gain ∝ `lateralAcceleration`), clunk výhybky z flagu.
- `ControlPanel` — slidery „Rozteč spár" + „Síla rázů (kvalita trati)" (sekce Trať). `main.ts` — `AudioView(train, params)`.
- Emergence: per-vůz `s` → klikot i trh proběhnou soupravou jako vlna (homomorfně se slack action).
- `tsc` + build zelené. Ověřeno uživatelem v prohlížeči: **„Působí to věrně."**

## Sezení 20 (2026-05-31)

### Doladění rázů z trati — rozštěp typů, kvalita přechodnic, zvuk (dotažení DD-21)

- **`PerturbationKind = 'transition' | 'switch'`** (`trackData.ts`) — bodové perturbace dostaly typ;
  skok křivosti (chybějící přechodnice) vs. výhybka/křížení jsou teď fyzikálně rozlišené.
- **`transitionQuality ∈ [0,1]`** (`params.ts`, default 0,3) — „kvalita přechodnic": tlumí roll-trh
  jen u `transition` faktorem `(1−quality)` (1 = dokonalá klotoida → 0 trh); spáry/výhybky nezávislé.
  Realizováno jako **spojitý slider** (volba uživatele místo toggle ze zadání) — izomorfní s Lab knoby.
- **Zvuk rozštěpen** (`AudioView.ts`) — `pointImpulseFired` → dva flagy: `switchFired` → clunk (beze
  změny), `transitionJerkFired` → nový `playArcJerk` (krátké skřípnutí se sklouznutím frekvence dolů,
  příbuzné trvalému skřípění oblouku). Odlišuje boční trh od tupého kovového nárazu výhybky.
- **Pozice ověřeny objektivně** — jednorázová diagnostika profilu `signedCurvature(s)` ukázala, že
  `u=0.25/0.75` jsou **střed křížení** osmičky (κ≈0), ne „vrchol laloku" (omyl komentářů S19); `transition`
  na `u=0.10/0.40/0.60/0.90` sedí na strmých úsecích κ. Pozice ponechány, opravena sémantika komentářů.
- `Train.ts` — větvení dle `kind` v `applyTrackImpulses` (`scale≤0` přeskočí ráz i jeho zvuk).
  `ControlPanel.ts` — slider „Přechodnice (kvalita oblouků)". `tsc` + build zelené; smoke test bez JS chyb.

## Sezení 21 (2026-05-31)

### Příprava sample vrstvy `AudioView` (bez kódu)
- Manifest **8 zvuků 1:1 s hlasy** `AudioView` (one-shot vs. seamless loop) — délky, charakter, licence do `IDEAS.md`.
- Volba knihoven (Pixabay / Freesound CC0; vyhnout se BBC RemArc, NC, Zapsplat). Fallback = **hybrid** (sample → padni na procedurální).
- Soubory shání uživatel (Freesound vyžaduje login).

## Sezení 22 (2026-06-01)

*Přechod na nový stroj (mrkla) — kontinuita ověřena: `git pull` natáhl S13–S21 (fast-forward, čistá historie), `tsc` zelený i na mrkla, `public/audio/` chybí dle stavu S21. Stale „Příště" (modely vozů, 5 sezení) → DO.*

### Modely vozů — lowpoly skříně + kola + hnací spojnice (DD-22)

- **Nový `view/carModels.ts`** — faceted lowpoly factory `buildCarModel(type, length)` → `CarVisual`.
  Typy `CarType`: `loco` (kotel/kabina/komín/dóm), `tank` (cisterna), `boxcar` (krytý), `flatcar`
  (plošinový „plato" — pro techniku), `gondola` (otevřený). `skin` materiál nese stavové tintování,
  doplňky fixní tmavá ocel. `CAR_WIDTH/CAR_HEIGHT` přesunuty sem (single source), `CAR_COLOR` smazán.
- **Souprava 6 těles** (`main.ts`): `['loco','tank','boxcar','flatcar','gondola','gondola']`, délky `[8,7,6,6,7,7]`.
  `carTypes` jdou do Rendereru paralelně s `carLengths` (view metadata 1:1 s tělesy, DD-22).
- **`Renderer.ts`** — `carMeshes: Mesh[]` → `carVisuals: CarVisual[]`; render loop operuje na `group`
  (position/lookAt/pitch/roll beze změny), barvu/žár cpe do `skin`. Konstruktor dostal `carTypes`.
- **Kola s valením** — `rotation.x` ∝ `−body.s / wheelRadius` (per vůz), kontrastní příčka pro viditelnost.
  `wheelDir` per vůz (loko `+1`, vagony `−1`) srovnává směr otáčení (loko je Y-flipnuté, viz níže).
- **Hnací spojnice loko („páky")** — tyč podél Z vně kol; čep kliky (`CRANK_RADIUS`) obíhá střed kola →
  tyč krouží v Y-Z (`rod.position` z `sin/cos(−phase)`, záporná fáze ladí směr s koly).
- **Animace prokluzu** (`driverSlipPhase`, `SLIP_SPIN_RATE` 26 rad/s) — při `train.slipping` hnací kola
  loko „závodí" navíc → viditelně se protáčejí a spojnice víří. View-only stav (sim dává jen bool), DD-01.
- **Iterace dle feedbacku:** loko otočeno o 180° (vnitřní `model` skupina) — přída po směru jízdy;
  skříně zvednuty nad kola (`bodyGroup` posun o poloměr kola) — kola nejsou „utopená"; směr spojnice
  i vagonových kol opraven. `tsc` + build zelené. Uživatel: **„Prokluzy parádní!"**, „Test OK".

## Sezení 23 (2026-06-01)

### Propracovaný kouř + sdílený rytmus výfuku (DD-23) + start hybrid sample vrstvy
- **`view/SmokeView.ts`** — pool faceted obláčků (ikosaedry, flatShading) emitovaných z ústí komína loko.
  Žijí ve **world-space** → jak loko ujede, kouř visí a vzniká **vlečka emergentně** (bez skriptu). Hustota/
  velikost/**tmavost** ∝ `throttleFraction·steamPressure` (uhlíkový kouř ↔ světlá pára), idle obláčky při notch 0.
- **`view/ExhaustClock.ts` (DD-23)** — sdílený fyzikální rytmus výfuku (4 pufy/otáčku kola, `v/(π·D)`), jediný
  zdroj pro zvukový chuff i puf kouře (`main` posouvá fázi, view čtou `fired`). Nahradil fenomenologický
  `0.9/(v+0.4)` → věrný zrychlující se „čch… čch…". Emisní bod přes `chimneyTip` marker (`getWorldPosition`).
- **Hybrid sample vrstva (realizace S21)** — uprostřed sezení dorazil první sample (`steam_chuff.wav`):
  `loadSample` (`fetch` přes `BASE_URL` + `decodeAudioData`, chyba → fallback) + `playSample`; `playChuff`
  dostal hybrid větev (sample má přednost, jinak procedurální). `vite-env.d.ts` (typy `import.meta.env`).
- `Train.throttleFraction` getter (single source otevření regulátoru). `tsc` + build zelené, sample se kopíruje do `dist/`.

## Sezení 24 (2026-06-01)

### Sample vrstva — únik páry, houkačka, brzdy (4 z 8 zvuků)
- **Tři tvary „voice" pro tři chování samplu** (izomorfní s procedurálními `SustainVoice`/`LevelVoice`):
  - **`makeSampleLoop`** — únik páry (`steam_leak.wav`): loop běžící pořád, slyšitelný dokud `steamPressure > 0`.
  - **`playSample`** (one-shot) — houkačka (`horn_on.wav`): nová akce `KeyH`, tlačítko vzniklo z pole `actions`. Bez fallbacku.
  - **`makeRandomizedLoop`** — brzdy (`brakes_on.wav`): loop s **přelosovanými hranicemi** po každém průchodu
    (šev se neozývá periodicky), `playbackRate ∝ rychlost` (`RateVoice`), aktivní jen za jízdy (stojící vlak tichý).
- Skřípění brzd: sample → 3-frekvenční synteticky → sample s **fallbackem** (`makeSquealVoice` = 3 neharmonické frekvence s jitterem).
- `tsc` + build zelené. Uživatel: **„Super! Mám to!"**

## Sezení 25 (2026-06-01)

### `%AUDIT:CODE` — split Renderer + AudioView, DRY, cleanup (0 kritických; `tsc` + build zelené)
- **D2 (KO3 z S18):** nový `view/CameraController.ts` — veškeré řízení kamery (orbit/dron/WASD +
  key-listenery + `setAspect`) vytaženo z `Renderer.ts` (544 → ~390 ř.). Renderer deleguje. `DroneParams`/
  `DEFAULT_DRONE` přesunuty tam (importy opraveny v `main.ts`, `ControlPanel.ts`).
- **D3:** nový `view/proceduralAudio.ts` — procedurální generátory (slip/squeal/arc/metalHit/chuff-burst/
  arc-jerk + `SustainVoice`/`LevelVoice`) jako čisté funkce nad `ctx`+`dest`. AudioView (388 → ~270 ř.)
  drží orchestraci + hybrid + sample tvary.
- **D1 (DRY):** `consumeFuel` i `applyLocomotive` přepojeny na getter `throttleFraction` (single source).
- **K1:** zrušeny zbytečné `export` (`CAR_WIDTH` + lživý komentář, `TERRAIN_FLAT_R/HILL_R/HILL_H`).
- **K2:** `driverSlipPhase` přesunuto z bloku dronu (patří k animaci kol).
- **K3:** per-frame alokace pryč (`lookTarget` buffer + instanční dron buffery).
- **K4** (memoizace `lateralAcceleration`) **zamítnuta** — cache v simu proti KISS, výkon irelevantní. → IDEAS.

### Doladění zvuku/kouře + těžiště (živý test)
- **Bug fix:** chuff i puf kouře jen `steamPressure > 0` (dřív falešně zněly při dojezdu bez páry s otevřeným regulátorem).
- **Chuff-kulomet vyřešen:** `ExhaustClock` stropuje rychlost na `CHUFF_FUSE_SPEED = 7,4 m/s` (sdílený clock → zvuk i kouř).
- **Idle kouř na palivu:** `SmokeView.update(…, fireLit)` — idle větev jen při `coalFraction > 0` (vyhaslý kotel nekouří; bez vody kouří dál bez páry).
- **Brzdový zvuk „vrtačka" opraven:** `playbackRate` přemapován lineárně 0 → `BRAKE_FUSE_SPEED = 3,8 m/s`, strop, rate ∈ [0,5; 1,15].
- **Nižší těžiště:** `comHeight` 1,2 → 0,9 m → práh převrácení 5,87 → 7,82 m/s² (méně náchylné k vykolejení).
- **Dodatek — klapot spár ze samplu (5/8 hlasů):** `clattering_wheels.wav` napojen jako rail-tick přes nový `makeRateLoop` (loop + `playbackRate ∝ rychlost`, `RAIL_REF_SPEED=12`, clamp [0,4; 2,0]); self-timed procedurální tikot zůstává fallback. Hlasitosti ×2 (klapot 1,2, brzdy 1,6).

### Diskuse (bez kódu)
- Brzdný model oponován a **ponechán**: Coulombovo tření = konstantní síla → lineární `v(t)` je správně
  (brzdná dráha ∝ v² to potvrzuje). Volby `μ(v)` / Davisův `B·v` → IDEAS.

## Sezení 26 (2026-06-01)

### μ(v) brzdy + Davisův `B·v` člen odporu (oba „Příště" S25; `tsc` + build zelené, „Test OK")
- **μ(v) brzdy** — `Train.brakeFadeFactor = (1−fade) + fade/(1+k·|v|)` škáluje brzdnou sílu (litinový
  špalík, tření klesá s rychlostí). `f(0)=1` (Coulombův základ S25 beze změny), `f(∞)=1−fade` (asymptota),
  `brakeFade=0` = konstantní. `BRAKE_FADE_RATE=0,1` (půl-pokles ~10 m/s). Default `0,4`. Skid-check proti
  faded síle (nižší μ → menší síla → méně náchylné k zablokování kol). → konkávní zpomalení („pocit" z S25).
- **Davisův `B·v`** — `Body.beginStep` rozšířen o lineární člen `−davisB·v` vedle kvadratického dragu.
  Davisova rovnice `R=A+B·v+C·v²` teď v modelu kompletní (A valivý, B·v ložiska, C·v² vzduch). Default `20` N·s/m.
- `params.ts` (`davisB`, `brakeFade`), `ControlPanel.ts` (slidery „Lineární odpor (B·v)" + „Pokles tření brzdy s v").
- **Žádné nové DD** — laditelné členy odporu (jako drag/Crr), ne architekturní rozhodnutí.

### `%AUDIT:DOCS` (první od S13; uživatel „opravit vše")
- **D1:** `DONE.md` doplněn o chybějící S16/S18/S21 (údržbová) + **S23/S24 (s kódem)** — skok S22→S25.
- **D2:** README „čtyřmi vagony" → „pěti" (souprava 6 těles od S22). **D3:** odstraněn hotový „Split `Renderer.ts`" z TODO backlogu (S25).
- **K1:** DD-21 přeřazen do pořadí v `DESIGN_DECISIONS`. **K2:** README strom doplněn o `carModels.ts`. **K3:** README zastaralý hedge u F1 odstraněn.

## Sezení 27 (2026-06-01)

### Kompletace zvukových samplů (8 z 8 manifestu) + odstranění procedurální vrstvy
- **5 nových hlasů ze samplů** (uživatel dodal soubory): `clank`, `clunk`, `arc_jerk` (one-shoty,
  vzor jako `chuffSample`), `arc_squeal` (loop řízený úrovní — nový `makeSampleLevelLoop`, izomorfní
  s `makeSampleLoop`), `steam_slip` (prokluz, loop on/off). Tím **8 z 8** manifestu + bonusy (únik páry, houkačka).
- **Audio čistě sample-based** — hybrid (sample → fallback procedurální) byl od S23 most, dokud nebyly
  všechny samply. Set kompletní → smazán **`view/proceduralAudio.ts`** (166 ř., všechny generátory),
  všechny fallback větve v `AudioView`, self-timed `updateRailJoints`/`playRailTick`. Interfacy
  `SustainVoice`/`LevelVoice` přesunuty do `AudioView.ts` (jediný uživatel). `update(train)` bez `dt`
  (jediný uživatel byl odstraněný `updateRailJoints`) → upraveno volání v `main.ts`. **Trade-off:**
  chybí-li sample → hlas mlčí (žádný procedurální záskok) — vědomě přijato.
- **Brzdy zprovozněny** — odhalen překlep `breaks_on.wav` vs. kód `brakes_on.wav`: sample se nikdy
  nenačetl, padalo na procedurální squeal (= dlouhodobé „zní divně"). Soubor přejmenován, `.old` smazán.
  Po zprovoznění slyšet ~2s perioda smyčky → **randomizace hranic** (`makeRandomizedLoop` vrácen z gitu);
  `playbackRate` cap zpomalen (`BRAKE_RATE_MIN/MAX` 0,25/0,6) kvůli rychlému („cikáda") samplu.
- **Nárazníky na 1/3** — `updateCouplers` buff → `playClunk(volume / 3)`; výhybka (`switchFired`) hlasitější.
- **Žádné nové DD** (dokončení sample vrstvy + úklid; hybrid nikdy neměl DD číslo). `tsc` + build zelené.

## Sezení 28 (2026-06-01)

### `%CALIBRATE` — meta-audit řídících docs/procesu (2. za život projektu; bez kódu)
- **A1 (kritické):** `%CALIBRATE` neměl globální definici (jen ve skillu PocketStory) → povýšen do
  globálního `~/.claude/PROMPTS.md` (DRY, používán ve 3 projektech) + přidán do tabulky maker v `~/.claude/CLAUDE.md`.
- **A2 (kritické):** cadence prahy nikde zapsané (`%BEGIN` je odhadoval z diářů) → explicitní **prahy + ledger**
  v `docs/PROMPTS.md` (CODE ≥6 sez./+250 LOC, DOCS/pruning ≥12, CALIBRATE ≥15), opraven rozbitý ukazatel kroku 3.
- **A4:** Key Files / rejstřík DD / GLOSSARY ověřeny aktuální. **A5:** `CONTEXT.md` nezaváděn (KISS, diár+git stačí).
- Změny mimo repo (`~/.claude/*`) + `docs/PROMPTS.md`. Bez kódu (`src/` netknuto).

## Sezení 29 (2026-06-01)

### Křivkový odpor v obloucích (backlog; `tsc` + build zelené, „Test OK")
- **Model** — `R = −sign(v)·curveResistance·|κ|·m·g`: tření okolků + prokluz kol na pevné nápravě v zatáčce.
  Specifický odpor `curveResistance·|κ|` (bezrozm., jako Crr) úměrný křivosti — **Röcklův charakter** `c/r`
  (ověřeno rešerší: curve resistance je rychlostně nezávislý, empirický Röckl `500/(r−30)` pro velká `r`
  ≈ `c/r`). `κ` konečné → bez exploze u našich ostrých laloků (`r≈33 m`, kde Röckl selhává). Jen `sign(v)`
  pro směr (rychlostně nezávislý), na rovince `κ=0` → mizí.
- **`Body.beginStep`** rozšířen o `fCurve` jako **druhý geometrický** člen vedle gravitace (oba z polohy `s`
  na trati); komentář rozdělen na **geometrické** (gravitace + oblouk) vs. **rychlostní** (Davisovy B·v, C·v²).
  Body si čte `track.signedCurvature(s)` (jako už čte `grade(s)`). Doplnil `R=A+B·v+C·v²` o zatáčkový člen.
- **Drží DD-02** — `κ` zůstává skalár, výstup je podélná síla (mění `v` podél `s`), žádný příčný DOF.
- `params.ts` (`curveResistance` + default `0,15` m: ~2× valivý v laloku). `ControlPanel.ts` (slider
  „Odpor v oblouku" 0..1 m v Odporech, za `B·v`). `GLOSSARY` (termín „odpor v oblouku").
- **Žádné nové DD** — laditelný člen odporu (jako Davisův `B·v` S26), ne architekturní rozhodnutí.

## Sezení 30 (2026-06-01)

### Rotační setrvačnost hmot — rotating mass factor (backlog; `tsc` + build zelené, „Test OK")
- **Model `m_eff = m·(1+λ)`** — rotující kola/náprav/ojnic přidají k translační setrvačnosti. Rešerší
  (Metro Train Simulation, GE Locomotive Application Guide) ověřeno: **rychlostně i výkonově nezávislé**,
  celý vlak ~6–8 % tara, samotná loko ~10 % (GE ~9,8 %). Přesný `m_eff = m_static + I·(převod/r)²`
  zjednodušen na branžový tvar `m·(1+λ)` (`λ` laditelný knob).
- **Jen převod síla→zrychlení, ne síly** — `Body.integrate(h, mass, rotatingFactor=0)`: `accel =
  force/(mass·(1+λ))`. Síly (gravitace, Davis, oblouk, adheze `μ·N`, trakce) drží **skutečné `m`** přes
  `massOf`. `m_eff` vzorec žije v `Body` (jediné místo); `accel` pro pitch zůstává korektní (`F/m_eff`).
- **Per-vůz `λ`** (izomorfní s `massOf`) — `Train.rotatingFactorOf(i)`: loko `rotatingMassFactorLoco`
  (0,15 — hnací kola + ojnice) / vůz `rotatingMassFactorCar` (0,06 — valivá kola/nápravy).
- `params.ts` (2 parametry + defaulty + komentář k modelu). `Body.ts` (`integrate` + `m_eff`). `Train.ts`
  (getter + předání). `ControlPanel.ts` (2 slidery „Rotující hmota (loko/vagon)" 0..0,4 v Hmotnostech).
- **Drží DD-02** (skalár, žádný DOF). **Žádné nové DD** (laditelný setrvačný člen jako `davisB`/`curveResistance`).

## Sezení 31 (2026-06-02)

### Ztlumení clunk + `%AUDIT:CODE` (6. audit, 0 kritických, „opravit vše"; `tsc` + build zelené, „Test OK")
- **Ztlumení clunk.wav** — celý sample na 1/3 (`CLUNK_GAIN = 1.1/3` v `playClunk`, volba uživatele „celý
  sample"); nárazník spadl na ~1/9 (relativní /3 × globální /3), výhybka zůstává hlasitější.
- **`%AUDIT:CODE`** — přečten celý `src/` (16 souborů); fyzikální vrstvy od S25 ověřeny izomorfní. Nálezy → vše opraveno:
  - **K1:** `playClunk` magic `1.1/3` → pojmenovaná konstanta `CLUNK_GAIN`.
  - **K2:** sjednoceno pořadí cross-productu pro příčnou osu kolejnic na `crossVectors(UP, tan)` (= pražce/pilíře); kosmetické (offset symetrický, `right`→`side`).
  - **D2:** doc drift po dnešní změně clunk — `GLOSSARY` přepsán (globální `CLUNK_GAIN` + relativní /3 nárazníku).
  - **D1 (split, KO3 z S18):** vytažen **`view/WorldView.ts`** (statická scéna: terén + dekorace + trať/pilíře, `rebuild`, export `RAIL_RADIUS`); `Renderer.ts` 436 → ~210 ř., řeší jen aktéry (vozy/spřáhla/kouř) + kameru + loop. `main.ts`: `rebuildTerrain`+`rebuildTrack` → `rebuildWorld`. SLAP jako S25 (CameraController/AudioView), drží DD-01.
- Docs: GLOSSARY (clunk + termín WorldView), README (strom view), CLAUDE.md (Key Files), `docs/PROMPTS.md` (cadence ledger CODE → S31). **21 modulů** (+1 WorldView). **Žádné nové DD** (split = aplikace SLAP).

## Sezení 32 (2026-06-02)

### F4 dotažení — mlha + mostovka (view-only; `tsc` + build zelené)
- **Mlha na horizontu** — `Renderer.scene.fog = THREE.Fog(0xccd6dd, 130, 340)`, bělavý opar (volba uživatele).
  Fog ∝ vzdálenost od kamery → souprava ostrá, okraj terénní desky (±350 m) vybledne. Atmosféra scény = Renderer.
- **Mostovka** — `WorldView.buildDeck`: souvislý betonový nosník pod kolejí v úsecích vyvýšení (plná deska,
  volba uživatele). Box-segmenty `InstancedMesh` (`DECK_SPACING=2 m`, ×1.4 překryv → souvislé i v oblouku),
  sleduje sklon koleje, `DECK_DROP=0.35 m` pod pražce.
- **DRY refaktor** — detekce vyvýšení trati vytažena z `buildPiers` do sdíleného `elevatedSamples(amplitude,
  spacing)` (body+tangenty+výšky); pilíře řidší vzorkování, mostovka hustší. Emergence drží (žádná znalost „kde je most").

### Markery napětí spřáhel → toggle (čistá scéna)
- `Renderer` — flag `couplerMarkersVisible` (default skryté), `setCouplerMarkersVisible(v)` (+ skip
  `renderCouplers` když skryté). `buildCouplers` staví skryté.
- `ControlPanel` — nová sekce **„Zobrazení"** v Nastavení + helper `buildCheckbox` (boolean přepínač mimo
  params, izomorfní s `buildSlider`); `PanelHandlers.onCouplerMarkers`. `main.ts` — handler.
- Oponováno smazání: koule = osciloskop slack action (F1 ★) → kompromis toggle (volba uživatele).

### Dron: chase → orbit kolem lokomotivy
- `CameraController` — `updateDroneCamera`/`computeDroneTarget` přepsány: orbit kolem **lokomotivy**
  (`bodies[0]`, `lookAt` loko), azimut `orbitAngle += orbitSpeed·dt`, poloměr `distance` + výška, tlumené
  dohánění (`stiffness`). **Odpadla** hystereze směru (`droneDir`/`V_DRONE_DIR`) i reverz-přelet (orbit
  nezávislý na směru jízdy).
- **Zoom v dronu** — `Z`/`X` i **kolečko myši** → poloměr kroužení jednou cestou `adjustOrbitRadius(delta)`
  (DRY); ruční zoom ponechán na `OrbitControls`. `wheel` listener se v ručním režimu hned vrací.
- `DroneParams` + `orbitSpeed` (default 0,3 rad/s); slidery „Poloměr kroužení" / „Rychlost kroužení" + výška/tuhost.
- **DD-19 drží** (rozhodnutí = `DroneParams` ve view, ne chování); aktualizován GLOSSARY termín „dron".

### Bug fix — prokluz kol se točil obráceně
- Valecí fáze jde jako `-body.s/r` (vpřed = klesá), slip přírůstek byl při `notch≥0` kladný → kola se při
  prokluzu protáčela dozadu. Prokluz = obvodová rychlost kol > rychlost vlaku (kola hrabou vpřed). Oprava:
  `dir = notch≥0 ? -1 : 1` (slip ve směru valení). Promítne se i do hnacích spojnic (sdílí `phase`).

## Sezení 35 (2026-06-02)

### Volný vagon + kontaktní srážky (DD-24)
- `Train.freeBodies` — volná nespřažená tělesa mimo couplerový řetězec, projedou týž integrátor (bez trakce/brzdy).
- `applyContacts` — jednostranná buff pružina (jen tlak) mezi konci soupravy ↔ volné vozy + volné navzájem; bez spřažení.
- Mez energie srážky `½·m_red·v_close²` (kJ) → vykolejení; slider „Mez srážky" (default 500 kJ), `derail(reason, speed)`.
- Diagnostika `derailReason` (collision/overturn) + rychlost ve statusu; derail zastaví soupravu i volné vozy.
- `boxcar` jako odstavený vagon na protilehlé straně smyčky (`main.ts`).

### Asymetrická + vlnitější trať
- Asymetrická osmička: izotropní stretch `(1+E·(1+cos t)/2)`, pravý lalok větší, levý beze změny (E=0.5).
- Min poloměr **změřen** `tools/check-radius.ts` (kalkulačka poloměru/sklonu/clearance) — ≈52 m při count 96.
- Hustota kontrolních bodů 24→96 (Catmull-Rom přestane podstřelovat zvlněný terén — kolej už nezapadá pod zem).
- Vlnitější trať: `trackAmplitude` 4→8, slider strop 8→16.

### Distanční zvuk + scenérie + mlha
- Distanční hlasitost `AudioView` (inverse-distance, plno do 30 m, ticho u 320 m), `Renderer.cameraDistance` (DD-01).
- Scenérie: clearance od osy trati (`nearTrack`) místo radiální zóny → vlak neprojíždí dekorací, roste i uprostřed osmičky.
- Lesy: `forestDensity` (nízkofrekvenční pole) moduluje hustotu → shluky stromů. `SCENERY_STEP` 22→18.
- Mlha dohlednost 2× (260/680).

### Výhybky — fáze 1: graf segmentů (DD-25)
- `TrackSegment` (okno nad master křivkou, spojitá křivost přes hranice) + `TrackNetwork` (graf, `next`/`prev`, `advance`, `globalS`/`gap`).
- `Body` → `(seg, s)`; spřáhla, kontakty, rázy z trati i valení kol přepočítány na `globalS`/`gap`.
- Osmička = 2 segmenty (deterministická smyčka) → chování identické; `Track.ts` smazán (nahradil `TrackSegment`).
- Renderer/WorldView/CameraController/AudioView na `network`; WorldView kreslí per master křivku. Ověřeno „sedí to".

## Sezení 36 (2026-06-02)

### Výhybky — infrastruktura větvení (graf s volbou trasy)
- `TrackNetwork.next`/`prev` z `number[]` na `number[][]` (seznam možností; jeden = napojení, víc = výhybka).
- `advance(loc, choose)` — `choose` vybírá pokračování (default `[0]` = hlavní smyčka / deterministická souprava).
- `TrackSegment.wrapU` respektuje `curve.closed` (uzavřená osmička wrap, otevřená větev clamp — jinak degenerace).
- `totalLength` = délka hlavní jízdní smyčky (cyklus `next[0]`), ne součet všech segmentů (jinak `gap` wrapuje špatně).
- *(Geometrie kolejiště v S36 vrácena — viz diář; vyřešena až S37.)*

## Sezení 37 (2026-06-03)

### Výhybky — fáze 2: geometrie odbočky (θ-graf, spojitá omezená κ, DD-26)
- Odbočka (3. hrana θ-grafu) jako **boční offset** hlavní trati: `δ(s)=BRANCH_OFFSET·sin⁴(π·t)` podél `[SWITCH_U=0.713, MERGE_U=0.86]`.
- Profil **sin⁴** → `δ=δ'=δ''=0` na koncích (C² napojení: poloha+tečna+křivost), `δ≥0` → konstrukčně nekříží hlavní trať.
- **Spojitá, shora omezená κ** (max|κ|≈0,022 → r≈47 m; max skok Δκ 0,006 vs. dog-bone 0,017 naráz) — poučení uživatele.
- Topologie: 5 segmentů, **2 výhybkové uzly** (`next/prev` s volbou), 3 hrany; `totalLength` = lemniskáta (odbočka mimo cyklus).
- `WorldView.buildCurveRails` respektuje `curve.closed` (otevřená větev se nezauzlí).
- Volný vagon dočasně deterministický (`randomBranch` odebrán — bez jízdy po grafu by vjel na konec a spadl).
- Nástroje: `tools/check-{switch,connector,merge,network}.ts` — geometrie měřena před kódem (souběh, dosednutí, spojitost κ, nekřížení).

## Sezení 38 (2026-06-11)

### `%AUDIT:CODE` — síť, diagnostika a životní cyklus view
- Volné vozy vstupují do příčné diagnostiky i kritéria převrácení; vykolejení nese správného viníka a rychlost.
- `TrackNetwork` validuje topologii a explicitně odmítá nejednoznačné route souřadnice na větvích; křivost se vzorkuje přes hranice segmentů.
- Otevřené segmenty používají jednostranné diference; skrytě prodloužená řídicí křivka spojky drží spojitou křivost i na koncích.
- `WorldView` při rebuildu rekurzivně uvolňuje geometrie i materiály; klávesové jednorázové akce ignorují autorepeat.
- Polohy výhybkových rázů odpovídají skutečným křížením asymetrické osmičky (`u≈0.2966/0.7033`).
- Diagnostické skripty sjednoceny pod `npm run check`; přidány testy sítě, spojky, převrácení volného vozu a pískování.

### Účinnější pískování
- Nový Lab parametr `sandAdhesionBoost` násobí suchou adhezi; default 1,20 dává μ=0,36 a při plném výkonu odstraní prokluz.
- Stejný efektivní adhezní limit platí pro tah i brzdu; UI obsahuje slider účinnosti písku.

### Realistický kouř a parní úniky
- `SmokeView` nahrazen `SteamView` s 320 měkkými sprite částicemi, procedurální texturou, turbulencí, vztlakem, růstem a vyhasínáním.
- Emitory jsou součástí modelu lokomotivy: komín, odvodňovací kohouty válců, rozvod a píšťala.
- Píšťala vypouští páru synchronně se zvukem; pojistné ventily záměrně chybí, dokud sim nemodeluje dynamický tlak kotle.
- DD-23 rozšířeno, bez nového DD.

## Sezení 39 (2026-06-12)

### Nezávislý `%AUDIT:CODE` — opravy přehlédnutých hran
- Per-frame `switchFired` / `transitionJerkFired` se čistí i po vykolejení; odstraněno
  nekonečné opakování posledního clunku/skřípnutí. Přidán regresní scénář.
- `TrackNetwork` validuje reciproční `next`/`prev`, výsledek `advance(choose)` i guard
  proti zacyklení; testy pokrývají nereciproční graf a neplatnou volbu.
- `AudioView.makeRandomizedLoop` plánuje změnu hranic podle aktuálního `playbackRate`.
- `npm run check` je součást deploy CI; odstraněno mrtvé API.
- Terminologie sjednocena na parní píšťalu (`playWhistle`); historický asset zůstává
  `horn_on.wav`.

### Proměnný vítr pro kouř a páru
- `WindParams` ve view: síla, proměnlivost směru, doba změny; default 4 m/s, 70°, 8 s.
- Náhodný cílový vítr plynule mění směr i sílu; `0 m/s` = bezvětří.
- Pára se větru poddá rychleji než hutnější kouř; sim vlaku zůstává beze změny (DD-01).
- Nová sekce Vítr v Nastavení. `npm run check`, TypeScript, build i živý test zelené.

## Sezení 40 (2026-06-12)

### Upgrade Vite 5 → 8

- Vite `5.4.21` nahrazen Vite `8.0.16`; lockfile přešel z Rollupu na Rolldown.
- Explicitní požadavek Node.js `^20.19.0 || >=22.12.0` v `package.json` a README;
  lokální Node 22.21 i GitHub Actions Node 22 vyhovují.
- `npm ci`, `npm run check`, `npm run build` a `npm audit` zelené; audit hlásí
  0 zranitelností.
- Lokální Vite 8 dev server ověřen přes HTTP 200 na `127.0.0.1:5173`.
- Existující bundle má přibližně 560 kB a Vite 8 na něj nově upozorňuje; code-splitting
  nebyl míchán do samostatného toolchain upgradu.

## Sezení 41 (2026-06-20)

### Výhybky — fáze 3: route-aware průjezd soupravy

- `TrackNetwork` má explicitní `routes` (`main`, `branch`), route-aware `routeLength`,
  `routeChoice`, `globalS` a `gap`; validace kontroluje návaznost tras.
- `Body` nese `route`; `Train` drží `currentRoute`, `setRoute` a `routeCanChange`.
- Souprava projede hlavní smyčku i odbočku podle hráčské volby; volné vozy zatím
  zůstávají na main.
- Route lock brání přestavení uprostřed výhybkového uzlu nebo na exkluzivní větvi.
- UI: klávesy/tlačítka `1` / `2`, status `Trasa ...` a `VÝHYBKA ZÁMEK`.
- `WorldView` kreslí výměnové terče a `Renderer` je aktualizuje podle route/locku.

### Rázy na odbočce

- `TRACK_PERTURBATIONS` nahrazeno route-aware helperem `trackPerturbationsFor(network, route)`.
- Hlavní route zachovává historické body; odbočka překládá sdílené perturbace do své délky
  a přidává výhybkové clunky na rozbočení i sloučení.
- Spojka sama nemá transition rázy, protože její C² profil je navržený bez skoku křivosti.
- `tools/check-train.ts` ověřuje `switchFired` při průjezdu oběma branch uzly.

### `%AUDIT:CODE` — výhybkové rázy a volná tělesa

- Hlavní i odbočná route teď dostávají skutečné výhybkové clunky na rozbočení/sloučení;
  dřív byly fyzické uzly slyšet jen v branch testech.
- Rázy z trati se aplikují i na `freeBodies`, nejen na spřaženou soupravu.
- `tools/check-train.ts` pokrývá main/branch výhybkové rázy, rázy volných vozů a
  plnou šestivozovou branch soupravu bez vykolejení.

### Audio bug fix — tvrdý mute

- `AudioView.toggleMute` teď vypíná všechny kontinuální hlasy tvrdě, nejen přes master gain fade.
- One-shoty (`chuff`, píšťala, clank/clunk, transition jerk) se při mute vůbec nespouští.
- Coupler režimy se při mute synchronizují, aby po unmute nevyskočil starý clank.

### Domek s napaječkou — view-only řez

- `WorldView` staví u odbočné spojky lowpoly servisní místo: boudu, vodní jeřáb
  s ramenem nad kolejí a hromadu uhlí.
- Umístění je vázané na segment spojky a přepočítává výšku z `terrainHeight`, takže
  po změně sklonu sedí na terénu. Bouda a uhlí jsou mimo průjezdný profil, jeřáb je
  blíž ke koleji.

### Domek s napaječkou — auto-doplnění zásob

- `sim/serviceSite.ts` je single source pro polohu servisního bodu na branch trase;
  stejnou polohu používá `WorldView` i `Train`.
- `Train` postupně doplňuje uhlí, vodu a písek jen tehdy, když lokomotiva stojí u vodního
  jeřábu na odbočce. Průjezd kolem jeřábu nedoplňuje.
- UI status ukazuje `DOPLŇUJE`; `tools/check-train.ts` má regresi pro stojící i
  projíždějící lokomotivu.

### Dokumentace a nové otevřené úkoly

- README, GLOSSARY a `docs/DESIGN_DECISIONS.md` aktualizovány na route-aware stav.
- `TODO.md` zůstává open-only; přibyl úkol **UI pro odpojování/zapojování vozů soupravy**.
- `npm run check` a `npm run build` zelené; Vite 8 pouze opakuje známý chunk-size warning.

## Sezení 42 (2026-07-12)

### Adopce sdílené metodiky (globální × projektová pravidla; bez kódu)
- Overlay sjednocen: `AGENTS.md` je zdroj, `CLAUDE.md` rozcestník s `@AGENTS.md` — drift dvojčat ukončen.
- Key Files opraveny: `trackData.ts` = asymetrická lemniskáta + C² spojka (DD-20/DD-26), doplněn `sim/serviceSite.ts` (S41); `ExhaustClock`/`carModels` už nechybí.
- `docs/PROMPTS.md`: projektová `%BEGIN`/`%END` explicitně provádějí globální protějšky (skládání, ne přebití); `%CALIBRATE` → `%CALIBRATE:PROJ` (kolize jmen s globální revizí spolupráce).
- Mrtvé odkazy na `~/AGENTS.md` odstraněny (soubor se neobnovuje).
- Ztracená makra `%THINK`/`%DOCS`/`%AUDIT:CODE`/`%AUDIT:DOCS` rekonstruována globálně (`~/.claude/PROMPTS.md`) — auditní ledger je zase spustitelný.
