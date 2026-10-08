# Note pour jeudi 2026-10-15 : équipes proposées par la veille

**Quand :** après la passe `rseq-passe-secondaire-q1`, le mercredi 2026-10-14 à 08:10 UTC (04:10, heure de Montréal).
Les découvertes T1 à T3 (dimanche à mardi, 07:55 UTC) alimentent aussi les alertes.

**Ce que la veille écrit :** des alertes seulement, aucune équipe. Créer une équipe, c'est BP qui le décide, puis un
admin appelle `rseq_creer_equipes_proposees(alertes)`, qui recalcule la proposition au moment de l'appel.

## 0. Point de départ, relevé le 2026-10-08 (lecture seule)

- **32 alertes `NOUVELLES_EQUIPES` OUVERTES**, toutes de la veille **v1** (2026-09-18 → 2026-10-07), soit
  1 955 équipes. Aucune ne porte de clé `proposition` : ce champ n'existe que depuis la v2.
- **1 913** de ces équipes existent déjà en base, créées par les 9 lots du 2026-10-08. Les alertes restent
  OUVERTES parce que personne ne les a closes.
- **42 restent**, avec leur proposition recalculée aujourd'hui :
  - 6 `a_creer`, toutes à **0 côté à relier** (calendrier pas encore publié) ;
  - 31 `ecole_introuvable` ;
  - 5 `sport_absent`.

**Piège à connaître :** la v2 n'ouvre pas de nouvelle alerte pour un `rseq_team_id` déjà présent dans une alerte,
quel que soit son statut. Ces 42 équipes **ne reviendront donc jamais avec une proposition stockée**. La requête
ci-dessous recalcule leur proposition à la volée (`alerte_v1 = true`).

## 1. Lister les propositions (lecture seule)

Une ligne par équipe proposée. Les équipes déjà en base (`deja_en_base`) sont exclues. La fonction
`rseq_proposition_equipe` est STABLE : elle ne peut rien écrire. Il faut l'exécuter en `postgres` (MCP ou CLI
`db query --linked`), parce que `authenticated` n'a pas le droit `EXECUTE` dessus.

```sql
with brut as (
  -- secondaire : une ligne par équipe de l'alerte ; v1 (avant le 2026-10-08) n'a pas de « proposition »
  select a.id as alerte_id, a.type, a.created_at, e->'proposition' as p_stockee,
         (e->>'rseq_team_id')::uuid as rid, nullif(e->>'rseq_institution_id','')::uuid as inst,
         e->>'team_name' as nom, nullif(e->>'rseq_league_id','')::uuid as ligue,
         a.payload->>'saison' as saison, coalesce(a.payload->>'secteur','Secondaire') as secteur
    from public.rseq_sync_alerts a, jsonb_array_elements(a.payload->'equipes') e
   where a.type = 'NOUVELLES_EQUIPES' and a.statut = 'OUVERTE'
  union all
  select a.id, a.type, a.created_at, a.payload->'proposition', null, null, null, null, null, null
    from public.rseq_sync_alerts a
   where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE'
), p as (
  -- proposition RECALCULÉE maintenant quand c'est possible, comme le fera rseq_creer_equipes_proposees
  select alerte_id, type, created_at, (p_stockee is null) as alerte_v1,
         coalesce(case when rid is not null
                       then public.rseq_proposition_equipe(rid, inst, nom, ligue, coalesce(saison, '2026-2027'), secteur) end,
                  p_stockee) as p
    from brut
)
select p->>'decision'               as decision,      -- a_creer | doublon | ecole_introuvable | sport_absent
       p->>'ecole'                  as ecole,
       p->>'sport'                  as sport,
       p->>'age_group'              as categorie,
       p->>'gender'                 as sexe,
       p->>'division'               as division,
       p->>'confiance'              as confiance,     -- « haute (InstitutionId) » ou « introuvable »
       p->>'nom'                    as nom_rseq,
       (p->>'cotes_a_relier')::int  as cotes_a_relier,
       p->>'doublon_team_id'        as doublon_de,
       p->>'saison'                 as saison,
       alerte_v1, alerte_id, type, created_at::date as vue_le
  from p
 where p->>'decision' is distinct from 'deja_en_base'
 order by decision, sport, ecole, categorie, sexe, division;
```

Validée le 2026-10-08 en prod (lecture seule) : 42 lignes, réparties comme au §0.

## 2. Lire le résultat

| décision | sens | que faire |
|---|---|---|
| `a_creer` | école prouvée par InstitutionId, sport connu, aucun doublon | candidate : cocher ou non |
| `doublon` | une équipe de même école + sport + catégorie + division + **sexe** + saison existe déjà | ne pas créer ; voir `doublon_de` (peut-être un `rseq_team_id` à poser, mais c'est une écriture distincte) |
| `ecole_introuvable` | l'InstitutionId RSEQ ne correspond à aucune école Nexus | rien, sauf si BP décide d'insérer l'école (règle Pont RSEQ : GO BP obligatoire) |
| `sport_absent` | sport RSEQ sans correspondance Nexus | rien ; à trancher hors veille |

`cotes_a_relier` donne le nombre de côtés de match que l'équipe relierait. C'est le meilleur indicateur d'utilité :
une proposition à 0 côté ne sert à rien tant que son calendrier n'est pas publié.

## 3. Après la décision de BP (GO requis, non fait ici)

```sql
-- sous le compte admin (is_admin()), avec les identifiants d'alertes retenus :
select public.rseq_creer_equipes_proposees(array['<alerte_id>', ...]::uuid[]);
```

La fonction ne crée que les propositions encore à `a_creer` au moment de l'appel. Elle liste le reste dans la note
de l'alerte (« À trancher par BP ») et écrit une ligne `admin_operations` (`EQUIPES_RSEQ_CREEES`).

**Attention :**
- une alerte `NOUVELLES_EQUIPES` regroupe plusieurs équipes, et la fonction prend des alertes entières, pas des
  équipes. Pour n'en créer qu'une partie, le dire avant l'appel : il faut alors une transaction dédiée ;
- clore les 32 alertes v1 dont les équipes sont déjà en base est aussi une écriture (`statut`), à faire sur GO dans
  une transaction gardée. Recommandé, pour que la liste de jeudi ne mélange pas l'ancien et le neuf.
