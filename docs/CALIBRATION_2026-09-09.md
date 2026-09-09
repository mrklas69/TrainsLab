# Kalibrace procesu — 2026-09-09 (S45)

Dokončená revize `%CALIBRATE:PROJ`. Rozsah: poslední kalibrace S28,
sezení S29–S44 a dnešní obnovení projektu S45. Zdroje jsou projektové deníky,
pravidla a Git historie; dobové výsledky testů nejsou novým ověřením aplikace.

## Závěr

Hlavní ztráty vznikaly neúplnými podmínkami přijetí změny a nepodloženými
závěry auditu. Častější audit sám tyto příčiny neodstraní: v S39 našel reálnou
regresi, v S43 naopak vytvořil falešné nálezy a následné opravy rozbily build.
Pravidla KISS, DRY a sim/view split není třeba zpřísňovat; potřebují kontrolu
proti skutečnému modelu, zapojení změny a pozorovatelnému výsledku.

## Nálezy a opora

Následující tabulka zachycuje stav před přijetím změn v A18.

| Priorita | Nález | Evidence a důsledek |
|---|---|---|
| Kritické | Audit zaměňoval návrh rozšíření za opravu vady. | S43 C-1 označil matematické použití Three.js za porušení DD-01, ačkoli je `AGENTS.md` výslovně dovoluje. C-6 žádal abstrakci pro audio, které už dostávalo jen číslo. S44 tyto závěry nepodrobil dostatečné oponentuře. |
| Kritické | Hlášení dokončení nemělo oporu v zapojení ani ověření. | Commit `47c4eaa` odstranil používaný import a přidal volání neexistujících metod. C-3 změnil jen getter; tvrzení o změně callsites je vyvráceno diffem. `Renderer.dispose()` existuje bez volajícího. Korekce: závěr diáře 2026-07-12, commity `bd881b2` a `316a43f`. |
| Doporučené | Měření pokrývalo jen část cíle. | S36 měl kalkulačky, přesto se geometrie vracela; S37 ověřil dosednutí, ale přehlédl křížení. S38 test spotřeby písku neověřil potlačení prokluzu. S41 už rozlišuje stojící loko u jeřábu a průjezd: příklad testu účinku i situace, kdy účinek nastat nemá. |
| Doporučené | Korekce se nedostala do vstupního rozcestníku. | Index S44 dál tvrdil dokončení všech oprav, přestože vlastní deník to vyvrací. `%BEGIN` může chybu znovu převzít. Stejně problematický je dvojí popis zdroje cadence: jednou diář, podruhé ledger. |
| Doporučené | Lokální ověření se rozešlo s CI. | Od S39 CI spouští `npm run check` a `npm run build`; projektový `%END` stále požaduje pouze `tsc` a build, přičemž build už `tsc` obsahuje. Testy existují, ale postup je může vynechat. |

### C-3 je potřeba znovu posoudit

Současný `Train.step()` výslovně aplikuje pohon a brzdu pouze na lokomotivu;
volné vozy dostávají brzdnou sílu 0. To odpovídá DD-07, S35 a odložené
průběžné brzdě v IDEAS. `adhesionLimitFor()` je volána jen pro index 0.
Z toho plyne, že S44 nepřineslo deklarované rozšíření. **Neplyne z toho, že
rozšíření na všechny vozy je nutnou opravou současného modelu.** K posouzení
je třeba konkrétní chybný scénář; plošné omezení všech sil adhezí by navíc
vyžadovalo samostatné zdůvodnění. Toto je kontrola premisy úkolu, nikoli nový
úplný fyzikální audit. TODO proto zůstává otevřené s výhradou k zadání.

## Co zachovat a co se vracelo

- S29/S30: malý fyzikální řez, předchozí diskuse modelu, průchod odpovídajícími
  vrstvami a uživatelův test. S31: rozdělení rendereru podle odpovědností.
- S34: přijetí dokončeného PoC; další nápady nebyly vydávány za nedodělky.
  Nový směr S35 byl výslovnou volbou uživatele, nikoli svévolné rozšiřování.
- S35: oprava deformace laloku po prvním neprojetelném tvaru; S36: vrácení
  geometrie při zachování použitelné infrastruktury; S37: více nahrazených
  konstrukcí a doplnění chybějící podmínky křížení. Počty pokusů v deníku
  jsou přibližné a část změn reagovala na postupně upřesňované zadání.
- S38: přepracování účinku písku; S41: oprava mute po uživatelově testu;
  S43/S44: opravné commity po chybné auditní implementaci.
- S40: oddělení upgradu Vite od funkčních změn omezilo rozsah ověřování.

