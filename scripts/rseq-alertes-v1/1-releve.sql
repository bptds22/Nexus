-- Relevé (lecture seule) : alertes NOUVELLES_EQUIPES ouvertes, équipes présentes / attendues.
with e as (
  select a.id, a.cle, x->>'rseq_team_id' as rid
    from public.rseq_sync_alerts a, jsonb_array_elements(a.payload->'equipes') x
   where a.statut = 'OUVERTE' and a.type = 'NOUVELLES_EQUIPES'),
p as (
  select e.id, e.cle, count(*) as n, count(t.id) as presentes
    from e left join public.teams t on t.rseq_team_id::text = e.rid
   group by 1, 2)
select case when presentes = n then 'A_CLORE' else 'A_GARDER' end as decision, id, cle, n, presentes
  from p order by 1, cle;
