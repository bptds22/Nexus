# Investigation — Vues partenaires `top_athletes_view` / `trending_athletes_view` (2026-07-06)

**Mode : DIAGNOSTIC UNIQUEMENT — aucune modification.** Complète
`docs/security-definer-audit-20260706.md` (§ INVESTIGATE). Toutes les requêtes
sont des `SELECT` read-only sur `nrloizyemulbhujrqhgx`.

Objectif : décider **CONVERT vs KEEP** pour les 2 vues partenaires en levant le
risque MEDIUM identifié (agrégations sur tables de tracking sans policy RLS
partenaire).

---

## Phase A — `is_partner_eligible_athlete()` ⇄ RLS `athletes`

**Définition de la fonction** (SECURITY DEFINER, `SET row_security = off`) :

```sql
SELECT a.partner_visibility_opt_in = true
   AND (EXTRACT(YEAR FROM AGE(a.date_naissance)) >= 18
        OR a.partner_visibility_parental_consent = true)
FROM public.athletes a WHERE a.id = p_athlete_id;
```
→ critères : **opt-in partenaire** ET **(majeur OU consentement parental)**.

**Policy RLS `athletes` pertinente** (rôle `public`) :

| Policy | `USING` |
|---|---|
| Approved partners read opted-in athletes | `partner_visibility_opt_in = true AND is_approved_partner(auth.uid())` |

**Cohérence** : **MATCH PARTIEL, complémentaire (pas de conflit).**
- La policy RLS vérifie `opt_in = true` **+ que l'appelant est un partenaire
  approuvé** (`is_approved_partner`).
- La fonction (dans le `WHERE` de la vue) vérifie `opt_in = true` **+ le gate
  âge/consentement**.
- Sous INVOKER, **les deux s'appliquent** → un partenaire approuvé voit
  exactement : `opt_in ∩ approved ∩ (majeur OU consentement)`. C'est un
  **sur-ensemble de contraintes**, pas une divergence : l'intersection est le
  bon ensemble (opted-in, éligible âge, visible aux partenaires approuvés).
