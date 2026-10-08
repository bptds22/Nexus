# Équipes RSEQ 2026 (secondaire) — création par lots — 2026-10-08

Décisions de BP du 2026-10-08, sur le CSV de revue `docs/rseq-audit-20261008/equipes-2026-a-creer.csv`.
Règles : CLAUDE.md § « Pont RSEQ ». **Rien n'est appliqué en prod. Exécution sur GO de BP, lot Football
en premier, un lot par appel `execute_sql`.**

## Périmètre : 1 737 équipes, 15 958 côtés de match
- Les 1 717 lignes `oui` du secondaire qui ont déjà des matchs en base, plus les 20 que BP a validées :
  - **É.I. Du Phare** → École internationale du Phare (Sherbrooke) : 3 équipes ;
  - **Séminaire Saint-Joseph** → Séminaire Saint-Joseph de Trois-Rivières : 15 équipes ;
  - **Triolet** : la seconde équipe RSEQ est créée, comme exception au dédoublonnage ;
  - **Du Rocher** : une équipe normale. « Pionniers » n'est pas un doublon (voir plus bas).
- Restent hors lots :
  - St-François, Rivière-du-Loup, É.S. Montcalm (en attente de confirmation) ;
  - ÉS Anjou, CQPEL, Saint-Arsène (école absente : aucune école créée) ;
  - la balle molle ;
  - le collégial et les ligues servies par s1 seulement (après le correctif de la veille).

| Lot | Sport | Équipes | Côtés à relier |
|---|---|---|---|
| 01 | Football | 38 | 227 |
| 02 | Flag football | 442 | 2 627 |
| 03 | Soccer | 203 | 1 354 |
| 04 | Volleyball | 328 | 3 763 |
| 05 | Basketball | 370 | 4 411 |
| 06 | Futsal | 328 | 3 378 |
| 07 | Baseball | 15 | 90 |
| 08 | Rugby | 6 | 48 |
| 09 | Ultimate frisbee | 7 | 60 |

## Fichiers
- `generer-lots.mjs` lit `equipes-2026-revue.json` et produit `lots/NN-<sport>.sql` et
  `lots/NN-<sport>.rollback.sql`.
- **Un lot** :
  - transaction gardée qui exige exactement N équipes et exactement les côtés de match relevés ;
  - gardes de dédoublonnage : `rseq_team_id` déjà en base, puis même école + sport + catégorie +
    division + saison (division normalisée « Division 3 » = « D3 »), à l'exception des cas tranchés par
    BP ;
  - écoles SECONDAIRE existantes seulement ;
  - n'écrit dans `games` que `home_team_id` / `visitor_team_id`, et seulement là où ces colonnes sont
    NULL ;
  - une ligne `admin_operations` `EQUIPES_RSEQ_2026_CREEES` par lot, avec la liste des `rseq_team_id`.
- **Un rollback** :
  - refusé si une équipe du lot a reçu un dépendant (athlète, coach, invitation, page, carte prospect…) ;
  - remet à NULL les côtés de match reliés, puis supprime les équipes ;
  - écrit une ligne `EQUIPES_RSEQ_2026_RETIREES`.
- **La veille reste cohérente.** `rseq_sync_apply_games` résout `home_team_id` / `visitor_team_id` par
  `rseq_team_id` à chaque passe. Les passes suivantes retrouvent donc les mêmes équipes ; après un
  rollback, elles remettent les côtés à NULL.

## Preuve locale (base jetable `nexus_copie`, copie prod du 2026-10-08) — sorties brutes dans `preuve/`
- **La copie.**
  - Le schéma est celui de la base locale (`preuve/copie-schema.sh`). La restauration a donné 15
    erreurs, toutes dues à `pg_cron`, absent de cette base.
  - Les données prod sont copiées en lecture seule (`preuve/charger-copie.sql`) : 24 sports, 1 206
    écoles, 8 300 équipes, 13 709 matchs 2026.
  - La base locale `postgres`, celle de tes tests, n'a pas été touchée.
- **Les 9 lots** : 1 737 équipes et 15 958 côtés (domicile + visiteur), exactement les nombres
  attendus. Les côtés NULL qui portent un `rseq_team_id` passent de 17 093 à 1 135.
