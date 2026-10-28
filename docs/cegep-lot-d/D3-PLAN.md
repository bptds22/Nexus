# Lot D3 — ce que voit le recruteur universitaire (diagnostic et plan, 2026-10-28)

Demande de BP : cégépiens seulement ; secondaire et civil masqués EN BASE, sur le modèle du lot A ; portail
adapté ; catégorie « Universitaire » dans la liste canonique. Rien n'est codé avant le GO.

## Diagnostic

**La règle du lot A (en prod) est l'inverse de ce qu'il faut ici.** Un « cégépien » = fiche dont l'école
d'ancrage (`athletes.school_id`) est de type CEGEP. Le lot A les cache à tout recruteur dont l'école n'est pas
une université :
- **Fonctions-règles :** `athlete_est_cegepien(id)`, `peut_voir_cegepiens()` (admin, partenaire, ou recruteur
  dont l'école est UNIVERSITE), `unite_voit_cegepiens(école)` (vraie pour toute école UNIVERSITE).
- **Lecture :** une policy RESTRICTIVE `cegepiens_masques_recruteurs` sur `athletes`, `team_athletes`,
  `athlete_badges`, `evaluations`, `recruiter_athlete_views` et `recruiter_activity_log`.
- **Écriture (lot C0) :** `cegepiens_ecriture_recruteurs` sur `recruiter_favorites`, `recruiter_pipeline` et
  `conversations`, avec `compte_voit_cegepiens(compte)`.
- **Fonctions :** 16 fonctions SECURITY DEFINER filtrent avec ces règles (recherche, fiches, cartes,
  rapprochements, matchs, agenda, journal, `is_athlete_contactable`…).

Le recruteur universitaire voit donc déjà les cégépiens : rien à ouvrir. Il manque le masquage inverse :
- **À masquer pour lui :** tout ce qui n'est pas cégépien, soit 145 fiches du secondaire, 35 du civil et
  37 sans école en prod (1 seule fiche cégépienne aujourd'hui).
- **Mêmes surfaces que le lot A,** dans l'autre sens : lecture, écriture, fonctions DEFINER, déclencheurs du
  journal.

**Latent :** `unite_voit_cegepiens()` ne lit pas l'interrupteur. Sans conséquence aujourd'hui (aucun compte ne peut
être rattaché à une université sous OFF, verrous D0 / D2a), mais à fermer par principe.

**Portail recruteur (web), à adapter pour le contexte `universitaire` :**
- **Communes et neutres :** Recherche (`recruiter_search_athletes`, filtrée en base), Favoris, Processus,
  Listes, Messages, Profil, Paramètres, Activités.
- **À revoir :**
  - **Calendrier, Carte des matchs, Game On :** des matchs, pas de données d'athlète ; filtre par défaut à
    choisir.
  - **Tableau de bord :** l'encart « cibles » (`athletes_targeting_my_cegep`) est propre au cégep.
  - **Recherche :** le filtre Type doit offrir « Collégial » seulement, et le mot « secondaire » des promotions
    doit changer.
  - **« Mon CÉGEP »** (recruteurs, stats, recrues, réassignation) : propre à une unité cégep ×
    sport.
  - **« Ma page »** (vitrine /college) : la vitrine universitaire est « plus tard » (décision 9).
- La page d'attente `/universitaire/en-validation` (D2b) est remplacée par le portail adapté.

**Catégorie :** `lib/config/categories.ts` s'arrête à « Collégial ». Les 84 équipes D1 portent
`age_group = 'Universitaire'`. Il faut l'ajouter après « Collégial », en tranche 18+, avec ses tests.

**Listes ouvertes (audit D1) :** transfert / Mon équipe, coach « modifier une fiche », recruteur paramètres et
profil. Aujourd'hui, elles ne montrent aucune université parce que la base les masque (D1a).

## Plan

### D3a — base (migration, rejeu prod, GO)
1. **Règle :** `nexus_prive.lecteur_universitaire()` (vraie pour un recruteur au contexte universitaire, école
   UNIVERSITE, interrupteur ON) et `unite_voit_cegepiens` réécrite avec l'interrupteur.
2. **Lecture :** une policy RESTRICTIVE `non_cegepiens_masques_universitaires` TO authenticated sur les 6 tables
   du lot A : `not lecteur_universitaire() or athlete_est_cegepien(...)`. Aucune policy existante modifiée.
3. **Écriture :** une policy RESTRICTIVE INSERT sur `recruiter_favorites`, `recruiter_pipeline` et `conversations`.
   Un recruteur universitaire n'écrit que vers un cégépien.
4. **Fonctions :** les 16 fonctions qui lisent ces règles, rebasées sur le corps prod relevé le jour même. Garde md5, même
   signature, CREATE OR REPLACE. Seul ajout : le filtre inverse. Même chose pour `log_new_athlete`,
   `log_athlete_update` et `log_coach_reply` : aucune entrée de journal pour une fiche non cégépienne chez un
   recruteur universitaire.
5. **Preuves du rejeu :**
   - Matrice par rôle (recruteur collégial, recruteur universitaire témoin créé dans la transaction, partenaire,
     coach, athlète, admin) × type de fiche (secondaire, civil, sans école, cégépien), interrupteur OFF puis ON.
   - Banc des 36 appels DEFINER de D1, refait avec le recruteur universitaire.
   - Écritures refusées vers une fiche non cégépienne.
   - Recruteur collégial strictement inchangé (empreinte).
   - Temps de la recherche recruteur avant et après, rollback vérifié.

### D3b — web (après D3a en prod)
1. **Catégorie :** « Universitaire » ajoutée à `CATEGORIES_CANONIQUES` (après « Collégial », 18+), tests inclus.
2. **Portail pour `context = universitaire` :**
   - La garde du layout ouvre le portail au lieu de la page d'attente.
   - Barre latérale adaptée (selon tes réponses ci-dessous).
   - Recherche : Type « Collégial » seulement, libellés « cégep ».
   - Tableau de bord sans l'encart des cibles.
   - Le vocabulaire « recruteur universitaire » partout.
3. **Listes ouvertes :** filtre de type ajouté (transfert, coach « modifier une fiche », recruteur paramètres et
   profil), pour qu'aucune n'offre d'université le jour où la base en montrerait une.
4. **Essais en local :**
   - Comptes recruteur universitaire et recruteur collégial côte à côte ; captures OFF / ON de chaque page du
     portail.
   - Build et tests verts, puis merge ; la promotion est ta décision.

### Ensuite
D4 mobile 1.4.6, avec C2 : RolePickerMobile, RecruiterOnboardingMobile, portail mobile. L'interrupteur ne passe à ON
qu'après D3 en prod et la 1.4.6 publiée.

## Risques
1. **Surface :** 16 fonctions plus 3 déclencheurs rebasés, comme au lot A. Si un corps prod change entre le
   relevé et l'apply, la garde md5 bloque (sans dégât) et il faut régénérer.
2. **Régression collégiale :** le filtre ajouté ne doit rien changer pour un compte non universitaire. C'est
   prouvé par l'empreinte et la matrice OFF / ON.
3. **Coût :** une restrictive de plus sur `athletes`, évaluée pour chaque lecture authentifiée. La règle passe en
   initplan (`select …`) comme au lot A ; mesure avant / après dans le rejeu.
4. **Mobile 1.4.5 installé :** un recruteur universitaire qui ouvre la 1.4.5 verrait le parcours collégial.
   - La base le protège : il ne voit que des cégépiens et ne peut rien écrire d'autre.
   - Mais l'écran serait faux. D'où l'interrupteur ON seulement après la 1.4.6, et peut-être une version
     minimale (Q7).
5. **Nom de l'université chez les autres :** les règles D1a cachent les universités aux non-admins. Partout où un
   cégépien ou un coach voit un recruteur (messages, « recruteurs intéressés »), le nom de son école serait vide.
   - Une fonction DEFINER le montre déjà : `list_interested_recruiters`.
   - Voir Q4.
6. **Loi 25 :** les cégépiens n'ont pas été informés qu'un recruteur universitaire les verrait (Q6).

## Tes décisions (questions courtes)
- **Q1 — Matchs** (calendrier, carte, Game On) : on montre tous les matchs avec le filtre « Collégial » par défaut
  (ma proposition : ce sont des matchs, sans donnée d'athlète) ? Ou seulement les matchs collégiaux ?
- **Q2 — « Mon CÉGEP »** : on en fait « Mon université » avec Recruteurs et Réassignation seulement (ma
  proposition) ? Stats et recrues confirmées viendraient plus tard.
- **Q3 — « Ma page »** : masquée pour lui (vitrine universitaire plus tard, décision 9) ?
- **Q4 — Nom de l'université** chez le cégépien et le coach (messages, intérêts) : on le passe par des fonctions
  et on garde les écoles universitaires masquées en base (ma proposition, protège la 1.4.5) ? Ou on ouvre les
  universités à la lecture sous ON ?
- **Q5 — Abonnement** : même offre Pro que le recruteur collégial ?
- **Q6 — Loi 25** : un avis aux cégépiens (et une ligne dans la politique de confidentialité) avant de passer
  l'interrupteur à ON ?
- **Q7 — Version minimale mobile** : on refuse la 1.4.5 aux recruteurs universitaires (message « mets ton app à
  jour ») ?
- **Q8 — Règle** : visible pour lui = ancrage CEGEP seulement ? Un cégépien qui joue aussi en civil reste
  visible ; un adulte civil sans cégep, ou une fiche sans école, reste caché.
