## 69. Chantier cégep — lot A « base » (branche `feat/cegep-lot-a-base`, 2026-10-20, NON appliqué en prod)

**Règle (décisions BP 2026-10-20).** Un *cégépien* est un athlète dont l'école d'ANCRAGE
(`athletes.school_id`) est de type `CEGEP` — qu'il joue aussi en ligue civile ou non. Le voient :
l'admin, les partenaires (rôle `PARTNER`, sans exigence de statut : les surfaces partenaire exigent
déjà `APPROVED`), et au lot D les recruteurs dont l'école est de type `UNIVERSITE` (comparé en
`::text` ; la valeur n'existe pas encore). Tous les autres recruteurs — collégiaux, y compris ceux
de son propre cégep, et les 12 sans école (relevé prod 2026-10-20) — n'en voient aucun. Les
matchs collégiaux leur restent visibles ; seules disparaissent les données d'athlète (noms,
fiches, nombre de profils Nexus, étoile « cible » due à l'athlète). Surfaces partenaire, coach,
athlète et parent : inchangées.

**Mécanique** (`20261020190000_cegep_lot_a_base.sql`, horodatage provisoire) :
- trois fonctions-règles, STABLE, SECURITY DEFINER, `search_path` épinglé, `row_security off` :
  `athlete_est_cegepien(uuid)`, `peut_voir_cegepiens()` (sur l'appelant),
  `unite_voit_cegepiens(uuid)` (sur une école — pour `agenda_flux`, appelé par jeton, et
  `rapprochement_candidats`, appelé par la file : aucun `auth.uid()`) ;
- 15 RPC rebasées sur le corps prod (garde md5, même signature, aucun DROP) ;
- une policy **RESTRICTIVE** `cegepiens_masques_recruteurs` (SELECT, `TO authenticated`) sur
  `athletes`, `team_athletes`, `athlete_badges`, `evaluations` ; aucune policy existante modifiée.
  **Ne jamais réécrire ces quals dans les policies `TO public`** : PostgreSQL vérifie EXECUTE à
  l'initialisation de l'expression, même dans une branche qui ne peut pas être vraie — `anon`
  prendrait « permission denied for function » (sondé 2026-10-20).
- Non touchées, par décision : `lookup_invitable_athletes_by_email` (coach),
  `invitation_recruteurs_suivent` et `list_team_commits` (athlète, public — à revoir au lot D),
  `admin_prospects_rapprochements` (admin), les surfaces partenaire. Échanges recruteur ↔ coach
  d'un cégépien (`send_broadcast`, conversations) : reportés à la partie coach.

**Preuves locales** (`docs/cegep-lot-a/preuves-locales-20261020*.txt`, pile jetable) : dormance
identique sur tous les comptes avant/après ; avec un cégépien, seuls les recruteurs non
universitaires changent (21 surfaces + REST) ; le cégépien lui-même, son parent, ses coachs,
l'admin, le partenaire et `anon` identiques sur 30 lignes ; rollback à l'octet près (md5 + ACL).
Le local prouve que ça fonctionne, pas que c'est étanche : étape 3 en prod.

**D5 (décision BP 2026-10-20) :** les traces du recruteur collégial (journal d'activité, notes,
relances, visites, conversations) et le blocage des messages recruteur collégial → joueur
collégial sont reportés au NETTOYAGE DE L'ÉTÉ (passage secondaire → cégep). Aujourd'hui ces
traces ne peuvent pas exister : les joueurs collégiaux sont de nouveaux inscrits sans lien avec
un recruteur collégial. Le lot A n'est donc pas étendu.
*Relevé local qui motive le nettoyage :* après une bascule secondaire → cégep simulée, le
recruteur collégial lit toujours 8 lignes de `recruiter_activity_log` sur S et C (prénom et nom
écrits au moment du geste) ; contenu des `recruiter_notes` et messages : non filtrés non plus.

**Reste ouvert** : écrans à l'étape 2 (cartes orphelines du processus, des listes et favoris,
compteurs du tableau de bord, fiche par URL directe), étanchéité et coût
(`athlete_est_cegepien` ligne à ligne dans la policy) en prod à l'étape 3 — dont un point à
vérifier : un recruteur collégial peut-il ouvrir une NOUVELLE conversation avec un joueur
collégial par l'API, sans le voir à l'écran ? Si oui, on le signale (pas bloquant) —, valeur `UNIVERSITE`
(lot D), double rôle recruteur/coach (§68, exigence 1).
