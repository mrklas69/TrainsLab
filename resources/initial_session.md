# TrainsLab — Kick-off (2026-05-29)

Záznam zakládacího sezení. Z prázdného repa do dotaženého konceptu PoC.

---

## Co je TrainsLab

**Laboratoř / sandbox kolem vlaků.** Ne jedna hra s cílem, ale prostor experimentů
zkoumajících dvě věci:

1. **Proč je uspokojivé sledovat vláčky** (estetika, plynulost, emergence).
2. **Jak věrně se dá simulovat chování vlakové soupravy** — zvlášť věci, které ostatní
   hry ignorují: nárazníky, vůle ve spřáhle, podélná dynamika.

> „Vždyť přeci všichni milují vláčky."

## Prostor experimentů — dvě nezávislé osy

Tři původní nápady (ASCII / Transport Tycoon / fyzika soupravy) **nejsou tři projekty**,
ale tři body v jedné mřížce:

```
            nízká věrnost            vysoká věrnost
  MAKRO  │  Transport Tycoon      │  (zřídka — drahé)
 (síť)   │  (ekonomika, rozvozy)  │
  ───────┼────────────────────────┼─────────────────────
  MIKRO  │  ASCII vláček          │  ★ fyzika soupravy
 (1 vlak)│  (kinematika)          │  (nárazníky, vůle)  ← ZAČÍNÁME TADY
```

- **Osa měřítka:** jeden vlak (mikro) ↔ celá síť (makro).
- **Osa věrnosti:** jak detailně počítáme pohyb.

Slovo **Lab** je doslovné: společné jádro, různá okna do něj, každé okno testuje hypotézu.

## Jádrová nika: slack action

Tomu, co chceme simulovat, se v železnici říká **slack action**:
- **buff** = stlačení nárazníků (z kopce, při brzdění),
- **draft** = natažení spřáhel (do kopce, při rozjezdu).

Reálný náklaďák se nerozjede celý naráz — lokomotiva napne první spřáhlo, trhne dalším
vagonem, vůle „proběhne" soupravou (slack run-out). Vzniká podélná vlna.

To je hledané **„jednoduché pravidlo → emergentní hloubka"**: pár pružin a vůlí v 1D řetězci
→ trhání, houpání, realistické rozjezdy, riziko přetržení vlaku. Hru, která tohle modeluje
pořádně, skoro nikdo nedělá (Tycoon hry berou vlak jako tuhý bod). **To je důvod, proč
TrainsLab stojí za to dělat.**

A zároveň odpovídá na otázku „proč uspokojivé": slack action je doslova vizualizovaná
setrvačnost. Estetika a fyzika jsou tu jedna věc.

---

## Klíčová rozhodnutí

| # | Rozhodnutí | Proč |
|---|-----------|------|
| DD-01 | **Sim a view tvrdě oddělené.** Model neví o pixelech, renderer je čistá funkce stavu → obraz. | Izomorfismus, vyměnitelné renderery. Platí se pozdě draho — proto od začátku. |
| DD-02 | **Trať = parametrická křivka, fyzika je 1D.** Vozidlo = poloha `s` po arc-length parametrizované křivce + rychlost `v`. 3D pozice až při renderu. | Drží fyziku triviální i ve 3D; vagon sleduje koleje zadarmo. |
| DD-03 | **Stack: ThreeJS + TypeScript + Vite.** | Vize stojí na svahu (3D terén), pozorování i uspokojení jsou nativně 3D. Rychlá iterace = krev laboratoře. |
| DD-04 | **Začínáme v rohu MIKRO × vysoká věrnost** (jeden vlak, slack action). Tycoon/síť odloženo. | Jádro hodnoty projektu, ne další Tycoon klon. |
| DD-05 | **Foundations before curtains** — fyzika (kvádry) běží dřív, než přijde první strom. | Disciplína proti scope creepu. |

Pozn.: DD-03 přepsalo původní úvahu o Canvas 2D — 3D je tu objektivně lepší kvůli svahu.

## PoC — cílová vize (A5)

Jednoduchý ThreeJS model: zvlněná krajina, pár lowpoly stromů a kamenů, železniční smyčka,
lokomotiva + 4 vagony (jeden cisterna s kapalinou). Vlak jede do spotřebování uhlí a vody.
Očekávané chování: **do kopce se natáhne a zpomalí, z kopce se rozjede a zkrátí.**

## PoC — pořadí stavby (foundations before curtains)

| Fáze | Co | Proč |
|------|-----|------|
| **F0 — skeleton** | ThreeJS scéna, kamera, smyčková trať na zvlněném terénu, vlak jako **kvádry**, jede dokola tuhým tahem | ověří render + pohyb po křivce |
| **F1 — ★ jádro** | podélná dynamika: spřáhla s vůlí + nárazníky; kvádry se viditelně rozestupují do kopce / zhušťují z kopce | „aha" moment, srdce TrainsLab |
| **F2 — palivo** | uhlí/voda, tah, vlak dojede a zastaví | uzavře smyčku chování |
| **F3 — záclony** | lowpoly terén, stromy, kameny, modely lokomotivy a vagonů, cisterna | teprve teď krása |
| **F4 — budoucí** | čvachtání kapaliny v cisterně (sloshing → těžiště) | „tu pak rozpohybujeme" |

## Technické jádro F1

- `coupler` mezi vozidly = pružina s **vůlí** (mrtvé pásmo): v rozsahu vůle síla = 0,
  za hranou táhne (draft) / přes nárazník tlačí (buff).
- gravitace podél trati = `g·sin(θ)`, `θ` z tečny křivky.
- integrátor: **semi-implicitní Euler se substeppingem** (tuhé pružiny jsou jinak nestabilní).
- palivo: tah spotřebovává zásoby → dojdou → `tractive effort = 0` → vlak dojede setrvačností
  a zastaví podle profilu (emergentní místo zastavení).

## Rizika

- **Scope creep** — tři rohy mřížky naráz = nic hotového. Disciplína: jeden vertikální řez.
- **Předčasná abstrakce** — nestavět „framework pro vrstvy věrnosti" dopředu (YAGNI).
  Výjimka: sim/view split (DD-01) prosazen od začátku.
- **Topologie sítě** (výhybky) je vlastní těžký problém — mimo PoC, začínáme na smyčce.
- **Numerická stabilita** tuhých pružin — řešeno DD-04 integrátorem.
- **Záclony first** — pozor, ať lowpoly stromy nesežerou čas dřív, než stojí F1.

## Kudos / Censure

- **Kudos!** (uživatel → AI): „Dobrý kick-off." Reframe tří nápadů do jedné mřížky +
  pojmenování slack action jako niky se trefilo.

## Příště

- Založit kostru projektu (Vite + TS + ThreeJS), rozjet **F0** (scéna, smyčka, kvádry dokola).
- Pak **F1** — podélná dynamika se slack action.
