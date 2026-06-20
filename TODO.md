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

### Domek s napaječkou

- [ ] **Domek + napaječka** — lowpoly bouda, vodní jeřáb s ramenem nad kolejí
  a hromada uhlí v oku odbočky; view v `WorldView`.
- [ ] **Postupné auto-doplnění zásob** — stojící lokomotiva na odbočce plynule
  doplňuje vodu a uhlí. Závisí na fázi 3.
