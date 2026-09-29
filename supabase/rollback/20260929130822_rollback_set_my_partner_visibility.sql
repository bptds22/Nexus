-- Rollback de 20260929130822_set_my_partner_visibility (version prod ; écrite
-- sous 20260929034823, renommée après l'apply).
-- La fonction est NOUVELLE : aucun état antérieur à restaurer, on la retire.
-- Effet côté app : /athlete/parametres rend « Erreur lors de la sauvegarde »
-- (RPC introuvable) — c'était déjà le comportement réel avant (UPDATE refusé
-- par la garde de périmètre). Les lignes consent_audit_trail écrites restent :
-- c'est un journal, on ne le réécrit pas.
drop function if exists public.set_my_partner_visibility(boolean, text);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_my_partner_visibility'
               and pronamespace = 'public'::regnamespace) then
    raise exception 'NEXUS: rollback incomplet — set_my_partner_visibility existe encore';
  end if;
  raise notice 'NEXUS: set_my_partner_visibility retirée';
end $$;
