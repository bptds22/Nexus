-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK du lot B1 cégep (20261022190000_cegep_lot_b1_porte_coach.sql).
-- Retire les 6 triggers, la fonction de trigger, la fonction de contrôle, la liste d'attente
-- (⚠ ses lignes sont perdues) et remet consume_invitation_token (md5 0fb9444467a2754217a4c2f4390debc8)
-- et backfill_athletes_on_coach_join (md5 9344f99399ea5d3fa5c24c65da64f743) sur leur corps prod
-- À L'OCTET, ACL inchangées.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.porte_coach_cegep()') is null then
    raise exception 'NEXUS: lot B1 absent — rien à défaire';
  end if;
end $$;

create temp table _b1r_acl_avant as
select pr.oid::regprocedure::text as sig, coalesce(array_agg(t.g order by t.g), '{}') as acl
  from pg_proc pr,
       lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                  from unnest(pr.proacl::text[]) as x) t
 where pr.oid in ('public.consume_invitation_token(text,uuid)'::regprocedure,
                  'public.backfill_athletes_on_coach_join()'::regprocedure)
 group by pr.oid;

drop trigger trg_porte_coach_cegep on public.users;
drop trigger trg_porte_coach_cegep on public.school_coaches;
drop trigger trg_porte_coach_cegep on public.team_coaches;
drop trigger trg_porte_coach_cegep on public.teams;
drop trigger trg_porte_coach_cegep on public.admin_claims;
drop trigger trg_porte_coach_cegep on public.athletes;
drop function public.porte_coach_cegep();

CREATE OR REPLACE FUNCTION public.consume_invitation_token(p_token text, p_new_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_id uuid;
  v_school_id uuid;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller != p_new_user_id THEN
    RAISE EXCEPTION 'consume_invitation_token: cannot consume for another user';
  END IF;

  UPDATE public.invitations
  SET
    status = 'CONSUMED',
    consumed_by_user_id = p_new_user_id,
    consumed_at = now()
  WHERE token = p_token
    AND status = 'PENDING'
    AND expires_at > now()
  RETURNING id, school_id INTO v_invitation_id, v_school_id;

  IF v_school_id IS NOT NULL THEN
    UPDATE public.users
    SET school_id = v_school_id
    WHERE id = p_new_user_id;
  END IF;

  RETURN v_invitation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.backfill_athletes_on_coach_join()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE athletes
  SET coach_id = NEW.id
  WHERE school_id = NEW.school_id AND coach_id IS NULL;
  RETURN NEW;
END;
$function$;

drop function public.inscrire_liste_attente_collegiale(text);
drop table public.liste_attente_gestion_collegiale;
drop function public.ecole_ouverte_aux_coachs(uuid);

do $$
declare vus text[]; r record;
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.consume_invitation_token(text,uuid)'::regprocedure)
     is distinct from '0fb9444467a2754217a4c2f4390debc8' then
    raise exception 'NEXUS: consume_invitation_token pas revenu au corps prod';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.backfill_athletes_on_coach_join()'::regprocedure)
     is distinct from '9344f99399ea5d3fa5c24c65da64f743' then
    raise exception 'NEXUS: backfill_athletes_on_coach_join pas revenu au corps prod';
  end if;
  for r in select * from _b1r_acl_avant loop
    select coalesce(array_agg(t.g order by t.g), '{}') into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, r.acl;
    end if;
  end loop;
  if exists (select 1 from pg_trigger where tgname = 'trg_porte_coach_cegep')
     or to_regprocedure('public.ecole_ouverte_aux_coachs(uuid)') is not null
     or to_regprocedure('public.inscrire_liste_attente_collegiale(text)') is not null
     or to_regclass('public.liste_attente_gestion_collegiale') is not null then
    raise exception 'NEXUS: objet du lot B1 encore présent';
  end if;
end $$;

drop table _b1r_acl_avant;
