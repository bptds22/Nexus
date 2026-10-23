# Lot A — preuves exigées à l'apply en prod

## Le cégépien témoin (2026-10-23, GO BP)

Un athlète réel, actif, qui avait déclaré son cégep en texte libre (`ecole_non_listee`), a été
rattaché à ce cégep : `athletes.school_id` seulement, la seule colonne que lit
`athlete_est_cegepien`. Trace : `admin_operations` `RATTACHEMENT_CEGEPIEN_TEST_LOT_A`
(ids seulement). On le retrouve ainsi, sans écrire son id :

```sql
select (details->>'athlete_id')::uuid from public.admin_operations
 where operation = 'RATTACHEMENT_CEGEPIEN_TEST_LOT_A' order by le desc limit 1;
```

Effets de bord constatés : `updated_at` et `profile_completion` (45 → 50, `school_id` compte
dans le calcul) recalculés par leurs triggers. Aucune notification, aucun journal, aucun appel
réseau (`recruiter_activity_log`, `activities`, `athlete_notifications`, `net.http_request_queue`
inchangés) ; `ecole_non_listee`, son compte `users` et les autres fiches inchangés (md5).

Avant l'apply (relevé 2026-10-23, sous vrai JWT) : c'est le seul cégépien en prod, et le
recruteur collégial le voit encore — lecture directe 1, `recruiter_search_athletes` 1, fiche 1.

## À prouver juste après l'apply (vrai JWT, jamais superuser)

| Compte | Lecture directe `athletes` | `recruiter_search_athletes` | `recruiter_athlete_profile` |
|---|---|---|---|
| Recruteur collégial (R1 Free et R2 Pro) | **0** (était 1) | **0** (était 1) | **0** (était 1) |
| Recruteur sans école | 0 | 0 | 0 |
| Admin | **1** | — (réservé recruteur) | — |
| Partenaire | inchangé | — | — |

Plus : `athletes ancrés CEGEP` vu par le recruteur collégial = 0 ; ses athlètes secondaire,
civil et sans ancrage inchangés ; les matchs collégiaux toujours visibles ; coach, athlète et
`anon` identiques à avant. Si le recruteur collégial voit encore le témoin : rollback
(`supabase/rollback/20261020190000_rollback_cegep_lot_a_base.sql`) sur GO.
