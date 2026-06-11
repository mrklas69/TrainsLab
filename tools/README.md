# Geometrické nástroje

- `check-network.ts` — regresní kontrola produkční topologie a hlavní trasy.
- `check-connector.ts` — regresní kontrola křivosti a C² napojení spojky.
- `check-train.ts` — regrese fail-state volného vozu.
- `check-radius.ts` — návrhová kalkulačka variant hustoty bodů a amplitudy terénu.

Regresní kontroly spouští `npm run check`. Návrhová kalkulačka záměrně porovnává
varianty a není pass/fail testem.
