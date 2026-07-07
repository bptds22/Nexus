# Nexus — Audit des vues SECURITY DEFINER (2026-07-06)

**Mode : DIAGNOSTIC UNIQUEMENT — aucune modification appliquée.** Aucune
migration, aucun `ALTER`, aucun `db push`. Toutes les requêtes sont des `SELECT`
read-only sur le projet `nrloizyemulbhujrqhgx` (`nexus-prod`). Ce document est le
seul fichier produit.

---

## 1. Executive summary

L'advisor Supabase signale « Security Definer View » en **ERROR**. Inventaire réel :
**5 vues** en SECURITY DEFINER (owner `postgres`, non-matérialisées). Une 6ᵉ vue
citée par l'advisor — `athlete_view_details` — porte déjà `security_invoker=on`
→ **déjà INVOKER, hors périmètre** (non-finding).

Une vue SECURITY DEFINER s'exécute avec les droits de son propriétaire
(`postgres`), donc **contourne la RLS des tables sous-jacentes**. Deux facteurs
aggravants communs aux 5 vues :

- **Grants trop larges** : les 5 ont `GRANT ALL` (SELECT inclus) à **`anon` ET
  `authenticated`**. Combiné au DEFINER, **tout utilisateur — même anonyme —
  peut lire ces données en contournant la RLS.** C'est le vrai risque, distinct
  de la question INVOKER.
