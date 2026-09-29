-- Rollback de 20260929150639_roles_figes_parent_partner_admin : rétablit les deux
-- fonctions dans leur état d'avant (logique identique à la prod du 2026-09-29,
-- sans la liste des rôles figés). CREATE OR REPLACE : l'ACL est conservée.
-- ⚠ Rétablit le défaut : un PARENT connecté par Google/Apple repart vers
--   /inscription/role et peut voir son rôle écrasé.

create or replace function public.needs_signup_role()
returns boolean
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.users%rowtype;
begin
  if v_uid is null then
    return false;
  end if;
  select * into v_row from public.users where id = v_uid;
  if not found then
    return false;
  end if;
  if v_row.role_claimed_at is not null then
    return false;
  end if;
  if v_row.onboarding_complete is true then
    return false;
  end if;
  if exists (select 1 from public.athletes where user_id = v_uid) then
    return false;
  end if;
  return true;
end;
$function$;

create or replace function public.claim_signup_role(p_role text, p_context text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_row     public.users%rowtype;
  v_context text := null;
begin
  if v_uid is null then
    raise exception 'claim_signup_role: appel non authentifie' using errcode = '28000';
  end if;
  if p_role is null or p_role not in ('ATHLETE', 'COACH', 'RECRUTEUR') then
    raise exception 'claim_signup_role: role % non autorise (attendu ATHLETE|COACH|RECRUTEUR)', p_role
      using errcode = '22023';
  end if;
  select * into v_row from public.users where id = v_uid for update;
  if not found then
    raise exception 'claim_signup_role: profil introuvable' using errcode = 'P0002';
  end if;
  if v_row.role_claimed_at is not null then
    raise exception 'claim_signup_role: role deja reclame (%) -- immuable', v_row.role_claimed_at
      using errcode = '55000';
  end if;
  if v_row.onboarding_complete is true then
    raise exception 'claim_signup_role: onboarding deja complete -- role fige' using errcode = '55000';
  end if;
  if exists (select 1 from public.athletes where user_id = v_uid) then
    raise exception 'claim_signup_role: fiche athlete existante -- role fige' using errcode = '55000';
  end if;
  if p_role = 'COACH' and p_context in ('scolaire', 'ligue_civile') then
    v_context := p_context;
  elsif p_role = 'RECRUTEUR' then
    v_context := 'collegial';
  end if;
  update public.users
  set    role = p_role::public.user_role, context = coalesce(v_context, context), role_claimed_at = now()
  where  id = v_uid;
  return jsonb_build_object('role', p_role, 'context', v_context, 'claimed_at', now());
end;
$function$;

do $$
declare
  r record;
  vus text[];
begin
  for r in
    select * from (values
      ('public.needs_signup_role()',            array['authenticated','postgres','service_role']),
      ('public.claim_signup_role(text, text)',  array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut;
    end if;
  end loop;
end $$;
