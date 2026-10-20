-- ════════════════════════════════════════════════════════════════════════════
-- 20261019230000 — Demande d'accès à ses données (Loi 25, droit d'accès) : un vrai chemin.
--
-- Le bouton « Demander » des paramètres recruteur insérait dans admin_notifications —
-- table sous RLS SANS policy (20261002131439) : le refus était systématique, avalé, et
-- l'écran annonçait « Votre demande a été envoyée ». Aucune demande n'a jamais été reçue.
-- (Relevé 2026-10-19, audit « Mis à jour sans vérifier l'erreur ».)
--
-- Désormais : demander_acces_mes_donnees() inscrit la demande au registre que l'admin
-- traite déjà (loi25_portability_requests, onglet Portabilité de /admin/loi25), type
-- 'access' ; l'échéance (deadline = submitted_at + 30, colonne générée) suit d'elle-même.
-- Une demande encore ouverte n'est pas dupliquée.
-- Rollback : supabase/rollback/20261019230000_rollback_demande_acces_donnees.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.demander_acces_mes_donnees()') is not null then
    raise exception 'NEXUS: 20261019230000 déjà appliquée';
  end if;
  if to_regclass('public.loi25_portability_requests') is null then
    raise exception 'NEXUS: loi25_portability_requests absente';
  end if;
end $$;

create function public.demander_acces_mes_donnees()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_uid  uuid := auth.uid();
  v_u    public.users;
  v_r    public.loi25_portability_requests;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select * into v_u from public.users where id = v_uid;
  if v_u.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select * into v_r from public.loi25_portability_requests
   where user_id = v_uid and request_type = 'access' and status in ('pending', 'in_progress')
   order by created_at desc limit 1;
  if v_r.id is not null then
    return jsonb_build_object('ok', true, 'deja', true, 'echeance', v_r.deadline);
  end if;

  insert into public.loi25_portability_requests
    (user_id, requester_name, requester_email, request_type, status, notes, created_by)
  values (
    v_uid,
    coalesce(nullif(btrim(concat_ws(' ', v_u.first_name, v_u.last_name)), ''), v_u.email),
    v_u.email,
    'access',
    'pending',
    'Demandée par l''usager depuis ses paramètres.',
    v_uid)
  returning * into v_r;
  return jsonb_build_object('ok', true, 'deja', false, 'echeance', v_r.deadline);
end $$;

revoke all on function public.demander_acces_mes_donnees() from public, anon;
grant execute on function public.demander_acces_mes_donnees() to authenticated, service_role;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.demander_acces_mes_donnees()'::regprocedure;
  if vus is distinct from array['authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL public.demander_acces_mes_donnees() = %', vus;
  end if;
end $$;
