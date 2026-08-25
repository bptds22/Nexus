# Dérive de migrations — chantier badges, 25 août 2026

**Statut : constat, pas correctif.** Ce document ne rapatrie rien. Il existe pour
que le lot soit portable à la session qui a produit ces migrations. Deux sessions
qui écriraient les mêmes fichiers miroirs se marcheraient dessus.

**Établi le 2026-08-25**, en lecture seule, contre `nexus-prod`
(`nrloizyemulbhujrqhgx`), depuis `supabase_migrations.schema_migrations` et le
catalogue système.

---

## Le constat

**Treize migrations sont appliquées en production. Aucune n'a de fichier dans
`supabase/migrations/`.**

Ce n'est pas une dérive de code applicatif — c'est du **schéma de production dont
le code source n'existe nulle part dans le dépôt**. Un `supabase db reset` local
reconstruit aujourd'hui une base **sans les badges** : sans les trois tables, sans
les quatorze fonctions, sans les six triggers, et avec `top_athletes_view` et
`partner_athlete_profile` dans leur version d'avant. Le dev qui teste en local ne
teste pas ce qui tourne en prod.

**Une quatorzième modification est pire encore** : elle n'a même pas de migration.
Voir la section « Le trou le plus sérieux ».

### L'entrelacement avec le chantier CÉGEP

Deux de ces migrations sont datées à l'intérieur de la fenêtre du chantier
« programme CÉGEP visé » (T1), dont les six migrations ont, elles, leur miroir :

```
20260825144302  badges_contexte_forme_et_suggestions_vers_athlete_badges   ← pas de miroir
20260825144345  cegep_programs_liste_partagee_structure                     ✓ miroir
20260825144431  cegep_programs_liste_partagee_seed                          ✓ miroir
20260825144441  badges_suggestions_auteur_et_portee_du_remplacement         ← pas de miroir, INTERCALÉE
20260825144628  profile_completion_repli_programmes_vises                   ✓ miroir
20260825144735  cegep_programs_rls_lecture_reference                        ✓ miroir
20260825145144  cegep_programs_revoke_anon_et_fonction_refresh              ✓ miroir
20260825145707  cegep_programs_500a1_vedette_en_francais                    ✓ miroir
```

`144441` tombe strictement **entre** deux migrations CÉGEP ; `144302` tombe
43 secondes avant la première. Les deux chantiers écrivaient la même base en même
temps. Aucun conflit d'objet n'a eu lieu — les périmètres ne se recoupent pas —
mais l'ordre de rejeu ne pourra plus jamais être reconstitué depuis le dépôt tant
que les treize manquent.

---

## Bonne nouvelle : le SQL est récupérable

Le SQL complet des treize est stocké en base, dans
`supabase_migrations.schema_migrations.statements` (colonne `text[]`).

```sql
select version, name, array_to_string(statements, E'\n') as sql
  from supabase_migrations.schema_migrations
 where version in ('20260825014257','20260825014323','20260825014427','20260825014940',
                   '20260825015147','20260825015337','20260825020802','20260825130731',
                   '20260825130938','20260825131151','20260825134921','20260825144302',
                   '20260825144441')
 order by version;
```

Le rapatriement est donc mécanique : un fichier par ligne, nommé
`<version>_<name>.sql`. **Ce n'est pas urgent parce que ce serait difficile, c'est
urgent parce que tant que ce n'est pas fait, un `db reset` détruit l'information.**

---

## Les treize, et ce qu'elles touchent

