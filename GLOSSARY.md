# GLOSSARY — TrainsLab

Termíny projektu. Anglické identifikátory v kódu, české vysvětlení.

## Slack action (vůle v soupravě)
- **slack action** — souhrnný jev podélného pohybu vůlí mezi vozy; jádrová nika projektu.
- **draft** — natažení spřáhel (tah), typicky do kopce a při rozjezdu.
- **buff** — stlačení nárazníků (tlak), typicky z kopce a při brzdění.
- **slack run-out** — postupné vybírání vůle vozem za vozem → podélná vlna soupravou.
- **coupler (spřáhlo)** — spoj mezi sousedními vozy = pružina s **vůlí** (mrtvým pásmem):
  v rozsahu vůle síla 0, za hranou spring-damper (táhne/tlačí).

## Trať a kinematika
- **arc-length parametrizace** — poloha vozu daná délkou `s` (m) podél křivky, ne parametrem
  křivky. Drží fyziku 1D; 3D pozice až při renderu (DD-02).
- **grade (sklon)** — `sin(θ)` trati = y-složka jednotkové tečny; vstup do gravitace.

## Trakce a adheze
- **tractive effort (tažná síla, TE)** — síla, kterou lokomotiva žene soupravu.
- **výkonový limit** — `TE = min(F_max, P/v)`; při vyšší rychlosti omezuje výkon (hyperbola).
- **adheze (μ)** — součinitel tření kolo-kolej; strop přenositelné síly `μ·N`
  (`N` = adhezní tíha lokomotivy). Sucho ≈ 0,30, mokro ≈ 0,15.
- **prokluz (wheel slip)** — požadovaná TE > `μ·N`; kola se protáčejí, tah se zhroutí.
- **notch (stupeň regulátoru)** — diskrétní poloha regulátoru tahu (3 vpřed · 0 · 1 vzad).
- **reverzér / cutoff** — u parní lokomotivy plnění válce + směr (zatím nemodelováno; notch
  je hratelné zjednodušení).
- **rozběhový odpor (starting/breakaway resistance)** — klidové tření > valivé za jízdy;
  fyzikální *důvod*, proč slack action funguje (rozjezd vozů postupně).
- **valivý odpor (Crr)** — kinetický odpor valení za jízdy (ocel-ocel ≈ 0,002).
- **protiproudé brzdění (plugging / counter-pressure)** — tah motoru proti směru jízdy =
  brzdění. Limit je adheze (`μ·N`), ne výkon `P/v` (ten platí jen pro zrychlování). V modelu
  notch −1 za jízdy vpřed (DD-08). Zabírá **plným úsilím** (`fraction=1`, ne dělené stupni),
  takže `F_max` překoná adhezi → **skid** (prokluz při brzdění), DD-10.
- **brzda jako řízené tření** — provozní brzda lokomotivy modelovaná jako dodatečný odpor
  (zvyšuje statický práh i kinetický odpor), ne zvláštní síla. Tah a brzda se perou ve
  společném akumulátoru sil (DD-09).
- **dragging brakes** — tah překoná hranu, ale brzda + tření vlak udrží: kola prokluzují
  proti stojící soupravě. Emergentní důsledek souboje sil (DD-09).

## Zvuk
- **chuff (výfuk páry)** — nárazový výdech páry komínem při otevřeném regulátoru; hustota
  roste s rychlostí. V `AudioView` rytmický burst šumu.
- **AudioView** — zvuk jako další „view" nad simem (DD-01): čte stav, ozvučuje události
  (chuff, clank/náraz spřáhla, sykot prokluzu, skřípění brzd). Procedurální, bez souborů.

## Numerika a architektura
- **semi-implicitní Euler** — integrátor: nejdřív rychlost z aktuálních sil, pak poloha.
- **substepping** — dělení časového kroku; nutné pro stabilitu tuhých pružin (spřáhel).
- **sim/view split (DD-01)** — model nezná renderer; renderer = čistá funkce stavu → obraz.
- **DD-NN** — design decision; tabulky v `docs/diary/`.
