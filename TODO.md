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

Historická revize po klonu na nový stroj; původně bez dostupného Node.
V S45 už `npm run check` a build prošly. Tím nejsou jednotlivé níže uvedené
nálezy automaticky potvrzené ani opravené; před zásahem ověř jejich konkrétní scénář.

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

## Dohra auditu S43/S44 (Copilot; nedotažené opravy)

- [ ] **Dotáhnout C-3 — adheze všech těles.** `sim/Train.ts:583` má od S44 metodu
  `adhesionLimitFor(index)`, ale volá ji jen getter pro index 0 (lokomotiva).
  Brzda (`Train.ts:617`) i tah (`Train.ts:668`) používají dál jen limit
  lokomotivy a volné vozy mají μ=∞ — přesně stav, který audit S43 vytkl.
  Deník S44 tvrdí opak („Callsites UPDATED"); není to pravda.
  **Výhrada S45:** nutnost tohoto rozšíření není doložena. DD-07 a `Train.step()`
  předepisují pohon a brzdu pouze lokomotivě; volné vozy mají brzdu 0.
  Před opravou určit chybný scénář a posoudit soulad s rozsahem modelu.
  Viz [kalibrace S45](docs/CALIBRATION_2026-09-09.md).
- [ ] **Zavolat `Renderer.dispose()`.** Metoda od S44 existuje (a po opravě
  je typově korektní), ale nikdo ji nevolá — leak listenerů je teď
  „odstranitelný, leč neodstraňovaný". Dává smysl při HMR/rebuildu scény.

### Dokumentace

- [ ] **`sim/serviceSite.ts` chybí ve stromu architektury v `README.md:104`.**
  Vznikl v S41; Key Files v `AGENTS.md` už ho mají (S42), README ještě ne.

