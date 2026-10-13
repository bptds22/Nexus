# Lot W0 — application PROD, étape 1 (GO BP 2026-10-13)

Projet `nrloizyemulbhujrqhgx`. Une migration à la fois (`apply_migration`, transaction
unique : une gate qui lève annule toute la migration). 094806 appliquée à l'étape 3 (plus bas).

Les fichiers ont été renommés à la version enregistrée par la prod (convention des lots
précédents). Contenu des fichiers = SQL appliqué, à l'octet.

| Fichier (ancien n°) | Version prod | Relevé avant | Relevé après | `admin_operations` |
|---|---|---|---|---|
| `…141550_w0_media_partners_garde_colonnes` (094801) | 20261013141550 | trigger `set_media_partners_updated_at` seul | + `trg_media_partners_garde_colonnes:O`, INVOKER, ACL `{postgres,service_role}` | `dcd0ceb3-506c-4faa-8b6c-413598ca9286` |
| `…141612_w0_media_partners_lecture_anon` (094802) | 20261013141612 | anon : SELECT de table, 30 colonnes | anon : 0 SELECT de table, 18 colonnes | `ccf8bdc4-f11e-45fc-b903-dd3a506e99d6` |
| `…141628_w0_is_partner_eligible_athlete_acl` (094803) | 20261013141628 | `{anon,authenticated,postgres,PUBLIC,service_role}` | `{authenticated,postgres,service_role}` | `7d953f7d-6662-4051-97e6-4a13f4440f9b` |
| `…141657_w0_partner_athlete_profile_actif` (094804) | 20261013141657 | md5 `0d995b80…`, sans filtre ACTIF | md5 `bbb64200…` (= local), filtre ACTIF, ACL inchangée | `3b655578-daed-46ec-b52a-3fd9ac5583eb` |
| `…141717_w0_partenaires_vitrine` (094805) | 20261013141717 | absente | DEFINER, ACL `{anon,authenticated,postgres,service_role}` ; policies SELECT de media_partners inchangées | `fc9cd1b1-448d-4cbd-acfa-ea3669492970` |

Aucune gate n'a échoué ; aucun rollback.

## Vérification prod (API publique, clé anon, lecture seule)

- `media_partners?select=contact_email` / `contact_name` → `42501 permission denied`.
- `rpc/is_partner_eligible_athlete` → `42501 permission denied for function`.
- `rpc/partenaires_vitrine` → 4 partenaires, tous `APPROVED`, 3 à l'accueil ; 18 clés, aucune `contact_*`.
- Carrousel actuel (lecture directe anon, avant déploiement du nouveau code) → 3 lignes : fonctionne.

## Étape 3 — 094806 (GO BP 2026-10-13, après déploiement du carrousel `8cb7a152`)

Deux premières tentatives refusées par le connecteur MCP (`Invalid or expired requestState`) :
rien n'a été appliqué (policies et `schema_migrations` relevées inchangées). Appliquée après
reconnexion.

| Fichier (ancien n°) | Version prod | Relevé avant | Relevé après | `admin_operations` |
|---|---|---|---|---|
| `…173942_w0_media_partners_lecture_connectes` (094806) | 20261013173942 | SELECT : Admins `{authenticated}`, Partners own `{public}`, **Public read approved `{public}`** | SELECT : Admins `{authenticated}`, **Anon read approved `{anon}`**, Partners own `{public}` ; UPDATE inchangées | `62f78353-1d0e-4158-a4b0-456356a32a66` |

Vérification prod, lecture seule (`begin read only`, rôle et JWT simulés) :

| Qui | lignes `media_partners` | lignes avec contact | `partenaires_vitrine()` |
|---|---|---|---|
| coach non partenaire (`nexus.coachs@`) | 0 | 0 | 4 |
| admin (`bptds22@`) | 4 | 4 | 4 |
| anon | 4 (18 colonnes) | — | 4, tous `APPROVED` |

Aucune gate n'a échoué ; aucun rollback. **Lot W0 entièrement appliqué en prod.**
