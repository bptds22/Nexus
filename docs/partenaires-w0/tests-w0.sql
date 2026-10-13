-- Tests W0 (base LOCALE). Tout tourne dans UNE transaction annulée à la fin : aucune écriture
-- ne survit. Comptes de preuve locaux, résolus par courriel :
--   p1.partenaire@preuve.local (PARTNER, APPROVED), admin@demo.local (ADMIN).
\set ON_ERROR_STOP 1
\pset footer off
begin;

create temp table _res (test text, ok boolean, detail text) on commit drop;
grant all on _res to authenticated, anon;

select set_config('w0.partner', (select id::text from public.users where email = 'p1.partenaire@preuve.local'), true);
select set_config('w0.admin',   (select id::text from public.users where email = 'admin@demo.local'), true);
-- Athlète éligible partenaire, ACTIF au départ.
select set_config('w0.ath', (select a.id::text from public.athletes a
                               where a.status = 'ACTIF' and public.is_partner_eligible_athlete(a.id)
                               order by a.id limit 1), true);

-- ── T1. Partenaire connecté : colonnes réservées refusées, profil permis ─────────────
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('w0.partner'), 'role', 'authenticated')::text, true);

do $$
declare
  essais text[][] := array[
    array['tier',          $q$tier = 'OFFICIEL'$q$],
    array['approved_at',   $q$approved_at = now() - interval '1 day'$q$],
    array['approved_by',   $q$approved_by = auth.uid()$q$],
    array['category',      $q$category = 'Média'$q$],
    array['homepage_order',$q$homepage_order = 1$q$],
    array['contact_email (non nommée → bloquée par défaut)', $q$contact_email = 'x@y.z'$q$],
    array['user_id',       $q$user_id = user_id$q$]   -- réécrite À L'IDENTIQUE : doit passer (aucune différence)
  ];
  i int; n int;
begin
  for i in 1 .. array_length(essais, 1) loop
    begin
      execute format('update public.media_partners set %s where user_id = auth.uid()', essais[i][2]);
      get diagnostics n = row_count;
      insert into _res values ('T1 partenaire ' || case when essais[i][1] = 'user_id' then 'réécrit user_id à l''identique (doit passer)' else 'modifie ' || essais[i][1] end,
        essais[i][1] = 'user_id' and n = 1,
        'accepté, ' || n || ' ligne(s)');
    exception when insufficient_privilege then
      insert into _res values ('T1 partenaire ' || case when essais[i][1] = 'user_id' then 'réécrit user_id à l''identique (doit passer)' else 'modifie ' || essais[i][1] end,
        essais[i][1] <> 'user_id' and sqlerrm like 'NEXUS:%', sqlerrm);
    end;
  end loop;

  -- Colonnes de profil : permises.
  begin
    update public.media_partners
       set description = 'test W0', about_text = 'test', website_url = 'https://exemple.ca',
           terms_accepted_at = now(), terms_version = 'v-test'
     where user_id = auth.uid();
    get diagnostics n = row_count;
    insert into _res values ('T1 partenaire modifie son profil (permis)', n = 1, n || ' ligne(s)');
  exception when others then
    insert into _res values ('T1 partenaire modifie son profil (permis)', false, sqlerrm);
  end;
end $$;

-- ── T1b. Admin : peut toujours modifier tier / category / approved_* ─────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('w0.admin'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  update public.media_partners
     set tier = 'MAJEUR', category = 'Média', approved_at = now(), homepage_order = 3
   where user_id = current_setting('w0.partner')::uuid;
  get diagnostics n = row_count;
  insert into _res values ('T1b admin modifie tier/category/approved_at', n = 1, n || ' ligne(s), is_admin=' || public.is_admin());
exception when others then
  insert into _res values ('T1b admin modifie tier/category/approved_at', false, sqlerrm);
end $$;

-- ── T2/T3. Anonyme ────────────────────────────────────────────────────────────────────
reset role;
-- Le carrousel ne montre que show_on_homepage = true ; on y met p1 le temps du test
-- (annulé avec la transaction), sinon la requête rend 0 ligne et ne prouve rien.
update public.media_partners set show_on_homepage = true where user_id = current_setting('w0.partner')::uuid;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare n int;
begin
  begin
    perform contact_email from public.media_partners;
    insert into _res values ('T2 anon lit contact_email', false, 'lecture acceptée');
  exception when insufficient_privilege then
    insert into _res values ('T2 anon lit contact_email', true, sqlerrm);
  end;
  begin
    perform contact_name from public.media_partners;
    insert into _res values ('T2 anon lit contact_name', false, 'lecture acceptée');
  exception when insufficient_privilege then
    insert into _res values ('T2 anon lit contact_name', true, sqlerrm);
  end;
  -- Requête du carrousel de l'accueil (PartnerCarousel.tsx), à l'identique.
  begin
    select count(*) into n from (
      select id, organization_name, logo_url, card_image_url, tier, category, homepage_order
        from public.media_partners where status = 'APPROVED' and show_on_homepage = true) s;
    insert into _res values ('T2 anon : requête du carrousel d''accueil', n >= 1, n || ' ligne(s)');
  exception when others then
    insert into _res values ('T2 anon : requête du carrousel d''accueil', false, sqlerrm);
  end;
  -- Requête de /partenaires/[id], à l'identique.
  begin
    select count(*) into n from (
      select id, organization_name, logo_url, card_image_url, description, about_text, website_url,
             instagram_handle, tiktok_handle, facebook_url, x_url, youtube_url, linkedin_url
        from public.media_partners) s;
    insert into _res values ('T2 anon : requête de /partenaires/[id]', n >= 1, n || ' ligne(s) (APPROVED seulement)');
  exception when others then
    insert into _res values ('T2 anon : requête de /partenaires/[id]', false, sqlerrm);
  end;
  begin
    perform public.is_partner_eligible_athlete(current_setting('w0.ath')::uuid);
    insert into _res values ('T3 anon appelle is_partner_eligible_athlete', false, 'appel accepté');
  exception when insufficient_privilege then
    insert into _res values ('T3 anon appelle is_partner_eligible_athlete', true, sqlerrm);
  end;
end $$;

-- ── T3b / T4. Partenaire : la fonction reste appelable ; un athlète inactif disparaît ──
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('w0.partner'), 'role', 'authenticated')::text, true);
do $$
declare n int; e boolean;
begin
  e := public.is_partner_eligible_athlete(current_setting('w0.ath')::uuid);
  insert into _res values ('T3b partenaire appelle is_partner_eligible_athlete', e is true, 'rend ' || e);
  select count(*) into n from public.partner_athlete_profile(current_setting('w0.ath')::uuid);
  insert into _res values ('T4 athlète ACTIF visible dans partner_athlete_profile', n = 1, n || ' ligne(s)');
end $$;

reset role;
update public.athletes set status = 'DESACTIVE' where id = current_setting('w0.ath')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('w0.partner'), 'role', 'authenticated')::text, true);
do $$
declare n int;
begin
  select count(*) into n from public.partner_athlete_profile(current_setting('w0.ath')::uuid);
  insert into _res values ('T4 athlète DESACTIVE absent de partner_athlete_profile', n = 0, n || ' ligne(s)');
end $$;

reset role;
select case when ok then 'PASS' else 'FAIL' end as verdict, test, detail from _res;
select count(*) filter (where not ok) as echecs, count(*) as total from _res;
rollback;
