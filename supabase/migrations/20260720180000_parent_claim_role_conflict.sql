-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1a (patch collision d'email).
-- claim_parent_invitation :
--   - user authentifié avec un rôle existant ≠ PARENT → 'role_conflict' (aucun write)
--   - rôle = PARENT → ne RÉÉCRIT PAS le rôle, crée parent_athletes seulement
--   - rôle null (edge) → pose PARENT
-- Flow neuf intact : signUp role=PARENT → handle_new_auth_user pose role=PARENT
--   (COALESCE((meta->>'role')::user_role,'ATHLETE')) → on lie sans réécrire.
-- Garde UNIQUE 1-parent/athlète inchangée.
-- ═══════════════════════════════════════════════════════════════

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
  v_role  public.user_role;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select email into v_email from auth.users   where id = v_uid;
  select role  into v_role  from public.users where id = v_uid;

  select * into v_inv from public.parent_invitations where token = p_token for update;
  if v_inv.id is null then              return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_inv.claimed_at is not null then  return jsonb_build_object('ok', false, 'reason', 'already_claimed'); end if;
  if v_inv.expires_at < now() then      return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  if lower(coalesce(v_email,'')) <> lower(v_inv.parent_email) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  -- Collision de rôle : un compte existant d'un autre rôle (athlète/coach/recruteur/…)
  -- ne peut pas devenir parent. AUCUN write.
  if v_role is not null and v_role <> 'PARENT'::public.user_role then
    return jsonb_build_object('ok', false, 'reason', 'role_conflict');
  end if;

  -- Garde 1 parent / athlète.
  if exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_inv.athlete_id) then
    return jsonb_build_object('ok', false, 'reason', 'athlete_already_linked');
  end if;

  -- Rôle : ne RÉÉCRIT PAS si déjà PARENT ; ne pose PARENT que si non défini (edge).
  if v_role is null then
    update public.users set role = 'PARENT', role_claimed_at = now() where id = v_uid;
  end if;

  insert into public.parent_athletes (parent_user_id, athlete_id)
    values (v_uid, v_inv.athlete_id);

  update public.parent_invitations set claimed_at = now() where id = v_inv.id;

  return jsonb_build_object('ok', true, 'athlete_id', v_inv.athlete_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'athlete_already_linked');
end;
$$;
grant execute on function public.claim_parent_invitation(text) to authenticated;
