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

**Les règles, telles que posées en base (lot B1, migration `20260924201029_b1_tableau_blanc_unite`) :**
1. **L'unité d'une ligne se pose à la création**, d'après son auteur (ou d'après
   la liste pour membres et notes de liste), par trigger — la valeur envoyée par
   le client est ignorée. **Elle ne bouge plus jamais** : un recruteur qui change
   de sport ou de cégep laisse tout dans l'ancienne unité.
2. **Policies élargies, additives** (`unite_select / unite_update / unite_delete`,
   `unite_insert` sur les membres de liste) via `acces_unite(cégep, sport)` :
   même unité, ou admin de ce cégep. Chacune **reproduit la policy propriétaire**
   de la même commande (Pro exigé partout depuis B2-0, voir plus bas). Les policies
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

**Lot B2-0 (migration `20260924203244_b2_0_signatures_unite`) — ce qui a changé :**
- **Gratuit = tout bloqué, en base** (décision BP 2026-09-24). Les 20 policies
  `unite_*` passent par `acces_unite_pro()` : unité (ou admin cégep) **et** Pro,
  en lecture comme en écriture et suppression. Un recruteur gratuit ne lit
  **aucune** ligne d'un collègue par appel direct ; ses propres lignes restent
  aux policies propriétaire, et « Mon processus » reste en mode démo pour lui.
  Admin ou pas : il faut payer pour voir et modifier le tableau blanc.
  (Dérogation à la règle 1 accordée par BP pour ces 20 policies seulement.)
- **Chaque geste signé par celui qui agit.** Les journaux d'étape, de retrait
  de favori et d'ajout/retrait de membre de liste signent le recruteur
  appelant (`acteur_recruteur()`), plus l'auteur de la ligne ni le
  propriétaire de la liste. L'interface écrit par `unite_ecrire_dossier` /
  `unite_ecrire_grade` : **toujours sur la ligne de l'acteur** (créée au besoin,
  alignée sur l'unité, sans bruit de journal).
- **Retraits d'unité** : `unite_retirer_favori`, `unite_retirer_du_processus`,
  `unite_retirer_grade` — une fonction par geste, **une** ligne de journal
  signée par l'acteur (aucune pour les grades, qui ne se journalisent pas).
  Un retrait de processus s'écrit `PIPELINE_CHANGED` avec `new_stage = null`
  et `retire = true` (la contrainte du journal n'est pas touchée).
- **Journal de l'unité** : `recruiter_activity_log` porte l'unité du geste
  (celle du dossier touché, jamais choisie par un client). Les collègues Pro
  lisent les **gestes du tableau blanc** (étapes, favoris, notes, listes) ; les
  vues de profil et les notifications rangées dans la même table restent
  privées. Le journal d'unité commence à l'apply de B2-0 (pas de rattrapage).
- **Notes des collègues** : la base permet à un Pro de l'unité de les
  modifier ; **l'interface les montre en lecture seule** (décision BP) — chacun
  ne modifie que les siennes.

**Lot B2, étape 2 (web, 2026-09-28) — Favoris et Listes par unité.** Aucune
migration : tout repose sur B1/B2-0.
- **Favori d'unité** (`useFavorisUnite` → `unite_favoris()`) : un cœur posé
  par un collègue Pro s'allume chez tous les Pro de l'unité — recherche, fiche,
  Mes favoris — avec « Favori de … ». Un seul chemin d'écriture web,
  `useBasculeFavori` : ajout = `definirFavori` (sa ligne) ; retrait Pro =
  `unite_retirer_favori` (une ligne de journal signée par l'acteur), après une
  confirmation qui **nomme les collègues** s'ils l'ont aussi ; seul à l'avoir,
  pas de modale. Un gratuit garde ses propres favoris, inchangé.
- **Listes de l'unité** (`useListesUnite`) : visibles et modifiables par tous
  les Pro de l'unité, avec l'auteur (« Par … », « Créée par … »), chaque membre
  avec qui l'a ajouté (`added_by`), notes de liste et notes d'athlète signées ;
  celles des collègues en **lecture seule**. Supprimer une liste la supprime
  pour l'unité — la confirmation nomme l'auteur si ce n'est pas soi.
- **Retirer un favori retire aussi du processus** (décision BP 2026-09-28,
  web, Pro) : dossier à Identifié ou Contacté → les deux partent sans question
  (sauf la confirmation d'unité si des collègues l'ont en favori) ; dossier
  plus avancé → confirmation « Cet athlète est en [étape]. Retirer le favori le
  retirera aussi du processus de l'unité. ». Deux appels client dans l'ordre,
  `unite_retirer_favori` puis `unite_retirer_du_processus` — aucune fonction en
  base touchée, chacun signe sa ligne de journal. Si le second échoue, le
  favori est déjà parti et l'écran le dit. Gratuit : inchangé.
- L'admin cégep voit ici **son sport** seulement ; les autres sports de son
  cégep relèvent de l'étape 3 (registre §39–40).
- Toutes les lectures sont sous les clés de `lib/queries/tableauBlanc.ts`
  (jamais persistées), toutes les écritures appellent `invaliderTableauBlanc`.
- Mobile 1.4.3 : inchangé (registre §38) — les hooks mobiles
  (`useFavorites`, `useRecruiterLists`, `useFavoriteAthletes`) n'ont pas bougé.
- **§41 appliqué en prod (`20260928143738`)** : on n'écrit une note de liste
  que dans sa liste ou celle de son unité. Reste l'incohérence `unite_update`
  (déplacer sa note vers une autre unité), au registre §41.

**Lot B2, étape 3 (web, 2026-09-28) — Calendrier, Tableau de bord, Mon CÉGEP par unité.**
- **Calendrier** (`useCalendrierUnite`) : les matchs des athlètes suivis par
  l'unité (processus, favoris, listes — de soi ou d'un collègue) et les
  **visites planifiées** de toute l'unité comme événements (section en vue
  liste, marqueur vert en vue mois, « Suivi par … »). Les équipes des athlètes
  suivis par un collègue se lisent grâce à la policy additive
  `unite_equipes_suivies` sur `team_athletes` (migration
  `b2_3_unite_journal_calendrier`, appliquée en prod : `20260928172039`). La construction cibles → matchs est
  partagée (`construireCalendrier`) : l'app 1.4.3 garde ses propres cibles.
