# Veille RSEQ secondaire — procédure de mise en prod

Préparée le 2026-09-18, branche `feat/rseq-veille-secondaire`. **Rien n'est
appliqué en prod à la date de rédaction.** À exécuter sur GO explicite de BP,
dans une seule fenêtre.

## 0. La fenêtre

- **Ni un mardi, ni un mercredi** (UTC comme heure de Montréal). Les travaux
  tournent le mardi 07:55 UTC (découverte) et le mercredi 07:55 / 08:10 UTC
  (passes). Entre l'étape 2 et l'étape 3, la fonction déployée (v6) ne
  correspond plus à la base : un déclenchement tombé dans cet intervalle
  échouerait.
- Prévoir **~30 min** : ~5 min de SQL et de déploiement, ~6 min de recette
  (35 s + 2 min 40 s + 2 min 20 s), le reste en lecture.
- Aucune passe `RUNNING` dans le journal au moment de commencer (§1).

## Ce qui part en prod

| # | Objet | Nature |
|---|---|---|
| M1 | `20260918143401_rseq_veille_secondaire_lot1.sql` | catalogue, vue, clé à 3 args, `p_secteur` sur 4 RPC (DROP + CREATE), données |
| M2 | `20260918165007_rseq_sync_runs_mode.sql` | journal : `mode` (sans défaut) + `detail` |
| M3 | `20260918171403_rseq_apply_games_matchs_partages.sql` | matchs inter-sections (CREATE OR REPLACE) |
| F | `supabase/functions/rseq-weekly-sync/index.ts` (+ `_shared/rseqWhitelist.ts`, inchangé) | v6 → v7 |
| M4 | `20260918172143_rseq_cron_secteurs.sql` | cron : 1 modifié, 2 ajoutés — **en dernier** |

État de départ relevé le 2026-09-18 (à revérifier au §1) : dernière migration
`20260917203126`, fonction **v6** (`verify_jwt = false`, identique au fichier de
`a0e8aca`), un seul travail cron `rseq-veille-hebdo` `55 7 * * 3` sans
paramètre.

---

## 1. Pré-vol — lecture seule

```sql
-- a) Dernières migrations : rien de plus récent que 20260917203126.
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;

-- b) Signatures d'origine, une par nom.
select p.oid::regprocedure from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('rseq_family_key','rseq_sync_apply_standings','rseq_sync_detect_teams',
                     'rseq_sync_detect_familles','rseq_sync_detect_mapping')
 order by 1;
-- attendu : rseq_family_key(text,text), apply_standings(uuid,uuid,text,jsonb),
--           detect_familles(uuid,text), detect_mapping(uuid,text),
--           detect_teams(uuid,uuid,text,text,jsonb)

-- c) Cron inchangé.
select jobname, schedule, active from cron.job where jobname like 'rseq%';
-- attendu : rseq-veille-hebdo | 55 7 * * 3 | t   (une ligne)

-- d) Aucune passe en cours.
select count(*) from rseq_sync_runs where statut = 'RUNNING';   -- attendu 0

-- e) Préconditions que M1 vérifie aussi (gate bloc 0) — mieux vaut le savoir avant.
select type, count(*) from rseq_sync_alerts
 where type in ('CHANGEMENT_DIVISION','FAMILLE_ATTENDUE_ABSENTE') group by 1;   -- attendu 0 ligne
```

Et `list_edge_functions` : `rseq-weekly-sync` en **version 6**.

**Un écart = on s'arrête**, on instruit, on ne force pas.

---

## 2. Migrations M1 → M3 — une par une

Via `apply_migration` (MCP), **chacune séparément**, le contenu exact du
fichier. Chaque migration porte ses gates et lève si un seul échoue — la
transaction est alors annulée en entier.

| Ordre | Nom MCP | NOTICE attendue |
|---|---|---|
| M1 | `rseq_veille_secondaire_lot1` | `NEXUS lot1 : gates OK — … veille (67 familles : 22 collegiales, 45 secondaires) …` |
| M2 | `rseq_sync_runs_mode` | (aucune ; le gate ne lève pas) |
| M3 | `rseq_apply_games_matchs_partages` | `NEXUS: apply_games — garde des matchs partages en place (5), ACL {postgres,service_role}` |

Le chiffre 67 / 45 dépend des matchs secondaires 2025-2026 en prod : 45
familles relevées le 2026-09-18. Un autre total n'est pas une erreur en soi —
le gate de cohérence, lui, doit passer.

