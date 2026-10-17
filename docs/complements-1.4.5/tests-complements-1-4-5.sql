-- Compléments 1.4.5 (20261017010000) — volets A (non-contact) et B (effectif), base LOCALE. Une transaction ANNULÉE à la fin.
--   docker cp docs/complements-1.4.5/tests-complements-1-4-5.sql supabase_db_Nexus:/tmp/tests-c145.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -At -f /tmp/tests-c145.sql
-- Fixtures : comptes de docs/emulateur-1.4.5/preparer-local.mjs (e.partenaire, e.coach, e.athlete.existant),
-- et un athlète d'un autre coach.
\set ON_ERROR_STOP 1
\pset footer off
\o /dev/null
begin;

create temp table _res (n serial, test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon;
grant usage on sequence _res_n_seq to authenticated, anon;
create function pg_temp.verif(p_test text, p_obtenu text, p_attendu text) returns void language sql as $$
  insert into _res (test, ok, detail) values (p_test, p_obtenu is not distinct from p_attendu,
    coalesce(p_obtenu, 'NULL') || ' (attendu ' || coalesce(p_attendu, 'NULL') || ')')
$$;
create function pg_temp.essai(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return 'OK:' || coalesce(v, 'NULL');
exception when others then
  return sqlstate || ':' || sqlerrm;
end $$;
grant execute on function pg_temp.essai(text) to authenticated, anon;
grant execute on function pg_temp.verif(text, text, text) to authenticated, anon;
create function pg_temp.acl(p_fn text) returns text language sql as $$
  select array_agg(t.g order by t.g)::text from pg_proc pr,
    lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) x) t
   where pr.oid = p_fn::regprocedure
$$;

select set_config('t.part', (select id::text from users where email = 'e.partenaire@emulateur.local'), true);
select set_config('t.carte', (select c.id::text from partenaire_prospects c join media_partners mp on mp.id = c.partner_id
   join users u on u.id = mp.user_id where u.email = 'e.partenaire@emulateur.local' and c.statut = 'A_ENVOYER'
   and c.expire_le > now() and c.promotion is not null order by c.id limit 1), true);
select set_config('t.sport', (select sport_id::text from partenaire_prospects where id = current_setting('t.carte')::uuid), true);
select set_config('t.promo', (select promotion::text from partenaire_prospects where id = current_setting('t.carte')::uuid), true);
select set_config('t.autre_sport', (select id::text from sports where id <> current_setting('t.sport')::uuid order by nom limit 1), true);
select set_config('t.coach', (select id::text from users where email = 'e.coach@emulateur.local'), true);
select set_config('t.mien', (select a.id::text from athletes a join users u on u.id = a.user_id where u.email = 'e.athlete.existant@emulateur.local'), true);
select set_config('t.mien_mail', 'e.athlete.existant@emulateur.local', true);
select set_config('t.autre_mail', (select lower(btrim(coalesce(a.email, u.email))) from athletes a join users u on u.id = a.user_id
   where a.coach_id is not null and a.coach_id <> current_setting('t.coach')::uuid order by a.id limit 1), true);

select pg_temp.verif('F0 fixtures présentes (partenaire, carte, coach, mon athlète, autre athlète)',
  (current_setting('t.part') <> '' and current_setting('t.carte') <> '' and current_setting('t.coach') <> ''
   and current_setting('t.mien') <> '' and current_setting('t.autre_mail') <> '')::text, 'true');

-- ── A. Non-contact sur les cartes prospect ───────────────────────────────────
select pg_temp.verif('A1 non_contact_carte : ACL complète', pg_temp.acl('public.non_contact_carte(uuid,integer)'), '{authenticated,postgres,service_role}');
select pg_temp.verif('A2 partenaire_prospect_lien : ACL inchangée', pg_temp.acl('public.partenaire_prospect_lien(uuid)'), '{authenticated,postgres,service_role}');
set local role anon;
select pg_temp.verif('A3 anon : non_contact_carte refusée',
  split_part(pg_temp.essai(format('select date_fin::text from public.non_contact_carte(%L, %s)', current_setting('t.sport'), current_setting('t.promo'))), ':', 1), '42501');
reset role;

-- Aucune période active de départ : on désarme celles qui existent (annulé avec la transaction).
update blackout_periods set actif = false;
select pg_temp.verif('A4 aucune période : rien',
  (select count(*)::text from public.non_contact_carte(current_setting('t.sport')::uuid, current_setting('t.promo')::int)), '0');

insert into blackout_periods (libelle, sport_id, promo_min, promo_max, date_debut, date_fin, actif)
values ('Test non-contact', current_setting('t.sport')::uuid, current_setting('t.promo')::int - 1, current_setting('t.promo')::int + 1,
        (now() at time zone 'America/Montreal')::date - 1, (now() at time zone 'America/Montreal')::date + 10, true);