| # | Version | Nom | SQL | Ce qu'elle fait |
|---|---|---|---|---|
| 1 | `20260825014257` | `badges_catalogue_et_attributions` | 11 196 c. | **crée** tables `badges`, `athlete_badges` ; fns `badge_contexte_requis`, `badge_plafond`, `coach_can_award_badge` ; triggers `trg_badge_contexte_requis`, `trg_badge_plafond` ; 3 index ; 7 policies |
| 2 | `20260825014323` | `badges_seed_22` | 4 285 c. | données : 22 lignes dans `badges` |
| 3 | `20260825014427` | `badges_miroir_app_1_2` | 8 802 c. | **crée** `badges_vers_distinctions`, `trg_badges_vers_distinctions`, `preserve_updated_at_si_miroir` ; **touche 2 objets préexistants** (voir plus bas) |
| 4 | `20260825014940` | `badges_miroir_neutralise_effets_athletes` | 3 690 c. | **crée** `preserve_athlete_denorm_si_miroir` ; **pose un trigger sur `athletes`** |
| 5 | `20260825015147` | `badges_projections_partenaire` | 6 875 c. | **remplace `top_athletes_view` ET la RPC `partner_athlete_profile`** ; crée `badges_json` |
| 6 | `20260825015337` | `badges_transposition_depuis_distinctions` | 6 295 c. | `athlete_badges` + colonne `origine` ; transposition depuis les distinctions |
| 7 | `20260825020802` | `badges_contexte_equipe_etoiles_athlete_nexus` | 1 845 c. | un `UPDATE` de données (contexte `allstar` 2026) |
| 8 | `20260825130731` | `badges_sports_table_de_liaison` | 7 356 c. | **crée** table `badge_sports`, fn `badge_sports_coherent`, 2 triggers, 1 index ; **`DROP COLUMN badges.sport_id`** |
| 9 | `20260825130938` | `badge_sports_rls_et_droits` | 2 288 c. | 4 policies sur `badge_sports` |
| 10 | `20260825131151` | `badges_projections_sans_fonction_privilegiee` | 7 225 c. | **re-remplace `top_athletes_view` et `partner_athlete_profile`** ; supprime `badges_json` |
| 11 | `20260825134921` | `badges_libelles_du_catalogue_final` | 5 004 c. | libellés du catalogue (`UPDATE` + `COMMENT`) |
| 12 | `20260825144302` | `badges_contexte_forme_et_suggestions_vers_athlete_badges` | 11 034 c. | **crée** `appliquer_distinctions_suggerees`, `code_badge_catalogue` ; `badges` + colonne `contexte_forme` ; écrit dans `evaluations` et `custom_distinctions` |
| 13 | `20260825144441` | `badges_suggestions_auteur_et_portee_du_remplacement` | 4 590 c. | remplace `appliquer_distinctions_suggerees` (**signature changée** : perd `v_coach_id`) |

### État actuel des objets badges

| Table | Lignes | RLS | Policies |
|---|---|---|---|
| `badges` | 22 | oui | 4 |
| `athlete_badges` | 5 | oui | 3 (pas de `DELETE` — le retrait passe par `UPDATE`) |
| `badge_sports` | 20 | oui | 4 |

Quatorze fonctions, dont onze en `SECURITY DEFINER`. Six triggers, dont **deux
posés sur des tables préexistantes**.

---

## Ce qui a été modifié HORS du périmètre badges

C'est le point qui rend le rapatriement urgent plutôt que cosmétique. Ces
migrations n'ont pas seulement ajouté des objets à elles : elles ont **réécrit des
objets antérieurs**, dont deux surfaces partenaire/recruteur en production.

| Objet préexistant | Depuis | Ce qui lui est arrivé | Migration |
|---|---|---|---|
| **`partner_athlete_profile(uuid)`** — RPC du portail partenaire | `20260820021550` | `DROP FUNCTION` + recréation, **deux fois** | `015147` puis `131151` |
| **`top_athletes_view`** — vue partenaire/recruteur | `20260429030000` | `DROP` + recréation, **deux fois** (ajout colonne `badges` jsonb) | `015147` puis `131151` |
| **`log_coach_activity_badge()`** — fn de trigger de la baseline, câblée sur `evaluations` | baseline | `CREATE OR REPLACE` (corps réécrit) + `REVOKE`/`GRANT` | `014427` |
| **`evaluations`** (table) | baseline | nouveau trigger `trg_zz_preserve_updated_at` + `UPDATE` de données | `014427`, `144302` |
| **`athletes`** (table) | baseline | nouveau trigger `trg_zz_preserve_athlete_denorm` + `UPDATE` de données | `014940` |
| **`custom_distinctions`** (table) | baseline | `INSERT` de données depuis le miroir badges | `144302` |

**Aucun `DROP TABLE` ni `DROP COLUMN` sur un objet préexistant.** Le seul
`DROP COLUMN` (`badges.sport_id`, migration 8) porte sur une colonne créée une
heure plus tôt par le chantier lui-même.

> Le trigger `trg_zz_preserve_athlete_denorm` sur `athletes` est déjà connu :
> il est mentionné dans les notes de session existantes. Il est ici **daté et
> rattaché à la migration qui l'a posé**, ce qui n'était pas le cas.

