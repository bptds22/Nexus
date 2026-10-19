-- ════════════════════════════════════════════════════════════════════════════
-- Propositions REFUSÉES du PARTENAIRE : les revoir, les proposer de nouveau (BP 2026-10-19 : « j'ai
-- encore pas d'endroit, partenaire ni recruteur, pour revoir mes profils potentiellement sur Nexus
-- mais que j'ai refusés »). Le recruteur l'a depuis 20261019150000 ; ceci est l'équivalent partenaire.
--
-- partenaire_rapprochement_refuser marque la paire ECARTE dans partenaire_prospects_rapprochements ;
-- prospect_partenaire_candidats exclut toute paire décidée sauf CADUC. On ajoute, sans rien modifier :
--   · partenaire_rapprochements_refuses() : les paires ECARTE (refusées par le partenaire) de SES cartes
--     libres et non expirées, avec les MÊMES gardes que partenaire_rapprochements (athlète éligible
--     partenaire, sport concordant, transfert permis) ;
--   · partenaire_rapprochement_reproposer(p_carte, p_athlete) : ECARTE → CADUC sur SA carte. La paire
--     redevient une candidate : elle revient dans partenaire_rapprochements, où Accepter garde sa garde.
--
-- Rollback : supabase/rollback/20261019190000_rollback_partenaire_rapprochements_refuses.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.partenaire_rapprochements_refuses()') is not null
  or to_regprocedure('public.partenaire_rapprochement_reproposer(uuid,uuid)') is not null then
    raise exception 'NEXUS: 20261019190000 déjà appliquée';
  end if;
  if to_regprocedure('public.partenaire_rapprochements()') is null
  or to_regclass('public.partenaire_prospects_rapprochements') is null
  or to_regprocedure('public.prospect_partenaire_sport_concorde(uuid,uuid)') is null
  or to_regprocedure('public.prospect_partenaire_peut_transferer(uuid,uuid)') is null then
    raise exception 'NEXUS: préalables absents (20261018100000)';
  end if;
end $$;

create function public.partenaire_rapprochements_refuses()
returns table (
  carte_id uuid, athlete_id uuid, prenom text, nom text, ecole text, sport text, promotion integer,
  photo_url text, critere text, force text, decide_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select c.id, a.id, a.first_name, a.last_name, s.name, sp.nom, a.annee_diplomation, a.photo_url,
         r.critere, r.force, r.decide_le
    from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
    join public.partenaire_prospects_rapprochements r on r.carte_id = c.id and r.statut = 'ECARTE'
    join public.athletes a on a.id = r.athlete_id
    left join public.schools s on s.id = a.school_id
    left join public.sports sp on sp.id = a.sport_id
   where mp.user_id = auth.uid()
     and c.expire_le > now()
     and c.statut in ('A_ENVOYER', 'ENVOYEE')
     and a.status = 'ACTIF'::public.account_status
     and coalesce(public.is_partner_eligible_athlete(a.id), false)
     and public.prospect_partenaire_sport_concorde(c.sport_id, a.id)
     and public.prospect_partenaire_peut_transferer(c.partner_id, c.sport_id)
   order by r.decide_le desc nulls last
   limit 200
$$;

create function public.partenaire_rapprochement_reproposer(p_carte uuid, p_athlete uuid)
returns boolean
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_n integer;
begin
  if not exists (select 1 from public.partenaire_prospects c
                   join public.media_partners mp on mp.id = c.partner_id
                  where c.id = p_carte and mp.user_id = auth.uid() and c.expire_le > now()) then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  update public.partenaire_prospects_rapprochements
     set statut = 'CADUC', decide_par = auth.uid(), decide_le = now()
   where carte_id = p_carte and athlete_id = p_athlete and statut = 'ECARTE';
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke all on function public.partenaire_rapprochements_refuses() from public, anon, authenticated;
revoke all on function public.partenaire_rapprochement_reproposer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.partenaire_rapprochements_refuses() to authenticated, service_role;
grant execute on function public.partenaire_rapprochement_reproposer(uuid, uuid) to authenticated, service_role;

do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.partenaire_rapprochements_refuses()', array['authenticated','postgres','service_role']),
      ('public.partenaire_rapprochement_reproposer(uuid,uuid)', array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
end $$;
