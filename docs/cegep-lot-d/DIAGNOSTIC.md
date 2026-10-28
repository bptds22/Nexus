# Chantier cégep — lot D (universités) : diagnostic et plan

Lecture seule le 2026-10-27 (prod nrloizyemulbhujrqhgx, transactions `begin read only`, agrégats seulement ;
sorties brutes dans le scratchpad de session). Code lu sur main 76a5f872. Aucun changement prod, aucun code.

## 1. État actuel

### Base
- `schools.type` est du **texte** borné par `CHECK (type = ANY (ARRAY['SECONDAIRE','CEGEP','LIGUE_CIVILE']))`.
  **UNIVERSITE est refusé par la base** : aucune école universitaire ne peut exister aujourd'hui.
- Prod : 864 SECONDAIRE, 71 CEGEP, 473 LIGUE_CIVILE, **0 UNIVERSITE**, 0 équipe universitaire.
  Aucune université non plus dans `school_registry` (colonne `has_universitaire` présente, 0 ligne qui matche).
- RSEQ en base : `rseq_ligues_publiees` = Collégial (87 ligues, 677 équipes) + Secondaire (1 738 ligues) ;
  `rseq_watch_leagues.secteur` CHECK ∈ {Collégial, Secondaire}. Le secteur « Universitaire » existe côté API
  RSEQ (vu dans scripts/rseq-audit-20261008/jeux.mjs, scripts/scrape-rseq.mjs) mais n'est jamais chargé.
- `users.role` : enum sans valeur universitaire (ADMIN, COACH, RECRUTEUR, ATHLETE, PARTNER, PARENT, SERVICE).
  `users.context` CHECK ∈ {scolaire, collegial, ligue_civile}. 25 RECRUTEUR, tous `context = collegial`,
  22 rattachés à un CEGEP, 3 sans école.
- Fiches athlètes : 217 = 145 secondaire, 35 civil, 1 cégep, 36 sans école.

### Lot A / C0 : la branche « universitaire » est du code mort
- `unite_voit_cegepiens(école)` = « l'école est de type UNIVERSITE » → toujours faux aujourd'hui.
- `peut_voir_cegepiens()` = admin OU PARTNER OU (RECRUTEUR rattaché à une UNIVERSITE).
- `compte_voit_cegepiens(compte)` = faux seulement pour un RECRUTEUR dont l'école ne voit pas les cégépiens.
- `is_athlete_contactable` (C0) = pas de blackout ET (compte voit les cégépiens OU athlète non cégépien).
- Policy RESTRICTIVE `cegepiens_masques_recruteurs` sur 6 tables (athletes, athlete_badges, evaluations,
  recruiter_activity_log, recruiter_athlete_views, team_athletes).
- Conséquence : le jour où une école UNIVERSITE existe et qu'un RECRUTEUR y est rattaché, il voit et peut
  contacter les cégépiens **sans autre changement de base** (recherche, fiches, favoris, messages passent par
  ces policies/fonctions). C'est voulu par le lot A ; c'est aussi pourquoi l'interrupteur doit garder la porte.

