-- Rollback de 20260929151022_retrait_partenaires_mineur_notifie.
-- Fonctions et trigger NOUVEAUX : rien à restaurer, on les retire. Effet :
-- plus de courriel au parent quand l'enfant retire, et l'écran des paramètres
-- ne sait plus afficher « Retiré le … » (il retombe sur l'état simple).
drop trigger if exists trg_notify_parent_retrait_partenaires on public.consent_audit_trail;
drop function if exists public.notify_parent_retrait_partenaires();
drop function if exists public.my_partner_visibility_state();

do $$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('notify_parent_retrait_partenaires','my_partner_visibility_state'))
     or exists (select 1 from pg_trigger where tgname = 'trg_notify_parent_retrait_partenaires') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS: retrait-notifié retiré';
end $$;
