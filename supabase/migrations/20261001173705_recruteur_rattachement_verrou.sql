-- 20261001173705_recruteur_rattachement_verrou (appliquée en prod le 2026-10-01, 17:37 UTC)
-- ════════════════════════════════════════════════════════════════════════════
-- RISQUE 2 — UN RECRUTEUR NE CHANGE PLUS LUI-MÊME DE CÉGEP NI DE SPORT
-- (GO BP 2026-10-01 ; docs/security-users-school-id-privilege-escalation-20260821.md).
--
-- Constat : la policy `users update own` épinglait role, status,
-- is_platform_admin, context et is_school_admin — PAS school_id ni sport. Un
-- recruteur Pro entrait dans l'unité (et le tableau blanc) de n'importe quel
-- cégep par un simple UPDATE de sa propre ligne.
--
-- Correctif :
--   · recruteur_rattachement_inchange(school_id, sport, sport_id) — vrai si
--     l'appelant n'est pas recruteur, OU si son onboarding n'est pas terminé
--     (choisir son cégep EST le geste d'inscription), OU si les trois valeurs
--     sont inchangées. Ajouté au WITH CHECK de `users update own`.
--   · changer_rattachement_recruteur(user, cégep, sport) — la seule porte :
--     admin plateforme (consigné dans admin_operations) ou soi-même PENDANT
--     l'onboarding. Cégep de type CEGEP, sport connu (sinon pas d'unité).
--   · Inchangés : `admins update all` (l'admin plateforme reste permis),
--     finish_recruiter_onboarding (SECURITY DEFINER, onboarding), les autres
--     rôles (coach, athlète…).
--
-- Rollback : supabase/rollback/20261001173705_rollback_recruteur_rattachement_verrou.sql
-- ════════════════════════════════════════════════════════════════════════════

create function public.recruteur_rattachement_inchange(p_school_id uuid, p_sport text, p_sport_id uuid)
returns boolean
language sql stable security definer
set row_security = off
set search_path = public
as $$
  select exists (
    select 1 from public.users u
     where u.id = auth.uid()
       and (u.role is distinct from 'RECRUTEUR'::public.user_role
            or not coalesce(u.onboarding_complete, false)
            or (u.school_id is not distinct from p_school_id
                and u.sport is not distinct from p_sport
                and u.sport_id is not distinct from p_sport_id))
  );
$$;

-- La policy : même USING, WITH CHECK resserré d'une condition.
drop policy "users update own" on public.users;
create policy "users update own" on public.users
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and public.user_privileged_cols_unchanged(role, status, is_platform_admin, context, is_school_admin)
    and public.recruteur_rattachement_inchange(school_id, sport, sport_id)
  );

-- La porte unique. Rend le nouveau sport_id (dérivé par trg_users_sport_id).
create function public.changer_rattachement_recruteur(p_user uuid, p_school_id uuid, p_sport text)
returns uuid
language plpgsql security definer
set row_security = off
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_cible record;
  v_sport_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  select id, role, onboarding_complete, school_id, sport, sport_id into v_cible
    from public.users where id = p_user for update;
  if v_cible.id is null or v_cible.role is distinct from 'RECRUTEUR'::public.user_role then
    raise exception 'NEXUS: recruteur introuvable' using errcode = '22023';
  end if;
  if not v_admin and not (p_user = auth.uid() and not coalesce(v_cible.onboarding_complete, false)) then
    raise exception 'NEXUS: pour changer de cégep ou de sport, écris à info@nexussports.ca' using errcode = '42501';
  end if;
  if p_school_id is null or not exists (select 1 from public.schools s where s.id = p_school_id and s.type = 'CEGEP') then
    raise exception 'NEXUS: cégep inconnu' using errcode = '22023';
  end if;
  if p_sport is null or not exists (select 1 from public.sports s where s.nom = btrim(p_sport)) then
    raise exception 'NEXUS: sport inconnu (aucune unité possible)' using errcode = '22023';
  end if;

  update public.users set school_id = p_school_id, sport = btrim(p_sport) where id = p_user
  returning sport_id into v_sport_id;
  if v_sport_id is null then
    raise exception 'NEXUS: le sport n''a pas donné d''unité' using errcode = '22023';
  end if;

  if v_admin then
    insert into public.admin_operations (operation, motif, details, par)
    values ('CHANGEMENT_RATTACHEMENT_RECRUTEUR', 'Cégep ou sport d''un recruteur changé par l''admin plateforme',
            jsonb_build_object('recruteur', p_user,
                               'avant', jsonb_build_object('school_id', v_cible.school_id, 'sport', v_cible.sport),
                               'apres', jsonb_build_object('school_id', p_school_id, 'sport', btrim(p_sport))),
            auth.uid());
  end if;
  return v_sport_id;
end $$;

-- ACL — liste COMPLÈTE triée (CLAUDE.md, 2026-09-07) : anon et PUBLIC retirés.
revoke all on function public.recruteur_rattachement_inchange(uuid, text, uuid) from public, anon;
grant execute on function public.recruteur_rattachement_inchange(uuid, text, uuid) to authenticated;
revoke all on function public.changer_rattachement_recruteur(uuid, uuid, text) from public, anon;
grant execute on function public.changer_rattachement_recruteur(uuid, uuid, text) to authenticated;

do $$
declare r record; vus text[];
begin
  for r in select * from (values
      ('public.recruteur_rattachement_inchange(uuid,text,uuid)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.changer_rattachement_recruteur(uuid,uuid,text)'::regprocedure,  array['authenticated','postgres','service_role'])
    ) as t(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
  if not exists (select 1 from pg_policy where polrelid = 'public.users'::regclass and polname = 'users update own'
                   and pg_get_expr(polwithcheck, polrelid) like '%recruteur_rattachement_inchange%'
                   and pg_get_expr(polwithcheck, polrelid) like '%user_privileged_cols_unchanged%') then
    raise exception 'NEXUS: users update own ne porte pas les deux verrous';
  end if;
end $$;