Zpětná vazba v denících opakovaně oceňuje odhalení latentní chyby uživatelem
nebo nezávislou kontrolou a vytýká neúplné ověření účinku. U některých starších
`Kudos!` není doložen udělující; nevyvozuji z nich skóre ani nové ocenění.
Samostatná položka `Vráceno` tehdy nebyla zavedena: výše jsou jen případy
doložené narativem, nikoli úplná metrika přepracování. Globální pravidla už
záznam vrácené práce i ověřování efektu obsahují; neduplikovat je v overlayi.

## Rekalibrace kadence

| Kontrola | Pozorované intervaly | Výsledek revize |
|---|---|---|
| CODE | S25→31: 6; S31→38: 7; S38→39: 1 (na žádost); S39→41: 2; S41→43: 2 (sporný audit). | Ponechat 6 sezení / +250 LOC. Krátké intervaly nejsou důkazem nutnosti auditu každé 1–2 sezení. |
| DOCS a pruning | S26→40: 14; v S40 odstraněn významný dluh včetně 75 hotových položek TODO. | Ponechat práh 12; problém je i nedodržování průběžného `%DOCS`. Jediný další interval neopravňuje přesnější novou konstantu. |
| CALIBRATE:PROJ | S16→28: 12; S28→45: 17. | Ponechat 15; upozornění při překročení o 2 dnes vedlo k revizi. Ledger aktualizovat na S45. |
| Stale Příště | Výhybky S37–S40 se vracely, v S41 následoval konkrétní průjezd a servis. | Ponechat 5 po sobě jdoucích sezení; obecný milník ani jiné dílčí řezy nesčítat jako jednu stagnující položku. |

S43 je historicky provedený audit, ale jeho závěry jsou částečně vyvrácené;
nepovažuji jej automaticky za nový důvěryhodný výchozí stav. CODE ledger
konzervativně zůstává S41 (dnes odstup 4), s odkazem na tento rozpor.
Čistý růst řádků může skrýt přepis nebo mazání; přijaté zpřesnění LOC je
v [projektových makrech](PROMPTS.md). Diff od závěru S41 (`f7f0485`) do obnoveného HEAD má 52 přidaných
a 24 odstraněných řádků v `src/`, tedy je pod 250 i při součtu obou hodnot.
Počet auditů není ukazatel kvality a kalendářní pauza sama nemění kód.

## Přijetí změn — A18

Uživatel schválil všechny čtyři návrhy odpovědí **A18 Ano** dne 2026-09-09.
Závazné znění je přesunuto do těchto zdrojů, aby report netvořil druhou kopii:

| Přijatá změna | Zdroj pravidla |
|---|---|
| Podmínky přijetí netriviální změny | [AGENTS.md](../AGENTS.md), doménové rozšíření `%THINK` |
| Opora auditního nálezu a doložení zapojení opravy | [AGENTS.md](../AGENTS.md), Opora auditního nálezu a opravy |
| Shoda lokálního ověření s CI | [PROMPTS.md](PROMPTS.md), `%END` krok 2; příkazy také v [README](../README.md) |
| Jednoznačný ledger a doručení korekcí | [PROMPTS.md](PROMPTS.md), Cadence a `%END` krok 1 |

### Zkouška návrhů na konkrétních případech

- S33 (dvě vizuální konstanty): žádná povinná nová testovací infrastruktura.
- S37: kontrola průsečíků by doplnila chybějící podmínku; samotné dosednutí
  oblouků by návrh nepřijalo. Změna uživatelova záměru zůstává legitimní.
- S43 C-1/C-6: přípustná matematika a předání čísla nejsou porušení hranice.
- S44 C-3/C-7: nezapojené API neprojde jako dokončený funkční zásah.
- Přepis 200 řádků za 200 není nulová změna; přesun souboru bez změn obsahu
  při rozpoznání rename v Gitu nepřidává LOC. Číslo je podnět, ne náhrada úsudku.
- Dnešní obnova a revize dokumentů: ověření Gitu a dokumentů stačí k jejich
  převzetí; nevydává se za otestovanou aplikaci ani nespouští další audit sama.

## Provedené změny

Revize dokončena, číselné prahy ponechány, CALIBRATE ledger posunut na S45.
Index S43/S44 opraven podle již existující korekce; u C-3 v TODO doplněna
výhrada k premise. Po A18 zapsána všechna čtyři schválená pravidla, dorovnán
README a uzavřen související úkol v TODO přesunem do DONE.
Globální pravidla, zdrojový kód, dependencies ani CI se nemění.

<!-- nové záznamy vkládej NAD tento řádek -->
