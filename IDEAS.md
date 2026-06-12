# IDEAS — TrainsLab

Nezralé směry a výzkumné hypotézy. Jakmile je řez připravený k realizaci,
přesune se do `TODO.md`; dokončená práce patří do `DONE.md`.

## Prostor experimentů

- **Transport Tycoon vrstva** — makro měřítko × nižší věrnost: síť, ekonomika,
  rozvozy. Jiný roh mřížky než současné mikro × vysoká věrnost; pravděpodobně
  samostatný experiment, ne bobtnání stávajícího jádra.
- **ASCII renderer** — mikro × nízká věrnost nad týmž simem. Levný sanity check
  sim/view splitu a nostalgická alternativa Three.js view.

## Hlubší fyzika

- **Sloshing kapaliny v cisterně** — pohyb kapaliny mění těžiště vagonu a zpětně
  ovlivňuje dynamiku. Vyžaduje nový stav, ale neměl by plíživě zavést plný multi-body model.
- **Přetržení vlaku** — draft síla překročí mez spřáhla. Přirozený fail state
  slack action; odpojený vůz může využít existující `freeBodies`.
- **Průběžná pneumatická brzda** — tlaková vlna a prodleva brzdění soupravou.
  Další podélná vlna, izomorfní se slack run-out.
- **Dynamický prokluz** — vlastní rotační stav kola a creep křivka: adheze roste
  do malého skluzu a potom klesá. Dal by hlubší význam písku i zvuku výfuku.
- **Klopení trati** — cant jako další vstup příčné diagnostiky; vyžaduje up-vektor
  koleje ve view a úpravu kritéria převrácení.
- **Nadalovo kritérium** — vyšplhání okolku jako odlišný režim vykolejení.
- **Dva podvozky na jedné křivce** — geometrie dlouhého vozu, yaw a přesah v oblouku.
- **Příčný DOF dvojkolí** — hunting, kuželový jízdní obrys a fyzické opuštění koleje.
  To už vědomě opouští 1D monorail a patří do jiného rohu mřížky.

## Výzkumná osa

- **H1:** uspokojení roste s plynulostí a předvídatelností pohybu.
- **H2:** emergentní navazování slack action působí lépe než skriptovaná animace.
- **H3:** pomalost a opakování smyčky mají meditativní hodnotu.

Každý budoucí experiment má testovat jednu hypotézu a mít pozorovatelný výstup.

## Vizualizace

- **Jiskry při skidu/prokluzu** — částice u kol při protiproudém brzdění nebo
  agresivním rozjezdu.
- **Kamera sledující vybraný vagon** — alternativa k dronu kolem lokomotivy.
- **Další doladění krajiny** — hustota a velikost stromů, barevná pásma terénu,
  případně větší terénní deska, pokud bude při vzdálené kameře vidět její okraj.

## Zvuk

- **Výfuk podle otáček kol při prokluzu** — `ExhaustClock` dnes čte rychlost vlaku;
  při dynamickém prokluzu by měl číst efektivní obvodovou rychlost hnacích kol.
- **Odvodit chuff fuse z průměru kola** — aktuální `CHUFF_FUSE_SPEED` je vázaný na
  výchozí `driverDiameter`. Dynamické odvození by drželo fyzikální vztah i po změně slideru.

## Optimalizace

- **Předpočítat vzorky křivky** — pokud se `signedCurvature` nebo `positionAt` stanou
  měřitelným výkonovým problémem, interpolovat nad cache vzorků trati. Memoizace getterů
  závislých na měnícím se `s`/`v` zůstává nevhodná kvůli riziku zastaralého stavu.

## Lab nástroje

- **Kalkulačka silové bilance** — max. sklon vs. adhezní/výkonový strop a hmotnost
  soupravy, buď jako diagnostický skript v `tools/`, nebo jako read-only část Lab panelu.
