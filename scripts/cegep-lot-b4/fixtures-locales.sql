-- Lot B4 cégep — fixtures LOCALES de la pile d'appli NexusCegepA (base postgres, port 55322). JAMAIS en prod.
-- Par-dessus les fixtures du lot A (scripts/cegep-lot-a-fixtures-locales.sql, mot de passe NexusTest123!) :
-- recruteur collégial Pro, partenaire APPROVED, coach secondaire K, athlète cégépien C (compte lota.cedric@).
-- Données personnelles fictives ; préfixe b4000000-. Trois athlètes de plus, pour varier Type et Catégorie :
--   B4A  ancré à l'école du coach K (secondaire), équipe Cadet, coach K, promotion 2028
--   B4B  ancré à un club LIGUE_CIVILE, équipe Midget AAA du club, promotion 2027
--   B4C  ancré à l'école du coach K, SANS équipe, coach K, promotion 2029
-- Tous ACTIF, majeurs ou 16 ans, opt-in partenaire ; consentement partenaire v2 pour B4A (vidéo visible).
-- Rejouable : retire d'abord les fixtures b4000000-.
\set ON_ERROR_STOP 1
do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée — fixtures locales refusées';
  end if;
end $$;
begin;
set local session_replication_role = replica;
delete from public.consentement_partenaire_v2 where athlete_id::text like 'b4000000-%';
delete from public.team_athletes where athlete_id::text like 'b4000000-%';
delete from public.athletes where id::text like 'b4000000-%';

create temp table _ref on commit drop as
select (select school_id from public.users where id = 'c0ce0a00-0000-4000-8000-000000000005') as ecole_coach,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'SECONDAIRE' and t.age_group = 'Cadet' order by t.id limit 1) as eq_cadet,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'LIGUE_CIVILE' and t.age_group = 'Midget AAA' order by t.id limit 1) as eq_civile,
       (select sport_id from public.users where id = 'c0ce0a00-0000-4000-8000-000000000005') as sport;

insert into public.athletes (id, school_id, coach_id, first_name, last_name, date_naissance, genre, status, sport_id,
                             annee_diplomation, consentement_parental, partner_visibility_opt_in, partner_visibility_opted_in_at,
                             video_faits_saillants_url, verified)
select 'b4000000-0000-4000-8000-0000000000a1'::uuid, r.ecole_coach, 'c0ce0a00-0000-4000-8000-000000000005'::uuid, 'Béa', 'Cadette',
       '2010-03-01'::date, 'F', 'ACTIF'::public.account_status, r.sport, 2028, true, true, now() - interval '1 day', 'https://exemple.test/b4a', true from _ref r
union all
select 'b4000000-0000-4000-8000-0000000000b1'::uuid, (select t.school_id from public.teams t where t.id = r.eq_civile), null::uuid, 'Bruno', 'Civil',
       '2008-04-01'::date, 'M', 'ACTIF'::public.account_status, r.sport, 2027, true, true, now() - interval '1 day', null, true from _ref r
union all
select 'b4000000-0000-4000-8000-0000000000c1'::uuid, r.ecole_coach, 'c0ce0a00-0000-4000-8000-000000000005'::uuid, 'Chloé', 'Sansequipe',
       '2011-05-01'::date, 'F', 'ACTIF'::public.account_status, r.sport, 2029, true, true, now() - interval '1 day', null, false from _ref r;

insert into public.team_athletes (team_id, athlete_id, sport_id)
select r.eq_cadet, 'b4000000-0000-4000-8000-0000000000a1'::uuid, r.sport from _ref r
union all
select r.eq_civile, 'b4000000-0000-4000-8000-0000000000b1'::uuid, r.sport from _ref r;

insert into public.consentement_partenaire_v2 (athlete_id, accepte_le)
values ('b4000000-0000-4000-8000-0000000000a1', now());

set local session_replication_role = origin;
commit;

select a.first_name, a.last_name, s.type as ancrage, ts.type as equipe, t.age_group as categorie, a.annee_diplomation as promo,
       public.athlete_est_cegepien(a.id) as cegepien
  from public.athletes a left join public.schools s on s.id = a.school_id
  left join public.team_athletes ta on ta.athlete_id = a.id left join public.teams t on t.id = ta.team_id
  left join public.schools ts on ts.id = t.school_id
 where a.id::text like 'b4000000-%' or a.id::text like 'c0ce0a00-%'
 order by a.id;
