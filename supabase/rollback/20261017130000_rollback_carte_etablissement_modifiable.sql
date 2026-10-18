-- Rollback de 20261017130000 : retour EXACT au corps relevé en prod (md5 brut 90b07925…, stocké sans
-- commentaires) — l'établissement redevient figé hors équipe. Aucune donnée touchée.
-- Le corps ci-dessous est recopié octet pour octet de la prod : n'y ajoute AUCUN commentaire, sinon
-- l'empreinte change et la migration 20261017130000 refusera de se réappliquer.
do $$
begin
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure('public.cartes_prospect_avant_update()'))
       is distinct from '38b55d113bd5d27f7cfded1e82f38076' then
    raise exception 'NEXUS: cartes_prospect_avant_update n''est pas la version 20261017130000 — rien à défaire';
  end if;
end $$;

create temp table _acl_avant_rb on commit drop as
  select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
    from pg_proc pr, lateral unnest(pr.proacl::text[]) as x
   where pr.oid = 'public.cartes_prospect_avant_update()'::regprocedure;

create or replace function public.cartes_prospect_avant_update()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_sport_equipe uuid; v_sport_position uuid; v_ecole_equipe uuid;
begin
  new.unite_cegep_id := old.unite_cegep_id;
  new.unite_sport_id := old.unite_sport_id;
  new.cree_par := old.cree_par;
  new.created_at := old.created_at;
  new.updated_at := now();
  if auth.uid() is not null then
    new.modifie_par := auth.uid();
    new.invitee_le := old.invitee_le;
  end if;
  new.derniere_activite := now();
  new.etape_le := case when new.etape is distinct from old.etape then now() else old.etape_le end;

  if new.team_id is distinct from old.team_id then
    if new.team_id is null then
      raise exception 'NEXUS: l''équipe est obligatoire' using errcode = '23502';
    end if;
    select t.sport_id, t.school_id into v_sport_equipe, v_ecole_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from old.sport_athlete_id then
      raise exception 'NEXUS: l''équipe doit être du sport de l''athlète' using errcode = '22023';
    end if;
    new.school_id := v_ecole_equipe;
    new.sport_athlete_id := old.sport_athlete_id;
  else
    new.school_id := old.school_id;
    new.sport_athlete_id := old.sport_athlete_id;
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from new.sport_athlete_id then
      raise exception 'NEXUS: la position doit être du sport de l''athlète' using errcode = '22023';
    end if;
  end if;
  return new;
end $function$;

-- GATE — corps de la prod rétabli, ACL complète triée identique, toujours SECURITY DEFINER.
do $$
declare vus text[]; veut text[];
begin
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.cartes_prospect_avant_update()'::regprocedure)
       is distinct from '90b079257971091e31a03f366cbf5aed' then
    raise exception 'NEXUS: cartes_prospect_avant_update ne revient pas au corps de la prod';
  end if;
  select array_agg(g order by g) into veut from _acl_avant_rb;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.cartes_prospect_avant_update()'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de cartes_prospect_avant_update = %, attendu %', vus, veut;
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.cartes_prospect_avant_update()'::regprocedure) then
    raise exception 'NEXUS: cartes_prospect_avant_update doit rester SECURITY DEFINER';
  end if;
end $$;
