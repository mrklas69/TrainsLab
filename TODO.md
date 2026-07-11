# TODO — TrainsLab

Pouze otevřené a rozpracované úkoly. Hotová práce je v `DONE.md`, kontext a
rozhodnutí v `docs/diary/` a `docs/DESIGN_DECISIONS.md`.

Markery: `[ ]` čeká · `[~]` rozděláno · `[!]` priorita.

## Interakce vozů a topologie sítě

### Výhybky — fáze 3: jízda po grafu

- [ ] **Náhodné větvení volného vozu** — vrátit `randomBranch`, dočasně odebrané
  v S37, až bude průjezd větví plně podporovaný.

### Výhybky — fáze 4: interakce na grafu

- [ ] **Vagon, srážky a rázy přes větve** — kontakty volných vozů a soupravy
  musí respektovat zvolenou trasu; nejtěžší část síťové fáze.
- [ ] **UI pro odpojování/zapojování vozů soupravy** — vybrat spřáhlo mezi vozy,
  odpojit ho na volné těleso a znovu zapojit při bezpečném dotyku/nízké relativní
  rychlosti. UI musí jasně ukázat aktivní spřáhlo a platnost akce.

## Nálezy revize 2026-07-10

Revize po klonu na nový stroj. **Nic z toho není ověřené `tsc`/`npm run check`** —
na stroji chybí Node. Před opravou zprovoznit toolchain.

### Kód

- [!] **GPU únik: `InstancedMesh.instanceMatrix` se neuvolňuje.**
  `view/WorldView.ts:104` — `disposeObject` volá `geometry.dispose()` a
  `material.dispose()`, ale nikdy `object.dispose()`. Buffer matic instancí žije
  na meshi, ne na geometrii. Týká se šesti instancovaných meshů (pražce, mostovka,
  pilíře, kmeny, koruny, kameny). Slider sklonu volá `rebuild` na **každý `input`
  event** (`ui/ControlPanel.ts:398`), takže jedno tažení nechá viset desítky bufferů.
  Oprava: v `traverse` přidat `if (object instanceof THREE.InstancedMesh) object.dispose();`

- [ ] **`slipping` nemá diagnostiku.** `sim/Train.ts:57` je holý boolean, ačkoli
  `CLAUDE.md` žádá, aby fail/skid stav nesl *čím a při jakém stavu* nastal.
  Sourozenec `derailed` to plní (`derailReason`, `derailSpeed`) a UI to zobrazuje;
  prokluz vzniká ze dvou příčin — tah (`Train.ts:689`) a brzda (`Train.ts:609`) —
  a UI o obou hlásí jen `· PROKLUZ`. Sdílení flagu je záměr (`Train.ts:602`),
  chybějící diagnostika ne. Izomorfismus vůči `derail` nedodržen.

- [ ] **Dvě implementace křivosti.** `sim/TrackNetwork.ts:148` (vzorkuje přes uzel
  na navazující segment — používá ji sim) a `sim/TrackSegment.ts:71` (jednostranné
  diference na koncích otevřené křivky — používá ji `tools/check-radius.ts:42`).
  Obě jsou ve svém kontextu správně, ale **návrhová kalkulačka tak měří jinou
  veličinou, než jakou cítí vlak.** Čísla pro ladění geometrie nemusí sedět.

- [ ] **Mrtvý odkaz v komentáři.** `sim/trackData.ts:11` ukazuje na
  `tools/check-switch.ts`, který zanikl v S38. Opravit na `check-connector.ts` /
  `check-network.ts`.

### Dokumentace

- [!] **`CLAUDE.md:42` popisuje trať zastarale** — „ležatá osmička (asymetrická,
  izotropní stretch)". Skutečnost je Bernoulliho lemniskáta se dvěma výhybkami
  a C² spojkou. `AGENTS.md:42` to má správně (včetně DD-26). Pozor na past:
  `CLAUDE.md` je novější podle gitu (S40 vs. S39), ale právě v tomhle řádku
  zastaralejší — nesjednocovat mechanicky „podle data".

- [ ] **`sim/serviceSite.ts` chybí v Key Files** v `CLAUDE.md` i `AGENTS.md`
  a ve stromu architektury v `README.md:104`. Vznikl v S41, seznamy modulů se
  neaktualizovaly.

- [ ] **`AGENTS.md` navíc postrádá** `view/ExhaustClock.ts` a `view/carModels.ts`.

- [ ] **`AGENTS.md` × `CLAUDE.md` driftují.** Dva overlaye téhož obsahu pro dva
  agenty. Rozhodnout: jeden kanonický zdroj, nebo vědomě přijmout „Codex =
  zkrácená verze" a rozdíl zapsat. Dnes je to nezapsaný drift.

- [ ] **`npm run check` není v README ani v `%END`.** CI ho spouští před buildem
  (`.github/workflows/deploy.yml:29`), README sekce Vývoj uvádí jen `dev`/`build`/
  `preview` a projektový `%END` krok 2 žádá jen `tsc` + `build`. Rozbité regrese
  se tak objeví až po pushi, kdy je commit v historii.

### Rozbité vazby na globální kontext

Stroj byl přeinstalován; globální `~/.claude/` se staví znovu. Řeší se
v globálním `TODO.md` (úkol *Metodika: globální × projektová pravidla*).

- [ ] **`~/AGENTS.md` neexistuje.** Odkazují na něj `CLAUDE.md:3,60`,
  `AGENTS.md:3,58`, `docs/PROMPTS.md:5`.
- [ ] **Makra `%DOCS`, `%THINK`, `%AUDIT:CODE`, `%AUDIT:DOCS` nemají definici.**
  `docs/PROMPTS.md:29` (`%END` krok 1) volá `%DOCS`; `%BEGIN` krok 3 vyhodnocuje
  kadenci auditů. Ledger v `docs/PROMPTS.md:54` hlídá kadenci maker, která nelze
  spustit.
- [ ] **Práh `%CALIBRATE` má dvě hodnoty:** globálně ~40 sezení,
  `docs/PROMPTS.md:59` ≥ 15. Dva zdroje pravdy pro totéž číslo.
- [ ] **`%BEGIN`/`%END` existují dvakrát** pod týmž jménem s jinými kroky
  (globální: deník, půlnoc; projektový: `git fetch`, cadence, dva commity).
  Není zapsáno, který platí, když se `claude` spustí z repozitáře.