⚠️ **À partir de M1, la v6 ne fonctionne plus** (signatures supprimées). Enchaîner
sur l'étape 3 sans pause.

Contrôle :

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;
```

**Noter les 3 versions assignées par MCP** : elles servent au §7 pour renommer
les fichiers.

---

## 3. Déploiement de la fonction (v7)

Depuis la racine du dépôt, sur la branche `feat/rseq-veille-secondaire` :

```powershell
npx supabase functions deploy rseq-weekly-sync --project-ref nrloizyemulbhujrqhgx --no-verify-jwt
```

`--no-verify-jwt` est **obligatoire** : l'appelant est pg_cron, sans JWT (v6
tourne en `verify_jwt = false`). Contrôle : `list_edge_functions` →
`rseq-weekly-sync` **version 7**, `verify_jwt: false`.

---

## 4. Recette en prod — dans cet ordre

Toutes les invocations passent **par la base** (`net.http_post` + Vault) : le
secret ne quitte jamais la prod. Mode cron (réponse 202) + lecture du journal —
**jamais `?wait=1`** en prod (coupé à 150 s, prouvé en recette locale).

Gabarit d'invocation (remplacer `<QUERY>`) :

```sql
select net.http_post(
  url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync<QUERY>',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-rseq-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'RSEQ_SYNC_SECRET')),
  body := '{}'::jsonb,
  timeout_milliseconds := 5000);
```

Lecture de la réponse HTTP (id rendu par l'appel) :

```sql
select status_code, left(content, 200) from net._http_response where id = <id>;
```

### 4a. Refus — aucune écriture attendue

| `<QUERY>` | Attendu |
|---|---|
| *(vide)* | 400 `?secteur= obligatoire` |
| `?secteur=Coll%C3%A9gial&mode=decouverte` | 400 |

### 4b. Passe COLLÉGIALE — le point qui ne doit pas casser

`<QUERY>` = `?secteur=Coll%C3%A9gial` → 202. Attendre ~40 s puis :

```sql
select statut, round(extract(epoch from finished_at - started_at)) s, ligues_visees, ligues_ok, ligues_ko,
       matchs_vus, matchs_inseres, matchs_maj, classements_maj, alertes_levees, erreurs
  from rseq_sync_runs where mode = 'passe' and secteur = 'Collégial' order by started_at desc limit 1;
```

Attendu : **`DONE`, 38/38, 0 erreur, ~2 363 matchs vus**, insertions et mises à
jour de l'ordre d'une passe du mercredi (quelques dizaines), alertes faibles.
Et le classement garde son secteur :

```sql
select secteur, count(*) from rseq_standings group by 1;   -- Collégial seul à ce stade
```

**Si 4b échoue → §6 (retour arrière), sans aller plus loin.**

### 4c. Découverte

`<QUERY>` = `?mode=decouverte&secteur=Secondaire` → 202. Attendre ~3 min :

```sql
select statut, ligues_visees, ligues_ok, ligues_ko, detail, erreurs
  from rseq_sync_runs where mode = 'decouverte' order by started_at desc limit 1;
select secteur, count(*) from rseq_ligues_publiees group by 1;
```

Attendu (local, 2026-09-18) : `DONE`, **~185 ligues secondaires**, ~195 appels,
0 en échec, 9 hors secteur (primaire).

### 4d. Passe SECONDAIRE

`<QUERY>` = `?secteur=Secondaire` → 202. Attendre ~2 min 30 s :

```sql
select statut, round(extract(epoch from finished_at - started_at)) s, ligues_visees, ligues_ok, ligues_ko,
       matchs_vus, matchs_inseres, matchs_maj, classements_inseres, alertes_levees, erreurs
  from rseq_sync_runs where mode = 'passe' and secteur = 'Secondaire' order by started_at desc limit 1;

select secteur, count(*), count(distinct rseq_league_id) from rseq_standings group by 1;

select type, count(*) from rseq_sync_alerts a join rseq_sync_runs r on r.id = a.run_id
 where r.secteur = 'Secondaire' group by 1 order by 1;
