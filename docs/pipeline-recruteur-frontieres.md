# Pipeline recruteur — frontières de données et surfaces canoniques

Créé le 2026-09-03 (Lot 0 « garder le trigger »). Ce fichier fixe trois décisions
qui reviennent à chaque itération du pipeline recruteur. Les faits DB ci-dessous
ont été relus sur le projet cloud `nrloizyemulbhujrqhgx` le 2026-09-03, puis
**mis à jour le 2026-09-17 après le Lot 2a** (§1 et §2 réécrits : les policies
coach et admin cégep sont retirées, remplacées par des RPC).

---

## 0. RETOUR ASSUMÉ SUR LE 17 SEPTEMBRE — le tableau blanc par unité (décision BP, 2026-09-24)

**Ce qui est décidé.** Entre recruteurs d'une même **unité = cégep × sport**
(`users.school_id` × `users.sport_id`, lot A), **rien n'est privé, sauf les
messages**. « Mon processus » devient un tableau blanc partagé : dossiers,
étapes, grades, notes, relances, visites, favoris, listes (et leurs membres et
notes), calendrier appartiennent à l'unité. **Chaque geste reste signé** par
son auteur (`recruiter_id`, et `added_by` pour les membres de liste).
L'admin cégep lit et modifie **tout son cégep**, avec un filtre par sport ouvert
sur le sien ; un recruteur non admin ne voit que son unité.

**Ce que ça renverse.** La décision du 2026-09-17 (§1 ci-dessous) rendait
`next_action_note`, `visit_at` et `flagged` **privés au recruteur**, admin cégep
compris. **Entre collègues d'une même unité, ce n'est plus vrai** : ils se
lisent et se modifient. Ce qui du 17 septembre **reste vrai** :
- le **coach** et le **parent** ne lisent toujours ni les notes, ni les
  relances, ni les visites (aucune policy nouvelle ne les concerne) ;
- un recruteur d'un **autre cégep**, ou d'un **autre sport** du même cégep
  (hors admin), ne voit rien de l'unité ;
- un recruteur **sans cégep ou sans sport** n'a pas d'unité : ses lignes restent
  privées exactement comme le 17 septembre.

**Les règles, telles que posées en base (lot B1, migration `…_b1_tableau_blanc_unite`) :**
1. **L'unité d'une ligne se pose à la création**, d'après son auteur (ou d'après
   la liste pour membres et notes de liste), par trigger — la valeur envoyée par
   le client est ignorée. **Elle ne bouge plus jamais** : un recruteur qui change
   de sport ou de cégep laisse tout dans l'ancienne unité.
2. **Policies élargies, additives** (`unite_select / unite_update / unite_delete`,
   `unite_insert` sur les membres de liste) via `acces_unite(cégep, sport)` :
   même unité, ou admin de ce cégep. Chacune **reproduit la policy propriétaire**
   de la même commande (mêmes exigences `user_has_pro()`). Les policies
   propriétaire sont **conservées** ; leur retrait viendra dans une migration
   séparée, sur GO distinct, **après B2**.
3. **On n'écrit jamais au nom d'un collègue** : l'INSERT reste « `recruiter_id` =
   soi ». Un collègue peut modifier la ligne d'un autre, **jamais en changer
   l'auteur** (trigger `unite_figer`, erreur 42501).
4. **Une ligne par unité et par athlète, sans toucher `UNIQUE(recruiter_id,
   athlete_id)`** : les lignes de chaque recruteur restent distinctes (« lignes
   sœurs ») ; un trigger recopie sur les sœurs ce qui vient d'être écrit
   (processus : étape, relance, visite, drapeau ; grades). Dernière écriture =
   état de l'unité. Un collègue qui ajoute un athlète déjà suivi **rejoint** le
   dossier à son étape, il ne le fait pas reculer. Les lectures par unité
   (`unite_pipeline`, `unite_grades`, `unite_favoris`) rendent une ligne par
   athlète ; `unite_auteurs()` rend le nom des auteurs (users n'est pas lisible
   entre collègues).
5. **Les effets de bord ne se jouent qu'une fois**, sur la ligne écrite : journal
   (`log_pipeline_change`), notifications parent (étape, visite), statut global
   de l'athlète. Les quatre fonctions trigger portent une garde
   (`nexus.sync_unite`) qui les coupe pendant la recopie des sœurs. Un collègue
   qui rejoint un dossier déjà à cette étape ne déclenche pas de « progression »
   chez le parent.
6. **Favori d'unité** = au moins un recruteur de l'unité l'a. Le retirer sur le
   web le retire pour l'unité ; **le mobile 1.4.3 ne retire que le sien** jusqu'à
   la 1.4.4 (registre `docs/fast-follow-1.4.2.md` §38).

