## 69. Chantier cégep — lot A « base » (branche `feat/cegep-lot-a-base`, 2026-10-20, NON appliqué en prod)

**Règle (décisions BP 2026-10-20).** Un *cégépien* est un athlète dont l'école d'ANCRAGE
(`athletes.school_id`) est de type `CEGEP` — qu'il joue aussi en ligue civile ou non. Le voient :
l'admin, les partenaires (rôle `PARTNER`, sans exigence de statut : les surfaces partenaire exigent
déjà `APPROVED`), et au lot D les recruteurs dont l'école est de type `UNIVERSITE` (comparé en
`::text` ; la valeur n'existe pas encore). Tous les autres recruteurs — collégiaux, y compris ceux
de son propre cégep, et les 3 recruteurs sans école (9 comptes vides supprimés le 2026-10-22,
admin_operations SUPPRESSION_COMPTES_RECRUTEUR_VIDES) — n'en voient aucun. Les
matchs collégiaux leur restent visibles ; seules disparaissent les données d'athlète (noms,
fiches, nombre de profils Nexus, étoile « cible » due à l'athlète). Surfaces partenaire, coach,
athlète et parent : inchangées.

**Mécanique** (`20261020190000_cegep_lot_a_base.sql`, horodatage provisoire) :
- trois fonctions-règles, STABLE, SECURITY DEFINER, `search_path` épinglé, `row_security off` :
  `athlete_est_cegepien(uuid)`, `peut_voir_cegepiens()` (sur l'appelant),
  `unite_voit_cegepiens(uuid)` (sur une école — pour `agenda_flux`, appelé par jeton, et
  `rapprochement_candidats`, appelé par la file : aucun `auth.uid()`) ;
- 15 RPC rebasées sur le corps prod (garde md5, même signature, aucun DROP) ; plus (2026-10-25)
  les 3 déclencheurs du journal, filtrés à l'écriture (voir D5) ;
- une policy **RESTRICTIVE** `cegepiens_masques_recruteurs` (`TO authenticated`) : SELECT sur
  `athletes`, `team_athletes`, `athlete_badges`, `evaluations` et (ajout 2026-10-25)
  `recruiter_activity_log` ; **ALL** sur
  `recruiter_athlete_views` (ajout après le test de l'étape 2 : « Athlètes tendance » du tableau
  de bord recruteur lit les vues de fiche du recruteur lui-même et affichait le cégépien en
  « Athlète » anonyme ; et ouvrir l'URL d'une fiche ÉCRIT une vue même quand la fiche ne se
  charge pas — la policy rend la trace invisible ET refuse d'en créer une). Aucune policy
  existante modifiée.
  **Ne jamais réécrire ces quals dans les policies `TO public`** : PostgreSQL vérifie EXECUTE à
  l'initialisation de l'expression, même dans une branche qui ne peut pas être vraie — `anon`
  prendrait « permission denied for function » (sondé 2026-10-20).
- Non touchées, par décision : `lookup_invitable_athletes_by_email` (coach),
  `invitation_recruteurs_suivent` et `list_team_commits` (athlète, public — à revoir au lot D),
  `admin_prospects_rapprochements` (admin), les surfaces partenaire. Échanges recruteur ↔ coach
  d'un cégépien (`send_broadcast`, conversations) : reportés à la partie coach.

**Preuves locales** (`docs/cegep-lot-a/preuves-locales-20261020*.txt`, pile jetable) : dormance
identique sur tous les comptes avant/après ; avec un cégépien, seuls le recruteur collégial et
le recruteur sans école changent (24 surfaces + REST + écriture d'une vue de fiche refusée) ; le
cégépien lui-même, son parent, ses coachs, l'admin, le partenaire et `anon` identiques sur 32
lignes ; rollback à l'octet près (md5 + ACL). Test écran de l'étape 2 (BP) : en cours.
Le local prouve que ça fonctionne, pas que c'est étanche : étape 3 en prod.

**Défaut d'écran relevé à l'étape 2, déjà présent en prod (correctif en attente de GO) :** la fiche
recruteur (`useFicheAthleteDonnees` + `AthleteRecruiterProfileBody`, et `AthleteRecruiterProfileBodyMobile`)
tourne en chargement infini quand l'athlète n'est pas lisible — cégépien, mais aussi aujourd'hui
tout athlète non ACTIF ou supprimé (lecture `.single()` en erreur → `a` reste nul → spinner).
La même page écrit la vue de fiche avant de savoir si la fiche existe.

**D5 (décision BP 2026-10-20) :** les traces du recruteur collégial (journal d'activité, notes,
relances, visites, conversations) et le blocage des messages recruteur collégial → joueur
collégial sont reportés au NETTOYAGE DE L'ÉTÉ (passage secondaire → cégep). Aujourd'hui ces
traces ne peuvent pas exister : les joueurs collégiaux sont de nouveaux inscrits sans lien avec
un recruteur collégial. Le lot A n'est donc pas étendu — sauf `recruiter_athlete_views`, ajoutée
après le test de l'étape 2 parce que la trace pouvait se RECRÉER après la migration (ouvrir l'URL
d'une fiche, par exemple depuis Activités → Voir, écrivait une vue).
**Révisé le 2026-10-25 (GO BP) :** l'affirmation « ces traces ne peuvent pas exister » est fausse
pour le journal. `log_new_athlete` écrit une ligne `NEW_ATHLETE` (prénom, nom) chez les
recruteurs à l'inscription de TOUT athlète, sans geste de leur part : le témoin rattaché le
2026-10-23 est nommé chez 5 recruteurs collégiaux. Le lot A couvre donc aussi
`recruiter_activity_log` : policy RESTRICTIVE FOR SELECT (rien d'effacé) et filtre à l'écriture
dans `log_new_athlete`, `log_athlete_update`, `log_coach_reply` (corps prod du 2026-10-25, garde
md5). Les autres traces (notes, relances, visites, conversations) restent au nettoyage de l'été.
*Relevé local qui motive le nettoyage :* après une bascule secondaire → cégep simulée, le
recruteur collégial lit toujours 8 lignes de `recruiter_activity_log` sur S et C (prénom et nom
écrits au moment du geste) ; contenu des `recruiter_notes` et messages : non filtrés non plus.

**Reste ouvert** : écrans à l'étape 2 (cartes orphelines du processus, des listes et favoris,
compteurs du tableau de bord, fiche par URL directe), étanchéité et coût
(`athlete_est_cegepien` ligne à ligne dans la policy) en prod à l'étape 3 — dont un point à
vérifier : un recruteur collégial peut-il ouvrir une NOUVELLE conversation avec un joueur
collégial par l'API, sans le voir à l'écran ? Si oui, on le signale (pas bloquant) —, valeur `UNIVERSITE`
(lot D), double rôle recruteur/coach (§68, exigence 1).
