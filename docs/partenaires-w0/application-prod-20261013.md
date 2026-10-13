# Lot W0 — application PROD, étape 1 (GO BP 2026-10-13)

Projet `nrloizyemulbhujrqhgx`. Une migration à la fois (`apply_migration`, transaction
unique : une gate qui lève annule toute la migration). **094806 NON appliquée.**

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

## Reste à faire

1. Déployer le carrousel qui lit par `partenaires_vitrine()` (`app/components/PartnerCarousel.tsx`).
2. Puis, sur GO : `20261013094806_w0_media_partners_lecture_connectes.sql` (fichier à renommer à sa
   version prod une fois appliqué).
