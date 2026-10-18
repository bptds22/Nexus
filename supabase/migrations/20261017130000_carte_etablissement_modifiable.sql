-- Carte prospect : l'ÉTABLISSEMENT (école / club) devient modifiable — 1.4.5, demande BP.
--
-- Avant : le trigger cartes_prospect_avant_update « figeait » school_id — l'établissement ne
-- suivait QUE l'équipe (« Préciser l'équipe »). Une carte créée sans équipe (établissement sans
-- équipe de ce sport) ne pouvait donc jamais corriger son école ou son club.
--
-- Après (le reste du corps est INCHANGÉ, octet pour octet) :
--  · carte AVEC équipe : l'établissement suit toujours l'équipe. Changer school_id seul est refusé
--    (« l'établissement suit l'équipe — change l'équipe ») ; changer l'équipe est déjà permis.
--  · carte SANS équipe : school_id peut changer. Mêmes gardes qu'à la création : l'établissement
--    existe, et il n'a PAS d'équipe du sport de l'athlète (sinon « choisis-la »).
--  · le sport de l'athlète, l'unité, le créateur, la fusion : toujours figés.
-- Seule l'unité propriétaire écrit (cartes_update / acces_carte_ecriture, inchangé). Une carte
-- FUSIONNÉE avec un vrai athlète est masquée et non écrivable pour tous (cartes_non_fusionnees,
-- lot E) ; ce trigger n'écrit jamais dans athletes.
--
-- Garde : empreinte md5 du corps RÉEL en prod (relevée le 2026-10-17, sans commentaires :
-- 90b07925…), pas celle du texte d'une migration.
-- Rollback : supabase/rollback/20261017130000_rollback_carte_etablissement_modifiable.sql

do $$
begin
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure('public.cartes_prospect_avant_update()'))
       is distinct from '90b079257971091e31a03f366cbf5aed' then
    raise exception 'NEXUS: cartes_prospect_avant_update ne correspond pas au corps relevé en prod — ne pas écraser une version inconnue';
  end if;
end $$;

-- ACL relevée AVANT (CLAUDE.MD : comparer la liste complète avant/après un remplacement).
create temp table _acl_avant on commit drop as
  select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
    from pg_proc pr, lateral unnest(pr.proacl::text[]) as x
   where pr.oid = 'public.cartes_prospect_avant_update()'::regprocedure;

create or replace function public.cartes_prospect_avant_update()
returns trigger language plpgsql security definer set search_path = public as $$
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
    -- L'invitation n'est posée que par l'edge function (service_role).
    new.invitee_le := old.invitee_le;
  end if;
  new.derniere_activite := now();
  new.etape_le := case when new.etape is distinct from old.etape then now() else old.etape_le end;

  if new.team_id is distinct from old.team_id then
    if new.team_id is null then
      raise exception 'NEXUS: l''équipe est obligatoire' using errcode = '23502';
    end if;
    -- « Préciser l'équipe » (sansEquipe → une équipe du MÊME sport que celui
    -- déjà posé à la création) : le sport de l'athlète ne peut plus bouger
    -- après coup, exactement comme l'établissement ne pouvait déjà pas
    -- bouger seul — seule l'équipe en est la source.
    select t.sport_id, t.school_id into v_sport_equipe, v_ecole_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from old.sport_athlete_id then
      raise exception 'NEXUS: l''équipe doit être du sport de l''athlète' using errcode = '22023';
    end if;
    new.school_id := v_ecole_equipe;       -- l'établissement suit l'équipe précisée
    new.sport_athlete_id := old.sport_athlete_id;
  else
    new.sport_athlete_id := old.sport_athlete_id; -- jamais modifié seul
    if new.school_id is distinct from old.school_id then
      -- 1.4.5 : l'établissement d'une carte SANS équipe peut changer (même garde qu'à la création).
      -- Avec une équipe, il suit l'équipe : on change l'équipe, pas l'établissement.
      if old.team_id is not null then
        raise exception 'NEXUS: l''établissement suit l''équipe — change l''équipe' using errcode = '22023';
      end if;
      if new.school_id is null or not exists (select 1 from public.schools s where s.id = new.school_id) then
        raise exception 'NEXUS: l''établissement est obligatoire' using errcode = '23502';
      end if;
      if exists (select 1 from public.teams t where t.school_id = new.school_id and t.sport_id = old.sport_athlete_id) then
        raise exception 'NEXUS: cet établissement a une équipe de ce sport — choisis-la' using errcode = '23502';
      end if;
    end if;
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from new.sport_athlete_id then
      raise exception 'NEXUS: la position doit être du sport de l''athlète' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- GATE — ACL complète, triée, identique à l'avant ; toujours SECURITY DEFINER.
do $$
declare vus text[]; veut text[];
begin
  select array_agg(g order by g) into veut from _acl_avant;
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
