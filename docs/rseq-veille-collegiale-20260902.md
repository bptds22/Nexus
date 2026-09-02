# Veille RSEQ collégiale — ce que le diagnostic a établi (2026-09-02)

Notes de chantier pour la veille hebdomadaire des pages CÉGEP. Tout ce qui suit
a été **mesuré** sur `diffusion.s1.rseq.ca` et sur la base de production, pas
déduit. Les chiffres portent la date parce qu'ils bougeront.

> **État au moment où ce document est écrit : rien n'est appliqué.** Les deux
> migrations `20260902090000` / `20260902090100` n'ont jamais été exécutées, ni
> en local ni en prod ; `rseq-weekly-sync` n'est pas déployée ; aucun passage
> n'a eu lieu. Ce document consigne le DIAGNOSTIC, pas une recette réussie.

---

## 1. Le périmètre réel

| | |
|---|---|
| Cégeps sur Nexus | 70 (`schools.type = 'CEGEP'`), 65 pontés, 61 avec page configurée |
| Cégeps avec ≥1 équipe au calendrier collégial 2026-2027 | 58 |
| Équipes cégep 2026-2027 dans `teams` | 312, toutes pontées |
| Ligues collégiales 2026-2027 | **38** → 38 appels par semaine |
| Volume mesuré | ~195 Ko par ligue, ~7,4 Mo par passage, ~35 s à 800 ms de politesse |

Une passe hebdomadaire coûte moins qu'un envoi de courriels.

---

## 2. Trois pièges de la source, tous vérifiés

### 2.1 `Teams[]` n'est PAS le registre des participants d'une ligue

C'est le piège le plus coûteux, et il a fait échouer la première version du
détecteur.

Sur `Soccer C M D2 Nord-Est` (`9111db6c…`) le 2026-09-02 :

- `Teams[]` = **5 lignes**, `TeamCount = 5` — Garneau, Lévis, Limoilou,
  Rimouski, Sainte-Foy.
- Les **52 matchs de la même ligue** font jouer **12 équipes réelles** : les 5
  ci-dessus **plus** Alma, Beauce-Appalaches, Chicoutimi, Jonquière,
  Rivière-du-Loup, Saint-Félicien, Thetford — avec exactement les mêmes
  identifiants que ceux déjà en base.

Sur les 38 ligues : **312 lignes `Teams[]` pour 334 participants réels.**

Conséquence : détecter les nouvelles équipes sur `Teams[]` seul rend **22
équipes invisibles**. Il faut l'UNION `Teams[]` + participants des matchs
(`equipesADetecter()` dans `supabase/functions/_shared/rseqWhitelist.ts`).

Corollaire à ne pas perdre de vue : **`InstitutionId` n'existe QUE dans
`Teams[]`**. Une équipe connue des seuls matchs arrive donc sans rattachement
d'école, et l'alerte doit le dire (`source: 'matchs'`,
`vu_dans_teams: false`) au lieu de laisser croire à un rapprochement de nom.

### 2.2 Le gabarit de tableau éliminatoire se déguise en équipe

RSEQ inscrit les cases de bracket comme des participants : « 3e position »,
« 1er section Nord-Est », « Gagnant SF01 », « Perdant D-F ». Toutes portent
l'identifiant nul `00000000-0000-0000-0000-000000000000`.

Elles participent à des matchs dans **32 des 38 ligues**. Sans filtre, elles
généreraient de fausses alertes à chaque passage. Le filtre s'applique partout
où l'on raisonne « équipe » — **jamais aux matchs eux-mêmes** : le match
existe, c'est son adversaire qui n'est pas encore connu.

### 2.3 La sentinelle `-999`

Un match non joué porte `HomeTeamScore = -999`. Lue comme un 0, elle
inventerait un blanchissage sur tout un calendrier. `scoreDe()` la ramène à
`null` et n'établit `is_played` que sur un score domicile réel — règle reprise
telle quelle du premier chargement (`scripts/scrape-rseq-calendar.mjs`), parce
qu'en changer reclasserait des matchs sans que RSEQ ait bougé.

---

## 3. La ligne rouge

`GetLeagueDiffusion` renvoie **459 clés racine** (83 tableaux, 1 objet, 375
scalaires). Dont **60** contenant `Stats`, **23** `Player`, **17** `Athlete`,
**5** `Coach`, **8** `Coordinator`/`Statistician`.

