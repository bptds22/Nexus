# Relevé PROD — lecture seule, 2026-10-13 (projet `nrloizyemulbhujrqhgx`)

SELECT sur le catalogue uniquement ; aucune écriture. Comparé à la base locale AVANT W0.

| Objet | Prod | Local avant W0 | Attendu par |
|---|---|---|---|
| `partner_athlete_profile` — md5(`pg_get_functiondef`) | `0d995b80267eb244c974360ecc9a1c8b` | `0d995b80267eb244c974360ecc9a1c8b` | 094804 (corps = local) → **identique, pas de reconstruction** |
| `partner_athlete_profile` — ACL | `{authenticated,postgres,service_role}` | idem | gate 094804 |
| `is_partner_eligible_athlete` — md5 | `5bfd92f0bd9ab0b26b623c9b499f7708` | idem | — |
| `is_partner_eligible_athlete` — ACL | `{anon,authenticated,postgres,PUBLIC,service_role}` | idem | 094803 → `{authenticated,postgres,service_role}` |
| `media_partners` — colonnes (30, même ordre) | identiques | identiques | gates 094801 / 094802 |
| `media_partners` — privilèges de table | anon, authenticated, service_role : tous | idem | 094802 retire le SELECT de table à anon |
| `media_partners` — colonnes lisibles par anon | 30 | 30 | 094802 → 18 |
| `media_partners` — triggers | `set_media_partners_updated_at` | idem | 094801 ajoute `trg_media_partners_garde_colonnes` |
| `is_admin()` — corps | `role = 'ADMIN'` | idem | garde 094801 |
| `partenaires_vitrine()` | absente | absente | créée par 094805 |

## Seul écart : la forme des policies

En prod, les policies de `media_partners` portent `( SELECT auth.uid() AS uid)` (passe
RLS initplan) ; en local, `auth.uid()`. **Sans effet sur W0** : aucune migration W0 ne
redéfinit ces policies, et la gate de 094806 compare noms + rôles, pas le texte.
« Public read approved partners » est identique des deux côtés (`status = 'APPROVED'`,
TO public).

## Effet de 094804 en prod

Athlètes éligibles partenaire : 104 ACTIF, **1 EN_ATTENTE, 1 DESACTIVE**. Ces deux
fiches sont aujourd'hui lisibles par id via `partner_athlete_profile` ; elles ne le
seront plus.