- **Tableau de bord** : entonnoir et tuiles Relances / Visites sur
  `useProcessusUnite` (la lecture de Mon processus, même clé de cache) ; fil
  d'activité de l'unité (`useActiviteUnite`) — les gestes du tableau blanc de
  toute l'unité, chacun « par … », plus ses propres événements privés. Gratuit :
  inchangé.
- **Mon CÉGEP** : l'admin lit toutes les unités de son cégep, filtre par sport.
  Les comptes portent désormais sur des **dossiers** (athlète × unité) et non
  sur des lignes : deux collègues qui suivent le même athlète ne le comptent
  plus deux fois (`fetchDossiersUniteCegep`, `lib/cegep/dossiersUnite.ts`).
  `cegep_pipeline_overview` reste la source — Mon CÉGEP est ouvert à l'admin
  gratuit, que les lectures d'unité (Pro) laisseraient vide.
- **§40 tranché** : un admin qui regarde un autre sport (ou tout le cégep) lit
  sans écrire — avis « lecture seule » en tête de Mon CÉGEP et de Mon
  processus (`AvisLectureSeule`), dossiers d'un autre sport non modifiables.
- **§39 corrigé en base** (même migration) : la ligne de journal d'un retrait
  d'unité fait dans un autre sport va dans l'unité **visée**.

**Lot C (2026-09-28) — CARTES PROSPECT : un athlète pas encore sur Nexus.**
Migration `lot_c_cartes_prospect` (additive : sept tables nouvelles, aucune
existante touchée).
- **Propriété : l'UNITÉ** (cégep × sport), posée par trigger d'après le créateur,
  jamais modifiable. Lecture et écriture : Pro/All Star de l'unité ; admin cégep
  en **lecture** sur tout son cégep. Rien pour coach, athlète, parent,
  partenaire, anon. Aucune recherche ne lit ces tables : une carte n'apparaît
  jamais hors de son cégep.
- **Contenu** : prénom, nom, équipe RÉELLE (`teams.id`, du sport de l'unité,
  obligatoire à la création), position, numéro, promotion, taille, poids, lien
  vidéo, courriel facultatif (invitation du lot D). Aucune autre coordonnée.
  Suivi : étape, grade, relance, visite, drapeau ; notes à part, signées (chacun
  ne modifie que les siennes) ; journal propre (`cartes_prospect_journal`), pas
  `recruiter_activity_log` (dont la contrainte, lue par l'app 1.4.3, ne bouge pas).
- **Retirer une carte la SUPPRIME** (décision BP), avec une trace d'audit minimale
  (`cartes_prospect_suppressions` : qui, quand, motif, unité — aucune donnée de
  l'athlète), lisible par l'admin plateforme seulement.
- **Rétention** : purge pg_cron quotidienne 12 mois après la dernière activité ;
  avis à l'écran 30 jours avant (bandeau dans Mon processus, marqueur sur la
  carte). Tout geste repousse l'échéance.
- **Choix de l'équipe en deux temps** (retour BP) : Scolaire (écoles secondaires
  et cégeps) ou Civil (clubs `LIGUE_CIVILE`), puis l'établissement par son nom —
  seuls ceux qui ont une équipe du sport de l'unité —, puis une de ses équipes
  de ce sport, libellée « Football juvénile D1 · Masculin ». L'école se déduit
  de l'équipe.
