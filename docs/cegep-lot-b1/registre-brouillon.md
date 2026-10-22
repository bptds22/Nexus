## Chantier cégep — lot B1 « porte coach → cégep » + liste d'attente (branche `feat/cegep-lot-b1-porte-coach`)

**APPLIQUÉ EN PROD le 2026-10-22 à 18:48 UTC, version `20261022184822` (GO BP, `apply_migration`).**
Texte appliqué : md5 `6acdc71770043380b2d80d14df41f82b`, vérifié par la prod avant l'envoi. Rollback
prêt (`supabase/rollback/20261022184822_rollback_cegep_lot_b1_porte_coach.sql`, testé à l'octet en
local) : seulement sur GO de BP.

**Empreintes prod.** Hors B1, identiques avant et après : fonctions 531 `48d318a2…`, policies 378
`22abf0c2…`, triggers 173 `da742fd2…`, tables 175 `282dd3ba…`. Totales avant : 533 `7ecf68fe…` /
378 / 173 / 175 ; après : 536 `04bb3b0a…` / 379 `dcc5ad5f…` / 179 `4f70f2a5…` / 176 `9410e03a…`.
Dormance avant : 0 COACH sur une école fermée, 0 invitation en attente sur un cégep. Preuve sous vrai
rôle en transaction annulée : coach → cégep refusé (`NEXUS_COACH_CEGEP`), coach secondaire → école
secondaire OK, liste d'attente idempotente et lue par soi seul, athlète / insertion directe / `anon`
refusés. Sorties : `docs/cegep-lot-b1/preuves-prod-20261022.txt`.

**Relevé en passant, hors B1 (non corrigé) :** en prod, l'insertion directe d'un coach dans
`school_coaches` échoue en `42P17 infinite recursion detected in policy`, même vers une école
secondaire. Antérieur à B1 (policies inchangées).

**Pour le lot B4 (décision BP 2026-10-22, rien fait) :** à l'écran du choix du rôle, une 4ᵉ option
grisée « Coach cégep — bientôt disponible » à côté d'Athlète / Coach / Recruteur ; au toucher, le
message et un bouton « M'avertir » qui inscrit à la liste d'attente. Mise en forme du message
`NEXUS_COACH_CEGEP` partout où il peut apparaître. Décision 1 acceptée : refus au choix du rôle COACH
pour un invité de recruteur collégial.
