# Passation Windows → Mac — 2026-09-12

Fin de la session Windows. Le Mac prend la suite pour le **build iOS**.

---

## 1. SHA à puller

```
release/1.4.1 → 40cf85a
```

Dernier **build Android** de la session : **`e9a5dd6`** (APK 25 918 003 o,
installé 13:45:52, versionName 1.4.1 / versionCode 11, 0 crash).
Le commit `40cf85a` qui suit ne touche QUE l'écran équipe côté coach
(`canAddStaff` / `canRemoveStaff`) — il n'est pas dans l'APK Android testé.
Le build iOS, lui, partira de `40cf85a` et l'inclura.

---

## 2. État des 6 volets D6

| Volet | Sujet | État |
|---|---|---|
| **1** | Dédoublonnage conversations | ✅ **APPLIQUÉ EN PROD** |
| **2** | Index d'unicité RECRUTEUR_* | ✅ **APPLIQUÉ EN PROD** |
| **3** | `is_team_head_coach()` → REFERENT_ROLES | ⏸️ DDL **non écrit**, bloqué (§4) |
| **4** | Décision ✕/DELETE + scission des droits | ✅ **CODE LIVRÉ** (`40cf85a`) — pas de migration |
| **5** | Périmètre onboarding (school_id/coach_id) | ⏸️ DDL **prêt, non appliqué**, non prouvé (§4) |
| **6** | Suggestions d'évaluation | ⏸️ DDL **prêt, non appliqué**, non prouvé (§4) + un bloc restant à rédiger |

### Volets 1 et 2 — décompte réel contre attendu

| Attendu | Réel |
|---|---|
| 5 messages sur la survivante | **5** ✅ |
| 0 participant, 0 notification | **0 / 0** ✅ |
| 3 conversations supprimées | **3** ✅ |
| 0 message orphelin | **0** ✅ |
| `last_message_at` recalculé | **2026-08-18 21:47:45.596056** ✅ |
| 0 doublon RECRUTEUR_COACH restant | **0** ✅ |

Les deux index existent en prod :
`uq_conversations_recruteur_coach` (recruiter_id, coach_id, athlete_id) et
`uq_conversations_recruteur_athlete` (recruiter_id, athlete_id — **2 colonnes**,
`coach_id` étant NULL par construction sur ce type).

### Fichiers DDL prêts, NON appliqués

- `docs/d6-volet5-perimetre-onboarding.sql` — 7 preuves listées en fin de fichier.
- `docs/d6-volet6-suggestion-evaluation.sql` — 9 preuves + **un bloc restant à
  rédiger** : élargir la RLS de lecture des suggestions au périmètre équipe
  (voir §5 ci-dessous).

---

## 3. ⚠️ Pourquoi les volets 3, 5 et 6 ne sont pas prouvés

La décision **B** (`supabase db reset`) a été appliquée. Elle **a échoué**, et
pour une raison structurelle qu'il faut connaître avant de réessayer :

`20260825020802_badges_contexte_equipe_etoiles_athlete_nexus.sql` est une
migration de **données** qui vise un athlète de PROD en dur
(`d4cd6432-…`) et lève si elle ne met pas exactement 1 ligne à jour. Sur une
base fraîchement resettée, cet athlète n'existe pas → exception → le reset
s'arrête à 324 migrations.

Rattrapage manuel ensuite : **56 migrations appliquées**, 4 en échec, toutes
sur des **assertions de données de prod** (dont « 237 lignes attendues au
minimum » dans `edition_directe_athlete` — ce sont les fameuses 237). Local
atteint 380.

**Mais la parité n'est PAS acquise.** Empreintes `md5(prosrc)` comparées
local ↔ prod sur les quatre fonctions qui comptent :

| Fonction | Local | Prod |
|---|---|---|
| `champs_profil_athlete` | `29bd9c48…` | `c73d674f…` |
| `enforce_athlete_self_edit_perimeter` | `58102c4c…` | `54387769…` |
| `is_team_head_coach` | `544e9ed8…` | `d9d58a4f…` |
| `trg_suggestion_transition` | `36aad869…` | `3c9c55b9…` |

**Aucune ne correspond.** Prouver un volet contre une fonction qui n'est pas
celle de la prod ne prouve rien — les preuves n'ont donc pas été produites, et
c'est délibéré.

**Ce qu'il faudrait pour débloquer** (à faire à froid, pas dans l'urgence) :
1. comprendre l'écart — probablement des fins de ligne (les fichiers du dépôt
   sont en CRLF, le corps stocké en prod ne l'est pas) plutôt qu'un écart
   sémantique. À vérifier par un diff de `prosrc` sur UNE fonction avant tout
   le reste ;
