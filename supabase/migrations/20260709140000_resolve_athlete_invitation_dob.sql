-- resolve_athlete_invitation + date_naissance : expose la DOB de l'orphelin au
-- SignupClaim (anon, RLS bloque la lecture directe → la seule voie est la RPC,
-- gardée par le token). La DOB devient la source de vérité pré-remplie +
-- verrouillée sur les 3 écrans du flux claim.
--
-- 🔒 Loi 25 / PII : la PII du mineur (email, nom, date_naissance) ne transite
-- QUE si le token est VALIDE (PENDING + non-expiré + user_id NULL). Token mort
-- (expiré/consommé/déjà réclamé) → is_valid=false + PII NULL. Token inexistant
-- → aucune row. Ça ferme aussi la fuite préexistante nom/email.
--
-- Changement du RETURNS TABLE (ajout d'une colonne) → DROP + CREATE (impossible
-- via CREATE OR REPLACE). Idempotent. Un seul appelant (app/claim/page.tsx).

drop function if exists public.resolve_athlete_invitation(text);

create or replace function public.resolve_athlete_invitation(p_token text)
returns table(
  athlete_id     uuid,
  email          text,
  first_name     text,
  last_name      text,
  date_naissance date,
  status         text,
  expires_at     timestamp with time zone,
  is_valid       boolean
)
language plpgsql
security definer
set row_security to 'off'
set search_path to 'public'
as $function$
declare
  v_ai    record;
  v_a     record;
  v_valid boolean;
begin
  select * into v_ai from public.athlete_invitations where token = p_token limit 1;
  if not found then
    return;                                    -- token inexistant → AUCUNE row
  end if;

  select * into v_a from public.athletes where id = v_ai.athlete_id;
  v_valid := (v_ai.status = 'PENDING' and v_ai.expires_at > now() and v_a.user_id is null);

  -- PII (email, nom, DOB) SEULEMENT si le token est valide ; sinon NULL.
  return query select
    v_a.id,
    case when v_valid then v_a.email          else null end,
    case when v_valid then v_a.first_name     else null end,
    case when v_valid then v_a.last_name      else null end,
    case when v_valid then v_a.date_naissance else null end,
    v_ai.status,
    v_ai.expires_at,
    v_valid;
end;
$function$;

grant execute on function public.resolve_athlete_invitation(text) to anon, authenticated;