### Inscription
- Web `/auth/pro` : 3 cartes (Entraîneur d'école secondaire, **Recruteur CÉGEP**, Ligue/club). Mobile
  `RolePickerMobile` : mêmes 3. **Aucun choix universitaire.**
- `claim_signup_role` et `app/auth/callback/route.ts` forcent `context = 'collegial'` pour tout RECRUTEUR.
- `finish_recruiter_onboarding` exige `context = 'collegial'` et une école `type = 'CEGEP'` (`INVALID_CEGEP`).
  Le wizard web (`app/onboarding/page.tsx` l.2879, 3145) et mobile (`RecruiterOnboardingMobile.tsx` l.200, 240)
  ne listent que des CEGEP.
- Donc un recruteur universitaire ne peut pas s'inscrire aujourd'hui, ni web ni mobile ; seul un admin pourrait
  le fabriquer à la main — et encore, pas d'école UNIVERSITE où le rattacher.

### Ce que verrait un recruteur universitaire
- La policy permissive `recruiters read active athletes` = `status = 'ACTIF' AND is_recruiter()` : **tout
  RECRUTEUR voit tous les athlètes actifs, secondaire et civil compris.** Un recruteur universitaire verrait
  donc le secondaire, en plus des cégépiens. Est-ce voulu ? → décision Q4.
- Web : `app/recruteur/recherche/page.tsx` l.641 retire l'option Type « Collégial » pour tout recruteur
  (`sansCollegial`) — à conditionner au type d'école du compte. Le portail `/recruteur/*` est pensé « cégep »
  (page d'établissement, programmes DEC, entraîneurs du cégep, calendrier) : 34 fichiers mentionnent le cégep.

### Admin (demande BP du 27 oct.)
- `/admin/athletes` n'a **aucun filtre par type d'école** : seulement un filtre « École » (liste des écoles qui
  ont des fiches). On ne peut pas isoler les cégépiens d'un coup.
- `/admin/schools` et `/admin/schools/[id]` ont un Type (Secondaire, CÉGEP, Ligue civile) sans Université.
- `/admin/entraineurs`, `/admin/pipeline`, `/admin/desactivations`, `/admin/recruteurs` affichent le type
  (`schoolTypeLabel`) sans filtre. `lib/config/schoolTypes.ts` et `lib/utils/orgLabel.ts` : SchoolType à 3 valeurs.

## 2. Programmes universitaires québécois (recherche web du 2026-10-27)

Le RSEQ compte 12 universités québécoises au secteur universitaire (https://rseq.ca/secteur-universitaire/structure/).
Le bottin en liste 17 avec Carleton, Dalhousie, UNB, Ottawa et un Collège militaire royal, hors Québec ou non
confirmés (https://rseq.ca/secteur-universitaire/bottin/). Les pages RSEQ par sport ne listent pas les équipes :
sports ci-dessous = sites des programmes + Wikipédia, à recouper par l'API RSEQ au lot D1.

| Université | Équipe | Ville | Affiliation | Sports M | Sports F | Source principale |
|---|---|---|---|---|---|---|
| Université Laval | Rouge et Or | Québec | RSEQ + U SPORTS | basket, football, soccer, volley | basket, flag-football, hockey, rugby, soccer, volley | rougeetor.ulaval.ca |
| Université de Montréal (+ HEC, Polytechnique) | Carabins | Montréal | RSEQ + U SPORTS | football, rugby, soccer, volley (pas de basket) | flag-football, hockey, rugby, soccer, volley | carabins.umontreal.ca |
| Université McGill | Redbirds / Martlets | Montréal | RSEQ + U SPORTS (hockey M en OUA) | basket, football, hockey, rugby, soccer | basket, flag-football, hockey, soccer, volley | mcgillathletics.ca |
| Université Concordia | Stingers | Montréal | RSEQ + U SPORTS (hockey M en OUA) | basket, football, hockey, rugby, soccer | basket, hockey, rugby, soccer | Wikipédia (stingers.ca injoignable) |
| Université de Sherbrooke | Vert & Or | Sherbrooke | RSEQ + U SPORTS | football, hockey (D2), soccer, volley | rugby, soccer, volley, flag-football | usherbrooke.ca/vertetor |
| Université Bishop's | Gaiters | Sherbrooke (Lennoxville) | RSEQ + U SPORTS (football de retour au RSEQ en 2026) | basket, football, rugby | basket, hockey, rugby, soccer | Wikipédia, blog.ubishops.ca |
| UQAM | Citadins | Montréal | RSEQ + U SPORTS | basket, soccer | basket, flag-football, soccer, volley | citadins.uqam.ca |
| UQTR | Patriotes | Trois-Rivières | RSEQ + U SPORTS (hockey M en OUA) | hockey, soccer | flag-football, soccer, volley | Wikipédia (à vérifier) |
| UQAC | Inuk | Saguenay | RSEQ + U SPORTS probatoire | hockey (D2) | volley | Wikipédia, usports.ca |
| ÉTS | Piranhas | Montréal | RSEQ + U SPORTS probatoire | hockey (D2), rugby (D2) | volley | Wikipédia, usports.ca |
| UQO | Torrents | Gatineau | RSEQ seulement | hockey (D2) | non confirmé | uqo.ca (PDF dévoilement) |
| UQAR | Nordet | Rimouski / Lévis | RSEQ seulement | cross-country, natation | (volley F hors RSEQ) | uqar.ca |

Sports individuels (athlétisme, badminton, cross-country, golf, natation, cheerleading, tennis) omis du tableau.
Comparaison avec la base : **0 sur 12 en base** (aucune école UNIVERSITE ; les deux « Bishop's » / « universitaire »
trouvés sont Bishop's College School et un CHU, de type SECONDAIRE).

## 3. Plan proposé

| Lot | Contenu | Porte ouverte ? | Risque | Preuves |
|---|---|---|---|---|
| **D-admin** | Filtre « Type d'établissement » (Secondaire, Cégep, Civil, sans école ; Université dès D0) sur /admin/athletes, /admin/entraineurs, /admin/recruteurs, /admin/pipeline, /admin/desactivations ; Université dans les Type de /admin/schools. Web seul. | Non (admin) | Très faible | tests unitaires du filtre, captures headless, filtre Cégep → 1 fiche |
| **D0** | Base : CHECK `schools.type` + UNIVERSITE ; `users.context` + `universitaire` ; interrupteur `lancement_universitaire` (OFF) ; verrous : une fiche athlète ne s'ancre jamais à une UNIVERSITE, un compte ne se rattache à une UNIVERSITE que sous ON (admin exempté) ; `rseq_watch_leagues.secteur` + Universitaire. | Non | Faible | rejeu à blanc, gardes avant/après, essais JWT (verrou OFF), 0 ligne modifiée |
| **D1** | Import des 12 universités (GO séparé, règle « pas d'UNIVERSITE sans GO ») via l'API RSEQ secteur Universitaire (`rseq_institution_id`), puis leurs équipes (dédup école/sport/genre comme le pont). Sports déjà au catalogue Nexus seulement. | Non (personne rattaché) | Faible-moyen (données) | liste attendue vs obtenue, comptes, 0 fiche/compte touché |
| **D2** | Inscription du recruteur universitaire, web, sous l'interrupteur : carte « Recruteur universitaire » (/auth/pro), `claim_signup_role` + callback acceptent `universitaire`, `finish_recruiter_onboarding` accepte une UNIVERSITE si context universitaire (responsable d'unité comme au cégep), wizard qui liste les universités. | Oui, sous ON | Moyen (inscription) | essais JWT OFF/ON, comptes locaux, captures |
| **D3** | Ce qu'il voit (web) : option Type « Collégial » visible pour lui (recherche l.641), filtre par défaut Collégial, fiches/favoris/messages (déjà ouverts par lot A/C0) ; selon Q4, masquage du secondaire en base (miroir du lot A) ; pages du portail propres au cégep (ma-page, programmes, entraîneurs) masquées ou adaptées. | Oui, sous ON | Moyen à élevé si masquage secondaire | essais JWT par rôle × type d'athlète, comparaison recruteur collégial / universitaire |
| **D4** | Mobile 1.4.6 (avec C2) : RolePickerMobile, RecruiterOnboardingMobile, filtres de recherche mobile. | — | Moyen | build + parcours émulateur |
| **ON** | `lancement_universitaire` ON après publication 1.4.6. | — | — | GO BP |

## 4. Décisions de BP (2026-10-27)

1. Toutes les universités U SPORTS du Canada (Québec, OUA, AUS, Canada West) avec leur province : Québec d'abord
   (D1, API RSEQ), reste du Canada en D1b à partir du site U SPORTS, sources citées, sur GO séparé.
2. HEC et Polytechnique sous l'Université de Montréal (Carabins). 3. Sports d'équipe déjà dans Nexus seulement.
4. Le recruteur universitaire ne voit pas le secondaire : cégépiens seulement, masquage en base.
5. Interrupteur séparé `lancement_universitaire`. 6. Validation des comptes comme au cégep.
7. Aucune fiche athlète ancrée à une université (refus en base). 8. D-admin d'abord. 9. Vitrine universitaire plus tard.