---

## Le trou le plus sérieux : une 14ᵉ modification sans aucune migration

**`apply_approved_suggestion()`** — fonction de la baseline, câblée par
`trg_apply_suggestion` sur `athlete_suggestions`, 19 642 caractères — référence
aujourd'hui `athlete_badges` et **appelle `appliquer_distinctions_suggerees`**.

**Aucune migration de `schema_migrations` ne contient cette version.** La dernière
qui la redéfinit est `20260824134148`, antérieure au chantier badges et sans
aucune mention de badges. Les migrations 12 et 13 en parlent en commentaire
(« POURQUOI TOUCHER apply_approved_suggestion ») mais **ne la recréent pas**.

Elle a donc été modifiée **en direct sur la base**, hors de tout mécanisme de
migration. Ce n'est pas une migration sans miroir : c'est un changement de schéma
sans migration du tout. Ni le dépôt ni `schema_migrations` n'en portent trace.

Conséquence : un `db reset` restaure la version du `20260824134148`, qui ne
connaît pas les badges — et le flux suggestions se comporte alors différemment en
local et en prod, **sans erreur**.

C'est le point à porter en premier à l'autre session.

---

## Anomalies secondaires relevées au passage

Toutes sont dans le périmètre de l'autre session. Aucune n'a été corrigée ici.

1. **`preserve_updated_at_si_miroir` et `preserve_athlete_denorm_si_miroir` n'ont
   pas de `search_path` fixé** (`proconfig` NULL), seules du lot dans ce cas. Elles
   tournent sur `evaluations` et `athletes`. Le dépôt a pourtant une migration
   dédiée à ce durcissement (`f6_a_pin_search_path_batch`).
2. **Cinq fonctions de trigger `SECURITY DEFINER` sont exécutables par `anon`** —
   `badge_contexte_requis`, `badge_plafond`, `badge_sports_coherent`,
   `trg_badges_vers_distinctions`, et `log_coach_activity_badge` (celle-ci en
   `row_security=off`). Exposition théorique — une fonction de trigger n'est pas
   utilement appelable via PostgREST — mais le `GRANT` à `anon` est inutile, et le
   projet a une convention explicite de révocation.
3. **Les migrations 5 et 10 font le même travail deux fois.** Seul l'état final
   (`131151`) compte ; `015147` est un état intermédiaire mort. Au rapatriement,
   les deux fichiers doivent exister quand même — c'est l'historique, pas l'état.
4. **`appliquer_distinctions_suggerees` a changé de signature** entre les
   migrations 12 et 13 (perte de `v_coach_id`). Une seule surcharge existe en base.
   Un rapatriement naïf qui rejouerait les deux dans l'ordre est correct ; un
   rejeu partiel laisserait **deux surcharges**.
5. **`coach_badges`** : table préexistante, RLS activée, **zéro policy**, zéro
   ligne, jamais touchée par le chantier. Table fantôme homonyme qui prêtera à
   confusion avec `athlete_badges` / `badge_sports`.
6. **`top_athletes_view` est en `SECURITY DEFINER`** (pas de `security_invoker`
   dans `reloptions`). C'est cohérent avec la décision antérieure
   `20260820022949 top_athletes_view_back_to_definer`, donc probablement voulu —
   mais les deux recréations badges reposent cette propriété **sans la déclarer**.
   À confirmer que l'intention était bien `definer`.

---

## Ce qu'il faut faire, et par qui

**Pour la session badges — dans cet ordre :**

1. Récupérer `apply_approved_suggestion()` (`pg_get_functiondef`) et lui écrire
   une migration. C'est le seul point où l'information n'existe qu'en base, sans
   même une ligne dans `schema_migrations`.
2. Rapatrier les treize depuis `statements`, un fichier `<version>_<name>.sql`.
3. Vérifier le rejeu à blanc : `supabase db reset` sur une base locale neuve doit
   produire les trois tables, les quatorze fonctions, les six triggers, et
   `top_athletes_view` / `partner_athlete_profile` dans leur version `131151`.
4. Traiter les anomalies 1 et 2 (`search_path`, `GRANT anon`).

**Pour tout le monde, d'ici là :** ne pas lancer `supabase db reset` en local.
Il reconstruirait une base sans badges — et sans la 14ᵉ modification, qui
n'existe qu'en production.
