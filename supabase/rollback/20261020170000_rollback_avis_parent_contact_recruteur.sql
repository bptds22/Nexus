-- Rollback de 20261020170000_avis_parent_contact_recruteur.
--
-- Retire les triggers, le cron et les fonctions : plus aucun avis ne part.
-- GARDÉS, volontairement (aucun DELETE) :
--   · parent_contact_avis et ses lignes — le journal de ce qui est parti ;
--   · le CHECK élargi de parent_notifications — les notifications
--     CHILD_RECRUITER_CONTACT déjà écrites restent valides et visibles.
-- Une ré-application après ce rollback est possible (table IF NOT EXISTS).

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_aviser_parent_contact') then
    raise exception 'NEXUS: 20261020170000 absente (trg_aviser_parent_contact introuvable)';
  end if;
end $$;

drop trigger trg_aviser_parent_contact on public.messages;
drop trigger trg_parent_contact_reclamation on public.parent_athletes;
drop trigger trg_parent_notif_filtrer_contacte on public.parent_notifications;

select cron.unschedule('parent-contact-push');

drop function public.aviser_parent_contact_recruteur();
drop function public.parent_contact_a_la_reclamation();
drop function public.parent_notif_filtrer_contacte();
drop function public.parent_contact_ecrire_portail(uuid, boolean);
drop function public.parent_contact_envoyer_push(timestamptz);
drop function public.parent_contact_appeler(jsonb);
drop function if exists public.parent_contact_configure();

do $$
begin
  if exists (select 1 from pg_trigger where tgname in ('trg_aviser_parent_contact',
               'trg_parent_contact_reclamation', 'trg_parent_notif_filtrer_contacte'))
     or exists (select 1 from cron.job where jobname = 'parent-contact-push')
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in (
               'aviser_parent_contact_recruteur', 'parent_contact_a_la_reclamation',
               'parent_notif_filtrer_contacte', 'parent_contact_ecrire_portail',
               'parent_contact_envoyer_push', 'parent_contact_appeler', 'parent_contact_configure')) then
    raise exception 'NEXUS: rollback incomplet';
  end if;
end $$;
