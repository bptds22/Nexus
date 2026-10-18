-- Rollback de 20261017130000 : retour EXACT au corps relevé (20261005192511) — l'établissement
-- redevient figé hors équipe. Aucune donnée touchée.
do $$
begin
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure('public.cartes_prospect_avant_update()'))
       is distinct from '38b55d113bd5d27f7cfded1e82f38076' then
    raise exception 'NEXUS: cartes_prospect_avant_update n''est pas la version 20261017130000 — rien à défaire';
  end if;
end $$;

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
    new.school_id := old.school_id;             -- jamais modifié seul
    new.sport_athlete_id := old.sport_athlete_id; -- jamais modifié seul
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from new.sport_athlete_id then
      raise exception 'NEXUS: la position doit être du sport de l''athlète' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
