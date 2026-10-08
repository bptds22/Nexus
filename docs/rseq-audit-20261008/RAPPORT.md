# Audit RSEQ — diffusion complète + équipes 2026 manquantes — 2026-10-08

Lecture seule. Rien n'a été écrit en prod. Demandé par BP le 2026-10-08.

## Méthode (grille complète, sans se fier aux menus)

- **Codes de sport** : union de `GetRegionSports` pour les 12 saisons de
  diffusion.s1.rseq.ca × 15 régions (58 codes), plus tous les codes de 0 à 60
  → **61 codes**. `GetRegionSports` répond 404 sur s1.rseq.ca.
- **`GetLeagueList`** : pour CHAQUE couple région (0 à 14) × code × saison
  (2026-2027 et 2025-2026), sur les DEUX hôtes (diffusion.s1.rseq.ca et
  s1.rseq.ca). Total : 3 841 appels, 0 échec, 800 ms entre deux appels,
  User-Agent Nexus-Veille, 3 145 s.
  - Ligues dédoublonnées par `LeagueId` : 5 023 ligues.
  - Pour chaque ligue, on note les couples qui la rendent et l'hôte, et on
    marque `*` les couples que le menu ne proposait pas.
- **`GetLeagueDiffusion`** sur 3 110 ligues : toutes celles de 2026 hors
  primaire, plus, en 2025, le football, le flag, l'Outaouais et les ligues
  absentes de la base.
- **Comparaison à la base**, par empreinte md5 de `rseq_league_id` puis de
  `rseq_game_id` (relevés `execute_sql` en lecture seule).

Fichiers (les scripts sont dans `scripts/rseq-audit-20261008/` ; ils lisent des relevés de la base
faits par `execute_sql`, non versionnés) :
- `catalogue-rseq.csv` : une ligne par ligue, 2025 et 2026. Colonnes : région,
  sport, secteur, ligue, division, catégorie, sexe, nombre d'équipes, matchs
  RSEQ (saison régulière + séries ; aussi pré-saison et championnat), matchs
  en base, `menu`, couples.
- `analyse-brute.txt` : la sortie complète de l'analyse.

## 1. Ce que dit la grille

| | 2026-2027 | 2025-2026 |
|---|---|---|
| Ligues (tous secteurs) | 2 158 | 2 865 |
| Secondaire / Collégial / Universitaire / Primaire | 1 593 / 87 / 25 / 445 (+8 « Primaire et secondaire ») | 2 115 / 83 / 25 / 621 (+21) |
| Servies par s1 SEULEMENT | **1 826** | 1 300 |
| Servies par diffusion ET s1 | 332 | 1 565 |
| Servies par diffusion SEULEMENT | **0** | **0** |
| Couple non proposé par le menu | 134, **toutes au Provincial (région 14)** | 48, toutes au Provincial |

**s1.rseq.ca contient tout diffusion.** En 2026, diffusion n'expose que
332 ligues sur 2 158.

**Le menu ne cache rien aux régions 0 à 13** : chaque ligue régionale
trouvée l'a été sous un couple que le menu proposait. Son seul effet est au
Provincial : `GetRegionSports` région 14 ne rend que Cross-country.

## 2. Comparaison au contenu de la base (matchs 2026, par identifiant de match)

| Secteur 2026 | Ligues RSEQ avec matchs | Matchs RSEQ | **Absents de la base** |
|---|---|---|---|
| Secondaire | 335 | 11 749 | **53** (5 ligues) |
| Collégial | 69 | 4 168 | **1 561** (27 ligues) |
| Universitaire (hors périmètre) | 13 | 513 | 513 |

**Le secondaire est complet à 99,5 %.**
- Parmi les ligues sans aucune ligne en base, 24 ont TOUS leurs matchs déjà
  en base, rangés sous la ligue jumelle (sections A/B, Est/Ouest).
  `rseq_sync_apply_games` garde en effet un match partagé sous sa ligue
  d'origine.
- Les 53 matchs manquants :

| Ligue (2026) | RSEQ | Manquants | Pourquoi |
|---|---|---|---|
| GMAA · Hockey M15 Filles D4 | 45 | 45 | s1 seulement, jamais découverte |
| Outaouais · Baseball B U D4 Automne 2026 | 3 | 3 | s1 seulement |
| Outaouais · Baseball J U D4 Automne 2026 | 2 | 2 | s1 seulement |
| Montérégie · Football J U D3 9 joueurs | 14 | 2 | ligue appelée ; 2 matchs nouveaux depuis la passe du 7 |
| GMAA · Soccer B Garçons D4 Niveau 1 B | 7 | 1 | idem |

