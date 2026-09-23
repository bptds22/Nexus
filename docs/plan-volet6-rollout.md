# Plan de déploiement — D6 volet 6 (l'auto-évaluation redevient une proposition)

> Rédigé le 2026-09-23, **révisé le même jour après les preuves locales**.
> **Rien n'est appliqué en prod.** Chaque étape prod attend un GO explicite de BP.
> Sources : `docs/d6-volet6-suggestion-evaluation.sql` (brouillon), registre
> `docs/fast-follow-1.4.2.md` §19–21, relevés **en lecture seule** sur la prod
> (comptes agrégés seulement), et preuves exécutées sur Docker.

**Livrables sur la branche `feat/d6-volet6-autoevaluation` :**

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20260923210000_d6_volet6_autoevaluation_proposition.sql` | le DDL (une migration, 5 volets, pré-vol + contrôles intégraux) |
| `scripts/d6-volet6-oneshot.sql` | les données, version psql : `-v mode=dryrun \| apply \| rollback` |
| `scripts/d6-volet6-oneshot-prod.sql` | les mêmes, en SQL pur (MCP) : blocs A / B / C |
| `scripts/d6-volet6-rollback-ddl.sql` | retour arrière du DDL |
| `scripts/d6-volet6-preuves-par-role.sql` | preuves rejouables (une transaction annulée) |
| `app/athlete/profil/page.tsx` | le diff UI (masquage retiré, toast aligné sur le mobile) |

---

## 0. Décisions actées (BP, 2026-09-23)

| # | Décision |
|---|---|
| D1 | Les **4** refus automatiques d'athlètes qui ont un coach repassent `EN_ATTENTE`, `note_systeme`, `raison_rejet` et `reviewed_at` **effacés**. |
| D2 | Les **12** autres (athlètes sans coach) **restent `REJETEE`**. |
| D3 | **Aucune** notification de rattrapage au coach. |
| D4 | Les **4** notifications de refus liées à D1 sont **supprimées** ; les 12 autres restent. |
| D5 | **Les directeurs (et directeurs intérimaires) tranchent**, comme un coach. |
| D6 | Le toast web sans coach s'aligne sur le mobile : « ⏳ Invite ton coach pour qu'il approuve cette évaluation ». |

Pourquoi effacer `note_systeme` (D1) : `notify_athlete_suggestion_result` lit
`note_systeme IS NOT NULL` comme « édition système ». **Prouvé en local** : après
effacement, le refus du coach part en « Ton coach a rejeté ta suggestion :
Distinctions » — sans effacement, l'athlète recevrait le message d'édition directe.

---

## 1. Les 16, recomptés

Refus automatiques depuis le **2026-09-10** : **16** (67 depuis le 2026-08-04),
**5 athlètes**, tous `ACTIF`, aucune suggestion doublée.

| Athlète | Suggestions | Coach au dépôt | Coach aujourd'hui |
|---|---|---|---|
| A | 3 | oui | oui (`athletes.coach_id`) |
| B | 1 | non | **oui** (`athletes.coach_id`, rattaché depuis) |
| C, D, E | 6 + 5 + 1 | non | non |

Le « 3 / 13 » comptait le coach au dépôt ; aujourd'hui c'est **4 / 12**.
Notifications de refus liées : **16**, dont **13 lues**.

---

## 2. Binaires publiés (règle 3) — la policy d'UPDATE ouverte peut partir

Code de chaque version en magasin : `release/1.2` (+ `572ac94`), `83ce549`
(1.4.0), `release/1.4.1`, `release/1.4.2`, `0ab5fc8` (1.4.3). Dans les six :
INSERT seulement par l'athlète sur sa fiche ; UPDATE seulement depuis des
surfaces coach, qui lisent **sous RLS** (`lib/coach/tasks.ts`) — aucune RPC
n'expose `athlete_suggestions`. Aucun binaire ne dépend de la policy ouverte.

---

## 3. Le ré-ancrage — ce qui existe, ce qui manque (corrige la version précédente)

⚠ **La version précédente de ce plan disait « aucun trigger ne ré-ancre ».
C'était FAUX** : j'avais lu `trg_team_coaches_referent` sans suivre l'appel.

### Le mécanisme (trigger, pas RPC ni écran)

`team_coaches_referent_sync` (AFTER INSERT/UPDATE/DELETE sur `team_coaches`)
→ `fn_resync_team_coach_id(équipe)` → pose sur **tous** les athlètes de
l'équipe `coach_id = fn_resolve_team_referent(équipe)`, qui vaut, dans l'ordre :
`head_coach` → `head_coach_interim` → **directeur / directeur intérimaire** de
l'école de l'équipe. Et un coach qui s'ajoute **lui-même** comme `assistant`
dans une équipe sans référent est promu `head_coach_interim` (donc référent).

### a. Couvre-t-il les 57 ? — OUI, par les parcours du produit

Prouvé en local (4 scénarios, transactions annulées, équipe de 9 athlètes sans owner) :

| Scénario | Résultat |
|---|---|
| S1 — un **head coach** arrive | les 9 reçoivent son `coach_id` ✅ |
| S2 — un coach **s'ajoute lui-même** en assistant (onboarding « rejoindre ») | promu intérimaire, les 9 le suivent ✅ |
| S3 — un head coach arrive **après** un intérimaire | **refusé** par l'index `team_coaches_one_referent_per_team` ❌ |
| S4 — un assistant **ajouté par un tiers**, équipe sans référent | reste assistant, les 9 restent **sans owner** ❌ |

Les onboardings coach passent tous par S1/S2 (`finish_coach_*_onboarding` :
équipe créée → `head_coach` ; équipe adoptée sans staff → `head_coach` ; équipe
qui a déjà du staff → `assistant`). Les 57 (43 équipes, aucune avec staff, aucun
référent résoluble aujourd'hui) sont donc couverts **à l'arrivée d'un coach**.

### Ce que le mécanisme ne fait PAS — à savoir, dit franchement

- **« Quand un head coach arrive, l'intérimaire passe assistant » n'existe pas
  pour les équipes.** Aucun trigger, RPC ni écran. Un coach qui arrive dans une
  équipe qui a déjà un intérimaire devient `assistant` ; l'index interdit un
  second référent. La propriété reste à l'intérimaire.
- Ce qui existe est au niveau **école** : `trg_demote_interim_on_director_appointment`
  ramène un `DIRECTEUR_INTERIM` à `COACH` quand un `DIRECTEUR` est nommé (avec
  une notification). Il **ne réattribue pas** les athlètes.
- Effet de bord constaté en preuve : **nommer un directeur lui donne les
  athlètes orphelins de son école** (`school_coaches` → `users.school_id` →
  `backfill_athletes_on_coach_join`).

### b. §4 reste-t-il nécessaire ? — OUI, mais plus pour la raison annoncée

Le moteur « recrute ton coach » passe par `coach_id` : le mécanisme le couvre.
§4 (`peut_trancher_suggestion`) reste nécessaire pour trois raisons :
1. **D5 — les directeurs.** Leur pouvoir sur les athlètes de leur école ne
   passe pas par `coach_id`. Sans §4, un directeur ne lit aucune proposition
   d'un athlète dont il n'est pas owner (2 cas en prod).
2. **S4** : un athlète relié à son coach par l'équipe seulement.
3. **La boîte « À traiter » liste déjà** owner ∪ équipe ∪ directeur
   (`get_coach_athletes`). Sans §4, elle affiche des athlètes dont elle ne peut
   pas lire les propositions.

Et le **repli d'attribution** reste indispensable : sans owner,
`evaluations.coach_id` (NOT NULL) ferait échouer toute approbation.

---

## 4. Constat en préparant les preuves — le local était en retard sur la prod

`apply_approved_suggestion` locale n'avait pas la réécriture « Distinctions »
de `20260825144302` (jamais jouée en local). Alignée en rejouant **la seule
section 5** de cette migration (retrait des `\r` du corps source, nécessaire en
local), puis vérifiée : empreinte locale = prod (`7f99…`). Tous les objets
touchés par la migration ont été comparés prod/local avant les preuves.

---

## 5. Ordre de déploiement

| Étape | Quoi | Condition |
|---|---|---|
| 0 | Local : migration + preuves + one-shot + rollbacks | **fait** (§9) |
| 1 | **Migration** `20260923210000` en prod (`apply_migration`) — pré-vol intégré : état attendu + 0 `EN_ATTENTE` | GO BP |
| 2 | **One-shot** : `mode=dryrun` → relecture (attendu 4 / 2 / 4 / 0 / 12) → `mode=apply` | GO BP séparé · 1 appliquée |
| 3 | **UI web** : fusion de la branche (diff `/athlete/profil`) | 1 + 2 appliqués |
| 4 | Mobile 1.4.x : miroir du masquage + restauration `StarSuggestRow` / `DistinctionsSuggestRow` | lot mobile |

- **2 APRÈS 1, impérativement** : avant 1, la policy « Authenticated users
  update suggestions » laisse n'importe quel compte approuver une ligne
  `EN_ATTENTE`. Le one-shot est le premier à en créer.
- **1 avant 3** : l'UI d'abord afficherait « Rejetée » pour des propositions que
  personne n'a lues, pendant que le trigger refuse encore tout.
- **Entre 1 et 3**, le web affiche encore les 63 anciens refus machine « En
  attente » (masquage) : c'est l'état actuel, rien ne se dégrade.
- **Mobile publié, jusqu'à 4** : son masquage continue d'afficher les refus
  machine « En attente » — dont les 12 de D2 (3 athlètes).

Après l'apply prod, renommer le fichier de migration à la version enregistrée
par la prod (comme `20260923144821`).

---

## 6. Le one-shot — `scripts/d6-volet6-oneshot.sql`

Cible **par critères** (refus machine depuis le 2026-09-10, athlète avec
`athletes.coach_id`), jamais par identifiants.

```
psql -v mode=dryrun   -f scripts/d6-volet6-oneshot.sql   # comptes seulement, aucune écriture
psql -v mode=apply    -f scripts/d6-volet6-oneshot.sql   # sauvegarde → écritures → assertions → COMMIT ou ROLLBACK
psql -v mode=rollback -f scripts/d6-volet6-oneshot.sql
```

- **dry-run** : suggestions à rouvrir, athlètes, notifications à retirer,
  `EN_ATTENTE` avant, refus sans coach laissés. Attendu prod : **4 / 2 / 4 / 0 / 12**.
- **apply** : s'arrête sans rien écrire si la cible n'est pas exactement 4 / 4.
  Sauvegarde les 8 lignes dans `public._volet6_sauvegarde` (RLS sans policy,
  illisible hors service), rouvre, supprime, vérifie, puis `COMMIT` ou `ROLLBACK`.
- **En prod : `scripts/d6-volet6-oneshot-prod.sql`** — le MCP `execute_sql`
  n'exécute pas les méta-commandes psql (`\if`, `\gset`). Même logique en SQL
  pur, trois blocs à lancer séparément (A dry-run, B apply, C rollback), les
  assertions en `DO … RAISE` : un écart annule toute la transaction. Testé en
  local : cible de 3 au lieu de 4 → B s'arrête avant toute écriture (table de
  sauvegarde absente) ; A → B → C sur 4 lignes → empreintes identiques à
  l'origine, 0 notification parasite, triggers réactivés ; C lancé sans
  sauvegarde → échoue sans rien laisser, triggers restés actifs.

---

## 7. Rollback

### 7.1 Données — `mode=rollback`

- Ne restaure **que** les suggestions encore `EN_ATTENTE` ; celles qu'un coach a
  tranchées entre-temps sont **comptées, pas écrasées**.
- Ne restaure **que** les notifications de ces suggestions-là.
- **Coupe `trg_apply_suggestion` et `trg_notify_suggestion_result` pendant la
  restauration**, dans la transaction. Trouvé en preuve : sans ça, la
  restauration `EN_ATTENTE → REJETEE` réécrivait `reviewed_at` et **envoyait un
  nouveau refus à l'athlète** en plus de celui restauré (2 doublons en local ;
  4 faux avis en prod).

### 7.2 DDL — `scripts/d6-volet6-rollback-ddl.sql`

Rétablit l'aiguillage à deux sorties, les 4 policies d'avant (forme prod), la
ligne d'attribution d'origine (substitution inverse), et supprime les deux
fonctions du volet. **Refuse de tourner s'il reste des `EN_ATTENTE`** : faire
d'abord le rollback données.

### 7.3 Ordre du rollback complet

UI (`git revert`) → données (`mode=rollback`) → DDL. L'UI d'abord, sinon le web
affiche « Rejetée » pendant que le trigger rétabli refuse tout à nouveau.

---

## 8. Le diff UI — `app/athlete/profil/page.tsx`

1. **`estRefusMachine` retiré** : un refus portant `note_systeme` s'affiche
   « Rejetée » (c'est un vrai refus depuis le volet 6). Son motif système
   s'affiche en gris, sans préfixe « Coach: ».
2. **Toast aligné sur le mobile (D6)** : avec coach, « Suggestion envoyée à ton
   coach » ; sans coach, « ⏳ Invite ton coach pour qu'il approuve cette
   évaluation ». Même critère que le mobile (`athletes.coach_id`).

Nuance à connaître : avec §4, un athlète sans owner mais relié à un coach
d'équipe ou à un directeur **a** quelqu'un qui peut trancher, et voit pourtant
« Invite ton coach ». C'est le miroir exact du mobile ; l'affiner demande que le
client connaisse le périmètre de `peut_trancher_suggestion` (hors lot).

---

## 9. Preuves locales — résultats (2026-09-23)

`scripts/d6-volet6-preuves-par-role.sql`, sous `SET ROLE authenticated` + claims
JWT, une transaction annulée, rejoué deux fois (dont après rollback/réapply) :

| # | Preuve | Résultat |
|---|---|---|
| 1 | athlète dépose « Cote globale » | reste `EN_ATTENTE` ✅ |
| 2 | l'owner lit ses 3 propositions | 3 ✅ |
| 3 | l'athlète approuve **sa propre** proposition | 0 ligne, statut inchangé ✅ |
| 4 | l'owner approuve « Leadership » | évaluation mise à jour, notification « Ton coach a approuvé… (4/5) » ✅ |
| 5 | un coach sans lien approuve | 0 ligne ✅ |
| 6 / 14 | athlète dépose « Taille » | `APPROUVEE` d'office, fiche mise à jour (6'2") ✅ |
| 7 | « Champ Inventé » | `REJETEE`, « Ce champ ne se modifie plus depuis ton profil. » ✅ |
| 8 | dépôt sur la fiche d'un autre athlète | refus RLS ✅ |
| 9 | « Leadership » ET « leadership » | les deux `EN_ATTENTE` ✅ |
| 10 | coach d'**équipe** seul (S4), athlète sans owner | lit, approuve, évaluation **à son nom** (repli), notification coach ✅ |
| 10b | **directeur**, athlète sans owner | lit, approuve, évaluation à son nom ✅ |
| 11 | coach sans lien : suggestions lisibles sur ces athlètes | 0 ✅ |
| 12 | sabotage ACL (EXECUTE rendu à anon) | le contrôle lève ✅ |
| 13 | one-shot sur fixture (2 avec coach / 1 sans + 2 leurres) | dry-run 2/1/2/0/1 ; apply conforme ; rollback → empreintes **identiques à l'origine**, 0 notification parasite ; avec un verdict coach intermédiaire → 1 tranchée conservée, sa vieille notification non restaurée ✅ |
| — | migration rejouée | refusée par le pré-vol ✅ |
| — | rollback DDL | empreintes = avant migration ; policies = **empreinte prod** ✅ ; réapply OK |
| — | UI : Léa (sans coach) propose une cote | toast « ⏳ Invite ton coach… », ligne `EN_ATTENTE` ✅ |
| — | UI : Mathis, refus machine | onglet « Rejetées (1) », motif affiché ✅ |

Builds web + mobile OK, `npm test` 207/207. Lint de `/athlete/profil` = `main`.