2. rendre les 4 migrations à assertion tolérantes à une base sans données de
   prod, ou les marquer applicables hors-prod ;
3. reconstruire les comptes de test locaux — le reset a détruit les 37
   `auth.users` faits main, et les preuves par rôle (volets 5 et 6) en ont
   besoin.

---

## 4. Ce qui reste à faire

### Recette iOS (le Mac)

1. **WOW** — avec un **compte neuf** (l'écran ne se rejoue pas une fois
   `onboarding_complete` posé). Attendu : 5 étoiles qui **restent pleines**,
   puis le **défilé** — un badge à la fois au centre, en grand, **avec son
   nom**, haptique Light ×4 + Success sur le 5ᵉ, puis rangement en vignettes
   28 px. La ligne « Ton entraîneur t'évaluera. » reste affichée tout du long.
2. **Tour rapide** des écrans athlète et coach.
3. **Étape Évaluation** — et c'est le point qui demande de savoir à quoi
   s'attendre :
   - les **14 traits sont visibles et proposables même sans évaluation** du
     coach ; un trait jamais noté affiche « — », jamais des étoiles vides ;
   - après une soumission, la pastille affiche **« ⏳ En attente d'approbation
     du coach »** si l'athlète a un entraîneur, **« ⏳ Invite ton coach pour
     qu'il approuve cette évaluation »** sinon (+ bouton vers
     `/athlete/transfert`) ;
   - ⚠️ **en base, la ligne est REJETÉE dans la microseconde** par
     `trg_suggestion_transition`, tant que le volet 6 n'est pas appliqué.
     **C'est normal et attendu.** L'écran ne le montre pas : un refus portant
     `note_systeme` n'est pas un refus humain, donc il s'affiche comme une
     attente. Le rouge « ✕ Refusée » est réservé aux vrais refus
     d'entraîneur, qui n'existeront qu'après le volet 6.

### Code non fait cette session

**§4e — les 4 chemins de conversation** (c+d → helper a, durcir b,
`conversation_type` explicite à l'INSERT et filtré au SELECT, rattraper le
23505 → re-SELECT). **Rien n'a été écrit.** Ce n'est pas bloquant pour la
recette iOS, mais c'est désormais **urgent** : le volet 2 a posé les index
d'unicité en prod, donc un second clic sur « contacter » lève maintenant un
**23505 non rattrapé** — le code ne sait pas encore rendre la conversation
existante. À traiter en priorité au retour.

### Volet 6 — bloc restant à rédiger

La boîte « À traiter » du coach borne son périmètre avec `get_coach_athletes`
(owner ∪ équipe ∪ école), donc **un entraîneur qui se rattache hérite
automatiquement des EN_ATTENTE** — rien n'est figé au dépôt, le périmètre est
recalculé à chaque lecture. **Aucun ajustement de jointure n'est nécessaire.**

**Mais la RLS est plus étroite que le périmètre** :
`is_coach_of_athlete(t)` ne teste que `athletes.coach_id = auth.uid()`. Un
athlète rattaché **par équipe** — le geste même qu'on met en avant à l'athlète
sans entraîneur — a ses suggestions filtrées en silence. Sans ce correctif, le
moteur s'arrête là où on vient de l'allumer. Le bloc est décrit dans le DDL du
volet 6 ; le helper `SECURITY DEFINER` reste à écrire **en l'alignant sur
`get_coach_athletes`**, pas en réinventant la condition.

### Péremption des propositions dormantes — à trancher

Proposition : **90 jours**. Au-delà, la ligne passe `REJETEE` avec un motif
humain (« Cette proposition a expiré, tu peux la refaire »). Raisons : une cote
proposée il y a trois mois ne décrit plus le même joueur, et un entraîneur qui
se rattache ne doit pas hériter d'une file de propositions périmées. À écrire
comme un `pg_cron` hebdomadaire, PAS comme une purge — la ligne reste, elle
change de statut. **Non bloquant pour le volet 6.**

---

## 5. Rappels Mac

- **Premier `cap sync` depuis tous ces commits.** Beaucoup de code a bougé
  (wizard athlète, WOW, écran équipe). Prévoir un `npx cap sync ios` propre.
- **L'EPERM sur les symlinks était Windows-only.** À confirmer passé sur Mac —
  si un problème d'assets apparaît, ce sera un autre problème, pas celui-là.
- **L'EBUSY sur `cap sync` est Windows-only aussi** (registre §22). Le
  contournement robocopy n'a pas d'équivalent ni de raison d'être sur Mac.
- **Ne pas appliquer les volets 3, 5, 6 en prod** — ils attendent un GO
  explicite de BP, et ils ne sont pas prouvés.