**Le collégial a un vrai trou : 27 ligues provinciales, 1 561 matchs**,
toutes servies par s1 seulement et inconnues de la veille :
- Volleyball D2/D3 Nord-Est et Sud-Ouest B ;
- Basketball D2 Nord-Est CQ A/B, D3 Nord-Est, Sud-Ouest B ;
- Badminton D2/D3 ;
- Soccer intérieur Sud-Ouest ;
- Flag D3 Sud-Ouest B/C ;
- Football D3 Nord-Est ;
- Rugby M Nord-Est ;
- Soccer D2 Nord-Est CQ.

La liste complète est dans `analyse-brute.txt`.

**Écarts de compte sur les ligues présentes (11 ligues)** : la base porte
**74 matchs que le RSEQ ne sert plus**, dans aucune ligue (36 rien qu'en
Mauricie · Flag C M D4). Ce sont des matchs déplacés ou retirés côté RSEQ.
Par règle, la base ne les supprime jamais : ils sont seulement signalés
`MATCH_RETIRE`.

### Les cas signalés par BP
- **Outaouais cadet et juvénile 2026.** Les ligues « Football C U D3 » et
  « J U D3 » de l'Outaouais existent sur s1, mais à **0 équipe, 0 match**.
  Les écoles de 2025 jouent désormais dans **Lac-Saint-Louis · Football C M D4
  Section Ouest** (48 matchs) et **J M D3 Section Ouest** (55 matchs). Cela
  vaut pour Saint-Alexandre, Hormisdas-Gamelin, Nicolas-Gatineau, Nouvelles
  Frontières et du Versant. Ces deux ligues sont au catalogue et appelées ;
  leurs matchs sont en base, sous la région « Lac-Saint-Louis ». **Rien ne
  manque** : c'est un changement de région côté RSEQ, et une recherche par
  `region = 'Outaouais'` ne les voit plus.
- **Football à Montréal, Laval et GMAA.** **Aucune ligue de football n'existe**
  pour ces trois régions, ni sur diffusion ni sur s1, ni en 2025 ni en 2026,
  sous aucun des 61 codes. Leurs écoles jouent ailleurs :
  - en 2026, 13 écoles de Montréal ou Laval en Lac-Saint-Louis (Notre-Dame,
    Jean-Eudes, Laval Junior, Curé-Antoine-Labelle…) ;
  - 2 en Laurentides-Lanaudière ;
  - Lower Canada College en Montérégie ;
  - 6 au Provincial.

  **Ce n'est pas un trou de la veille.**
- **Paul-Le Jeune (Mauricie).** 2026 : Flag C F D4 Niveau 1 (55 matchs), Flag
  C M D4 (49 matchs) et Flag J F D4 Niveau 1 (55 matchs), plus des ligues
  d'hiver encore sans match. Il n'a **pas de football en 2026** ; en 2025, il
  jouait en « Football J U D3 Section C ». Il a 0 équipe Nexus 2026 : 2 sont
  à créer dans le CSV. La 3ᵉ (J F) est déjà reliée, par son `rseq_team_id`,
  à une équipe Nexus de 2025.
- **Châteauguay Valley (Montérégie).** 2026 : Rugby C F D4 (deux équipes) et
  Rugby J F D4, plus du basketball sans match encore. **Pas de football en
  2026** ; en 2025, il jouait en « Football J M D3 9 joueurs ». 3 équipes sont
  à créer.
- **Polyvalente Sainte-Thérèse (Laurentides).** En 2026, elle n'a **aucune
  ligue avec des matchs** : seulement des inscriptions d'hiver (basketball,
  futsal, volleyball, badminton) et du cross-country. **Pas de football en
  2026** ; en 2025, elle jouait en « Football J U D4 » (33 matchs). Rien à
  créer aujourd'hui.

## 3. Pourquoi la veille a raté ce qu'elle a raté

Ce n'est pas le fusible : aucune passe ni découverte n'est en PARTIAL. La
découverte du 6 octobre a tourné en 168 s, la passe secondaire du 7 en 274 s.

1. **Hôte.**
   - La découverte régionale lit `diffusion.s1.rseq.ca`, qui n'expose que
     les ligues diffusées publiquement.
   - Les ligues servies par s1 seulement, hors région 14 × {1, 5, 16}, ne
     sont jamais vues. C'est la cause des 9 ligues secondaires (dont hockey
     GMAA et baseball Outaouais) et des 27 ligues collégiales.
   - La sous-passe provinciale n'interroge que 3 sports, alors que s1 région
     14 en a 12 (badminton, soccer, soccer intérieur, rugby, flag, etc.).
2. **Secteur.**
   - `?mode=decouverte` refuse le Collégial ; la passe collégiale n'appelle
     que les ligues déjà présentes dans `games`.
   - Une nouvelle ligue collégiale n'entre donc **jamais**. C'est le
     verrou « le collégial est couvert par games », vrai le 2026-09-02 et
     faux depuis.
