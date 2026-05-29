# TODO — TrainsLab

Markery: `[ ]` čeká · `[~]` rozděláno · `[x]` hotovo · `[!]` priorita.
Kontext a rozhodnutí: viz `resources/initial_session.md`.

## PoC — slack action na smyčce

### F0 — skeleton
- [ ] [!] Kostra projektu: Vite + TypeScript + ThreeJS
- [ ] ThreeJS scéna: kamera, světlo, render loop
- [ ] Trať jako uzavřená křivka (`CatmullRomCurve3`) na zvlněném terénu
- [ ] Arc-length parametrizace křivky (poloha `s` → 3D bod + tečna)
- [ ] Vlak jako kvádry (lokomotiva + 4 vagony), pohyb po křivce tuhým tahem
- [ ] Sim/view split: model drží `s`, `v`; renderer jen vykresluje (DD-01)

### F1 — jádro: podélná dynamika (★)
- [ ] Vozidlo jako 1D hmota: poloha `s`, rychlost `v`, hmotnost `m`
- [ ] `coupler` = pružina s vůlí (mrtvé pásmo) — tah (draft) i tlak přes nárazník (buff)
- [ ] Gravitace podél trati `g·sin(θ)` z tečny křivky
- [ ] Valivý odpor
- [ ] Integrátor: semi-implicitní Euler se substeppingem
- [ ] Ověřit „aha": do kopce se souprava natáhne, z kopce zkrátí; vlna proběhne soupravou

### F2 — palivo
- [ ] Zásoby uhlí + vody, spotřeba tahem
- [ ] Tah lokomotivy (`tractive effort`), regulace
- [ ] Vlak dojede setrvačností a zastaví po spotřebování zásob

### F3 — záclony
- [ ] Lowpoly terén
- [ ] Stromy, kameny (instancing)
- [ ] Modely lokomotivy a vagonů (jeden cisterna)
- [ ] Kamera/osvětlení pro „uspokojivé" pozorování

## Backlog / později
- [ ] F4: sloshing kapaliny v cisterně → posun těžiště
- [ ] Hypotézy o „uspokojení" → měřitelné experimenty (viz IDEAS.md)
