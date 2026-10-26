-- Lot B3 cégep — fixtures LOCALES de la base jetable nexus_b3 (jamais en prod), PAR-DESSUS celles du lot B2
-- (scripts/cegep-lot-b2/fixtures-locales.sql, déjà dans la copie nexus_b2 : ADMIN, R1 recruteur collégial Pro,
-- P1 partenaire APPROVED, A1 cégépien sur une équipe « Collégial », A2 sans ancrage sur une équipe
-- « Collégial », A3 secondaire sur une équipe Juvénile). Données personnelles fictives ; préfixe b3000000-.
--   A4  ancré à un club LIGUE_CIVILE, sur une équipe civile du club
--   A5  ancré au SECONDAIRE, sans équipe
--   A6  sans école ni équipe
--   A7  ancré au SECONDAIRE, sur une équipe d'école CEGEP (le type d'ancrage et celui de l'équipe divergent ;
--       PAS cégépien au sens du lot A, qui regarde l'ancrage)
--   A8  cégépien SANS équipe (ancré au cégep d'A1)
--   Tous ACTIF, majeurs, opt-in partenaire ; A1, A3, A4 avec consentement partenaire v2 (vidéos).
\set ON_ERROR_STOP 1
do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée — fixtures locales refusées';
  end if;
end $$;
begin;
set local session_replication_role = replica;
delete from public.consentement_partenaire_v2 where athlete_id::text like 'b2000000-%' or athlete_id::text like 'b3000000-%';
delete from public.team_athletes where athlete_id::text like 'b3000000-%';
delete from public.athletes where id::text like 'b3000000-%';

create temp table _ref on commit drop as
select (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'LIGUE_CIVILE' and t.age_group = 'Midget AAA' order by t.id limit 1) as eq_civile,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'CEGEP' and t.age_group = 'Collégial' and t.sport_id = '063752bb-e786-4009-ac46-bb3c4eccfdee'
         order by t.id offset 3 limit 1) as eq_cegep,
       (select s.id from public.schools s where s.type = 'SECONDAIRE' order by s.name limit 1) as ecole_sec;

insert into public.athletes (id, user_id, school_id, first_name, last_name, date_naissance, status, sport_id, consentement_parental,
                             annee_diplomation, partner_visibility_opt_in, partner_visibility_opted_in_at, video_faits_saillants_url)
values
  ('b3000000-0000-4000-8000-0000000000a4', null, (select t.school_id from public.teams t where t.id = (select eq_civile from _ref)),
     'Athle', 'Quatre', '2006-02-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false, 2027, true, now() - interval '1 day', 'https://exemple.test/v4'),
  ('b3000000-0000-4000-8000-0000000000a5', null, (select ecole_sec from _ref),
     'Athle', 'Cinq', '2007-03-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false, 2028, true, now() - interval '1 day', null),
  ('b3000000-0000-4000-8000-0000000000a6', null, null,
     'Athle', 'Six', '2007-04-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false, 2028, true, now() - interval '1 day', null),
  ('b3000000-0000-4000-8000-0000000000a7', null, (select ecole_sec from _ref),
     'Athle', 'Sept', '2006-05-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false, 2027, true, now() - interval '1 day', null),
  ('b3000000-0000-4000-8000-0000000000a8', null, (select school_id from public.athletes where id = 'b2000000-0000-4000-8000-0000000000a1'),
     'Athle', 'Huit', '2004-06-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false, 2027, true, now() - interval '1 day', null);

insert into public.team_athletes (team_id, athlete_id, sport_id)
values ((select eq_civile from _ref), 'b3000000-0000-4000-8000-0000000000a4', '063752bb-e786-4009-ac46-bb3c4eccfdee'),
       ((select eq_cegep from _ref),  'b3000000-0000-4000-8000-0000000000a7', '063752bb-e786-4009-ac46-bb3c4eccfdee');

update public.athletes
   set partner_visibility_opt_in = true, partner_visibility_opted_in_at = now() - interval '1 day',
       annee_diplomation = coalesce(annee_diplomation, 2027), video_faits_saillants_url = 'https://exemple.test/v'
 where id::text like 'b2000000-%';

insert into public.consentement_partenaire_v2 (athlete_id, accepte_le)
values ('b2000000-0000-4000-8000-0000000000a1', now()), ('b2000000-0000-4000-8000-0000000000a3', now()),
       ('b3000000-0000-4000-8000-0000000000a4', now());

set local session_replication_role = origin;
commit;

select a.id::text like 'b2%' as lot_b2, right(a.id::text, 2) as ath, s.type as ancrage, ts.type as equipe, t.age_group as categorie,
       public.athlete_est_cegepien(a.id) as cegepien
  from public.athletes a left join public.schools s on s.id = a.school_id
  left join public.team_athletes ta on ta.athlete_id = a.id left join public.teams t on t.id = ta.team_id
  left join public.schools ts on ts.id = t.school_id
 order by a.id;
