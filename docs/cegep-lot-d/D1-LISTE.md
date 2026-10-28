# Lot D1 — liste attendue contre liste obtenue (2026-10-28)

**Attendu :** recherche web du 27 oct. (DIAGNOSTIC.md §2 : sites des programmes, Wikipédia, rseq.ca).
**Obtenu :** API RSEQ `s1.rseq.ca` (`GetLeagueDiffusion`), les 25 ligues du secteur Universitaire 2026-2027 du
catalogue de l'audit du 8 oct. Seules les données dérivées sont gardées dans
`scripts/cegep-lot-d/d1-universites.json` : la réponse brute de l'API contient des courriels personnels
(rapports de match) et n'est pas versionnée.

Retenu (décisions BP 1 à 3) : les 12 universités québécoises ; sports d'équipe déjà au catalogue Nexus
(basketball, flag-football, football, hockey, rugby, soccer, soccer intérieur, volleyball). Saison 2026-2027,
catégorie « Universitaire ».

## Universités : 12 attendues, 12 obtenues (même rseq_institution_id que l'API)

| Université (nom en base) | Programme | Ville | Équipes | Écarts avec l'attendu |
|---|---|---|---|---|
| Université Laval | Rouge et Or | Québec | 12 | conforme |
| Université de Montréal | Carabins | Montréal | 11 | conforme (pas de basketball) |
| Université McGill | Redbirds et Martlets | Montréal | 11 | hockey M absent : joue en OUA, pas au RSEQ |
| Université Concordia | Stingers | Montréal | 11 | hockey M absent (OUA) ; flag-football F et soccer intérieur en plus |
| Université de Sherbrooke | Vert & Or | Sherbrooke | 10 | rugby M absent de l'API (Wikipédia le donnait, non confirmé) |
| Université Bishop's | Gaiters | Sherbrooke | 8 | soccer M absent (attendu non plus) ; hockey F présent |
| Université du Québec à Montréal | Citadins | Montréal | 8 | conforme |
| Université du Québec à Trois-Rivières | Patriotes | Trois-Rivières | 6 | hockey M absent (OUA) |
| Université du Québec à Chicoutimi | Inuk | Saguenay | 2 | conforme |
| École de technologie supérieure | Piranhas | Montréal | 4 | flag-football F en plus |
| Université du Québec en Outaouais | Torrents | Gatineau | 1 | conforme (hockey M D2) |
| Université du Québec à Rimouski | Nordet | Rimouski | 0 | aucune équipe d'un sport d'équipe au RSEQ (cross-country, natation seulement) : l'université est créée sans équipe |

Total : **84 équipes**. Hockey M D2 : ÉTS, Sherbrooke, UQAC, UQO. Flag-football F en deux ligues (A et B).

## Non retenu
- **Hors Québec** présents dans les ligues RSEQ : Carleton, Ottawa, Dalhousie, UNB → lot D1b (U SPORTS).
- **« Collège Militaire Royal »** (athlétisme seulement) : identité non établie (Saint-Jean ou Kingston) → question à BP.
- **Sports individuels** : athlétisme 16, cross-country 20, golf 16, natation 12, badminton 6 équipes ; et
  **cheerleading** 6 (aucun match RSEQ, pas un sport de confrontation).
- **Hockey M en OUA** (McGill, Concordia, UQTR) : hors RSEQ, donc hors API ; à reprendre en D1b avec U SPORTS si voulu.
- Nom des universités : choisi par Nexus (l'API ne donne que « Laval », « Montréal »…) ; sites web seulement
  quand la source a été lue (Concordia, Bishop's, UQTR, UQAC, ÉTS, UQO : vide).
- Pas de coordonnées (lat/lng) ni de slug : vitrine universitaire plus tard (décision 9).
