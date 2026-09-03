# Pipeline recruteur — frontières de données et surfaces canoniques

Créé le 2026-09-03 (Lot 0 « garder le trigger »). Ce fichier fixe trois décisions
qui reviennent à chaque itération du pipeline recruteur. Les faits DB ci-dessous
ont été relus sur le projet cloud `nrloizyemulbhujrqhgx` le 2026-09-03.

---

## 1. La policy `coaches read pipeline for own athletes`

**Ce qui est en base aujourd'hui** (`pg_policy` sur `public.recruiter_pipeline`) :

| policy | cmd | qual |
|---|---|---|
| `recruiter_pipeline_select` | SELECT | `recruiter_id = auth.uid()` |
| `coaches read pipeline for own athletes` | SELECT | `is_coach_of_athlete(athlete_id)` |
| `cegep admin read pipeline` | SELECT | `is_cegep_admin_over_recruiter(recruiter_id)` |
| `admins read all` | SELECT | `is_admin()` |

**Frontière produit assumée :** le coach voit la progression du dossier de son
athlète chez un recruteur — c'est le cœur de la valeur « le coach suit ses
joueurs ». Il n'a pas à voir la cuisine interne du recruteur.

**Précision technique — ne pas se raconter d'histoires :** la RLS PostgreSQL est
*par ligne*, pas *par colonne*. La policy ci-dessus donne au coach la **ligne
entière** de `recruiter_pipeline`, donc aussi `notes`, `flagged`,
`next_action_at`, `next_action_note`, `visit_at`. Le cloisonnement « le coach ne
voit que le stage » n'existe aujourd'hui que dans l'**UI** : aucune surface coach
ne sélectionne ces colonnes. Ce n'est pas une garantie base de données.

**Règle qui en découle, et qui est la vraie règle :**

> Toute donnée privée recruteur vit dans une table séparée, à RLS propriétaire
> seul (`recruiter_id = auth.uid()`). On n'ajoute plus de colonne privée sur
> `recruiter_pipeline` : cette table est lisible par le coach, le cégep admin et
> l'admin.

Conséquence directe, appliquée au Lot 1 : `next_action_at` (une **date**, qui ne
dit rien de plus que « le recruteur compte relancer ») est portée au mobile ;
`next_action_note` (du **texte libre** du recruteur) ne l'est pas, et migrera
vers la table privée au Lot 2 avec les autres colonnes privées existantes.

**L'existant n'est PAS conforme à cette règle — ne pas lire « on n'ajoute plus de
colonne privée » comme « tout est propre ».** `next_action_note` est un legs non
conforme : la colonne vit sur `recruiter_pipeline` (lisible par le coach) et le
web l'écrit encore via `handleSaveAction`. À migrer vers la table privée
recruteur au Lot 2. Le mobile ne l'écrit pas (périmètre Lot 1 = date seule).

---

## 2. Surface de notes canonique

**Canonique : `recruiter_notes`** (`useAddPipelineNote` / `usePipelineNotes`,
feed de la page `/recruteur/pipeline`). Toute nouvelle note passe par là.

**`recruiter_pipeline.notes` — deprecated.** Plus écrite nulle part dans l'app
(grep 2026-09-03 : zéro `update`/`insert` la touchant). Elle n'est plus que
**lue**, à un seul endroit : `lib/queries/recruiter/usePipelineCards.ts` (champ
`notes` du select, mappé sur `PipelineKanbanCard.notes`). La colonne existe
toujours en base — elle n'est **pas** supprimée par le Lot 0.

**`recruiter_list_notes` — deprecated au sens « pas de neuf dessus ».**
Attention, contrairement à `pipeline.notes`, cette table est **encore vivante et
écrite** : `app/recruteur/listes/page.tsx` (lecture, ajout, suppression),
`lib/queries/recruiter/useAddListNote.ts`, `useListNotes.ts`. La déprécier veut
dire : ne rien bâtir de neuf dessus, et la replier sur `recruiter_notes` lors du
lot de nettoyage — pas la traiter comme du code mort aujourd'hui.

**Lot de nettoyage à venir (pas dans le Lot 0) :**
1. retirer `notes` du select ET du mapping dans `usePipelineCards.ts`, puis
   `alter table recruiter_pipeline drop column notes` ;
2. migrer les lignes `recruiter_list_notes` vers `recruiter_notes`, réécrire la
   page listes, puis supprimer la table.

---

## 3. Grade recruteur (Lot 2) — décidé d'avance

- Échelle **lettrée** : `A+`, `A`, `B+`, `B`, `C+`, `C`, `D`.
- Stockage : `varchar` + contrainte `CHECK` sur ces sept valeurs. Pas d'enum
  (une valeur ajoutée à un enum ne se retire plus), pas d'entier.
- Table **dédiée** : `recruiter_athlete_grades`, RLS propriétaire seul
  (`recruiter_id = auth.uid()`) — cf. la règle du §1.
- **Jamais dans `evaluations`.** `evaluations` est le système d'évaluation
  **coach**, visible côté athlète et recruteur. Le grade recruteur est un
  jugement privé. Les deux systèmes ne se confondent pas (cf. CLAUDE.md,
  « Two Separate Evaluation Systems — NEVER CONFLATE »).

---

## 4. Le trigger `log_pipeline_change` (état après Lot 0)

Avant : un seul trigger `trg_log_pipeline` `AFTER INSERT OR UPDATE` **sans
`WHEN`** — toute écriture de colonne (`flagged`, `next_action_at`, `visit_at`…)
insérait un faux `PIPELINE_CHANGED` avec `before_stage = new_stage`. Mesuré en
prod le 2026-09-03 : 69 lignes `PIPELINE_CHANGED`, dont **7 faux positifs**.

Après : deux triggers, `trg_log_pipeline_insert` (sans `WHEN`) et
`trg_log_pipeline_update` (`WHEN old.stage IS DISTINCT FROM new.stage`). La
fonction `log_pipeline_change()` n'est **pas** modifiée. Un trigger unique était
impossible : `WHEN` ne peut pas référencer `OLD` sur un trigger `INSERT`, et
`TG_OP` n'existe pas dans une condition `WHEN` (les deux erreurs vérifiées sur
PostgreSQL 17.6). Détail et preuves : migration
`supabase/migrations/*_guard_log_pipeline_change.sql`.