**Point ouvert pour B2 — la signature d'une modification.** Quand un collègue
modifie la ligne d'un autre, le journal est signé par l'**auteur de la ligne**
(`NEW.recruiter_id`), pas par celui qui a agi. Pour que « chaque geste soit
signé » par son acteur, **l'interface B2 écrit par la ligne de l'acteur** (en
la créant si besoin — elle naît alignée sur l'unité) plutôt que par celle d'un
collègue ; la synchronisation fait le reste. Les policies le permettent déjà.

La suite de ce fichier décrit l'état **du 17 septembre** : elle reste exacte
pour le coach, le parent, l'admin plateforme et les recruteurs sans unité.

---

## 1. Qui lit `recruiter_pipeline` — état au 2026-09-17, Lot 2a appliqué

**LA GARANTIE EST MAINTENANT EN BASE, PLUS SEULEMENT DANS L'UI.** C'est le
changement de ce lot : jusqu'au 2026-09-17, « le coach ne voit que le stage »
n'était vrai que parce qu'aucun écran ne sélectionnait les autres colonnes. Un
appel direct à l'API rendait la ligne entière.

**Décision BP du 2026-09-17 :** `next_action_note`, `visit_at` et `flagged` sont
**privés au recruteur**. Ni le coach, ni l'admin cégep ne doivent pouvoir les
lire, même par appel direct à l'API.

**Ce qui est en base** (`pg_policy` sur `public.recruiter_pipeline`, 6 policies) :

| policy | cmd | qual |
|---|---|---|
| `recruiter_pipeline_select` | SELECT | `recruiter_id = auth.uid()` |
| `recruiter_pipeline_insert / update / delete` | écriture | propriétaire (+ `user_has_pro()` en écriture) |
| `admins read all` | SELECT | `is_admin()` |
| `admins update all` | UPDATE | `is_admin()` |

**Trois policies ont été RETIRÉES** (migration `20260917184623`) et remplacées
par des RPC `SECURITY DEFINER` qui ne projettent aucune colonne privée
(migration `20260917181701`) :

| policy retirée | remplacée par | ce que la RPC rend |
|---|---|---|
| `coaches read pipeline for own athletes` | `coach_pipeline_for_my_athletes(p_athlete_ids, p_stages)` | `athlete_id, recruiter_id, stage, updated_at` |
| `cegep admin read pipeline` | `cegep_pipeline_overview(p_recruiter_ids, p_stages)` | + `created_at, moved_at` |
| `cegep admin update pipeline` | `reassign_pipeline(p_from, p_to, p_athlete_ids)` | ne change QUE `recruiter_id` |

**Périmètre coach, élargi au passage (décision BP) :** la RPC couvre les athlètes
dont le coach est `coach_id` **∪** `get_coach_athletes(true)` (équipes coachées,
et toute l'école pour un directeur). L'ancienne policy s'arrêtait à `coach_id` :
les pages `/coach/ecole/*` d'un directeur **sous-comptaient en silence** tout ce
qui touchait les athlètes des autres coachs. Prouvé sur fixture : 0 ligne en
lecture directe, 4 par la RPC.

**Vérifié en prod sous identité réelle, après l'apply :**

| | avant | après |
|---|---|---|
| Coach, `select * from recruiter_pipeline` | 1 ligne, `visit_at` lisible | **0 ligne** |
| Coach, RPC | 1 ligne | 1 ligne, 4 colonnes |
| Admin cégep, lignes et notes d'un collègue en direct | lisibles | **0 / 0** |
| Admin cégep, RPC d'aperçu | — | fonctionne |
| Réassignation | copiait les notes, notifiait à tort | déplace tout, **0 notification, 0 ligne de journal** |

**Ce qui reste lisible hors du propriétaire, délibérément :**
- `admins read all` / `admins update all` — l'admin plateforme est hors décision.
- `cegep admin read favorites` sur `recruiter_favorites` — deux écrans Mon CÉGEP
  comptent encore les favoris de l'équipe (`cegep/recruteurs:154`, `cegep/stats:248`).
  Hors périmètre : la décision ne vise que les trois colonnes privées.

**La règle, inchangée et toujours la vraie règle :**

> Toute donnée privée recruteur vit dans une table séparée, à RLS propriétaire
> seul (`recruiter_id = auth.uid()`).

**Pourquoi elle reste vraie même maintenant :** les trois colonnes sont privées
parce que **plus personne d'autre n'obtient la ligne**, pas parce qu'elles ont
bougé. Ajouter demain une policy de lecture à un nouveau rôle rouvrirait tout
d'un coup. Le **Lot 2b** — déplacer les colonnes dans une table propriétaire
seul — reste au programme comme défense en profondeur, reporté au lot mobile :
des binaires publiés écrivent encore `visit_at` et `flagged` en direct, et un
`DROP` de colonne les casserait (règle 3 du CLAUDE.md, expand-then-contract).

**Régression connue et acceptée** (registre `docs/fast-follow-1.4.2.md` §28) :
`components/shared/CoachDashboardMobile.tsx:621` lit encore le pipeline en
direct — son indicateur « contactés » affiche **0** dans les binaires coach
publiés jusqu'au lot mobile. Aucune erreur, aucun plantage.

---

## 2. Surface de notes canonique

**Canonique : `recruiter_notes`** (`useAddPipelineNote` / `usePipelineNotes`,
feed de la page `/recruteur/pipeline`). Toute nouvelle note passe par là.

**Depuis le Lot 2a (2026-09-17), la table est STRICTEMENT propriétaire :** une
seule policy, `Recruiters manage own notes`. `cegep admin read notes` et
`cegep admin insert notes` sont retirées — une note privée de recruteur n'a pas
à être lue par l'admin de son cégep. Elles n'existaient que pour la
réassignation, qui **copiait** les notes ; `reassign_pipeline()` les **déplace**
désormais, en conservant leur `created_at` et sans écrire de faux `NOTE_ADDED`.

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
