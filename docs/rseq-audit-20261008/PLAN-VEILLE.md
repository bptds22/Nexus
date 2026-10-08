# Plan — correctif de la veille RSEQ (découverte s1, grille complète, tiers de régions) — 2026-10-08

**Plan seulement, rien n'est codé.** Il découle de l'audit (`RAPPORT.md`) et des décisions de BP du
2026-10-08 : collecter les ligues servies par s1 seulement, Secondaire ET Collégial, grille complète
découpée par tiers de régions, nouvelles équipes proposées en ALERTE (jamais créées automatiquement).
Règles : CLAUDE.md § « Pont RSEQ ». La base TOUJOURS avant la fonction ; chaque migration sur GO de BP.

## Ce qui change, et pourquoi

| Aujourd'hui | Demain | Pourquoi (audit) |
|---|---|---|
| Découverte sur `diffusion.s1.rseq.ca`, régions × sports rendus par `GetRegionSports` | Découverte sur **`s1.rseq.ca`**, **régions 0 à 14 × tous les codes** connus | s1 contient tout diffusion (0 ligue « diffusion seul » sur 2 saisons) ; diffusion n'expose que 332 ligues 2026 sur 2 158 |
| Sous-passe provinciale : liste fixe `{1 Basketball, 5 Football, 16 Volleyball}` | Supprimée : la région 14 est dans la grille | s1 région 14 porte 12 sports (badminton, soccer, soccer intérieur, rugby, flag…) |
| Découverte **Secondaire seulement** ; la passe collégiale ne connaît que les ligues déjà dans `games` | Découverte **Secondaire + Collégial** au catalogue | 27 ligues collégiales et 1 561 matchs jamais vus |
| Une invocation de découverte (~200 appels) | **3 invocations** (tiers de régions), ~305 appels chacune | grille = 915 appels ≈ 750 s > fusible de 330 s |
| Une passe secondaire (327 ligues, 274 s, 83 % du fusible) | Passe secondaire **en 3 tiers** | le catalogue complet porterait ~1 000 ligues à appeler |

## 1. Codes de sport (base)
- Nouvelle petite table `rseq_codes_sport (code int primary key, nom text, vu_le timestamptz, source text)`,
  semée avec les **61 codes** de l'audit (union `GetRegionSports` sur 12 saisons + 0 à 60).
- Rafraîchie à chaque découverte, à coût faible : `GetRegionSports` diffusion pour la saison courante
  (15 appels, une fois par semaine, tranche 1). Un code jamais vu est AJOUTÉ (jamais retiré) et lève une
  alerte `NOUVEAU_CODE_SPORT`. Les menus ne filtrent plus rien ; ils ne servent qu'à découvrir des codes.
- ACL : lecture `service_role` seulement ; gate de liste complète triée.

## 2. Découverte v2 (fonction `rseq-weekly-sync`)
- `?mode=decouverte&tranche=1|2|3` — tranche 1 = régions 0–4, 2 = 5–9, 3 = 10–14 (14 = Provincial).
  Sans `tranche` : refus 400 (pas de défaut silencieux, même principe que `?secteur`).
- Hôte unique `https://s1.rseq.ca/` pour `GetLeagueList` (et `GetSchoolYearList`). `GetRegionSports`
  (diffusion) seulement pour le rafraîchissement des codes.
- Pour chaque région de la tranche × chaque code de `rseq_codes_sport` : `GetLeagueList`. Dédoublonnage par
  `LeagueId` ; secteurs écrits : `Secondaire`, `Collégial` (Universitaire, Primaire, « Primaire et
  secondaire » ignorés, comptés dans le journal).
- Écriture par région (déjà le cas), via `rseq_decouverte_upsert`, inchangée sauf qu'elle accepte le
  Collégial.
- Secteur du journal : la découverte couvre les deux secteurs en un seul balayage (mêmes appels). Deux
  options pour `rseq_sync_runs.secteur` — **à trancher par BP** :
  (a) une ligne de journal par secteur et par tranche (deux lignes pour un même balayage) ;
  (b) valeur `Tous` admise pour `mode = 'decouverte'` seulement (une contrainte à élargir, migration).
  Recommandation : (b), un balayage = une ligne.
