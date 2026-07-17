# public/heroes — PLACEHOLDER hero photos ⚠️

Full-bleed team-hero backgrounds (`TeamHero` v2). One per team, keyed by the
fixture `heroImage` field (Bloc 1/2 = coach upload).

**⚠️ PLACEHOLDER — NOT licensed / not the real asset.**
`hero-football-grasset.jpg` is currently a **stand-in** (a copy of the terrain
football field) so the layout/fade can be validated. Replace with BP's real
low-res photo, then the HD version + school media consents (TODO).

No photo for a team → `TeamHero` renders a themed dark gradient fallback
(never a broken hero). A missing/404 file also degrades to the fallback
(`onError`).
