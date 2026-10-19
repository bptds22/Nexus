-- ════════════════════════════════════════════════════════════════════════════
-- Propositions REFUSÉES : les revoir et les proposer de nouveau (BP 2026-10-19 : « comment, si on a
-- refusé, on peut revoir ces suggestions »).
--
-- Jusqu'ici un refus était définitif et invisible : refuser_rapprochement passe la paire à REFUSEE,
-- rapprochements_unite ne rend que PROPOSEE, rapprochement_candidats ne repropose jamais une paire
-- connue. On ajoute, sans rien modifier d'existant :
--   · rapprochements_refuses_unite() : les paires REFUSEE de l'unité (mêmes colonnes que
--     rapprochements_unite + qui a refusé et quand), mêmes gardes (identité, carte non fusionnée) ;
--   · reproposer_rapprochement(p_id) : REFUSEE → PROPOSEE (la proposition revient dans la fenêtre,
--     où l'on peut l'accepter). Même garde d'écriture que le refus.
-- Une paire refusée par « Annuler la fusion » (lot E) apparaît aussi : la reproposer est permis.
--
-- Rollback : supabase/rollback/20261019150000_rollback_rapprochements_refuses.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.reproposer_rapprochement(uuid)') is not null
  or to_regprocedure('public.rapprochements_refuses_unite()') is not null then
    raise exception 'NEXUS: 20261019150000 déjà appliquée';
  end if;
  if to_regclass('public.rapprochements') is null
  or to_regprocedure('public.acces_carte_ecriture(uuid,uuid)') is null
  or to_regprocedure('public.athlete_identity_ok(date,boolean)') is null then
    raise exception 'NEXUS: préalables absents (lot D)';
  end if;
end $$;

create function public.rapprochements_refuses_unite()
returns table (
  id uuid, force text, critere text, promotion_concorde boolean, cree_le timestamptz,
  carte_id uuid, carte_prenom text, carte_nom text, carte_equipe text, carte_ecole text,
  carte_promotion integer, carte_position text, carte_courriel_present boolean,
  athlete_id uuid, athlete_prenom text, athlete_nom text, athlete_ecole text, athlete_equipes text,
  athlete_promotion integer, athlete_position text, athlete_photo_url text,
  decide_le timestamptz, decide_par_nom text
)
language sql stable security definer set search_path = public set row_security = off as $$
  select r.id, r.force, r.critere, r.promotion_concorde, r.cree_le,
         c.id, c.prenom, c.nom, t.name, ts.name, c.promotion, pc.abreviation, c.courriel is not null,
         a.id, a.first_name, a.last_name, sa.name,
         (select string_agg(tt.name, ' · ' order by tt.name) from public.team_athletes ta
            join public.teams tt on tt.id = ta.team_id where ta.athlete_id = a.id),
         a.annee_diplomation, pa.abreviation, a.photo_url,
         r.decide_le, nullif(trim(concat_ws(' ', u.first_name, u.last_name)), '')
    from public.rapprochements r
    join public.cartes_prospect c on c.id = r.carte_id
    join public.athletes a on a.id = r.athlete_id
    left join public.teams t on t.id = c.team_id
    left join public.schools ts on ts.id = coalesce(t.school_id, c.school_id)
    left join public.positions pc on pc.id = c.position_id
    left join public.schools sa on sa.id = a.school_id
    left join public.positions pa on pa.id = a.position_id
    left join public.users u on u.id = r.decide_par
   where r.statut = 'REFUSEE'
     and c.fusionnee_le is null
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
   order by r.decide_le desc nulls last
   limit 200
$$;

create function public.reproposer_rapprochement(p_id uuid)
returns boolean language plpgsql security definer set search_path = public set row_security = off as $$
declare v record;
begin
  select * into v from public.rapprochements where id = p_id for update;
  if not found or not public.acces_carte_ecriture(v.unite_cegep_id, v.unite_sport_id) then
    raise exception 'NEXUS: proposition introuvable' using errcode = '42501';
  end if;
  if v.statut <> 'REFUSEE' then return false; end if;
  update public.rapprochements set statut = 'PROPOSEE', decide_par = auth.uid(), decide_le = now() where id = p_id;
  return true;
end $$;

revoke all on function public.rapprochements_refuses_unite() from public, anon, authenticated;
revoke all on function public.reproposer_rapprochement(uuid) from public, anon, authenticated;
grant execute on function public.rapprochements_refuses_unite() to authenticated, service_role;
grant execute on function public.reproposer_rapprochement(uuid) to authenticated, service_role;

do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.rapprochements_refuses_unite()', array['authenticated','postgres','service_role']),
      ('public.reproposer_rapprochement(uuid)', array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
end $$;
