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
- [~] Ověřit „aha": do kopce se souprava natáhne, z kopce zkrátí; vlna proběhne soupravou
      *(S3: potvrzeno akusticky — cvakání spřáhel — a dojmově; cílený vizuální test chybí)*

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
- [ ] Rozšíření (později): dynamický prokluz (setrvačnost kola + creep křivka), písek
- [ ] Rozšíření (později): víc reverzních/brzdných stupňů → skid při brzdění

### F3 — palivo  *(bývalé F2)*
- [ ] Zásoby uhlí + vody, spotřeba tahem
- [ ] Tah lokomotivy závislý na zásobách (parní tlak)
- [ ] Vlak dojede setrvačností a zastaví po spotřebování zásob

### F4 — záclony  *(bývalé F3)*
- [ ] Lowpoly terén
- [ ] Stromy, kameny (instancing)
- [ ] Modely lokomotivy a vagonů (jeden cisterna)
- [ ] Kamera/osvětlení pro „uspokojivé" pozorování
- [~] Zvuk: prototyp `AudioView` hotový (procedurální) *(S3, vědomě předsunuto)*
- [ ] Zvuk: vyměnit procedurální generátor za nahrané samply (zdroje + licence v IDEAS)

## Dokumentace / infra
- [x] Deploy dema na GitHub Pages (Actions, base `/TrainsLab/`) *(S4)*
- [!] `README.md` — identita projektu, ovládání, odkaz na demo *(přetrvává v Příště S2–S4)*

## Backlog / později
- [ ] Vizualizace napětí ve spřáhlech (barva/deformace) — infra `Coupler.mode`/`relVel` hotová *(S3)*
- [ ] F5: sloshing kapaliny v cisterně → posun těžiště *(bývalé F4)*
- [ ] Průběžná brzda soupravy (pneumatická, šíření tlaku = další vlna)
- [ ] Davisův lineární člen odporu `B·v`; křivkový odpor v obloucích
- [ ] Rotační setrvačnost hmot (rotating mass factor)
- [ ] Hypotézy o „uspokojení" → měřitelné experimenty (viz IDEAS.md)