On en garde **quatre** : `Teams`, `RegularSeasonGames`, `PostSeasonGames`,
`Standings`.

**Whitelist positive, jamais blacklist.** Le payload porte à la racine
`LeagueCoordinator: "rcollard@rseq.ca"` et
`LeagueStatistician: "jptremblay@rseq.ca"` — des courriels nominatifs de
personnel RSEQ, dont le nom de clé ne contient ni « Stats » ni « Athlete ». Une
blacklist les laisserait passer ; une whitelist ne les voit même pas.

Arbitrage rendu le 2026-09-02 : `PreSeasonGames` **exclu** (hors-concours,
valeur faible) et `ChampionshipGames` & consorts **exclus** (bruit de bracket).
À revoir au lot C seulement si l'affichage des séries devient un besoin.

Verrouillé par `lib/rseq/__tests__/rseqWhitelist.test.ts` — dont un cas de
dérive amont (`RSEQ_LIVE=1`) qui compare le jeu de clés servi aujourd'hui à
celui de la fixture et rougit si RSEQ en ajoute une.

---

## 4. La re-découverte des GUID : le trou non résolu

**`scripts/rseq-discover.mjs` ne trouvera jamais une ligue collégiale.**

- `data/import/rseq_leagues_all.json` : 1 597 ligues, **0 collégiale**
  (Secondaire 1372, Primaire 225).
- `GetRegionSports(2026-2027, région 14 « Provincial »)` → **0 sport**. Sur
  2025-2026 → 9 sports, dont `GetLeagueList` ne renvoie que du **Secondaire**
  (64 ligues, 0 collégiale).
- Testé `&sector=1` (Collégial est bien le code 1), `&level=`, `&sectorId=` :
  0 ligue à chaque fois. `InstitutionApi`, `TeamApi` : **404**.

Nos GUID collégiaux viennent de `data/import/rseq_leagues_collegial.json` —
**50 lignes assemblées à la main le 2025-07-23**, jamais reproduites par un
script, et déjà dépassées (le fichier n'a que 9 ligues 2026-2027 quand la base
en porte 38).

**Ce qui compense, et qui est automatisable :**

1. `LIGUE_MUETTE` — chaque GUID connu est appelé chaque semaine ; un 404 ou un
   payload vide lève une alerte. Ne découvre rien, mais garantit qu'on ne sert
   pas du périmé en silence.
2. `FAMILLE_ATTENDUE_ABSENTE` — les **22 familles** de ligues (sport ×
   division, stable d'une saison à l'autre alors que les GUID changent) sont
   suivies, dormantes comprises. Une famille non publiée passé la date où elle
   démarrait la saison précédente lève une alerte.

Au 2026-09-02 : **18 familles actives + 4 dormantes** (Badminton D2, Badminton
D3, Soccer intérieur, Soccer intérieur D3 — les ligues d'hiver), attendues
respectivement les 5 oct, 4 oct, 9 nov et 31 janv.

Piège d'alias : `Ultimate` (2025-2026) et `Ultimate frisbee` (2026-2027) sont
la même famille. Sans repli on compte 23 au lieu de 22 —
`rseq_family_key()` s'en charge.

**Trou historique visible dans les données** : la saison 2025-2026 ne compte
aucune ligue collégiale D1 (ni basket, ni foot, ni soccer, ni volley) — elles
ont été ratées au chargement. C'est exactement ce que
`FAMILLE_ATTENDUE_ABSENTE` aurait crié.

---

## 5. Le classement est stocké tel quel, jamais recalculé

`Standings[]` donne 8 à 10 lignes par ligue avec `Position`, `GamesPlayed`,
`Wins/Losses/Draws`, `PointsFor`, `TotalPoints` — et ~40 booléens
`Standings_Show_*` qui disent **quelles colonnes RSEQ affiche pour CE sport**
(les sets au volleyball, les points pour/contre au football). L'affichage
(lot C) les lira au lieu de deviner sport par sport.

Une V-D-N recalculée depuis `games` serait plausible et **fausse** : les bris
d'égalité RSEQ (`TieBreakingRules`, `TieBreakingDecisions`, points d'éthique,
forfaits) ne sont pas reproductibles. On copie `Position` et on l'affiche.

Deux fautes de frappe sont **chez RSEQ** et se lisent telles quelles :
`PointsAgaints`, `GoalsAgaints`.

---

