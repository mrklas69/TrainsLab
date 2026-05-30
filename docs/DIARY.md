# DIARY — TrainsLab

Index sezení. Záznamy v `docs/diary/YYYY-MM-DD.md`.
Více sezení v jednom dni = sekce `## Sezení N` v témže souboru.

| Datum | Sezení | Obsah |
|-------|--------|-------|
| 2026-05-29 | 1 | Kick-off — koncept TrainsLab, mřížka experimentů, slack action jako nika, PoC plán (F0–F4), DD-01…05 |
| 2026-05-29 | 2 | Stavba PoC: F0 jednotělesová dynamika → F1 slack action → F2 trakce & adheze. DD-06, DD-07 |
| 2026-05-29 | 3 | Reality check: reverz = protiproudé brzdění, brzda = řízené tření, prototyp AudioView. DD-08, DD-09 |
| 2026-05-29 | 4 | Publikace dema na GitHub Pages: base `/TrainsLab/`, Actions deploy, oprava `build_type: legacy → workflow` |
| 2026-05-29 | 5 | README, slider sklonu (live rebuild tratě), vizualizace napětí ve spřáhlech, stavový semafor loko, skid při protiproudém brzdění. DD-10 |
| 2026-05-29 | 6 | `%AUDIT:CODE` (opravy D1–D3, K1–K3), diskuse omezení rychlosti (chybí otáčkový strop), návrh příčné dynamiky & vykolejení. DD-11 |
| 2026-05-29 | 7 | Příčná dynamika: `Track.radius(s)` (křivost horizontálního průmětu) + `lateralAcceleration` diagnostika. Žebřík opuštění monorailu (kývání = Úr. 1, drží DD-02) |
| 2026-05-29 | 8 | Esíčko + most: trať = ležatá osmička (Bernoulli), kritérium převrácení → fail state (vykolejení). DD-12 |
| 2026-05-30 | 9 | Kývání skříně (roll/pitch jako tlumené torzní oscilátory, `Track.signedCurvature`), gradient blízkosti meze (žár ∝ v²·κ), tuning vykolejení, minimalizace panelu. DD-13 |
| 2026-05-30 | 10 | Ovládání kamery (WASD/QE/ZX, held-key v Rendereru), F3 palivo (uhlí + voda, parní tlak). Souběžné sezení z téže báze — kývání duplikováno, ponecháno S9. DD-14 |
| 2026-05-30 | 11 | Otáčkový strop rychlosti — `v_mech = maxPistonSpeed·π·D/(2·zdvih)`, tah padá k mezní rychlosti (kolo = převod). Uzavřeno téma rychlosti z S6. DD-15 |
