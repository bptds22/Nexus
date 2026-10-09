-- Compte, par sport du menu (table sports) + « Ultimate » brut + tous sports (NULL), les matchs
-- À VENIR rendus par la VRAIE RPC matchs_recherche, sous l'identité d'un recruteur Pro, tous types,
-- par fenêtres de 7 jours (la limite de la RPC) jusqu'au dernier match en base.
-- Lecture seule, SELECT pur (le MCP refuse temp table / truncate). La revendication JWT est locale
-- à la transaction. Courriel : local r3.collegue@preuve.local ; prod nexus.recruteur@nexussports.ca.
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.users where email = '__COURRIEL__'), 'role', 'authenticated')::text, true);
select coalesce(s.nom, '(tous sports)') as sport,
       sum((select count(*) from public.matchs_recherche(d::date, d::date + 6, s.nom, array['SECONDAIRE','COLLEGIAL','CIVIL'], null)))::int as n
  from (select nom from public.sports union select 'Ultimate' union select null) s
 cross join generate_series(current_date, (select max(game_date) from public.games), interval '7 days') d
 group by 1 order by 1;
