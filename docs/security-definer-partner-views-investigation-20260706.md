# Investigation — Vues partenaires `top_athletes_view` / `trending_athletes_view` (2026-07-06)

---

# ⚠️ EN-TÊTE DU CHANTIER RLS PARTENAIRE — À LIRE AVANT TOUTE REDÉFINITION (2026-08-19)

> Ajouté le 2026-08-19. Le corps du document (§A→§D, 2026-07-06) reste valide :
> ses recommandations ont été appliquées le 2026-07-07. Cet en-tête dit **ce qui
> a changé depuis**, dont une **régression silencieuse** de ce durcissement.

## 1. RÉGRESSION CONFIRMÉE — `top_athletes_view` n'est plus en INVOKER

**État prod au 2026-08-19 : les DEUX vues sont en `SECURITY DEFINER`**
(`reloptions = NULL` au catalogue `pg_class`).

Ce n'est pas l'état voulu. Chronologie établie :

| Date | Migration (version prod) | Effet |
|---|---|---|
| 2026-07-07 | `convert_top_athletes_to_invoker` (`20260707023211`) | `top_athletes_view` → **INVOKER** |
| 2026-07-07 | `harden_top_athletes_view` (`20260707131154`) | recréée **`WITH (security_invoker = true)`** + gate appelant |
| 2026-07-07 | `harden_trending_athletes_view` (`20260707023132`) | `trending` reste **DEFINER** — *délibéré*, cf. §D |
| **2026-08-18** | `top_athletes_view_genre` (`20260818032742`) | `create or replace view` **sans** clause `WITH` → **INVOKER PERDU** |

**Mécanisme prouvé** (probe local sur objet jetable, 2026-08-19) :

```
create view _probe as select 1 as x;
alter view _probe set (security_invoker = true);   → reloptions = {security_invoker=true}
create or replace view _probe as select 1 as x;    → reloptions = NULL        ← RÉINITIALISÉ
```

**`CREATE OR REPLACE VIEW` efface les `reloptions` non redéclarées.** La
migration `genre` du 18 août a donc annulé, sans le savoir et sans erreur, le
durcissement du 7 juillet.

**→ RÈGLE : toute redéfinition de `top_athletes_view` doit reporter
explicitement `WITH (security_invoker = true)`.** Sans ça, la vue retombe en
DEFINER à chaque `CREATE OR REPLACE`.

*Note de méthode : les 5 migrations du 6 juillet SONT en prod, mais estampillées
au 7 juillet (`apply_migration` pose son propre horodatage, pas celui du nom de
fichier). Chercher par `version like '20260706%'` les rate toutes — chercher par
`name`.*

## 2. ⚠️ NE PAS passer `trending_athletes_view` en INVOKER telle quelle

Contrairement à `top_athletes_view`, son mode DEFINER est **nécessaire, pas
accidentel** (déjà établi au §B/§D — rappelé ici parce que c'est le piège le
plus coûteux du chantier).

Ses CTE agrègent `recruiter_athlete_views` et `recruiter_favorites`. **Aucune de
ces deux tables n'a de politique partenaire** (revérifié 2026-08-19 : coach,
recruteur-propriétaire, athlète-propriétaire, admin, admin cégep — pas de
`is_approved_partner`).

Chaîne de rupture, **silencieuse de bout en bout** :

```
INVOKER → CTE renvoient 0 ligne → COALESCE(...,0) → views_delta = 0
       → .gt("views_delta", 0) côté page filtre TOUT
       → /partenaire/tendances vide en permanence, sans erreur, sans log
```

L'écran ne signale rien : il affiche son état vide normal. La panne serait
invisible en revue de code comme en test de fumée.

**Toute bascule INVOKER doit être compensée**, au choix :
- **(a)** une politique SELECT partenaire sur les deux tables de tracking,
  scopée aux athlètes éligibles ; **ou**
- **(b)** un passage en **fonction `SECURITY DEFINER`** portant le gate
  `is_approved_partner()` **à l'intérieur** (recommandé si une période
  paramétrable est aussi au programme — cf. §5).

## 3. `genre` est projeté par les DEUX vues — ne pas repartir d'une définition antérieure

Ajouté par `top_athletes_view_genre` (`20260818032742`) et
`trending_athletes_view_genre` (`20260818032811`), **en fin de liste** de
projection (contrainte de `CREATE OR REPLACE VIEW`).

Une redéfinition partant d'une copie antérieure **supprimerait la colonne** et
casserait les filtres genre de **trois écrans** : `/partenaire/classements`,
`/partenaire/tendances`, `/partenaire/newsroom` — plus `/partenaire/athletes`
depuis le 2026-08-19.

Même vigilance pour `region` et `annee_diplomation` sur `trending` : projetées
de longue date, elles alimentent depuis le 2026-08-19 les filtres Région et
Promotion de `/partenaire/tendances`.

## 4. Le tri de `/classements` est CÔTÉ PAGE — délibérément

