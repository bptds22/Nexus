-- Rollback de 20260929035825_relance_partenaires_parents.
-- ⚠ Détruit le journal des envois, les jetons et le registre de
-- désabonnement des parents. Les réponses des parents RESTENT dans
-- consent_audit_trail (journal de consentement, jamais réécrit) — c'est pour
-- ça que la contrainte d'action garde 'REFUSED' si des lignes l'utilisent.
drop function if exists public.parent_desabonner(uuid, text);
drop function if exists public.consentement_partenaire_par_jeton(text, boolean, text, text);
drop function if exists public.consentement_partenaire_jeton_etat(text);
drop function if exists public.relance_partenaires_reserver(uuid, text);
drop function if exists public.relance_partenaires_cibles(text);
drop function if exists public.courriel_sha256(text);
drop table if exists public.consentement_partenaire_jetons;
drop table if exists public.relances_partenaires;
drop table if exists public.parent_courriel_desabonnements;

do $$
begin
  if not exists (select 1 from public.consent_audit_trail where action = 'REFUSED') then
    alter table public.consent_audit_trail drop constraint consent_audit_trail_action_check;
    alter table public.consent_audit_trail add constraint consent_audit_trail_action_check
      check (action = any (array['ATTESTED','WITHDRAWN','EXPIRED','PDF_DOWNLOADED','PDF_UPLOADED','GRANTED']));
    raise notice 'NEXUS: contrainte d''action restaurée à l''identique';
  else
    raise notice 'NEXUS: des refus sont journalisés — contrainte élargie CONSERVÉE (le journal ne se réécrit pas)';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('parent_desabonner','consentement_partenaire_par_jeton','consentement_partenaire_jeton_etat',
                               'relance_partenaires_reserver','relance_partenaires_cibles','courriel_sha256')) then
    raise exception 'NEXUS: rollback incomplet';
  end if;
end $$;
