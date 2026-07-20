-- relax_partner_eligibility_keep_consent
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Assouplit l'éligibilité partenaire : opt-in + (majeur OU consentement parental).
-- Les exigences verified / cote_globale sont retirées ; le consentement reste requis.
create or replace function public.is_partner_eligible_athlete(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select
    a.partner_visibility_opt_in = true
    and (
      extract(year from age(a.date_naissance)) >= 18
      or a.partner_visibility_parental_consent = true
    )
  from public.athletes a
  where a.id = p_athlete_id;
$$;
