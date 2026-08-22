# Escalade de privilège — `users.school_id` hors du garde-fou

**Trouvé le** 2026-08-21, en marge du chantier « messagerie admin » (diagnostic du rôle
à donner à l'identité de service).
**Statut : DOCUMENTÉ, NON CORRIGÉ.** Le correctif dépasse le lot messagerie et exige
son propre lot avec preuves par rôle — voir « Ce que le correctif implique ».
**Vérifié au catalogue prod** (`nrloizyemulbhujrqhgx`), pas à partir d'un fichier de
migration ni d'un résumé.

---

## 1. Le mécanisme

La policy `users update own` autorise un utilisateur à modifier sa propre ligne :

```
qual:       id = auth.uid()
with_check: id = auth.uid()
            AND user_privileged_cols_unchanged(role, status, is_platform_admin,
                                               context, is_school_admin)
```

`user_privileged_cols_unchanged` (posée par la migration `20260520120000_pin_privileged_user_columns`)
compare **cinq colonnes** entre la valeur soumise et la valeur en base :

```sql
SELECT EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()
    AND role              IS NOT DISTINCT FROM p_role
    AND status            IS NOT DISTINCT FROM p_status
    AND is_platform_admin IS NOT DISTINCT FROM p_is_platform_admin
    AND context           IS NOT DISTINCT FROM p_context
    AND is_school_admin   IS NOT DISTINCT FROM p_is_school_admin
);
```

`public.users` a **29 colonnes**. `school_id` n'est pas dans les cinq. Elle est donc
librement modifiable par son propriétaire.

Or `school_id` alimente `current_user_school_id()` :

```sql
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET row_security TO 'off' SET search_path TO 'public'
AS $$
DECLARE v_role text; v_school_id uuid;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role = 'ATHLETE' THEN
    SELECT school_id INTO v_school_id FROM public.athletes WHERE user_id = auth.uid();
  ELSE
    SELECT school_id INTO v_school_id FROM public.users WHERE id = auth.uid();
  END IF;
  RETURN v_school_id;
END;
$$;
```

… qui gouverne **12 policies** du schéma `public`.

## 2. La requête d'exploitation

Sous une session authentifiée ordinaire (rôle `COACH`, `RECRUTEUR`, `PARENT` ou
`PARTNER` — voir §4 pour `ATHLETE`) :

```sql
UPDATE public.users
   SET school_id = '<uuid de l''école visée>'
 WHERE id = auth.uid();
```

`role`, `status`, `is_platform_admin`, `context` et `is_school_admin` sont inchangés :
le garde-fou renvoie `true`, `id = auth.uid()` est vrai, **l'UPDATE réussit**.

L'appelant obtient immédiatement, sur l'école visée :

- la lecture de toutes ses équipes ;
- la lecture de son **roster staff complet** (`school_coaches`) ;
- la **création d'équipes** chez elle.

## 3. Les trois policies sans test de rôle

Ce sont celles qui ne demandent rien d'autre que l'égalité d'école — donc celles que
`school_id` suffit à ouvrir :

| Table | Policy | Cmd | Expression |
|---|---|---|---|
| `teams` | `Coaches see their school teams` | SELECT | `school_id = current_user_school_id()` |
| `teams` | `Coaches create teams` | INSERT | `school_id = current_user_school_id()` |
| `school_coaches` | `coaches read school roster` | SELECT | `school_id = current_user_school_id()` |

Malgré leur nom, **aucune des trois n'appelle `is_coach()`** ni ne vérifie une
appartenance à `school_coaches`. Le nom dit « Coaches », l'expression dit « quiconque
dont `current_user_school_id()` vaut cette école ».

Les neuf autres policies qui dépendent de `current_user_school_id()` sont mieux
gardées et ne sont pas exploitables seules :

- `athletes` — `coaches read own athletes`, `coaches can claim unclaimed school athletes`,
  `coaches assign unclaimed school athletes`, `coaches reassign athletes within school` :
  toutes exigent `is_coach()` en plus, et `role` **est** dans le garde-fou.
- `invitations` — `Users invite from their own school` : exige `invited_by = auth.uid()`.
- `teams` — `Coaches update teams`, `Coaches delete teams`, `Athletes see their teams`.
- `users` — `cegep admin read school recruiters` : exige `is_cegep_admin()`, donc
  `role = 'RECRUTEUR'` **et** `is_school_admin = true`, deux colonnes gardées.

## 4. Pourquoi les triggers de synchronisation ne rattrapent pas

`users.school_id` est normalement dérivée de `school_coaches`. Deux triggers l'entretiennent :

```
trg_sync_user_school_on_coach_change  AFTER INSERT OR UPDATE ON public.school_coaches
                                      EXECUTE FUNCTION sync_user_school_from_coaches()
trg_sync_user_school_on_coach_remove  AFTER DELETE ON public.school_coaches
                                      EXECUTE FUNCTION sync_user_school_on_coach_remove()
```

**Les deux sont posés sur `school_coaches`, pas sur `users`.** Un `UPDATE` direct de
`users.school_id` ne les déclenche donc pas et n'est **pas** ramené à la valeur
légitime. Il ne le sera qu'au prochain `INSERT` / `UPDATE` / `DELETE` d'une ligne
`school_coaches` concernant cet utilisateur — c'est-à-dire potentiellement jamais.

Il n'existe aucun trigger sur `public.users` qui contrôle `school_id` : la table porte
`trg_check_recruiter_domain` (BEFORE INSERT), `on_user_created_link_athlete`,
`trg_create_subscription`, `trigger_backfill_athletes_coach`, `trg_sync_athlete_context`
(UPDATE OF context) et `trg_users_updated_at`. Aucun ne regarde `school_id`.

### Deux atténuations — aucune n'est une barrière

- **Le rôle `ATHLETE` n'est pas exploitable par ce chemin.** `current_user_school_id()`
  lit `athletes.school_id` pour lui, pas `users.school_id`. Un athlète devrait passer
  par `athletes`, dont les policies UPDATE sont une autre surface.
- **Les fiches athlètes restent protégées.** `coaches read own athletes` exige
  `is_coach()`, et `role` est gardé — un non-coach ne les atteint pas ainsi.

Ce qui reste exposé — équipes et roster staff de n'importe quelle école, plus la
création d'équipes — est réel et suffisant pour justifier un correctif.

## 5. Ce que le correctif implique

Le geste évident — ajouter `school_id` (et `primary_team_id`) aux colonnes épinglées —
**change la signature de `user_privileged_cols_unchanged`**. PostgreSQL ne permet pas
d'ajouter un paramètre par `CREATE OR REPLACE` : cela crée une surcharge. Il faut donc :

1. créer la fonction à 6 (ou 7) paramètres ;
2. **supprimer et recréer la policy `users update own`** pour qu'elle l'appelle ;
3. supprimer l'ancienne fonction à 5 paramètres.

L'étape 2 touche une policy critique de `users`. Entre le `DROP POLICY` et le
`CREATE POLICY`, seule `admins update all` subsiste — donc, dans la transaction, plus
aucun utilisateur ordinaire ne peut modifier sa propre ligne. C'est transactionnel et
bref, mais ce n'est pas une modification à glisser dans un lot qui parle d'autre chose.

**Lot dédié, avec preuves par rôle** (règle 7 de la MIGRATION SAFETY CHECKLIST) :
sous JWT réel `COACH`, `RECRUTEUR`, `ATHLETE`, `PARENT`, `PARTNER` et `ADMIN` —

- chemin refusé : `UPDATE users SET school_id = <autre école> WHERE id = auth.uid()` doit échouer ;
- chemin autorisé : la mise à jour normale du profil (`first_name`, `phone`, `photo_url`…)
  doit continuer de passer — c'est la régression à craindre, et elle est silencieuse
  côté UI (une écriture refusée par RLS ne lève pas toujours dans le client) ;
- non-régression : la synchronisation via `school_coaches` doit toujours écrire
  `users.school_id` (elle passe par une fonction `SECURITY DEFINER`, donc hors RLS —
  à confirmer par exécution, pas par lecture).

Vérifier au passage que `sync_user_school_from_coaches` et `sync_user_school_on_coach_remove`
ne sont pas eux-mêmes bloqués par le nouveau garde-fou.

## 6. Les autres colonnes hors garde-fou — verdict

Colonnes de `public.users` non couvertes par les cinq :
`email`, `school_id`, `first_name`, `last_name`, `phone`, `avatar_url`, `photo_url`,
`title`, `division`, `team_name`, `sport`, `region`, `preferred_language`,
`profile_data`, `recruitment_preferences`, `notification_preferences`,
`privacy_preferences`, `onboarding_complete`, `primary_team_id`, `date_naissance`,
`role_claimed_at`, `created_at`, `updated_at`.

| Colonne | Verdict |
|---|---|
| **`school_id`** | **Escalade réelle.** Objet de cette note. |
| `email` | **Pas d'escalade.** Les deux policies `athletes` qui comparent un courriel (`athletes can read own orphan match`, `athletes can claim own orphan match`) passent par `current_user_email()`, qui lit **`auth.users.email`** — pas `public.users.email`. Un utilisateur ne peut donc pas se réclamer la fiche orpheline d'un tiers en modifiant sa copie. Risque résiduel : **désynchronisation** entre `public.users.email` et `auth.users.email` → écrans admin et exports Loi 25 affichant une adresse fausse. Traçabilité, pas privilège. |
| `primary_team_id` | Aucune policy ne l'utilise. Aucune conséquence de privilège trouvée. À épingler avec `school_id` par cohérence le jour du correctif. |
| `onboarding_complete` | Aucune policy ne l'utilise — seul le routage (`computeDispatchDestination`). Se le positionner à `true` permet de sauter le wizard, sans gain d'accès. |
| `privacy_preferences` | Consentement Loi 25 de l'utilisateur : auto-modifiable est **probablement voulu**. À confirmer avec la logique `needsConsent()` avant d'épingler quoi que ce soit — l'épingler pourrait casser le retrait de consentement. |
| `date_naissance`, `role_claimed_at`, `profile_data` | Aucune policy ne les utilise. Aucune conséquence trouvée. |
| Champs de présentation (`first_name`, `last_name`, `phone`, `avatar_url`, `photo_url`, `title`, `division`, `team_name`, `sport`, `region`, `preferred_language`, `recruitment_preferences`, `notification_preferences`) | Auto-modifiables par conception. C'est le but de `users update own`. |

### Note liée — `is_service_identity`

Le chantier messagerie admin ajoute `users.is_service_identity`. Elle serait la
**sixième colonne sensible hors garde-fou**, et la plus grave : s'auto-promouvoir
identité de service donnerait le droit d'écrire dans un fil `ADMIN_USER` (via
`trg_admin_thread_readonly`) et de détourner l'expéditeur affiché « Équipe Nexus ».

