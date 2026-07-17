# public/terrains — PLACEHOLDER assets ⚠️

These `*.jpg` were extracted from `docs/reference/terrains-maitre-v2.html`.

**⚠️ PLACEHOLDER — NOT licensed for production.** They are low-res stock
previews (baseball.jpg is a recognizable Dodger Stadium with dugout branding).

**TODO (licence) :** replace each with a licensed / generic field photo before
prod. The swap is code-free — `TerrainStage` reads `/terrains/{sportKey}.jpg`,
so dropping a same-named file over these is the only step.

Present (all 7 sports covered): `football.jpg`, `hockey.jpg`, `baseball.jpg`,
`basketball.jpg`, `soccer.jpg`, `volleyball.jpg` (flag reuses `football.jpg`).
The v2 spec only ever shipped 4 photos; basketball/soccer/volleyball were added
later by BP (v2.4). `TerrainStage` still keeps a drawn-court fallback for those
three (`CourtSvg`) that renders only if the photo 404s.

`flag.jpg` was **removed** — its Alamy watermark is tiled across the whole image
(uncroppable), so flag reuses the watermark-free `football.jpg` as placeholder
(flag football is played on a football field). Add a licensed flag photo →
point `SPORT_CONFIGS.flag.asset` back to `/terrains/flag.jpg`.

Absent (no image in the spec): basketball / soccer / volleyball. The spec only
ever contained **4** photos (football, flag, hockey, baseball) — these three were
never extractable. `TerrainStage` draws a **procedural SVG court** for them
(`CourtSvg`, lit surface + regulation lines) so all 7 sports show a legible
terrain. Drop a licensed photo in and set `SPORT_CONFIGS.<sport>.asset` to switch
from the drawn court to the photo.