select set_config('t.fin', ((now() at time zone 'America/Montreal')::date + 10)::text, true);
select pg_temp.verif('A5 période active, même sport, promotion dans les bornes : sa fin',
  (select date_fin::text from public.non_contact_carte(current_setting('t.sport')::uuid, current_setting('t.promo')::int)), current_setting('t.fin'));
select pg_temp.verif('A6 autre sport : rien',
  (select count(*)::text from public.non_contact_carte(current_setting('t.autre_sport')::uuid, current_setting('t.promo')::int)), '0');
select pg_temp.verif('A7 promotion hors bornes : rien',
  (select count(*)::text from public.non_contact_carte(current_setting('t.sport')::uuid, current_setting('t.promo')::int + 5)), '0');
select pg_temp.verif('A8 carte sans promotion : couverte (comme un athlète sans promotion)',
  (select date_fin::text from public.non_contact_carte(current_setting('t.sport')::uuid, null)), current_setting('t.fin'));

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.part'), 'role', 'authenticated')::text, true);
select pg_temp.verif('A9 le partenaire lit la période de sa carte',
  (select date_fin::text from public.non_contact_carte(current_setting('t.sport')::uuid, current_setting('t.promo')::int)), current_setting('t.fin'));
select pg_temp.verif('A10 création du lien REFUSÉE pendant la période (message NEXUS, date en français)',
  (pg_temp.essai(format('select public.partenaire_prospect_lien(%L)', current_setting('t.carte'))) ~ '^42501:NEXUS: Période de non-contact jusqu''au [0-9]{1,2} [a-zéû]+ [0-9]{4}$')::text, 'true');
reset role;
select pg_temp.verif('A11 la carte n''a pas bougé (toujours à envoyer, aucun jeton)',
  (select statut || '|' || (jeton_empreinte is null)::text from partenaire_prospects where id = current_setting('t.carte')::uuid), 'A_ENVOYER|true');

update blackout_periods set actif = false where libelle = 'Test non-contact';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.part'), 'role', 'authenticated')::text, true);
select pg_temp.verif('A12 période désarmée : le lien se crée (64 car. hexa)',
  (pg_temp.essai(format('select public.partenaire_prospect_lien(%L)', current_setting('t.carte'))) ~ '^OK:[0-9a-f]{64}$')::text, 'true');
reset role;

-- Période terminée hier, ou pas encore commencée : rien.
insert into blackout_periods (libelle, sport_id, date_debut, date_fin, actif) values
  ('Test passé', null, (now() at time zone 'America/Montreal')::date - 20, (now() at time zone 'America/Montreal')::date - 1, true),
  ('Test futur', null, (now() at time zone 'America/Montreal')::date + 1, (now() at time zone 'America/Montreal')::date + 20, true);
select pg_temp.verif('A13 périodes passée et future : rien aujourd''hui',
  (select count(*)::text from public.non_contact_carte(current_setting('t.sport')::uuid, current_setting('t.promo')::int)), '0');

-- ── B. « Autre équipe » ≠ « mon effectif » ───────────────────────────────────
select pg_temp.verif('B0 lookup : ACL rétablie à l''identique', pg_temp.acl('public.lookup_invitable_athletes_by_email(text)'), '{anon,authenticated,postgres,service_role}');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.coach'), 'role', 'authenticated')::text, true);
select pg_temp.verif('B1 mon athlète (avec compte), courriel exact : exists_mine, PAS exists_exact',
  (select bool_or(exists_exact)::text || '|' || bool_or(exists_mine)::text from public.lookup_invitable_athletes_by_email(current_setting('t.mien_mail'))), 'false|true');
select pg_temp.verif('B2 athlète d''un AUTRE coach, courriel exact : exists_exact (« autre équipe »), pas exists_mine',
  (select bool_or(exists_exact)::text || '|' || bool_or(exists_mine)::text from public.lookup_invitable_athletes_by_email(current_setting('t.autre_mail'))), 'true|false');
select pg_temp.verif('B3 préfixe seul (4 car.) : aucun drapeau exact',
  (select coalesce(bool_or(exists_exact), false)::text || '|' || coalesce(bool_or(exists_mine), false)::text
     from public.lookup_invitable_athletes_by_email(left(current_setting('t.mien_mail'), 4))), 'false|false');
select pg_temp.verif('B4 aucune PII dans les lignes à drapeaux',
  (select count(*)::text from public.lookup_invitable_athletes_by_email(current_setting('t.mien_mail')) where athlete_id is null and (email is not null or first_name is not null)), '0');
reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select pg_temp.verif('B5 anon : rien (is_coach faux)',
  (select count(*)::text from public.lookup_invitable_athletes_by_email(current_setting('t.mien_mail'))), '0');
reset role;

\o
select n, case when ok then 'ok' else 'ÉCHEC' end, test, detail from _res order by n;
select count(*) filter (where ok) || ' | ' || count(*) filter (where not ok) from _res;
rollback;
