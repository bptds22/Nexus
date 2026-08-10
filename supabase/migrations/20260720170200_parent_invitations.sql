-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1a. Migration 3/5 : invitations parent (SÉPARÉE
-- de athlete_invitations, jamais réutilisée). Token serveur, résolution +
-- claim via RPC SECURITY DEFINER uniquement — aucune lecture client directe.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.parent_invitations (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  parent_email text not null,
  expires_at   timestamptz not null default (now() + interval '30 days'),
  claimed_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Une seule invitation NON-claimée par athlète.
create unique index if not exists parent_invitations_one_pending
  on public.parent_invitations(athlete_id) where claimed_at is null;

alter table public.parent_invitations enable row level security;
-- AUCUNE policy → aucune lecture/écriture client directe. Tout passe par les RPC.

-- ── Résolution anonyme du token (pré-remplissage email sur /parent/claim). ──
-- Modèle resolve_athlete_invitation : ne renvoie que le strict nécessaire, et
-- refuse déjà-claimé / expiré / athlète déjà lié.
create or replace function public.resolve_parent_invitation(p_token text)
returns table (valid boolean, reason text, parent_email text, athlete_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_inv public.parent_invitations;
begin
  select * into v_inv from public.parent_invitations where token = p_token;
  if v_inv.id is null then
    return query select false, 'not_found', null::text, null::uuid; return;
  end if;
  if v_inv.claimed_at is not null then
    return query select false, 'already_claimed', null::text, null::uuid; return;
  end if;
  if v_inv.expires_at < now() then
    return query select false, 'expired', null::text, null::uuid; return;
  end if;
  if exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_inv.athlete_id) then
    return query select false, 'athlete_already_linked', null::text, null::uuid; return;
  end if;
  return query select true, 'ok', v_inv.parent_email, v_inv.athlete_id;
end;
$$;
grant execute on function public.resolve_parent_invitation(text) to anon, authenticated;

-- Défensif : garantit la colonne que le claim stampe (présente en prod, absente
-- sur la DB locale désynchronisée). IF NOT EXISTS → no-op sur prod.
alter table public.users add column if not exists role_claimed_at timestamptz;

-- ── Claim : appelé APRÈS création du compte auth (authenticated). Pose le rôle
-- PARENT, insère parent_athletes, marque claimed_at. Refuse si l'athlète a déjà
-- un parent (garde 1:1) ou si l'email du compte ≠ email invité. ──
create or replace function public.claim_parent_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_inv   public.parent_invitations;
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select email into v_email from auth.users where id = v_uid;

  select * into v_inv from public.parent_invitations where token = p_token for update;
  if v_inv.id is null then      return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_inv.claimed_at is not null then return jsonb_build_object('ok', false, 'reason', 'already_claimed'); end if;
  if v_inv.expires_at < now() then     return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  -- L'email du compte doit correspondre à l'email invité (champ non-modifiable côté UI).
  if lower(coalesce(v_email,'')) <> lower(v_inv.parent_email) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  -- Garde 1 parent / athlète.
  if exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_inv.athlete_id) then
    return jsonb_build_object('ok', false, 'reason', 'athlete_already_linked');
  end if;

  update public.users
     set role = 'PARENT', role_claimed_at = now()
   where id = v_uid;

  insert into public.parent_athletes (parent_user_id, athlete_id)
    values (v_uid, v_inv.athlete_id);

  update public.parent_invitations set claimed_at = now() where id = v_inv.id;

  return jsonb_build_object('ok', true, 'athlete_id', v_inv.athlete_id);
exception when unique_violation then
  -- course : un autre claim a lié l'athlète entre-temps.
  return jsonb_build_object('ok', false, 'reason', 'athlete_already_linked');
end;
$$;
grant execute on function public.claim_parent_invitation(text) to authenticated;