`top_athletes_view` se termine par `ORDER BY cote_globale_entraineur DESC`, et
en PostgreSQL `DESC` implique `NULLS FIRST` : les athlètes **sans** cote
remontaient en tête (22 sur 24 à l'époque du constat).

Le correctif vit dans `app/partenaire/classements/page.tsx` :

```ts
query = query.order("cote_globale_entraineur", { ascending: false, nullsFirst: false });
```

**C'est un choix, pas un oubli.** Un `NULLS LAST` posé en DDL serait perdu à la
première redéfinition partie d'une version antérieure — exactement le sort qu'a
connu `security_invoker` au §1. Le tri côté page survit à la refonte des vues.

**→ Ne pas « corriger » en déplaçant ce tri dans la vue.**

## 4-bis. ⚠️ CORRECTION DU §D — « CONVERT, la RLS suffit » repose sur une prémisse fausse

Le §D conclut, pour `top_athletes_view` :

> *« `evaluations` via policy "authenticated read evaluations" → tous lisibles
> par un partenaire authentifié. **Pas de gap.** »*

**C'est faux.** Le nom de la politique trompe : `authenticated` y qualifie le
**rôle Postgres**, pas le périmètre. Son corps est une **disjonction de rôles
nommés** — coach propriétaire, directeur d'école, `coach_can_read_athlete_evals`,
recruteur sur athlète actif, athlète lui-même, admin. **Aucune branche
`is_approved_partner`.**

**Preuve runtime** (2026-08-19, read-only, `set local role authenticated` +
claims du partenaire APPROVED `lespritsportifmedia@gmail.com`) — ce qu'un
partenaire lit réellement sous RLS normale, c'est-à-dire ce que verrait la vue
en INVOKER :

| Table de base | Lignes visibles |
|---|---|
| `athletes` | **28** ✅ |
| `sports` / `positions` / `schools` | 24 / 120 / 1204 ✅ |
| **`evaluations`** | **0** ⚠️ |
| *(rappel)* `recruiter_athlete_views` / `recruiter_favorites` | 0 / 0 |

### La panne qu'une restauration produirait

`top_athletes_view` remonte `distinctions` par `LEFT JOIN LATERAL` sur
`evaluations`. Un `LEFT JOIN` sur zéro ligne **ne supprime pas l'athlète** — il
met `distinctions` à `NULL`. Donc **l'écran ne se vide pas**, et c'est ce qui
rend la panne plus dangereuse que celle de `/tendances` :

- `/partenaire/classements` et `/partenaire/athletes` afficheraient **toujours**
  leurs athlètes — rien d'alarmant à l'œil ;
- **tous les badges de distinction disparaîtraient**, silencieusement ;
- le filtre **« Avec distinction »** de `/partenaire/athletes`
  (`hasDistinctions(a.distinctions)`, évalué côté client) rendrait
  **systématiquement zéro résultat** ;
- **aucune erreur**, aucun log, aucun code HTTP anormal.

Un test de fumée passerait. Seule une vérification champ par champ la verrait.

### Conséquence pour le chantier

**Ne pas restaurer `top_athletes_view` en INVOKER tant que `evaluations` n'a pas
de branche partenaire.** Sans compensation, on échangerait une faiblesse
d'accès (la vue contourne la RLS) contre une **perte de données silencieuse sur
deux écrans** — un moins bon marché.

Ordre à respecter :

1. ajouter une branche `is_approved_partner(...)` à `authenticated read
   evaluations`, scopée aux athlètes éligibles ;
2. la prouver par le **même test runtime** que ci-dessus (le compte doit voir
   les évaluations des athlètes éligibles, et rien d'autre) ;
3. **seulement ensuite**, reposer `WITH (security_invoker = true)` ;
4. relancer `scripts/check-view-hardening.sql` — il doit rendre **zéro ligne**.

*Le §D reste valide sur `trending_athletes_view` (KEEP DEFINER) : son analyse
Phase B était juste, et la revérification du 2026-08-19 la confirme.*

## 4-ter. ⚠️ LA BASE LOCALE N'EST PAS DURCIE COMME LA PROD — la preuve locale ne prouve rien ici

Découvert le 2026-08-19 en exécutant `scripts/check-view-hardening.sql` contre
le Docker local pour valider sa syntaxe : il rend **4 écarts en local** contre
**1 en prod**.

### Mesure

Sur les **six** migrations du lot « sécurité des vues », **une seule** est dans
le `schema_migrations` local :

| Migration | Prod | Local |
|---|:--:|:--:|
| `secure_athlete_view_details` | ✅ `20260616090000` | ✅ `20260616090000` |
| `revoke_anon_on_definer_views` | ✅ `20260707023004` | ❌ |
| `convert_low_risk_views_to_invoker` | ✅ `20260707023030` | ❌ |
| `harden_trending_athletes_view` | ✅ `20260707023132` | ❌ |
| `convert_top_athletes_to_invoker` | ✅ `20260707023211` | ❌ |
| `harden_top_athletes_view` | ✅ `20260707131154` | ❌ |

Écarts rendus par le contrôle, côté local : `athlete_coaches`,
`athlete_views_weekly`, `athlete_visibility_stats`, `top_athletes_view`.
Seule `athlete_view_details` y est conforme — la seule dont la migration a été
appliquée.

### La conséquence, écrite en clair

**Pour ces vues, un test de comportement RLS en local part d'un état MOINS
durci que la prod.** Les vues y sont en DEFINER, donc elles **contournent la
RLS** : un partenaire local « voit » des données qu'une vue INVOKER lui
refuserait.

**Un test local qui passe ne prouve rien.** C'est l'inverse de l'hypothèse
habituelle — on suppose que le local est le miroir fidèle, ou au pire un
sur-ensemble permissif dont les refus se transposent. Ici, ce sont les
**autorisations** qui ne se transposent pas : local plus permissif ⇒ un accès
qui fonctionne en local peut échouer en prod, et un durcissement qu'on croit
valider en local n'y est simplement pas actif.

**L'étape 7 de la checklist de migration (`CLAUDE.md`) — « Local-first,
per-role proof … Runtime proof over logic claims » — repose entièrement sur
cette preuve locale.** Pour ces cinq vues, elle est actuellement sans valeur
probante. C'est exactement le chemin de validation du chantier RLS partenaire.

*Corollaire de méthode : la preuve runtime du §4-bis (`evaluations` à 0 ligne
pour un partenaire) a été faite **directement en prod**, en lecture seule. Pour
tout ce qui touche à ces vues, c'est la seule mesure fiable tant que le local
n'est pas remis à niveau.*

### Ampleur : l'écart n'est pas limité à ce lot

`schema_migrations` : **160 lignes en local, 295 en prod.**

Le chiffre est indicatif plutôt qu'exact — `apply_migration` crée une ligne
même pour un correctif ponctuel sans fichier, donc une partie des 295 n'a pas
de contrepartie versionnée. Mais la dérive est réelle et dépasse largement les
six migrations ci-dessus. **Ne pas supposer qu'une autre partie du schéma est,
elle, alignée** : le vérifier avant de s'appuyer sur un test local, quel qu'il
soit.

### Remise à niveau — NON EXÉCUTÉE, décision de BP

Les cinq migrations manquantes **existent en fichier**
(`supabase/migrations/20260706120000` → `20260706130000`). Un `supabase db reset`
local les rejouerait avec tout l'historique, et le local retrouverait l'état de
la prod pour ces vues.

**Rien n'a été exécuté.** Un `db reset` détruit les données locales de travail —
c'est un arbitrage qui appartient à BP, pas à ce lot de documentation. Deux
points à peser avant :

- d'autres sessions travaillent sur ce dépôt et peuvent dépendre de l'état
  local courant ;
- 135 lignes d'écart signifient qu'un reset ne « rattrape » pas seulement ce
  lot : il rejoue tout, et l'état obtenu ne sera identique à la prod que pour
  ce qui est versionné en fichier.

**Vérification après remise à niveau :** relancer
`scripts/check-view-hardening.sql` en local — il doit rendre **la même unique
ligne qu'en prod** (`top_athletes_view`), et pas quatre. Tant que les deux
sorties diffèrent, le local n'est pas un terrain de preuve valable pour ces
vues.

## 5. Points ouverts qui toucheront ces vues

À arbitrer **dans** ce chantier plutôt qu'après, puisqu'ils redéfinissent les
mêmes objets :

- **Période paramétrable sur `/tendances`** — les fenêtres 7 j / 14 j sont
  gravées dans les CTE. Une borne choisie par l'utilisateur exige une
  **fonction paramétrée** (`get_trending_athletes(p_days int)`), ce qui rejoint
  l'option (b) du §2 : une seule refonte réglerait les deux.
- **Période sur `/classements` et `/athletes`** — aucune colonne datée n'est
  projetée par `top_athletes_view`. Candidates :
  `athletes.partner_visibility_opted_in_at` (27/27 remplie) et
  `athletes.created_at`. La date de la cote exigerait de remonter
  `evaluations.updated_at` du `LATERAL`.
- **Filtre équipe / division** — exigerait de joindre `team_athletes`/`teams`.
  Sans risque de duplication : `team_athletes` porte `UNIQUE (athlete_id)`,
  donc la jointure est 1:0..1 (vérifié 2026-08-19, 0 athlète multi-équipes).

## 6. Compte de test

Deux partenaires `APPROVED` en prod : `lespritsportifmedia@gmail.com` et
`bpdesfosses@gmail.com`. Le §C ne mentionnait que le premier — le second permet
une validation croisée. Toute bascule doit être testée sur les **trois** écrans
partenaire, `/tendances` en premier : c'est le seul dont la panne est muette.

---

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