## 6. Idempotence — pourquoi les `WHERE` sur les `DO UPDATE`

Un upsert nu réécrirait 2 368 lignes par semaine et le journal ne vaudrait
rien. Les deux RPC portent un `WHERE` qui exige qu'au moins un champ diffère
réellement (`IS DISTINCT FROM`, NULL-safe) : une ligne inchangée n'est pas
écrite, n'est pas renvoyée par le `RETURNING`, n'est pas comptée. `xmax = 0`
distingue l'INSERT de l'UPDATE.

Corollaire d'implémentation : **la méta de ligue (sport, région, catégorie,
sexe) est reprise de la base, pas du payload** — elle venait à l'origine du
catalogue de ligues. La relire de la source ferait « bouger » toutes les lignes
au premier passage et la preuve d'idempotence ne prouverait plus rien.

---

## 7. Règle RSEQ maison, écrite dans le code

- **Jamais de DELETE**, nulle part.
- **Jamais d'INSERT dans `schools`** — aucune fonction n'a de chemin d'écriture
  vers cette table. Une équipe rattachée à une institution inconnue lève une
  alerte qui NOMME l'institution ; la décision reste humaine.
- **INSERT d'équipe permis avec dédup** — mais pas par le pipeline : les
  détections vont dans `rseq_sync_alerts`, traitées à la main. Protégé de toute
  façon par `teams_rseq_team_id_uidx` (unique partiel) et `teams_identity_unique`.

---

## 8. Le cas Campus Notre-Dame-de-Foy — ce qu'une preuve d'identifiant peut
   et ne peut pas dire

RSEQ publie trois équipes collégiales nommées « Notre-Dame » / « Notre-Dame
Bleu » (`0b77da64…`, `d387591f…`, `ba51f1e5…`), **toutes** avec
`InstitutionId = db18d59a-c6de-4e76-901e-c19388d3f4b6`. Côté Nexus, une seule
ligne porte cet identifiant : **Campus Notre-Dame-de-Foy** (`fbe59ef8…`).
Correspondance exacte, pas un rapprochement de nom.

**Mais** les deux équipes qui nous intéressaient — `efc24406…` « Notre-Dame »
(flag football D2 F) et `46e24feb…` « Notre-Dame Jaune » (rugby F) — ne
figurent dans **aucun** `Teams[]` des 38 ligues. Elles ne portent donc aucun
`InstitutionId` : **la preuve par identifiant n'existe pas pour elles.**

C'est le cas général des 22, pas une exception. D'où le libellé d'alerte
« RATTACHEMENT À ÉTABLIR À LA MAIN — absente de Teams[], aucun InstitutionId
publié », qui refuse de trancher à la place de l'humain.

---

## 9. Contraintes d'exploitation

- **`pg_cron` n'est pas installé** sur le projet (`pg_net` 0.20.3 l'est). À
  activer par migration au moment de planifier — pas avant que la recette soit
  passée.
- **Vercel Cron est écarté** : la prod est épinglée sur un déploiement
  antérieur, un cron poussé ne tournerait pas avant le Promote. `pg_cron` →
  edge function est indépendant de cet épinglage.
- **`pg_net` coupe à 5 s.** Une passe dure ~35 s : la fonction répond 202
  immédiatement et travaille dans `EdgeRuntime.waitUntil`, comme
  `send-announcement`. Le mode `?wait=1` force le synchrone pour la recette —
  on veut voir le journal, pas un 202.
- Les deux vues sont en `security_invoker` et **inscrites dans
  `scripts/check-view-hardening.sql`** (règle 10 : `CREATE OR REPLACE VIEW`
  efface les `reloptions` en silence).

---

## 10. Ce qui reste à faire

1. Apply LOCAL des deux migrations → **c'est là que la syntaxe SQL se prouve,
   elle n'a jamais été exécutée**.
2. Apply PROD, une migration à la fois.
3. Secret `RSEQ_SYNC_SECRET` + déploiement de `rseq-weekly-sync`.
4. Premier passage manuel (`?wait=1`), journal complet.
5. Relance immédiate → preuve d'idempotence (0 changement attendu).
6. Revue de la file, puis INSERT des équipes approuvées.
7. Seulement ensuite : migration `pg_cron` (hebdomadaire).
8. Lot C — affichage (fiche V-D-N, scores au calendrier, bloc classement, bloc
   école) : estimé 3,5 – 4,5 séances, non commencé.