- **Rien d'autre ne bouge.** `equipes_existantes_md5` (`5bdc27eb…`) et `matchs_hors_liaison_md5`
  (`763bde69…`) sont identiques avant, après et après le rollback.
- **Gardes négatives** :
  - relancer un lot est refusé (« déjà en base ») ;
  - un côté de match en plus est refusé (« 228 au lieu de 227, la veille a bougé ») ;
  - une équipe 2026 posée à la main (« Division 3 ») est refusée comme doublon ;
  - un rollback est refusé quand une équipe du lot a reçu un coach.
- **Rollback des 9 lots, dans l'ordre inverse** : toutes les empreintes reviennent à l'état d'avant,
  sauf `admin_operations`. La ré-application redonne 1 737 et 15 958. Les liaisons exprimées en
  `rseq_team_id` sont stables d'un cycle à l'autre (`e69133d6…`).
- **Accents** : 973 noms accentués sur 973 ont plus d'octets que de caractères, donc aucun `??`.
- **Temps de réponse**, sous un utilisateur authentifié, RLS active, médiane de 5 passages. Ce sont les
  5 écoles qui auront le plus d'équipes (Collège Notre-Dame : 52 → 91).

  | Écran (requête calquée) | Avant | Après |
  |---|---|---|
  | Inscription athlète (école + sport) | 0,02 – 0,11 ms | 0,02 – 0,13 ms |
  | Page d'école (toutes les équipes) | 0,28 – 0,34 ms (46–55 lignes) | 0,40 – 0,61 ms (70–91 lignes) |
  | Saison en cours (école + 2026) | 0,03 – 0,12 ms | 0,16 – 0,26 ms (17–39 lignes) |
  | Sélecteur d'équipe (école) | 0,26 – 0,32 ms | 0,39 – 0,48 ms |
  | Admin écoles (toute la table) | 31 ms (8 300 lignes) | 38 ms (10 037 lignes) |

  - **Aucun écran ne lit `teams` sans filtre d'école, d'identifiant ou de type** (relevé du code). Les
    recherches d'équipes civiles et de cégeps filtrent `LIGUE_CIVILE` ou `CEGEP` et ne voient donc pas
    ces équipes secondaires.
  - La seule lecture complète (admin écoles) est paginée (`fetchAllRows`).
  - Le maximum par école après création (91) reste loin du plafond de 1 000 lignes de PostgREST.

## Effets de bord à connaître (pas des pannes)
- L'**inscription athlète** et le **sélecteur d'équipe** listeront les équipes 2026 de l'école, à côté
  de celles de 2025. La saison est affichée.
- `detectExistingTeam` (création d'équipe par un coach) trouvera l'équipe RSEQ et proposera de la
  rejoindre, au lieu d'en créer un doublon.
- La **page d'école** et la **saison en cours** afficheront les équipes 2026 avec leurs matchs.

## Anomalie trouvée, pas créée par les lots (signalée, pas touchée)
- **18 côtés de match en prod** sont reliés à une équipe dont le `rseq_team_id` diffère de celui du
  match. Tous concernent des équipes pré-existantes : Des Patriotes, LCC, Collège Durocher,
  Massey-Vanier, Louis-Jobin, Acad. Saint-Louis, Samuel-Champlain, Sém. St-François, Poly. Black-Lake,
  Coll. des Compagnons, Aubier.
- Ce sont probablement des matchs que la veille ne relit plus (retirés côté RSEQ), restés sur une
  ancienne résolution.

## « Pionniers » et Du Rocher — pourquoi ils avaient été rapprochés
- L'équipe 2026 « Pionniers » (`7e24a76c…`, basketball juvénile F, Division 2, sans `rseq_team_id`) est
  rattachée en base à **École secondaire du Rocher (Shawinigan)**.
- Elle a été créée le 2026-07-06 par un coach (`c49ed835…`) dont le profil déclare cette même école.
- Le dédoublonnage compare les identifiants d'école. Il a donc vu « même école, même sport, même
  catégorie, même division ».
- Si « Pionniers » est en réalité l'École secondaire des Pionniers (Trois-Rivières), c'est le
  **rattachement de cette équipe** qui est faux en base. Il n'a pas été modifié : décision à BP.
