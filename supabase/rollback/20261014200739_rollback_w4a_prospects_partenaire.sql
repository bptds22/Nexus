-- Retour arrière de W4a (20261014200739) — à passer avec psql -1 -v ON_ERROR_STOP=1.
-- Supprime les cartes prospects partenaire, leurs rapprochements, issues et journal, le trigger
-- d'opt-in, les 32 fonctions et la purge ; rend sa liste d'avant à athlete_notifications_type_check.
-- Ce qui a DÉJÀ été transféré (partner_evaluations, partner_athlete_badges) reste en place :
-- ce sont désormais les données de l'athlète, pas celles de la carte.

do $$
begin
  if to_regclass('public.partenaire_prospects') is null then
    raise exception 'NEXUS: W4a absente — rien à défaire';
  end if;
  -- La liste d'avant ne connaît pas PARTENAIRE_EVALUATION : on ne supprime pas en silence des
  -- notifications reçues par des jeunes. À traiter à la main d'abord.
  if exists (select 1 from public.athlete_notifications where type = 'PARTENAIRE_EVALUATION') then
    raise exception 'NEXUS: % notification(s) PARTENAIRE_EVALUATION existent — les traiter avant le retour arrière',
      (select count(*) from public.athlete_notifications where type = 'PARTENAIRE_EVALUATION');
  end if;
end $$;

drop trigger trg_prospect_partenaire_sur_optin on public.athletes;
select cron.unschedule('prospects-partenaire-purge-quotidienne');

drop function public.admin_loi25_prospects_partenaires(uuid, timestamptz, timestamptz);
drop function public.admin_prospect_annuler(uuid);
drop function public.admin_prospect_supprimer(uuid);
drop function public.admin_prospect_ecarter(uuid, uuid);
drop function public.admin_prospect_proposer(uuid, uuid);
drop function public.admin_prospects_rapprochements();
drop function public.admin_prospects_partenaires();
drop function public.prospect_partenaire_infirmer(uuid);
drop function public.prospect_partenaire_confirmer(uuid);
drop function public.prospect_partenaire_mes_cartes();
drop function public.prospect_partenaire_ouvrir(text);
drop function public.prospect_partenaire_resoudre(text);
drop function public.partenaire_prospects_mes_issues();
drop function public.partenaire_prospects_mes_cartes();
drop function public.partenaire_prospect_supprimer(uuid);
drop function public.partenaire_prospect_revoquer_lien(uuid);
drop function public.partenaire_prospect_lien(uuid);
drop function public.partenaire_prospect_enregistrer(uuid, text, text, uuid, uuid, uuid, uuid, integer, boolean, numeric, jsonb, uuid[], uuid[]);
drop function public.purger_prospects_partenaire();
drop function public.prospect_partenaire_sur_optin();
drop function public.prospect_partenaire_proposer_auto(uuid, uuid);
drop function public.prospect_partenaire_proposer(uuid, uuid, text, text, text);
drop function public.prospect_partenaire_candidats(uuid, uuid);
drop function public.prospect_partenaire_transferer(uuid, uuid);
drop function public.prospect_partenaire_contenu(uuid, uuid);
drop function public.prospect_partenaire_terminer(uuid, text, jsonb);
drop function public.prospect_partenaire_normaliser_evaluation(numeric, jsonb);
drop function public.prospect_partenaire_journaliser(uuid, uuid, text, uuid, jsonb);
drop function public.prospect_partenaire_peut_transferer(uuid, uuid);
drop function public.prospect_partenaire_sport_concorde(uuid, uuid);
drop function public.prospect_partenaire_lever_proposition(uuid, text);
drop function public.prospect_partenaire_lever_reservation_lien(uuid, text);

drop table public.partenaire_prospects_rapprochements;
drop table public.partenaire_prospects_issues;
drop table public.partenaire_prospects_journal;
drop table public.partenaire_prospects;

alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED',
    'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED',
    'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION',
    'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5']::text[]));

do $$
begin
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check')
     is distinct from
     'CHECK ((type = ANY (ARRAY[''PROFILE_VIEWED''::text, ''ADDED_TO_FAVORITES''::text, ''SUGGESTION_APPROVED''::text, ''SUGGESTION_REJECTED''::text, ''COACH_REPORT_UPDATED''::text, ''COACH_VERIFIED''::text, ''COACH_MODIFIED_PROFILE''::text, ''COACH_DISTINCTION_ADDED''::text, ''COACH_EVALUATION_UPDATED''::text, ''PROFILE_MILESTONE''::text, ''PROFILE_TIP''::text, ''ADMIN_BROADCAST''::text, ''TEAM_INVITATION''::text, ''SCHOOL_CLAIM_REJECTED''::text, ''COACH_CLAIMED''::text, ''AMBASSADEUR_PALIER_3''::text, ''AMBASSADEUR_PALIER_5''::text])))' then
    raise exception 'NEXUS: athlete_notifications_type_check non restaurée à l''identique';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and (proname like 'prospect_partenaire%' or proname like 'partenaire_prospect%'
                   or proname like 'admin_prospect%' or proname in ('admin_loi25_prospects_partenaires', 'purger_prospects_partenaire'))) then
    raise exception 'NEXUS: des fonctions W4a subsistent';
  end if;
  raise notice 'NEXUS W4a défaite : tables, fonctions, trigger, purge retirés ; contrainte des notifications restaurée — OK';
end $$;