- **Temps** (mesuré à l'audit : 0,82 s par appel avec 800 ms de politesse) : 5 régions × 61 codes = 305
  appels ≈ **250 s** par tranche, sous le fusible de 330 s. Les moitiés (458 appels ≈ 375 s) ne passent
  pas. Le fusible et la tentative unique après 300 s restent tels quels.
- Crons : **dimanche, lundi, mardi 7 h 55** (tranches 1, 2, 3) — jamais en même temps qu'une passe : deux
  invocations simultanées doubleraient le débit vers le RSEQ (une seule IP, la politesse est par
  invocation).

## 3. Ce que la passe appelle (vue `rseq_ligues_a_appeler`)
- Garder l'union catalogue + `games` ; ajouter :
  - l'exclusion des **sports sans match** (aujourd'hui natation et cross-country seulement) : athlétisme,
    golf, échecs, improvisation, cheerleading, courses HALO, course à pied, pentathlon, curling, lutte,
    escrime, pétanque, footgolf, RX1 Nation — liste écrite, pas déduite ;
  - **`team_count > 0`** pour les ligues issues du catalogue (une ligue vide n'a rien à servir) ;
  - une colonne `tranche` (1, 2, 3) dérivée de `region_code`, pour la passe en tiers.
- Rappel : `CREATE OR REPLACE VIEW` reporte sa clause `WITH` — la vue n'en a pas aujourd'hui ; contrôle
  `scripts/check-view-hardening.sql` après la migration.
- Volume estimé 2026 : 1 292 ligues secondaires + collégiales hors sports sans match, dont **1 028 avec
  équipes** → environ 950 secondaires + 70 collégiales.

## 4. Passes
- **Secondaire en 3 tiers** : `?secteur=Secondaire&tranche=1|2|3`, mercredi, jeudi, vendredi 8 h 10.
  ~320 ligues par tiers ≈ 260 s. Une ligue n'est donc relue qu'une fois par semaine, comme aujourd'hui.
- **Collégial** : une seule passe (~70 ligues ≈ 60 s), mercredi 7 h 55, inchangée sauf qu'elle lit le
  catalogue.
- `GetLeagueDiffusion` sur l'hôte où la ligue a été vue (s1 pour les ligues s1 seulement) — vérifié à
  l'audit : 3 110 lectures sur s1/diffusion, 3 110 HTTP 200.
- Charge hebdomadaire vers le RSEQ : ~390 appels aujourd'hui → ~915 (découverte) + ~1 030 (passes) ≈
  **1 950 appels**, toujours à 800 ms, jamais en parallèle.

## 5. Nouvelles équipes de la saison : proposées en alerte, créées sur GO
- `rseq_sync_detect_teams` lève déjà `NOUVELLES_EQUIPES` (secondaire, par sport × région) et
  `NOUVELLE_EQUIPE` (collégial). On enrichit le **payload** d'une PROPOSITION par équipe, calculée comme
  dans l'audit : école par `InstitutionId` → `schools.rseq_institution_id` (confiance haute) ou
  « introuvable » ; sport Nexus ; catégorie, division, sexe normalisés (Garçons → Masculin, Filles →
  Féminin) ; résultat du dédoublonnage (rseq_team_id, puis école + sport + catégorie + division + saison) ;
  nombre de côtés de match à relier. **Aucune écriture dans `teams`.**
- Nouvelle RPC `rseq_creer_equipes_proposees(p_alerte_ids uuid[])`, SECURITY DEFINER, `is_admin()`
  seulement, ACL `{postgres,service_role,authenticated}` gatée en liste complète triée : applique
  exactement la logique des lots de l'audit (transaction gardée sur le nombre, aucune école créée, côtés
  de match NULL seulement, une ligne `admin_operations` `EQUIPES_RSEQ_CREEES` par appel), marque les
  alertes traitées. Les cas « introuvable » ou « doublon » sont refusés par la RPC : ils restent à BP.
- Écran admin : liste des propositions ouvertes, case à cocher, bouton « Créer » — lot web séparé, après
  la base.

## 6. Ordre de livraison (chaque étape sur GO de BP)
1. Migration A : `rseq_codes_sport` + semis des 61 codes (+ alerte `NOUVEAU_CODE_SPORT` admise).
2. Migration B : `rseq_decouverte_upsert` accepte `Collégial` ; `rseq_sync_runs` (tranche, et `Tous` si
   option b).
3. Migration C : vue `rseq_ligues_a_appeler` (exclusions, `team_count > 0`, `tranche`).
4. Fonction `rseq-weekly-sync` v2 (découverte s1 en tranches, passes en tranches), recette locale
   `?wait=1` + `RSEQ_FUSIBLE_S` abaissé, puis déploiement.
5. Crons : 3 découvertes (dim/lun/mar 7 h 55), passe collégiale (mer 7 h 55), 3 passes secondaires
   (mer/jeu/ven 8 h 10). L'ancien cron de découverte est retiré dans la même migration.
6. Migration D + RPC de création sur proposition ; écran admin (lot web).
7. Après la première semaine complète : rejouer l'audit (`scripts/rseq-audit-20261008/`) et comparer —
   attendu : 0 ligue avec matchs absente, collégial compris.

## 7. Preuves attendues à chaque étape
- Grille : nombre de ligues par tranche égal à l'audit (2026 : 2 158 toutes catégories), 0 couple manquant.
- ACL des fonctions et RPC : listes complètes triées avant/après ; empreintes fonctions / policies /
  triggers / droits hors objets du lot inchangées.
- Fusible : une tranche forcée à `RSEQ_FUSIBLE_S=60` → `PARTIAL` + `PASSE_PARTIELLE`, journal jamais
  bloqué en `RUNNING`.
- Aucun `DELETE` de match ; aucune écriture `schools`/`teams` hors RPC de création sur GO.

## Questions pour BP
1. Journal de découverte : une ligne par secteur, ou valeur `Tous` ? Recommandation : `Tous`.
2. Jours des crons (dim/lun/mar découverte, mer/jeu/ven passes) : convient-il ? Recommandation : oui —
   aucune exécution simultanée, et une semaine complète entre deux lectures d'une même ligue.
3. Liste des sports sans match à exclure de la passe : la valider telle quelle ? Recommandation : oui.
   Relevé de l'audit (ligues lues, 2025 et 2026) : 0 match pour tous ces sports, sauf **Improvisation :
   3 matchs** — sport absent de `sports` chez Nexus, donc exclu quand même ; Pétanque, Pentathlon : aucune
   ligue lue avec diffusion.
