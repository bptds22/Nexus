-- Tests W0.6 (094805 + 094806), base LOCALE. Une transaction annulée à la fin : rien ne survit.
-- Comptes de preuve locaux, résolus par courriel.
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon;

select set_config('w0.partner',  (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('w0.admin',    (select id::text from public.users where email = 'admin@demo.local'), true);
select set_config('w0.athlete',  (select id::text from public.users where email = 'a1.athlete@preuve.local'), true);
select set_config('w0.coach',    (select id::text from public.users where email = 'c1.coach@preuve.local'), true);
select set_config('w0.recruteur',(select id::text from public.users where email = 'julie.lambert@exemple.test'), true);
-- p1 au carrousel le temps du test (annulé avec la transaction).
update public.media_partners set show_on_homepage = true where user_id = current_setting('w0.partner')::uuid;
-- p2 (suspendu) passe APPROUVÉ le temps du test : sans un 2e partenaire approuvé, « le
-- partenaire ne voit pas les contacts des autres » serait vrai par construction.
update public.media_partners set status = 'APPROVED'
 where user_id = (select id from public.users where email = 'p2.suspendu@preuve.local');

create function pg_temp.jouer(p_qui text, p_uid text) returns void language plpgsql as $$
declare n int; v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);

  -- Lecture directe des contacts des partenaires APPROUVÉS (hors sa propre ligne).
  select count(*), max(contact_email) into n, v from public.media_partners
   where status = 'APPROVED' and user_id is distinct from p_uid::uuid;
  if p_qui = 'admin' then
    insert into _res values ('T5 admin lit les contacts des autres partenaires', n >= 2 and v is not null, n || ' ligne(s)');
  else
    insert into _res values ('T5 ' || p_qui || ' lit contact_email des partenaires approuvés', n = 0, n || ' ligne(s) visibles');
  end if;

  -- Sa propre ligne : seul le partenaire en a une.
  if p_qui = 'partenaire' then
    select count(*), max(contact_email) into n, v from public.media_partners where user_id = auth.uid();
    insert into _res values ('T5 partenaire lit SON contact_email', n = 1 and v is not null, coalesce(v, 'NULL'));
  end if;

  if p_qui = 'admin' then
    select count(*) into n from public.media_partners;
    insert into _res values ('T5 admin lit toutes les lignes (tous statuts)', n = 3, n || ' ligne(s)');
  end if;

  -- La vitrine (requête du carrousel d'accueil, à l'identique) reste servie.
  select count(*) into n from public.partenaires_vitrine()
   where status = 'APPROVED' and show_on_homepage = true;
  -- (la vitrine rend les 2 approuvés ; p1 seul est au carrousel)
  insert into _res values ('T5 ' || p_qui || ' : carrousel d''accueil (partenaires_vitrine)', n >= 1, n || ' ligne(s)');

  -- La vitrine ne porte aucune colonne de contact.
  insert into _res
  select 'T5 partenaires_vitrine n''expose pas contact_*', not exists (
           select 1 from pg_proc p, unnest(p.proargnames) a
            where p.oid = 'public.partenaires_vitrine()'::regprocedure and a like 'contact%'), 'colonnes de retour';
end $$;

set local role authenticated;
select pg_temp.jouer('athlete',    current_setting('w0.athlete'));
select pg_temp.jouer('coach',      current_setting('w0.coach'));
select pg_temp.jouer('recruteur',  current_setting('w0.recruteur'));
select pg_temp.jouer('partenaire', current_setting('w0.partner'));
select pg_temp.jouer('admin',      current_setting('w0.admin'));

-- Anonyme : /partenaires/[id] (client sans session) et le carrousel fonctionnent.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare n int;
begin
  select count(*) into n from (
    select id, organization_name, logo_url, card_image_url, description, about_text, website_url,
           instagram_handle, tiktok_handle, facebook_url, x_url, youtube_url, linkedin_url
      from public.media_partners where id = (select id from public.partenaires_vitrine() limit 1)) s;
  insert into _res values ('T5 anon : requête de /partenaires/[id]', n = 1, n || ' ligne(s)');
  select count(*) into n from public.partenaires_vitrine() where show_on_homepage = true;
  insert into _res values ('T5 anon : carrousel d''accueil (partenaires_vitrine)', n >= 1, n || ' ligne(s)');
  begin
    perform contact_email from public.media_partners;
    insert into _res values ('T5 anon lit contact_email (094802 toujours en place)', false, 'accepté');
  exception when insufficient_privilege then
    insert into _res values ('T5 anon lit contact_email (094802 toujours en place)', true, sqlerrm);
  end;
end $$;

reset role;
select case when ok then 'PASS' else 'FAIL' end as verdict, test, detail from _res;
select count(*) filter (where not ok) as echecs, count(*) as total from _res;
rollback;
