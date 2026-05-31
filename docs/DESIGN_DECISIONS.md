# Design Decisions — TrainsLab

Rejstřík architekturních rozhodnutí (DD-NN). Cíl: najít „co a proč" bez grepování diáře.

**Vztah k diáři:** plné zdůvodnění, alternativy a kontext žijí v `docs/diary/` u uvedeného
sezení (diář = narativ, single source). Tento soubor je **rejstřík** — jedna věta „co",
jedna „proč", odkaz kam pro detaily. Nové DD přidávej sem i do diáře téhož sezení.

| DD | Sez. | Rozhodnutí | Proč |
|----|------|-----------|------|
| DD-01 | S1 | **Sim a view tvrdě oddělené** — model nezná pixely, renderer je čistá funkce stavu → obraz. | Izomorfismus, vyměnitelné view (Renderer/AudioView). Platí se pozdě draho → od začátku. |
| DD-02 | S1 | **Trať = parametrická křivka, fyzika 1D** — poloha `s` po arc-length + rychlost `v`; 3D pozice až při renderu. | Drží fyziku triviální i ve 3D; vagon sleduje koleje zadarmo. |
| DD-03 | S1 | **Stack: Three.js + TypeScript + Vite.** | Vize stojí na svahu (3D terén), pozorování je nativně 3D; rychlá iterace = krev laboratoře. |
| DD-04 | S1 | **Začínáme v rohu MIKRO × vysoká věrnost** (jeden vlak, slack action). Tycoon/síť odloženo. | Jádro hodnoty projektu, ne další Tycoon klon. |
| DD-05 | S1 | **Foundations before curtains** — fyzika (kvádry) běží dřív než první strom. | Disciplína proti scope creepu. |
| DD-06 | S2 | **F0 = jednotělesová dynamika** (jeden vagon, reálné síly, šťouchnutí), ne „tuhý tah dokola". | Tuhý tah byl kinematika k zahození; nejmenší kus skutečné dynamiky je přímý základ slack action. |
| DD-07 | S2 | **F2 trakce & adheze vsunuta před palivo** — hmotnost per vůz, notch, `TE=min(F_max,P/v)`, adheze clamp `μ·N`, brzda loko, rozběhové tření. | Trakce logicky předchází palivu; statické tření sjednocuje auto-stop a dává vůli smysl. |
| DD-08 | S3 | **Reverz proti pohybu = protiproudé brzdění (plugging)** — limit adheze (`μ·N`) a `F_max`, ne `P/v`. | `P/v` hyperbola platí jen pro zrychlování (energie do pohybu); na brzdné síle dusila reverz. |
| DD-09 | S3 | **Brzda jako řízené tření**, ne early-`return` výjimka — dodatečný odpor v `applyFriction`. | Izomorfismus „vše je síla"; emergentně dragging brakes, držení svahu, plynulé dojetí. |
| DD-10 | S5 | **Protiproudé brzdění zabírá plným úsilím** (`fraction=1`) → skid. | Plugging je fyzikálně agresivní; dělení `MAX_FORWARD` ho uměle dusilo (67 kN). |
| DD-11 | S6 | **Příčná dynamika jako 1D diagnostika, vykolejení = emergentní fail state** (Úroveň A). Multi-body (B) zamítnuto. | Kolmá síla nemění `s`/`v` → 1D model (DD-02) drží. Homomorfní s přetržením vlaku. |
| DD-12 | S8 | **Trať = ležatá osmička (Bernoulliho lemniskáta)** + most `Y=amplitude·sin(t)`. | Jeden tvar = esíčko (proměnný poloměr) + křížení (most/podjezd). Bernoulli = kulaté laloky. |
| DD-13 | S9 | **Kývání skříně (roll+pitch) jako tlumené torzní oscilátory**, rotační stav na `Body`; kritérium převrácení oddělené. | Rotace nemění `s`/`v` → drží DD-02. Roll = spojitá předzvěst, převrácení = tvrdá statická mez. |
| DD-14 | S10 | **F3 palivo = spotřební zásoby (uhlí+voda)**, tah × `steamPressure`. Písek odložen. | Izomorfní (síla/stav přes params); písek bez mokré koleje = záclona bez základu. |
| DD-15 | S11 | **Otáčkový strop jako multiplikativní útlum tahu** — `v_mech=maxPistonSpeed·π·D/(2·zdvih)`. | Tvrdý strop pevného převodu, nezávislý na měkkém `P/v`; izomorfní se `steamPressure`. |
| DD-16 | S14 | **Skid při provozní brzdě** — `brakeForce()` zvedá sdílený `slipping` flag (tolerance 1,1×). | Izomorfismus tah↔brzda — skid byl fyzikálně funkční, ale neviditelný. |
| DD-17 | S14 | **Proměnná adheze + písek** — `railFactor` škáluje μ, písek (spotřební zásoba, held-key `P`) vrací suchou adhezi; sdílený `adhesionLimit`. | Jediné místo vstupu μ → platí pro tah i brzdu (jeden strop). |
| DD-18 | S14 | **UX redesign ovládání** — status / dolní bar / modální dialog, CSS Grid `auto-fill`. | Ovládání se nevešlo na obrazovku, mobilně nepoužitelné. |
| DD-19 | S15 | **Dron params jako `DroneParams` ve view**, ne v `PhysicsParams`. | Kamera je ryze view, nikdy nevstupuje do simu → drží DD-01 (precedent vypružení neplatí, to se počítá v simu). |

*Pozn.: některá rozhodnutí v diáři nemají číslo DD (deploy přes Actions, slider sklonu, …) —
nejsou architekturní, žijí jen v diáři.*