```

Attendu (projection sur les tables prod, 2026-09-18) :

| | Attendu |
|---|---|
| Statut | `DONE`, ~165/165, ~2 min 20 s |
| Matchs vus | ~3 900 |
| Classements | secteur **`Secondaire`** sur ~165 ligues |
| `NOUVELLES_EQUIPES` | **~17** (753 équipes, 695 à école prouvée) |
| `MATCH_RETIRE` | **~21** ponctuels, 0 retrait de masse |
| `FAMILLE_ATTENDUE_ABSENTE` | **2** (balle molle D3, baseball D3) |
| `MAPPING_DERIVE` | **0** |
| `CHANGEMENT_DIVISION` | 0 |

Au premier passage, `matchs_maj` peut être élevé : les 872 matchs secondaires
chargés en juillet sont revus, et les matchs inter-sections sont rattachés
une fois à leur ligue d'origine. **La passe du mercredi suivant doit tomber à
~0 mise à jour hors vrais changements.**

Un écart d'un ordre de grandeur sur les alertes (des centaines) = on
s'arrête et on instruit avant le §5. Les passes restent manuelles tant que le
cron n'est pas posé.

---

## 5. Cron (M4) — en dernier

`apply_migration` nom `rseq_cron_secteurs`, contenu de
`20260918172143_rseq_cron_secteurs.sql`. NOTICE attendue :

```
NEXUS lot3 : 3 travaux RSEQ conformes — {"rseq-decouverte-secondaire|55 7 * * 2|t|?mode=decouverte&secteur=Secondaire",
  "rseq-veille-hebdo|55 7 * * 3|t|?secteur=Coll%C3%A9gial","rseq-veille-secondaire|10 8 * * 3|t|?secteur=Secondaire"}
```

`rseq-veille-hebdo` garde son nom et son horaire ; seule son URL gagne
`?secteur=Coll%C3%A9gial`. **Sans M4, le mercredi suivant la passe collégiale
est refusée (400)** — `?secteur=` n'a pas de défaut (décision BP 2026-09-18).

---

## 6. Retour arrière — si 4b échoue, ou si le collégial est touché

Objectif : rendre la veille collégiale à son état d'avant **avant le mercredi**.

1. SQL : `apply_migration` nom `rseq_veille_secondaire_retour_arriere`, contenu
   de **`docs/rseq-veille-secondaire-retour-arriere.sql`** (une transaction,
   gates en fin). NOTICE attendue :
   `RETOUR ARRIERE : gates OK — signatures, ACL, vue collegiale (38 ligues), veille (22 familles), cron d'origine`.
   Il retire aussi les deux travaux cron ajoutés et rend à `rseq-veille-hebdo`
   son URL sans paramètre, si M4 était passée.
2. Fonction : redéployer **v6 à l'identique** (vérifié le 2026-09-18 : la v6 en
   prod = le fichier de `a0e8aca`, md5 identique) :
   ```powershell
   git checkout a0e8aca -- supabase/functions/rseq-weekly-sync/index.ts
   npx supabase functions deploy rseq-weekly-sync --project-ref nrloizyemulbhujrqhgx --no-verify-jwt
   git checkout HEAD -- supabase/functions/rseq-weekly-sync/index.ts
   ```
3. Preuve : passe collégiale **sans paramètre** (`<QUERY>` vide, l'ancienne
   fonction n'en prend pas) → `DONE`, 38/38.

Restent en place, inertes pour la v6 : le catalogue, `rseq_decouverte_upsert`,
le correctif des matchs partagés (neutre pour le collégial, prouvé 0/0/0), les
colonnes `secteur` / `mode` / `detail`, et les alertes secondaires déjà levées.

Testé le 2026-09-18 en local dans une transaction annulée : gates verts, base
inchangée ensuite. **Non testé de bout en bout** (la v6 n'a pas été rejouée
contre une base revenue en arrière) : les définitions restaurées sont celles
de la prod, md5 vérifiés.

---

## 7. Après — dépôt

1. Renommer M1–M4 selon les versions **réellement assignées par MCP** (§2, §5)
   et le noter en tête de chaque fichier (« APPLIQUÉE en PROD le … »), comme
   pour `20260917203126`.
2. Commit sur la branche, puis fusion dans `main` (BP). Aucun code applicatif
   dans ce chantier : le déploiement Vercel déclenché par la fusion ne change
   rien au web.
3. Mercredi suivant : lire les trois journaux (`mode`, `secteur`, `statut`) et
   vérifier que la passe secondaire retombe à ~0 mise à jour.