- **Doublons — avertir, jamais bloquer** : même nom normalisé + même
  établissement avec un prénom compatible (composé ou abrégé :
  « Bruno-Philippe » ↔ « Bruno »), contre les cartes de l'unité et les athlètes
  Nexus ; même courriel, contre une carte de l'unité ou un athlète Nexus
  (`athlete_nexus_par_courriel()`, SECURITY DEFINER). **Un athlète masqué n'est
  jamais suggéré** : la recherche recruteur et cette fonction ne rendent une
  identité que si `athlete_identity_ok()` passe, et seulement à un recruteur Pro
  — sinon un courriel confirmerait qu'un mineur non consentant est inscrit.
- **Listes** : une carte s'ajoute à une liste **de son unité** comme un athlète,
  par une liaison à part (`cartes_prospect_listes` : ajout et retrait, signés,
  journalisés `LISTE`). `recruiter_list_members` (athlete_id NOT NULL, lu par
  l'app 1.4.3) n'est pas touchée. Une liste d'une autre unité, ou personnelle,
  est refusée par trigger (22023). Supprimer la carte emporte ses liaisons.
- **Marqueur** : pas de pastille dans les listes — un **fond rouge léger**
  (#E63946 à 11 %) sur TOUTE la ligne du tableau (colonne Nom figée comprise),
  TOUTE la carte du kanban (bandeau photo compris), la ligne d'une liste et de
  Mon CÉGEP › Recrues, avec la légende « Fond rouge = pas encore sur Nexus » EN
  HAUT, à côté des filtres. Le panneau garde la mention en toutes lettres.
- **Invitation automatique, à la création seulement** : une carte créée avec un
  courriel qui n'appartient à aucun compte ni athlète Nexus déclenche UN
  courriel (Resend, `send-invitation-carte`), au nom du recruteur, nommant le
  cégep, avec le lien d'inscription pré-rempli et le désabonnement LCAP. La base
  décide et réserve (`cartes_prospect_invitations`, trigger AFTER INSERT : une
  modification ne déclenche jamais rien ; au plus une par carte) ; l'envoi pose
  `invitee_le`, que le panneau affiche (« Invitation envoyée le … ») et que le
  journal trace. **Écartée sans envoi** : adresse d'un compte ou d'un athlète,
  adresse désabonnée, ou adresse **déjà invitée depuis moins de 90 jours par
  n'importe quel cégep** (règle anti-doublon d'envoi, proposée, à confirmer).
  Le motif d'un écart n'est lisible que par l'admin plateforme ; le recruteur
  voit « Invitation envoyée le … » ou rien. L'adresse n'est jamais stockée en
  clair hors de la carte : empreinte sha256 dans les invitations et dans le
  registre `courriel_desabonnements_adresses` (le registre par compte ne couvre
  pas quelqu'un qui n'a pas de compte). L'import du lot F n'enverra rien
  (décision à part).
- **Un seul fil de notes par joueur** : `FilNotesSuivi` — Mon processus et le
  panneau d'une liste lisent et écrivent le même fil (`recruiter_notes` de
  l'unité, ou `cartes_prospect_notes` pour une carte), signé, les notes des
  collègues en lecture seule. Le web n'écrit plus `recruiter_list_notes`
  (registre §38).
- **Jamais un athlète, jamais dans une recherche** (prouvé, R1–R6) : créer une
  carte ne touche ni `athletes`, ni `users`, ni `auth.users` ; aucune fonction
  hors lot C et aucune vue ne lit les cartes (gate 7f de la migration, liste
  complète) ; la recherche recruteur ne les rend pas ; admin plateforme,
  partenaire, coach, athlète et anon n'en lisent aucune.
- **Interface** : kanban, tableau, panneau (Actions / Infos / Historique), export
  xlsx (colonnes « Profil Nexus » Oui/Non et « Courriel »), entonnoir, tuiles,
  listes, calendrier (matchs de leur équipe, visites et relances, marqués
  « prospect » ; filtre par liste) et Mon CÉGEP. Pas de profil complet, pas de
  messagerie ; « Inviter » arrive au lot D.

### LOI 25 — LE CÉGEP EST PROPRIÉTAIRE DES DONNÉES DES CARTES PROSPECT

Une carte prospect est constituée par les recruteurs d'un cégep, sur un athlète
qui n'a **pas** de compte Nexus et n'a donc consenti à rien auprès de Nexus. Le
**cégep** en est le responsable et le propriétaire (il la crée, la tient à jour,
la supprime) ; Nexus en est l'hébergeur et le sous-traitant. D'où :
- **minimisation** : identification et mesures sportives seulement, courriel
  facultatif, aucune autre coordonnée ;
- **cloisonnement** : jamais visible hors de l'unité (et de l'admin de son
  cégep), jamais dans une recherche ;
- **durée limitée** : suppression automatique après 12 mois sans activité ;
- **suppression réelle** au retrait, trace d'audit sans donnée personnelle ;
- **mineurs** : une carte peut viser un mineur ; rien n'y est publié, rien n'est
  transmis à l'athlète ni à ses parents avant l'invitation du lot D, qui devra
  porter le consentement.

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
