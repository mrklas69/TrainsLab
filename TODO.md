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

*Nezralá rozšíření (dynamický prokluz, víc reverzních/brzdných stupňů) → viz IDEAS.md.*

### F3 — palivo  *(bývalé F2)*  *(S10, DD-14)*
- [x] Zásoby uhlí + vody, spotřeba tahem (úměrná otevření regulátoru; uhlí + idle, voda jen poptávka)
- [x] Tah lokomotivy závislý na zásobách (`steamPressure` z menší zásoby, pokles pod rezervou 15 %)
- [x] Vlak dojede setrvačností a zastaví po spotřebování zásob *(ověřeno: „Test OK")*
- [x] Voda dochází dřív než uhlí (věrný detail) — `waterRate` doladěn na 38 kg/s
- [x] **Otáčkový/mechanický strop rychlosti** *(S11, DD-15)* — `v_mech = maxPistonSpeed·π·D/(2·zdvih)`,
      tah padá k mezní rychlosti (kolo = převod); ustálí ~22 m/s místo ~67. Slidery kolo + mez pístu.
- [x] **Proměnná adheze + písek** *(S14, DD-17)* — `railFactor` (stav koleje: sucho 1 → mokro/listí),
      efektivní μ = `adhesionCoeff·railFactor`; písek = spotřební zásoba (`sand`), held-key P vrací
      suchou adhezi. Sdílený `adhesionLimit` → platí pro tah i brzdu. Slidery stav koleje + pískování.
- [x] **Skid při provozní brzdě** *(S14, DD-16)* — brzda nad adhezí (mokro) → kola kloužou, indikováno
      sdíleným `slipping` flagem (PROKLUZ + oranžová loko), s tolerancí (sucho neblikne). Izomorfní s tahem.

### F4 — záclony  *(bývalé F3)*
- [x] **Lowpoly terén** *(S17)* — zvlněný heightfield (`sim/terrain.ts`), faceted flat shading
      (směrový kontrast světla), barvení dle výšky (louka/les/skála). Single source výšky pro sim i view.
- [x] **Párové kolejnice + pražce** *(S17)* — dvě trubky ±rozchod/2 + příčné pražce (`InstancedMesh`);
      sim zná jen osu koleje (DD-02).
- [x] **Trať vede po povrchu terénu** *(S17, DD-20)* — `Y=terrainHeight(x,z)+most(s)`; sklony pro slack
      action vznikají z krajiny (emergence). `trackAmplitude` = amplituda terénních vln (slider sklonu).
- [x] **Most u křížení + pilíře** *(S17, DD-20)* — `bridgeLift(s)` zvedne jednu větev (clearance 8 m);
      **emergentní pilíře** tam, kde se trať odlepí od terénu (i pro budoucí estakády/náspy).
- [x] **Stromy + kameny** *(S17)* — faceted lowpoly (kužel+kmen / ikosaedr), `InstancedMesh`,
      deterministické rozmístění mimo zónu trati (`r>180`), sedí na terénu.
- [x] **Modely lokomotivy a vagonů** *(S22, DD-22)* — lowpoly faceted (`view/carModels.ts`): loko (kotel/
      kabina/komín/dóm), cisterna, krytý, plošinový (plato — pro techniku), otevřený. Souprava 6 těles.
      Kola s valením + **hnací spojnice** loko + **animace prokluzu** (`driverSlipPhase`). Typ = view metadata.
- [x] **Propracovaný kouř** *(S23, DD-23)* — `SmokeView`: pool faceted obláčků (ikosaedry, flatShading) ve
      **world-space** → vlečka za komínem emergentně (loko ujede, kouř visí). Hustota/velikost/**tmavost** ∝
      `throttleFraction·steamPressure` (uhlíkový kouř ↔ světlá pára), idle obláčky při notch 0. Sladěn se
      zvukovým chuff přes **`ExhaustClock`** (sdílený fyzikální rytmus výfuku, 4×/otáčku kola). `chimneyTip`
      marker přes `getWorldPosition` (flip/náklon vyřeší three).
- [x] Osvětlení doladěno pro lowpoly (S17); kamera „dron" hotová (S15). **Mostovka + mlha na horizontu** *(S32)* —
      mostovka = plná betonová deska pod kolejí na estakádě (`elevatedSamples` sdílený s pilíři, DRY);
      mlha = `THREE.Fog` (bělavý opar, schová tvrdý okraj terénní desky). Dron přepnut chase → **orbit kolem loko**.
- [x] **Auto-kamera „dron"** *(S15, DD-19; S32 přepracováno chase → orbit)* — toggle `C` vypne
      OrbitControls/WASD a každý frame řídí kameru. **Aktuálně (S32):** **krouží kolem lokomotivy** a kouká
      na ni (azimut `orbitSpeed`, poloměr `distance`, výška; tlumené dohánění `α=1−exp(−tuhost·dt)`); zoom
      `Z`/`X` i kolečko myši mění poloměr (`adjustOrbitRadius`). Orbit nezávislý na směru → bez hystereze /
      reverz-přeletu (ty měl původní chase z S15). Params mimo fyziku (`DroneParams` ve view, DD-01), slidery
      Dron: výška / poloměr a rychlost kroužení / tuhost dohánění.
- [x] Zvuk: prototyp `AudioView` (procedurální) *(S3, vědomě předsunuto)* — nahrazen samply, procedurální vrstva odstraněna *(S27)*
- [x] **Zvuk: vyměnit procedurální generátor za nahrané samply** *(S23–S27)* — **8 z 8 manifestu** + bonusy.
      `steam_chuff` (takt `ExhaustClock`), `steam_leak` (loop ∝ parní tlak, `makeSampleLoop`), `horn_on`
      (houkačka `playHorn` + H), `brakes_on` (`makeRandomizedLoop` — náhodné hranice proti švu/2s periodě +
      `playbackRate` ∝ rychlost, jen za jízdy), `clattering_wheels` (klapot spár, `makeRateLoop`),
      `clank`/`clunk`/`arc_jerk` (one-shoty), `arc_squeal` (loop ∝ příčné zrychlení, `makeSampleLevelLoop`),
      `steam_slip` (prokluz, loop on/off). **S27: čistě sample-based** — `proceduralAudio.ts` smazán,
      hybrid fallbacky odstraněny (chybí-li sample → ticho). Interfacy hlasů přesunuty do `AudioView.ts`.
- [x] **Chuff při vysokých otáčkách zní jako kulomet** *(S25)* — vyřešeno capem rychlosti v `ExhaustClock`
      (`CHUFF_FUSE_SPEED=7,4 m/s`, kde interval výfuku ≈ délka chuffu). Cap na **sdíleném clocku** → takt se
      ustálí pro zvuk i kouř (drží DD-23). Stejný vzor i u brzdy (`BRAKE_FUSE_SPEED=3,8`, „zubní vrtačka").

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

## Rázy z trati (track impulses)  *(S19, DD-21 — rozšíření kývání skříně DD-13, drží DD-02)*
Sjednocený balík: nespojitosti trati → impulsy do **existujících** roll/pitch oscilátorů (recyklace,
žádný nový DOF). Kontext: `docs/diary/2026-05-31.md` (S19); koncept v `IDEAS.md`.
- [x] `Body.applyImpulse(rollKick, pitchKick)` — ťuknutí do úhlové rychlosti roll/pitch oscilátoru
- [x] **Rail joints** — `railLength` v params; `Train.crossed()` detekuje přejezd spáry přes ujetou
      vzdálenost (floor-trik, frame-rate indep.) → pitch kick ∝ rychlost, znaménko střídá (klikot)
- [x] **Bodové perturbace** — `TRACK_PERTURBATIONS` v `trackData` (zlomky délky); κ-skok = roll-kick
      ve směru oblouku (`sign(κ)`, A4 b fenomenologicky), výhybky = roll+pitch. Týž `crossed()` test.
- [x] **Zvuk** — tikot spár (self-timed `railLength/v`), skřípění oblouku (`LevelVoice` ∝ příčné
      zrychlení), clunk výhybky (`pointImpulseFired`). AudioView dostal `params`.
- [x] Slider „Síla rázů (kvalita trati)" + „Rozteč spár" (sekce Trať); `trackImpulse=0` = ideální trať
- [x] **Doladění rázů z trati** *(S20)* — `PerturbationKind` (`transition`/`switch`); slider „kvalita
      přechodnic" (`transitionQuality`, tlumí jen κ-trh, default 0,3 — místo toggle); zvuk rozštěpen
      (`switchFired` clunk vs. `transitionJerkFired` skřípnutí); pozice ověřeny profilem κ (u=0.25/0.75 = křížení)

## Dokumentace / infra
- [x] Deploy dema na GitHub Pages (Actions, base `/TrainsLab/`) *(S4)*
- [x] `README.md` — identita projektu, ovládání, stav fází, architektura, demo *(S5)*

## Lab knoby
- [x] Slider sklonu tratě — živá změna amplitudy + rebuild geometrie *(S5)*
- [x] Minimalizace ovládacího panelu — hlavička (titulek + přepínač + status) oddělená od těla *(S9)*
- [x] Klávesové ovládání kamery — WASD posun, QE výška, ZX zoom; held-key model v Rendereru,
      regulátor přesunut jen na šipky ↑/↓ *(S10)*
- [x] **UX redesign ovládání** *(S14, DD-18)* — monolitický panel rozdělen podle role: status nahoře
      (centr.), dolní bar s tlačítky řízení + ⚙ Nastavení (centr., flex-wrap), modální dialog
      „Nastavení" se slidery (CSS Grid auto-fill = multi-column na wide, 1 na mobilu). Mobilně použitelné.
      Nahradilo minimalizační toggle. Tlačítko písku jako press-hold (pointer events, drž = sype).

## Interakce vozů & topologie sítě  *(S35+, restart po „dokončeném" PoC)*

### Volný vagon + srážky *(S35, DD-24)*
- [x] Volné nespřažené těleso na trati (`Train.freeBodies`), projede týž integrátor bez trakce/brzdy
- [x] Kontaktní náraz (buff bez spřažení, `applyContacts`) — konce soupravy ↔ volné vozy + volné navzájem
- [x] Mez energie srážky `½·m_red·v²` → vykolejení (slider, `derail(reason)`, diagnostika collision/overturn)
- *Nezralé:* automatické spřažení (scénář B), dva řízené vlaky (scénář C) → viz IDEAS.

### Výhybky — topologie sítě *(S35+, DD-25)*
- [x] **Fáze 1** — osa trati z jedné křivky na **graf segmentů** (`TrackSegment` + `TrackNetwork`),
      `Body`→`(seg,s)`, vše přes `globalS`/`gap`; osmička = 2 segmenty, chování identické *(ověřeno)*
- [x] **Infrastruktura větvení** *(S36)* — `next`/`prev` na **seznam možností** (`number[][]`) +
      `advance(choose)` (deterministická souprava `[0]` / náhodný `randomBranch` volný vagon = scénář A2);
      `TrackSegment.wrapU` dle `curve.closed` (otevřené větve); `totalLength`=délka hlavní smyčky (gap).
- [x] **Fáze 2 — geometrie odbočky** *(S37, DD-26)* — odbočka (3. hrana) jako **boční offset** hlavní
      trati: `δ(s)=BRANCH_OFFSET·sin⁴(πt)` podél úseku `[SWITCH_U, MERGE_U]`. C² profil (δ=δ'=δ''=0 na
      koncích) → **spojitá, shora omezená κ** (žádný trh, max|κ|≈0,02 → r≈47 m); δ≥0 → **konstrukčně
      nekříží** (žádná falešná 2↔2). θ-graf: **2 uzly** (výhybky), **3 hrany** (krátký/dlouhý úsek
      lemniskáty + odbočka). Nástroje `tools/check-{switch,connector,merge,network}.ts`.
      **Poučení (uživatel):** trať se projektuje **profilem κ(s)** (spojitá omezená změna rychlosti =
      přechodnice/klotoida), ne skládáním oblouků+přímek (dog-bone křížil + skoky κ → ~10 pokusů).
- [ ] **Fáze 3 — jízda po grafu** *(A2)* — vlak projede **všemi 3 hranami**: řízení výhybky (hráč přepne
      trasu), `gap`/`globalS`/kontakty/rázy přes větve; vrátit `randomBranch` (volný vagon náhodně bloudí,
      dočasně odebrán S37). Předpoklad pro auto-doplnění u domku (A1=B).
- [ ] **Fáze 4** — vagon/srážky/rázy na grafu (kontakty přes větve — nejtěžší)

### Domek s napaječkou *(S37, nové)*
- [ ] **Domek + napaječka** (lowpoly view, A3) — bouda + vodní jeřáb (rameno nad kolej) + hromada uhlí
      v **oku odbočky**, v duchu scenérie (stromy/kameny `InstancedMesh`, faceted). WorldView.
- [ ] **Auto-doplnění zásob** (A2 postupně) — loko zastaví (v≈0) u domku **na odbočce** → plynule doplní
      vodu + uhlí (jako `reset`, ale jen u domku a postupně). **Závisí na Fázi 3** (jízda po odbočce, A1=B).

## Backlog / později
- [x] **Křivkový odpor v obloucích** *(S29)* — `R = −sign(v)·curveResistance·|κ|·m·g`; specifický odpor
      úměrný křivosti (Röcklův charakter `c/r`), rychlostně nezávislý. Geometrický člen vedle gravitace
      v `Body.beginStep` (z `s`/trati), oddělený od rychlostních Davisových členů. Doplnil `R=A+B·v+C·v²`
      o zatáčkový člen. Slider „Odpor v oblouku" v Odporech. Žádné nové DD (laditelný odporový člen).
- [x] **Rotační setrvačnost hmot** *(S30)* — `m_eff = m·(1+λ)`: rotující kola/ojnice přidají k translační
      setrvačnosti (rychlostně nezávislé, branžově vlak ~6–8 %, loko ~10 %). Mění jen převod síla→zrychlení
      v `Body.integrate` (síly drží skutečné `m` přes `massOf`). Per-vůz `rotatingFactorOf` (loko 0,15 /
      vůz 0,06), izomorfní s `massOf`. 2 slidery v Hmotnostech. Drží DD-02 (skalár). Žádné nové DD.
- Dlouhodobé / nezralé nápady (sloshing F5, průběžná brzda, jiskry, hypotézy o „uspokojení",
  dynamický prokluz) → **IDEAS.md** (single source pro nezralé).