3. **Région.** `games.region` est la région de la LIGUE, pas celle de
   l'école. Les écoles qui jouent hors de leur région, comme l'Outaouais en
   Lac-Saint-Louis, semblent « absentes ».
4. **Menu.** Il ne cause aucune perte régionale. Au Provincial, il ne
   propose que Cross-country, mais la liste fixe de la sous-passe
   contournait déjà le problème pour 3 sports.

**Risque à venir.** En 2026, il existe **857 ligues secondaires servies par
s1 seulement, avec des équipes inscrites mais aucun match encore**
(basketball 198, volleyball 158, futsal 114, badminton 69, hockey 26…).
En 2025, la plupart sont passées sur diffusion au moment de leur
publication : 1 565 ligues « les deux » en 2025, contre 332 aujourd'hui.
Rien ne GARANTIT pourtant qu'elles le feront toutes. Les 9 ligues
secondaires actuelles prouvent que certaines restent sur s1 avec leurs
matchs.

## 4. Correctif de la veille proposé (non codé)

1. **Découverte sur s1.rseq.ca, grille complète.**
   - Interroger les régions 0 à 14 × les 61 codes, pour la saison courante.
     Dans les deux saisons relevées, s1 contient diffusion.
   - Ne plus dépendre de `GetRegionSports` (404 sur s1).
   - Garder la liste des codes à jour : union de `GetRegionSports` sur
     diffusion, plus 0 à 60, plus tout code nouveau vu.
   - **Secondaire ET Collégial** au catalogue ; Universitaire et Primaire
     écartés à l'écriture.
   - La liste fixe `SPORTS_PROVINCIAUX` disparaît : la région 14 fait
     partie de la grille.
2. **Temps.** Mesuré : 0,82 s par appel avec 800 ms de politesse. Une grille
   d'une saison coûte 15 × 61 = 915 appels, soit **≈ 750 s**, au-delà du
   fusible de 330 s.
   - **Moitiés** : 458 appels, ≈ 375 s. Ça dépasse encore le fusible.
   - **Tiers** (5 régions par jour, 3 crons, par exemple lundi, mardi et
     mercredi à 7 h 55) : 305 appels, **≈ 250 s** chacun, sous le fusible.
     La grille reste complète, simplement étalée sur 3 jours.

   Le catalogue s'écrit déjà région par région : une tranche coupée ne perd
   rien.
3. **La passe collégiale lit le catalogue.** `rseq_ligues_a_appeler` l'accepte
   déjà, puisque la vue unit catalogue et `games` sans exclure le Collégial.
   Il suffit que la découverte l'écrive. On retire le refus de
   `?mode=decouverte&secteur=Collégial`.
4. **Volume des passes.**
   - Sans filtre, le catalogue 2026 compterait 1 680 ligues secondaires et
     collégiales.
   - En retirant les sports sans match (cross-country, athlétisme,
     natation, golf, échecs, impro, cheerleading, courses…), il en reste
     1 292, dont 1 028 avec équipes, soit ≈ 850 s par passe.
   - Les passes doivent donc aussi passer en **tranches** : le « lot
     tranches » annoncé dans l'en-tête de la fonction.
   - Proposition :
     - étendre l'exclusion de la vue aux sports sans match (aujourd'hui
       natation et cross-country seulement) ;
     - appeler seulement les ligues `TeamCount > 0` ;
     - répartir chaque passe par tiers de régions.
   - La passe secondaire actuelle (327 ligues, 274 s) est déjà à 83 % du
     fusible ; en hiver, elle sautera sans ce changement.

## 5. Équipes 2026 à créer — `equipes-2026-a-creer.csv`

Il y a une ligne par équipe RSEQ 2026 qui a des matchs mais aucune équipe
Nexus. Les cases de séries sont exclues : UUID nul (1) ; « Gagnant… »,
« Position… », etc. (0 dans les données 2026). Sont aussi exclues 126 équipes
déjà en base par `rseq_team_id` et 66 universitaires (hors périmètre).

| Décision proposée | Lignes |
|---|---|
| `oui` (confiance haute, ou décision BP) | **1 916** |
| `après confirmation BP` | 33 |
| `non (école introuvable)` | 16 |
| `non (sport absent de Nexus)` : balle molle | 5 |
| `non (doublon à trancher)` | 2 |

- **Rattachement à l'école** :
  - `InstitutionId` RSEQ = `schools.rseq_institution_id` (1 901 lignes,
    confiance haute) ;
  - décisions de BP du 2026-10-08 : Le Ber, Laval Jr. Academy, Matane,
    S. de Sherbrooke (19 lignes) ;
  - même nom qu'une équipe 2025 du même type d'école (3 lignes, confiance
    moyenne) ;
  - sinon, une piste par le nom, à confirmer.

  Aucune école n'est créée.