Elle est traitée **dans ce chantier-là**, par un trigger `BEFORE UPDATE OF
is_service_identity` (`enforce_service_identity_immutable`) plutôt que par
l'élargissement du garde-fou — précisément pour ne pas toucher à la signature de
`user_privileged_cols_unchanged` hors d'un lot dédié. Voir la migration 2 du chantier
messagerie admin.

## 7. Requêtes de reproduction

Constat (lecture seule) :

```sql
-- Le garde-fou et ses cinq colonnes
SELECT policyname, qual, with_check FROM pg_policies
 WHERE schemaname='public' AND tablename='users' AND cmd='UPDATE';

-- Les policies qui dépendent de current_user_school_id()
SELECT tablename||'.'||policyname AS policy, cmd FROM pg_policies
 WHERE schemaname='public'
   AND (coalesce(qual,'')||coalesce(with_check,'')) ~ 'current_user_school_id'
 ORDER BY 1;

-- Les triggers de sync sont sur school_coaches, pas sur users
SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid)
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname='public'
   AND pg_get_triggerdef(t.oid) ~ 'sync_user_school';
```

Preuve d'exploitation — **en transaction annulée uniquement**, jamais validée en prod :

```sql
BEGIN;
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<uuid coach de test>","role":"authenticated"}';

UPDATE public.users SET school_id = '<école dont il n''est pas membre>'
 WHERE id = '<uuid coach de test>';          -- réussit aujourd'hui

SELECT count(*) FROM public.teams;            -- équipes de l'école visée
SELECT count(*) FROM public.school_coaches;   -- roster staff de l'école visée
ROLLBACK;
```

Utiliser un **compte de test créé pour l'occasion**, jamais un compte réel.