- **RLS déjà présente et suffisante** sur toutes les tables sous-jacentes
  (vérifié) → une conversion en INVOKER **resserre** la sécurité (les appelants
  non autorisés perdent l'accès) sans casser les appelants légitimes, qui ont
  déjà une policy.

**Verdict :** 3 à **CONVERT** sans risque réel, 2 à **INVESTIGATE** (conversion
recommandée mais à valider fonctionnellement côté partenaire), **0 KEEP**
justifié. Le durcissement des grants (`REVOKE` anon + write) est recommandé sur
les 5, indépendamment de la conversion.

---

## 2. Tableau consolidé

| Vue | Type | Owner | `security_invoker` | Grants problématiques | Callers | Reco | Risque conv. |
|---|---|---|---|---|---|---|---|
| `athlete_coaches` | view | postgres | ❌ non (DEFINER) | ALL → anon+auth | **aucun (orpheline)** | **CONVERT** (ou DROP) | **Low** |
| `athlete_views_weekly` | view | postgres | ❌ non | ALL → anon+auth | `hooks/useAthleteVisibility.ts:99` | **CONVERT** | **Low-Med** |
| `athlete_visibility_stats` | view | postgres | ❌ non | ALL → anon+auth | `hooks/useAthleteVisibility.ts:98` | **CONVERT** | **Low-Med** |
| `top_athletes_view` | view | postgres | ❌ non | ALL → anon+auth | partenaire ×3 | **INVESTIGATE→CONVERT** | **Med** |
| `trending_athletes_view` | view | postgres | ❌ non | ALL → anon+auth | partenaire ×2 | **INVESTIGATE→CONVERT** | **Med** |
| `athlete_view_details` | view | postgres | ✅ **oui** (`=on`) | — | — | **N/A (déjà safe)** | — |

---

## 3. Diagnostic par vue

### Vue : `athlete_coaches`

- **Définition** : `SELECT DISTINCT ta.athlete_id, tc.coach_id, tc.role, t.id,
  t.name, t.division, t.league, t.sport_id FROM team_athletes ta JOIN teams t
  JOIN team_coaches tc WHERE t.is_active = true`.
- **Tables sous-jacentes** : `team_athletes`, `teams`, `team_coaches` (RLS active
  sur les 3).
- **Callers** : **aucun**. Grep `app/`, `components/`, `lib/`, `hooks/` → 0 hit.
  Seules occurrences = la définition dans `20260417120000_baseline.sql`.
  → **Vue orpheline.**
- **Grants** : `ALL` à `anon`, `authenticated`, `service_role` → n'importe qui
  peut lire tout le mapping athlète→coach→équipe en bypass RLS.
- **Justification légitime** : aucune identifiable (personne ne la lit).
- **Recommandation** : **CONVERT** en invoker, ou mieux **DROP** après
  confirmation de non-usage (candidate au ménage, comme les tables orphelines
  déjà dépréciées le 2026-05-03).
- **Risque conversion** : **Low** — aucun caller à casser.

### Vue : `athlete_views_weekly`

- **Définition** : compte de vues par semaine (fenêtre 56 j) depuis
  `recruiter_athlete_views`, `GROUP BY athlete_id, week`.
- **Tables sous-jacentes** : `recruiter_athlete_views` (RLS active).
- **Callers** : `hooks/useAthleteVisibility.ts:99` — dashboard visibilité de
  **l'athlète lui-même**, filtré `.eq("athlete_id", athleteId)`.
- **Grants** : `ALL` à `anon`+`authenticated` → aujourd'hui n'importe quel user
  peut lire les stats de vue de **n'importe quel** athlète.
- **RLS sous-jacente** : `recruiter_athlete_views` a la policy
  **« athletes read own views »** (+ « Coaches read views for their athletes »).
  → sous INVOKER, l'athlète (et son coach) lisent leurs lignes légitimement ;
  les autres perdent l'accès. **C'est le comportement voulu.**
- **Justification DEFINER** : aucune — la RLS couvre déjà le besoin.
- **Recommandation** : **CONVERT**.
- **Risque conversion** : **Low-Med** — sûr si `useAthleteVisibility` n'est
  appelé que par l'athlète/coach (RLS les couvre). À confirmer : aucun appel
  par un rôle sans policy (ex. recruteur regardant les stats d'autrui).

### Vue : `athlete_visibility_stats`

- **Définition** : KPIs (vues ce mois / mois dernier, recruteurs uniques) depuis
  `recruiter_athlete_views` + sous-requête `count(*) FROM recruiter_favorites
  WHERE athlete_id = pv.athlete_id`.
- **Tables sous-jacentes** : `recruiter_athlete_views`, `recruiter_favorites`
  (RLS active sur les 2).
- **Callers** : `hooks/useAthleteVisibility.ts:98` — même dashboard athlète.
- **RLS sous-jacente** : `recruiter_athlete_views` → « athletes read own views » ;
  `recruiter_favorites` → « Athletes read own favorites ». → l'athlète lit son
  propre agrégat sous INVOKER.
- **Recommandation** : **CONVERT**.
- **Risque conversion** : **Low-Med** — même réserve que ci-dessus (vérifier les
  rôles appelants). Note : l'agrégat `count(DISTINCT recruiter_id)` reste correct
  car l'athlète voit toutes ses propres lignes de vue.

### Vue : `top_athletes_view`

- **Définition** : classement athlètes (nom, cote, région, sport, position,
  photo, distinctions, vidéos) `WHERE is_partner_eligible_athlete(a.id) ORDER BY
  cote_globale_entraineur DESC`. Joins `athletes`, `sports`, `positions`,
  `schools`, LATERAL `evaluations`.
- **Tables sous-jacentes** : `athletes` (RLS active), + `sports`/`positions`/
  `schools`/`evaluations`.
- **Callers** : `components/partenaire/PartnerAthletesSearch.tsx:130`,
  `app/partenaire/classements/page.tsx:86`, `app/partenaire/athletes/page.tsx`
  → **dashboards PARTENAIRE**, usage soutenu.
- **Grants** : `ALL` à `anon`+`authenticated` → aujourd'hui **un athlète ou un
  coach connecté peut lire le classement complet des athlètes partner-eligible en
  bypass RLS** (la vue filtre QUELS athlètes, pas QUI appelle).
- **RLS sous-jacente** : `athletes` a **« Approved partners read opted-in
  athletes »**. → sous INVOKER, seuls les partenaires approuvés obtiennent des
  lignes ; les non-partenaires perdent l'accès. **La conversion resserre.**
- **Justification DEFINER possible** : « exposition cross-tenant read-only pour
  dashboards partenaires » — mais ce besoin est **déjà couvert par la policy RLS
  partenaire**, donc le DEFINER n'est pas nécessaire.
- **Recommandation** : **INVESTIGATE→CONVERT** — vérifier que l'ensemble
  d'athlètes renvoyé par la policy RLS « opted-in » **coïncide** avec le filtre
  `is_partner_eligible_athlete()` de la vue (sinon un partenaire pourrait voir
  légèrement plus/moins d'athlètes qu'avant — risque **fonctionnel**, pas
  sécurité).
- **Risque conversion** : **Med** — usage partenaire lourd ; divergence possible
  entre le prédicat de la vue et la policy RLS.

### Vue : `trending_athletes_view`

- **Définition** : CTEs vues/favoris 7 j vs 7 j précédents (deltas) + joins
  `athletes`/`sports`/`schools`, `WHERE is_partner_eligible_athlete(a.id)`.
- **Tables sous-jacentes** : `recruiter_athlete_views`, `recruiter_favorites`,
  `athletes`, `sports`, `schools` (RLS active).
- **Callers** : `app/partenaire/tendances/page.tsx:148,157` — dashboard
  partenaire « Tendances ».
- **RLS sous-jacente** : mêmes policies partenaire/athlète que ci-dessus.
  ⚠️ Subtilité : sous INVOKER, les CTE sur `recruiter_athlete_views` /
  `recruiter_favorites` s'exécuteraient avec la RLS de l'appelant **partenaire** —
  or les policies de ces 2 tables ciblent recruteur/coach/athlète, **pas
  explicitement le partenaire**. À vérifier : un partenaire a-t-il le droit de
  lire les lignes de vues/favoris nécessaires au calcul des deltas ? Sinon les
  compteurs tomberaient à 0 sous INVOKER.
- **Recommandation** : **INVESTIGATE→CONVERT** — la plus délicate : le calcul
  agrège des tables (`recruiter_athlete_views`, `recruiter_favorites`) dont la
  RLS **ne mentionne pas le rôle partenaire**. Conversion possible seulement si
  une policy partenaire couvre ces lectures, sinon garder DEFINER **documenté**
  ou passer par une fonction dédiée.
- **Risque conversion** : **Med** (potentiellement Med-High) — dépend de la RLS
  partenaire sur les tables de tracking.

---

## 4. Ordre de traitement suggéré (si décision de fixer)

1. **`athlete_coaches`** — orpheline. CONVERT (ou DROP). Zéro risque, valide le
   process. *Décider DROP vs CONVERT.*
2. **`athlete_views_weekly`** + **`athlete_visibility_stats`** — CONVERT ensemble
   (même caller, même table, RLS athlète confirmée). Tester le dashboard
   visibilité athlète après.
3. **`top_athletes_view`** — INVESTIGATE d'abord (comparer `is_partner_eligible`
   ⇄ policy « opted-in »), puis CONVERT. Tester classements + recherche partenaire.
4. **`trending_athletes_view`** — en dernier. Vérifier la RLS partenaire sur
   `recruiter_athlete_views`/`recruiter_favorites` **avant** toute conversion ;
   c'est le seul cas où un KEEP-documenté reste plausible si la RLS ne couvre pas
   le partenaire.

**Transversal (prioritaire, indépendant de l'ordre)** : resserrer les grants —
`REVOKE` de `anon` et des privilèges d'écriture sur les 5 vues. Gain de sécurité
immédiat même sans conversion.

---

## 5. Migrations SQL suggérées (TEXTE — aucun fichier .sql créé)

> ⚠️ Propositions à réviser. **Ne pas appliquer sans validation** des points
> INVESTIGATE ci-dessus. Sur Postgres 15+, `security_invoker` est un reloption
> de vue.

### 5a. CONVERT (vues sûres)

```sql
-- athlete_coaches (ou envisager: DROP VIEW public.athlete_coaches;)
ALTER VIEW public.athlete_coaches SET (security_invoker = true);

-- athlete_views_weekly
ALTER VIEW public.athlete_views_weekly SET (security_invoker = true);

-- athlete_visibility_stats
ALTER VIEW public.athlete_visibility_stats SET (security_invoker = true);
```

### 5b. CONVERT après INVESTIGATE (partenaire)

```sql
-- top_athletes_view — après confirmation que la policy RLS
-- « Approved partners read opted-in athletes » renvoie le même ensemble
-- que is_partner_eligible_athlete()
ALTER VIEW public.top_athletes_view SET (security_invoker = true);

-- trending_athletes_view — SEULEMENT si une policy RLS autorise le partenaire
-- à lire recruiter_athlete_views + recruiter_favorites (sinon deltas = 0)
ALTER VIEW public.trending_athletes_view SET (security_invoker = true);
```

### 5c. Durcissement des grants (recommandé sur les 5, indépendant)

```sql
-- Retirer l'accès anonyme + les privilèges d'écriture inutiles (vues en lecture)
REVOKE ALL ON public.athlete_coaches          FROM anon;
REVOKE ALL ON public.athlete_views_weekly      FROM anon;
REVOKE ALL ON public.athlete_visibility_stats  FROM anon;
REVOKE ALL ON public.top_athletes_view         FROM anon;
REVOKE ALL ON public.trending_athletes_view    FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.athlete_coaches, public.athlete_views_weekly,
     public.athlete_visibility_stats, public.top_athletes_view,
     public.trending_athletes_view
  FROM authenticated;
-- Conserver: GRANT SELECT ... TO authenticated (accès lecture légitime)
```

### 5d. KEEP documenté (si une conversion est écartée)

```sql
-- Exemple si trending_athletes_view devait rester DEFINER faute de RLS partenaire
COMMENT ON VIEW public.trending_athletes_view IS
  'SECURITY DEFINER assumé : agrège recruiter_athlete_views/recruiter_favorites '
  'pour les dashboards partenaires ; aucune policy RLS partenaire ne couvre ces '
  'tables de tracking. Accès restreint via REVOKE anon + filtre '
  'is_partner_eligible_athlete(). Revoir si une RLS partenaire est ajoutée.';
```

---

## 6. Points de décision (pour BP, après revue)

1. **`athlete_coaches`** : DROP (orpheline) vs CONVERT (garder au cas où) ?
2. **INVESTIGATE `top`/`trending`** : lancer la comparaison prédicat-vue ⇄
   policy-RLS avant conversion (je peux le faire en read-only sur demande).
3. **Grants** : appliquer le `REVOKE anon` tout de suite (gain net) ou grouper
   avec les conversions dans une seule migration ?
4. **Ordre** : traiter comme une migration unique versionnée, ou 4 petites
   (une par vue) pour isoler tout régression ?

---

*Diagnostic read-only — 5 vues DEFINER identifiées, 0 modification appliquée.
Prochaine étape = ta décision sur le tableau §2 et les points §6.*

---

## 7. Résolution appliquée (2026-07-06/07)

Décisions prises et appliquées au cloud (migrations `supabase/migrations/2026070612*`) :

- `athlete_coaches`, `athlete_views_weekly`, `athlete_visibility_stats` →
  **CONVERT `security_invoker=true`** (`120100`). Isolation athlète vérifiée.
- `trending_athletes_view` → **KEEP DEFINER + gate `is_approved_partner(auth.uid())`
  dans le WHERE + `security_barrier`** (`120200`) — la conversion INVOKER aurait
  mis les métriques à 0 (aucune RLS partenaire sur les tables de tracking).
- `top_athletes_view` → **CONVERT `security_invoker=true`** (`120300`), puis
  **durci** avec le même gate `is_approved_partner(auth.uid())` (`130000`) pour
  qu'un athlète non-partenaire voie 0 ligne (au lieu de sa seule propre ligne).
- `anon` révoqué sur les 5 vues (`120000`).

### ⚠️ Dette technique post-launch — `is_approved_partner(uid)`

La fonction `public.is_approved_partner(uid uuid)` **ignore son paramètre `uid`**
et teste `auth.uid()` en interne. **Signature trompeuse** : un dev pourrait
l'appeler avec un uid custom en croyant vérifier ce partenaire précis, alors que
ça vérifie l'appelant courant. Ça « marche » ici uniquement parce que les vues
passent `is_approved_partner(auth.uid())`.
**À refactorer post-launch** (renommer sans paramètre OU utiliser réellement le
param + auditer les callers). **Créer un ticket dette technique.** Effort ~1 h.
Priorité : avant le premier vrai partenaire commercial.