- **Aucun écart problématique.** La conversion ne fait que **retirer** l'accès
  aux non-partenaires (qui aujourd'hui, en DEFINER, obtiennent la liste).

---

## Phase B — RLS sur `recruiter_athlete_views` et `recruiter_favorites`

**Policies SELECT existantes :**

| Table | Policy | Rôle ciblé (via `USING`) |
|---|---|---|
| recruiter_athlete_views | Coaches read views for their athletes | coach (athlete.coach_id = auth.uid()) |
| recruiter_athlete_views | Recruiters manage own views (ALL) | recruteur (recruiter_id = auth.uid()) |
| recruiter_athlete_views | admins read recruiter_athlete_views | admin |
| recruiter_athlete_views | athletes read own views | athlète (athlete.user_id = auth.uid()) |
| recruiter_favorites | Athletes read own favorites | athlète |
| recruiter_favorites | Coaches read favorites for their athletes | coach |
| recruiter_favorites | admins read all | admin |
| recruiter_favorites | recruiter_favorites_select | recruteur (recruiter_id = auth.uid()) |

**Constat central : AUCUNE policy ne cible le rôle PARTENAIRE** sur ces deux
tables. Un partenaire approuvé n'a **aucun droit de lecture** sur
`recruiter_athlete_views` ni `recruiter_favorites` sous RLS normale.

→ **Prédiction sous INVOKER** : les CTE de `trending_athletes_view`
(`recent_views`, `prior_views`, `recent_favs`, `prior_favs`) renverraient
**0 ligne** pour un partenaire → toutes les métriques (`views_7d`,
`views_delta`, `favs_7d`, `favs_delta`) tomberaient à **0**. La fonctionnalité
« Tendances » serait **cassée** (elle n'est QUE des deltas de vues/favoris).

`top_athletes_view`, lui, n'agrège PAS ces tables — il lit `athletes` (couvert
par la policy partenaire) + `sports`/`positions`/`schools` (données de référence
publiques) + `evaluations` (policy « authenticated read evaluations »). → tous
lisibles par un partenaire authentifié. **Pas de gap.**

---

## Phase C — Simulation / compte partenaire

- **1 utilisateur PARTNER existe** : `lespritsportifmedia@gmail.com`
  (`role = 'PARTNER'`).
- Validation empirique recommandée (non exécutée ici — nécessiterait de simuler
  la session de ce user) : confirmer que `media_partners.status = 'APPROVED'`
  pour ce compte (sinon `is_approved_partner()` renvoie false et **même**
  `top_athletes_view` en INVOKER renverrait 0 ligne). Query read-only proposée :
  ```sql
  SELECT mp.status, is_approved_partner(mp.user_id)
  FROM media_partners mp JOIN users u ON u.id = mp.user_id
  WHERE u.role = 'PARTNER';
  ```

---

## Phase D — Recommandation finale par vue

### `top_athletes_view` → **CONVERT (la RLS suffit)**

- **Justification** : toutes les tables lues sont accessibles à un partenaire
  approuvé sous RLS normale (`athletes` via « Approved partners read opted-in »,
  `evaluations` via « authenticated read evaluations », référentiels publics).
  Le prédicat `is_partner_eligible_athlete()` de la vue reste évalué (DEFINER
  interne) et coïncide avec l'intention. La conversion **resserre** (les
  non-partenaires perdent l'accès) **sans casser** le partenaire.
- **Risque** : Low-Med. Pré-requis empirique : `media_partners.status='APPROVED'`
  pour le partenaire (cf. Phase C).
- **SQL suggéré (texte, non appliqué)** :
  ```sql
  ALTER VIEW public.top_athletes_view SET (security_invoker = true);
  COMMENT ON VIEW public.top_athletes_view IS
    'security_invoker=true (audit 2026-07-06). Partenaires approuves lisent via '
    'la policy athletes "Approved partners read opted-in athletes".';
  ```

### `trending_athletes_view` → **KEEP SECURITY DEFINER + DURCIR + documenter**

- **Justification** : la conversion casserait les métriques (Phase B — pas de
  policy partenaire sur les tables de tracking). Le DEFINER est **nécessaire**
  ici pour agréger `recruiter_athlete_views`/`recruiter_favorites` au nom du
  partenaire. MAIS le REVOKE anon (migration `20260706120000`) ne suffit pas :
  le rôle `authenticated` inclut athlètes/coachs/recruteurs — sans durcissement,
  un utilisateur connecté **non-partenaire** pourrait encore lire cette vue.
- **Durcissement recommandé** : ajouter un **gate d'appelant** dans le `WHERE`
  de la vue pour qu'elle ne renvoie rien aux non-partenaires, même en DEFINER :
  ```sql
  -- Recréer la vue avec, dans le WHERE :
  --   WHERE is_partner_eligible_athlete(a.id)
  --     AND is_approved_partner(auth.uid())   -- ← gate appelant ajouté
  COMMENT ON VIEW public.trending_athletes_view IS
    'SECURITY DEFINER assume (audit 2026-07-06) : agrege recruiter_athlete_views/'
    'recruiter_favorites, aucune policy RLS partenaire ne couvre ces tables. '
    'Acces restreint via REVOKE anon + gate is_approved_partner(auth.uid()) dans '
    'le WHERE. Revoir si une RLS partenaire est ajoutee aux tables de tracking.';
  ```
- **Alternative (si on veut tout en INVOKER)** : CONVERT **+** ajouter des
  policies SELECT partenaire scoping sur `recruiter_athlete_views` et
  `recruiter_favorites` (ex. « approved partners read views/favs for opted-in
  eligible athletes »). Plus de surface RLS à maintenir et à tester → non
  recommandé pour un simple durcissement pré-launch.
- **Risque** : la recréation de vue (option durcissement) est Med (DROP/CREATE
  avec re-GRANT). Le gate `is_approved_partner` est le changement de comportement
  à tester côté dashboard partenaire.

---

## Recommandation de prochaine étape (pour BP)

1. **Confirmer** `media_partners.status='APPROVED'` du compte partenaire (query
   Phase C) — débloque la certitude sur `top_athletes_view`.
2. **`top_athletes_view`** : CONVERT (migration séparée, même schéma que les 3
   low-risk), tester le dashboard partenaire (classements + recherche).
3. **`trending_athletes_view`** : décider entre **KEEP + gate appelant** (reco)
   et **CONVERT + policies partenaire**. Tester « Tendances » partenaire avec le
   compte réel — c'est le seul moyen empirique de valider les métriques ≠ 0.
4. Créer/utiliser le compte partenaire de test pour ces deux validations UI.

---

*Diagnostic read-only. Aucune migration créée pour ces 2 vues, aucun `db push`.
Décision CONVERT/KEEP à ta main sur la base du §D.*