- **Dédoublonnage** : par `rseq_team_id` (index unique), puis par même école
  + sport + catégorie + division en 2026. Deux cas sont à trancher :
  - **Du Rocher** (basketball juvénile F D2) : l'équipe 2026 « Pionniers »
    existe déjà sans `rseq_team_id`. Recommandation : lui poser cet
    identifiant plutôt que de créer une équipe.
  - **Triolet** (football benjamin D3) : une équipe 2026 du même nom porte
    déjà un autre `rseq_team_id`. RSEQ a donc deux équipes ; recommandation :
    créer la seconde.
- **Les 1 916 `oui`** :
  - 1 718 ont des matchs déjà en base. Le script de création reliera
    15 776 côtés de match, par `rseq_team_id`.
  - 198 sont collégiales ou en ligues s1 : elles n'auront de matchs
    qu'après le correctif de la veille.
  - **Football : 37** (31 secondaires, 6 collégiales).
- Le **script de création** (transaction gardée sur le nombre exact,
  `admin_operations`, liaison `games.home_team_id` / `visitor_team_id` par
  `rseq_team_id`) sera écrit **après** la validation du CSV, comme demandé.

### Les trois cas à faire confirmer
- **É.I. Du Phare** (Cantons-de-l'Est, 3 équipes). Piste : **École
  internationale du Phare (Sherbrooke)**, sans `rseq_institution_id` chez
  nous. Ce n'est pas l'École du Phare de Québec, qui a son propre
  identifiant RSEQ.
- **St-François** (Cantons-de-l'Est, 1 équipe, InstitutionId `513729ef…`).
  **Aucune école trouvée** dans `schools`.
- **Rivière-du-Loup** (football benjamin et juvénile D3). Piste : **Collège
  Notre-Dame de Rivière-du-Loup**, sans identifiant RSEQ. Ce n'est pas le
  cégep (InstitutionId RSEQ `25d74fae…`).

### Autres pistes à confirmer (même forme : nom proche, identifiant RSEQ inconnu chez nous)
- Séminaire Saint-Joseph (15 équipes, toutes sports) → Séminaire Saint-Joseph
  de Trois-Rivières.
- É.S. Montcalm (6 équipes) → École Mitchell-Montcalm. Doute : celle-ci
  porte un AUTRE identifiant RSEQ.
- Coll. Héritage → Collège Héritage de Châteauguay (2 lignes en double dans
  `schools`).
- Centennial Academy, Collège Beaubois (porte un autre identifiant RSEQ),
  Collège Pasteur (S).

### Introuvables : il faudrait une école (INSERT d'école = GO de BP)
- ÉS Anjou (Montréal, 10 équipes). Ce n'est pas le Collège d'Anjou, qui a
  un autre identifiant.
- CQPEL (Laval, 2), École Saint-Arsène (Montréal, 2), St-François (1).
- Sieur-de-Coulonge : deux lignes en double dans `schools`.

## 6. Athlètes restés sur l'équipe 2025 — `athletes-restes-2025.csv` (rien déplacé)

8 équipes 2025, toutes ACTIF :
- **École secondaire Saint-Joseph (Saint-Hyacinthe)**, football juvénile M
  D3 : 5 athlètes sur l'équipe 2025 `aa60ace5`. L'équipe 2026
  « Saint-Joseph » (Mixte D3) existe déjà.
- Collège Mont-Sacré-Cœur (2), Saint-Sacrement (1), Académie Lafontaine (1),
  Mgr-Euclide-Théberge (1), La Ruche (1), Hyacinthe-Delorme (1),
  Saint-Bernard (1).

Les identifiants (8 caractères) sont dans le CSV.

## 7. Partie 3 — `suppression-equipe-fantome.sql` (prêt, NON exécuté)

Relevé :
- **Équipe** `85db3d30…` « Football », Académie adventiste Greaves, juvénile M
  AAA, **saison 2025-2026** (et non 2026), sans `rseq_team_id`. 0 athlète,
  0 coach, 0 match, 0 référence, sur les 15 tables qui pointent vers
  `teams`.
- **Carte** `e7d97996…` « adrian test », créée le 2026-10-07 par
  nexus.recruteur, unité Nexus Collégial × Basketball. Elle entraîne en
  cascade 1 ligne de `cartes_prospect_journal`. Le trigger écrit 1 ligne dans
  `cartes_prospect_suppressions` (RETRAIT).

Le script tient en une transaction gardée :
- contenu vérifié avant : l'école, le créateur de la carte, aucun
  dépendant nouveau ;
- la carte d'abord, puis l'équipe ;
- exactement 1 carte, 1 équipe et 1 ligne `admin_operations`
  `SUPPRESSION_EQUIPE_FANTOME`, sinon rien n'est écrit.
