# Dérive de migrations — chantier badges, 25 août 2026

> ## ⚠️ MISE À JOUR DU 25 AOÛT, APRÈS VÉRIFICATION — LIRE AVANT LE RESTE
>
> **1. Les treize migrations ont été rapatriées.** Commit `4b0159a`, par la session
> qui a produit le chantier badges, plus une quatorzième de son cru
> (`badges_avertissement_prefixe_zz_sur_les_triggers`, appliquée *et* versionnée).
> Ce volet est réglé. La suite du document décrit l'état d'avant, et reste le
> compte rendu de ce qui a été trouvé.
>
> **2. LA « 14ᵉ MODIFICATION SANS MIGRATION » N'EXISTE PAS. Je me suis trompé.**
>
> Ce document affirmait que `apply_approved_suggestion()` avait été modifiée en
> direct sur la production, hors de tout mécanisme de migration. **C'est faux, et
> l'erreur était la mienne.** Vérification faite :
>
> La migration `20260825144302_badges_contexte_forme_et_suggestions_vers_athlete_badges.sql`
> **ne fait pas de `CREATE OR REPLACE`**. Elle lit le corps déployé avec
> `pg_get_functiondef('public.apply_approved_suggestion')`, y applique **deux
> substitutions textuelles ciblées**, et exécute le résultat. Le corps final est
> donc *calculé au moment du rejeu* — d'où son absence littérale des fichiers.
> C'est ce qui a déclenché ma fausse alerte : j'ai cherché le texte, je ne l'ai
> pas trouvé, et j'en ai conclu à une écriture à la main.
>
> Cette forme n'est pas une faiblesse, elle est **plus sûre** que ce que je lui
> reprochais : si le corps de départ n'est pas celui attendu, la migration
> **lève** (`NEXUS: branche 'Distinctions' introuvable — le corps déployé a
> changé, aucune substitution faite`), puis revérifie après coup qu'aucune
> écriture de `evaluations.distinctions` ne subsiste et que les 47 branches `WHEN`
> sont intactes. Un `db reset` reproduit donc le corps à l'identique, **ou échoue
> bruyamment**. Aucune dégradation silencieuse n'est possible.
>
> Ce qui reste vrai, et qui est une gêne réelle mais mineure : **le texte
> réellement exécuté n'est lisible dans aucun fichier du dépôt**. C'est la seule
> raison pour laquelle une archive a été conservée :
> `docs/recuperation/apply_approved_suggestion-20260825.sql` — pièce de
> **lecture**, pas de rejeu, et son en-tête le dit.
>
> **3. Un audit complet a suivi.** 710 objets de `public` testés (206 fonctions,
> 95 tables, 6 vues, 308 policies, 95 triggers), extensions exclues.
> **Zéro objet de production n'existe nulle part ailleurs qu'en production.**
> Les quinze divergences de définition relevées s'expliquent toutes par la forme
> des migrations (corps calculé, reformatage, un enregistrement en stub), aucune
> par une écriture à la main. Limites de la méthode en fin de document.


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

*(Une quatorzième modification était initialement signalée ici comme pire encore.
Cette alerte était fausse — voir la mise à jour en tête de document.)*

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

## L'alerte retirée : `apply_approved_suggestion()`

**Cette section affirmait une modification hors migration. Elle était fausse.**
Le détail de la réfutation est en tête de document ; le résumé :

| affirmé | établi |
|---|---|
| modifiée en direct sur la prod | **non** — modifiée par la migration `20260825144302` |
| n'existe nulle part ailleurs qu'en production | **non** — reproductible depuis `20260824134148` + deux substitutions |
| un `db reset` la remplacerait silencieusement | **non** — la migration lève si le corps de départ diffère |
| son texte est illisible depuis le dépôt | **oui** — seul point qui tenait, d'où l'archive de lecture |

Ce que j'aurais dû faire avant d'écrire l'alerte : ouvrir la migration `144302`
plutôt que de conclure de l'absence du texte à l'absence de migration. Une
recherche textuelle ne peut rien conclure face à une migration qui construit son
SQL à l'exécution — c'est une limite de la méthode, pas une preuve de dérive.

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

1. ~~Récupérer `apply_approved_suggestion()`~~ — **sans objet**, l'alerte était
   fausse (voir en tête). Une archive de lecture existe néanmoins :
   `docs/recuperation/apply_approved_suggestion-20260825.sql`.
2. ~~Rapatrier les treize~~ — **fait**, commit `4b0159a`.
3. Vérifier le rejeu à blanc : `supabase db reset` sur une base locale neuve doit
   produire les trois tables, les quatorze fonctions, les six triggers, et
   `top_athletes_view` / `partner_athlete_profile` dans leur version `131151`.
4. Traiter les anomalies 1 et 2 (`search_path`, `GRANT anon`).

**Pour tout le monde :** l'avertissement `db reset` du 25 août au matin est levé
pour ce qui concerne les badges — les treize sont rapatriées. Il reste valable
pour une autre raison, indépendante de ce chantier : **335 migrations appliquées
contre 339 fichiers locaux**, dont 67 paires même-nom-version-différente et au
moins deux numéros de version portant un contenu différent de chaque côté
(`20260723130000` est `coach_school_onboarding_adopt_guard` en local et
`coach_initiate_recruteur_coach` sur le cloud). Ni `schema_migrations` ni le
dépôt ne font autorité seuls. Cet écart mérite son propre audit.
