# TrainsLab

**Laboratoř kolem vlaků** — sandbox, který zkoumá dvě věci: *proč je uspokojivé sledovat
vláčky* a *jak věrně se dá simulovat chování vlakové soupravy*. Zvlášť to, co ostatní hry
ignorují: nárazníky, vůli ve spřáhle, podélnou dynamiku.

> „Vždyť přeci všichni milují vláčky."

### ▶ [Živé demo](https://mrklas69.github.io/TrainsLab/)

Řiď parní lokomotivu se čtyřmi vagony po zvlněné smyčce. Do kopce se souprava natáhne
a zpomalí, z kopce se rozjede a zhustí. Při rozjezdu kola prokluzují, na svahu drží
parkovací brzda. Všechny fyzikální parametry jsou živé slidery.

---

## Jádrová nika: slack action

Reálná souprava se nerozjede celá naráz — lokomotiva napne první spřáhlo, trhne dalším
vagonem, vůle „proběhne" soupravou (**slack run-out**). Vzniká podélná vlna:

- **draft** — natažení spřáhel (tah), do kopce a při rozjezdu,
- **buff** — stlačení nárazníků (tlak), z kopce a při brzdění.

Pár pružin s vůlí v 1D řetězci → trhání, houpání, realistické rozjezdy, riziko přetržení
vlaku. Tycoon hry berou vlak jako tuhý bod; tohle je důvod, proč TrainsLab stojí za to dělat.

TrainsLab je jeden roh **mřížky experimentů** (měřítko × věrnost) — začínáme v rohu
*mikro × vysoká věrnost* (jeden vlak, plná fyzika). Kontext viz [`docs/diary/`](docs/diary/).

## Ovládání

| Klávesa | Akce |
|---------|------|
| `W` / `↑` | přidat stupeň regulátoru |
| `S` / `↓` | ubrat stupeň (notch −1 = reverz / protiproudé brzdění) |
| `B` / mezerník | brzda lokomotivy |
| `R` | reset |
| `M` | zvuk on/off |

Notch regulátoru: **3 vpřed · 0 · 1 vzad**. Myší (OrbitControls) lze otáčet kamerou.
Tytéž akce jsou i jako tlačítka v panelu.

## Lab knoby

Levý panel ladí fyziku **za běhu** (single source of truth, [`src/sim/params.ts`](src/sim/params.ts)):
hmotnosti (lokomotiva = adhezní tíha), odpory (gravitace, valivý, rozběhový faktor, vzduch),
spřáhlo (vůle / tuhost / tlumení) a trakce (výkon, max tažná síla, adheze μ, brzda).

## Stav

| Fáze | Co | Stav |
|------|-----|------|
| **F0** | jednotělesová dynamika (gravitace, odpory, integrátor) | ✅ |
| **F1** | ★ slack action — spřáhla s vůlí, run-out vlna | ✅ (vizuální „aha" se dolaďuje) |
| **F2** | trakce & adheze — notch, prokluz, brzda jako řízené tření | ✅ |
| **F3** | palivo — uhlí/voda, tah dle zásob | ⬜ |
| **F4** | záclony — lowpoly terén, modely (zvuk: prototyp ✅) | ⬜ |
| **F5** | sloshing kapaliny v cisterně → posun těžiště | ⬜ |

Aktuální úkoly: [`TODO.md`](TODO.md) · hotové: [`DONE.md`](DONE.md).

## Architektura

Tvrdé oddělení **sim / view** (DD-01): model nezná pixely, renderer je čistá funkce
stavu → obraz. Fyzika je 1D (poloha `s` po arc-length parametrizované křivce); 3D pozice
vzniká až při renderu (DD-02).

```
src/
  sim/    fyzika — Track, trackData, params, Body, Coupler, Train
  view/   výstupy — Renderer (Three.js), AudioView (procedurální Web Audio)
  ui/     ControlPanel (slidery + status + tlačítka)
  main.ts skládá sim + view + ui, drží render loop
```

Renderer i AudioView jsou nezávislá „view" nad týmž simem — vyměnitelná, izomorfní.

## Vývoj

```bash
npm install
npm run dev      # vite dev server
npm run build    # tsc + vite build → dist/
npm run preview  # náhled produkčního buildu
```

Stack: **Three.js + TypeScript + Vite** (DD-03). Push na `main` automaticky buildí
a nasazuje demo na GitHub Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Dokumentace

- [`GLOSSARY.md`](GLOSSARY.md) — termíny (slack action, adheze, trakce, …).
- [`docs/DIARY.md`](docs/DIARY.md) — index sezení; záznamy v [`docs/diary/`](docs/diary/).
- [`IDEAS.md`](IDEAS.md) — nápady a výzkumné hypotézy.
- Design decisions (DD-NN) — v diáři u příslušného sezení.
