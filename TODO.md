# TODO — TrainsLab

Markery: `[ ]` čeká · `[~]` rozděláno · `[x]` hotovo · `[!]` priorita.
Kontext a rozhodnutí: viz `docs/diary/2026-05-29.md`.

## PoC — slack action na smyčce

### F0 — jednotělesová dynamika  *(reframe Sezení 2: dřív „tuhý tah dokola", DD-06)*
- [x] Kostra projektu: Vite + TypeScript + ThreeJS
- [x] ThreeJS scéna: kamera, světlo, OrbitControls, render loop
- [x] Trať jako uzavřená křivka (`CatmullRomCurve3`) na zvlněném profilu
- [x] Arc-length parametrizace + sklon `grade(s)` (poloha `s` → bod + tečna)
- [x] Jeden vagon jako 1D hmota (`Body`: `s`, `v`, `m`), kvádr na trati
- [x] Síly: gravitace `g·sin(θ)`, valivý odpor, odpor vzduchu
- [x] Integrátor: semi-implicitní Euler se substeppingem (háček pro F1 pružiny)
- [x] Šťouchnutí impulzem (klávesnice) + reset
- [x] UI slidery fyzikálních parametrů (živé ladění — „Lab" knoby)
- [x] Sim/view split: model drží `s`, `v`; renderer jen vykresluje (DD-01)

### F1 — jádro: slack action (★)
- [x] Souprava jako N těles (`Body` ×N) řízená `Train` (sdílená hmota z params zatím)
- [x] `coupler` = pružina s vůlí (mrtvé pásmo) — tah (draft) i tlak přes nárazník (buff)
- [x] Šťouchnutí do lokomotivy → run-out vůle soupravou (podélná vlna)
- [x] Slidery vůle / tuhost / tlumení spřáhla (živé ladění)
- [x] Ověřit „aha": do kopce se souprava natáhne, z kopce zkrátí; vlna proběhne soupravou
      *(S5: vizualizace napětí ve spřáhlech + slider sklonu → run-out přímo vidět)*

### F2 — trakce & adheze (★)  *(nové, Sezení 2, DD-07)*
- [x] Hmotnost per vůz (lokomotiva těžší) — místo sdílené hmoty
- [x] Regulátor jako notch páka (3 vpřed · 0 · 1 vzad), řízení místo šťouchnutí
- [x] Tractive effort s výkonovým limitem `TE = min(F_max, P/v)`
- [x] Adheze: clamp na `μ·N` (adhezní tíha lokomotivy), prokluz při překročení
- [x] Brzda jen u lokomotivy (limit adhezí — skid)
- [x] Rozběhový/statické tření (`Crr_start > Crr`) — dá vůli funkční smysl, sjednotí auto-stop
- [x] Slidery: výkon, max síla, μ, adhezní hmota, brzda, rozběhový faktor
- [x] Vizuální indikace prokluzu (barva lokomotivy)
- [x] Reverz za jízdy vpřed = protiproudé brzdění (limit adheze, ne P/v) *(S3, DD-08)*
- [x] Brzda jako řízené tření — souboj sil, dragging brakes, drží svah *(S3, DD-09)*
- [x] Skid při protiproudém brzdění — reverz naplno (`fraction=1`) překoná adhezi *(S5, DD-10)*
- [ ] Rozšíření (později): dynamický prokluz (setrvačnost kola + creep křivka), písek
- [ ] Rozšíření (později): víc reverzních/brzdných stupňů → plynulý přechod couvání↔skid

### F3 — palivo  *(bývalé F2)*  *(S10, DD-14)*
- [x] Zásoby uhlí + vody, spotřeba tahem (úměrná otevření regulátoru; uhlí + idle, voda jen poptávka)
- [x] Tah lokomotivy závislý na zásobách (`steamPressure` z menší zásoby, pokles pod rezervou 15 %)
- [x] Vlak dojede setrvačností a zastaví po spotřebování zásob *(ověřeno: „Test OK")*
- [x] Voda dochází dřív než uhlí (věrný detail) — `waterRate` doladěn na 38 kg/s
- [ ] **Písek + mokrá kolej** *(odloženo, DD-14)* — proměnná adheze (počasí) → prokluz/skid →
      písek dočasně zvedne μ. Bez nízké adheze je písek neviditelný knob (viz IDEAS).
- [ ] **Otáčkový/mechanický strop rychlosti** *(IDEAS, kandidát k F3)* — `maxPistonSpeed`

### F4 — záclony  *(bývalé F3)*
- [ ] Lowpoly terén
- [ ] Stromy, kameny (instancing)
- [ ] Modely lokomotivy a vagonů (jeden cisterna)
- [ ] Kamera/osvětlení pro „uspokojivé" pozorování
- [~] Zvuk: prototyp `AudioView` hotový (procedurální) *(S3, vědomě předsunuto)*
- [ ] Zvuk: vyměnit procedurální generátor za nahrané samply (zdroje + licence v IDEAS)

## Příčná dynamika — oblouky & vykolejení  *(S6, Úroveň A — drží DD-02; F-osu doladit v README)*
- [x] `Track.radius(s)` — lokální poloměr oblouku z křivosti **horizontálního průmětu** (XZ);
      izomorfní s `grade` (vertikála→gravitace, horizontála→odstředivka). Rovinka → ∞ *(S7)*
- [x] Odstředivá síla → `Train.lateralAcceleration` (max `v²/r` přes vozy), odvozená diagnostika
      (nemění `s`/`v` — drží DD-02); zobrazena ve status panelu *(S7)*
- [x] params: `trackGauge` (rozchod, 1.435 m), `comHeight` (výška těžiště vozu) *(S8)*
- [x] Kritérium převrácení: příčná akcelerace > `(gauge/2)/h · g` → vykolejení (fail state) *(S8, DD-12)*
- [x] Trať s proměnným poloměrem (esíčko) — ležatá osmička (Bernoulli), laloky r≈33 m, střed inflexe *(S8, mírněji v S9)*
- [x] Most + podjezd — trať se v půdorysu kříží, `Y=amplitude·sin(t)` *(S8, DD-12, požadavek uživatele)*
- [x] Vizualizace blízkosti meze + vykolejení — rudá souprava + stop + R, status `příč X/Y` +
      `VYKOLEJENO při Z m/s`; gradient blízkosti meze = žár skříně ∝ `v²·κ` per-vůz (emissive) *(S8–S9)*
- [x] **Kývání skříně** *(S9, DD-13 — neopouští monorail, drží DD-02)* — roll z odstředivky
      `v²·κ` (znaménko = strana náklonu), pitch z podélné akcelerace `dv/dt`; tlumené torzní
      oscilátory (rotační stav na `Body`). Zviditelní slack-trh (pitch) i zatáčku (roll). Params:
      frekvence + tlumení vypružení (sekce „Vypružení"). Kritérium převrácení zatím oddělené (roll = předzvěst).

## Dokumentace / infra
- [x] Deploy dema na GitHub Pages (Actions, base `/TrainsLab/`) *(S4)*
- [x] `README.md` — identita projektu, ovládání, stav fází, architektura, demo *(S5)*

## Lab knoby
- [x] Slider sklonu tratě — živá změna amplitudy + rebuild geometrie *(S5)*
- [x] Minimalizace ovládacího panelu — hlavička (titulek + přepínač + status) oddělená od těla *(S9)*
- [x] Klávesové ovládání kamery — WASD posun, QE výška, ZX zoom; held-key model v Rendereru,
      regulátor přesunut jen na šipky ↑/↓ *(S10)*

## Backlog / později
- [x] Vizualizace napětí ve spřáhlech (barva markeru) — `Coupler.force` + koule mezi vozy *(S5)*
- [ ] Jiskry při skidu / prokluzu — vizuál (F4 záclona)
- [ ] F5: sloshing kapaliny v cisterně → posun těžiště *(bývalé F4)*
- [ ] Průběžná brzda soupravy (pneumatická, šíření tlaku = další vlna)
- [ ] Davisův lineární člen odporu `B·v`; křivkový odpor v obloucích
- [ ] Rotační setrvačnost hmot (rotating mass factor)
- [ ] Hypotézy o „uspokojení" → měřitelné experimenty (viz IDEAS.md)
