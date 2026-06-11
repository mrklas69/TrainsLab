# TrainsLab

**Laboratoř kolem vlaků** — sandbox, který zkoumá dvě věci: *proč je uspokojivé sledovat
vláčky* a *jak věrně se dá simulovat chování vlakové soupravy*. Zvlášť to, co ostatní hry
ignorují: nárazníky, vůli ve spřáhle, podélnou dynamiku.

> „Vždyť přeci všichni milují vláčky."

### ▶ [Živé demo](https://mrklas69.github.io/TrainsLab/)

Řiď parní lokomotivu s pěti vagony po **ležaté osmičce** vedoucí **zvlněnou lowpoly krajinou**
(les, balvany) — trať se uprostřed kříží, jednou po mostě (estakáda na pilířích), podruhé pod ním.
Na stoupání krajiny se souprava natáhne a zpomalí, z klesání se rozjede a zhustí. Při rozjezdu kola prokluzují, na svahu drží parkovací brzda. A pozor
na **ostré laloky**: vletíš-li do zatáčky moc rychle, odstředivka soupravu **převrátí**
(vykolejení) — skříně se přitom **kývají** (naklánějí ven ze zatáčky, kývnou při trhu) a
blízkost meze **žhne** na skříni. A hlídej **uhlí a vodu**: až dojdou (voda dřív), lokomotiva
ztratí páru a vlak dojede setrvačností. Na **mokré koleji** kola hrabou (prokluz) a brzda
klouže — **pískuj** (drž `P`), ať se rozjedeš a zabrzdíš. Na **dilatačních spárách** to klikotá (rychleji = hustěji), v **ostrém
oblouku** skříň cukne (skok křivosti) a okolky kvílí. Všechny fyzikální parametry jsou živé slidery.

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
| `↑` | přidat stupeň regulátoru |
| `↓` | ubrat stupeň (notch −1 = reverz / protiproudé brzdění) |
| `B` / mezerník | brzda lokomotivy |
| `P` (drž) | pískování — zvýší adhezi nad suchou hodnotu (drž klávesu/tlačítko) |
| `R` | reset (doplní i palivo a písek) |
| `M` | zvuk on/off |
| `C` | auto-kamera „dron" — toggle kroužení kolem lokomotivy (vypne ruční ovládání kamery) |
| `W` `A` `S` `D` | posun kamery v rovině (ruční režim) |
| `Q` / `E` | výška kamery (dolů / nahoru, ruční režim) |
| `Z` / `X` | zoom (přiblížit / oddálit) — i v dronu (mění poloměr kroužení); v dronu i kolečkem myši |

Notch regulátoru: **3 vpřed · 0 · 1 vzad**. Kamerou lze otáčet i myší (OrbitControls).
**Dron** (`C`) krouží kolem jedoucí lokomotivy a kouká na ni (`Z`/`X` či kolečko myši mění poloměr
kroužení); ruční ovládání kamery je při něm vypnuté (vypni dron a vrátíš se k orbitu). Akce jsou i jako
tlačítka v **dolním baru** (vč. ⚙ Nastavení); pískování drž.

## Lab knoby

Dialog **⚙ Nastavení** (tlačítko v dolním baru) ladí fyziku **za běhu** (single source of truth,
[`src/sim/params.ts`](src/sim/params.ts)):
hmotnosti (lokomotiva = adhezní tíha; rotující hmota = setrvačnost kol/ojnic, loko > vůz), odpory
(gravitace, valivý, rozběhový faktor, lineární `B·v`, vzduch — členy Davisovy rovnice; odpor v oblouku
∝ křivost), spřáhlo (vůle / tuhost / tlumení), trakce (výkon, max tažná síla, adheze μ,
**stav koleje** = sucho/mokro, brzda + pokles jejího tření s rychlostí, průměr hnacího kola a mez pístové
rychlosti = otáčkový strop), **pískování**
(účinnost / kapacita / spotřeba písku), příčnou
dynamiku (rozchod koleje, výška těžiště — určují práh převrácení; amplituda terénních vln = sklon trati;
rozteč dilatačních spár, síla rázů z trati a kvalita přechodnic oblouků = kvalita trati), vypružení skříně (frekvence / tlumení kývání)
a palivo (kapacity a spotřeby uhlí / vody).
Sekce **Dron** ladí kameru (výška / poloměr a rychlost kroužení / tuhost dohánění) — to je view, ne
fyzika, takže žije mimo `params.ts` (drží DD-01). V Nastavení je i sekce **Zobrazení** (přepínač markerů
napětí ve spřáhlech — osciloskop slack action, default skrytý).

## Stav

| Fáze | Co | Stav |
|------|-----|------|
| **F0** | jednotělesová dynamika (gravitace, odpory, integrátor) | ✅ |
| **F1** | ★ slack action — spřáhla s vůlí, run-out vlna | ✅ |
| **F2** | trakce & adheze — notch, prokluz, brzda jako řízené tření | ✅ |
| **F6** | příčná dynamika — esíčko (osmička), most/podjezd, převrácení/vykolejení, kývání skříně, gradient meze, rázy z trati (spáry / skok křivosti) | ✅ |
| **F3** | palivo & zásoby — uhlí/voda (parní tlak), proměnná adheze + písek | ✅ |
| **F4** | záclony — lowpoly svět/modely ✅, párové koleje + mostovka + mlha ✅, realistické měkké částice kouře/páry (komín, válce, rozvod, píšťala) ✅, zvukové samply ✅ | ✅ |
| **F7** | interakce vozů — odstavený volný vagon + srážky (mez energie → vykolejení) ✅; **výhybky / topologie sítě** — graf segmentů (fáze 1 ✅), **odbočka = θ-graf 2 uzly / 3 hrany, boční offset se spojitou omezenou κ** (fáze 2 ✅, DD-26); jízda po grafu + domek s napaječkou (fáze 3–4 🔧) | 🔧 |

**PoC (F0–F4 + příčná) dokončen.** Po něm **restart** novým směrem (S35): interakce volného vagonu
a **topologie sítě** (osa trati přešla na graf segmentů — výhybky se staví po fázích, viz
[`TODO.md`](TODO.md)). Nezralé směry (sloshing, ASCII renderer, jiskry…) v [`IDEAS.md`](IDEAS.md);
hotové úkoly v [`DONE.md`](DONE.md).

## Architektura

Tvrdé oddělení **sim / view** (DD-01): model nezná pixely, renderer je čistá funkce
stavu → obraz. Fyzika je 1D (poloha `s` po arc-length parametrizované křivce); 3D pozice
vzniká až při renderu (DD-02).

```
src/
  sim/    fyzika — TrackSegment + TrackNetwork (graf trati), trackData, terrain, params, Body, Coupler, Train
  view/   výstupy — Renderer (Three.js, aktéři + loop) + WorldView (terén/koleje/dekorace)
          + CameraController (orbit/dron) + carModels (modely vozů) + SteamView (kouř/pára)
          + AudioView (samply) + ExhaustClock (rytmus výfuku)
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
- [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) — rejstřík rozhodnutí (DD-NN); narativ v diáři.
- [`docs/DIARY.md`](docs/DIARY.md) — index sezení; záznamy v [`docs/diary/`](docs/diary/).
- [`IDEAS.md`](IDEAS.md) — nápady a výzkumné hypotézy.
