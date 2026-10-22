-- QG admin, lot 1 — preuves par rôle des 2 fonctions (base LOCALE seulement).
-- Tout se passe dans une transaction annulée à la fin : rien n'est écrit.
-- Les comptes sont trouvés par requête (admin de plateforme ADMIN, un COACH).
\set ON_ERROR_STOP 1
set timezone = 'America/Toronto';
begin;

create temp table r (n serial, quoi text, resultat text) on commit drop;
grant all on r to anon, authenticated;
grant usage on sequence r_n_seq to anon, authenticated;

select id as admin_id from public.users where role = 'ADMIN' and is_platform_admin limit 1 \gset
select id as coach_id from public.users where role = 'COACH' order by created_at limit 1 \gset

-- ── 1. anon : EXECUTE refusé sur les deux fonctions ──
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin perform public.admin_comptes_connectes(now() - interval '1 day', now());
        insert into r(quoi, resultat) values ('anon → admin_comptes_connectes', 'PASSE (ÉCHEC DE LA PREUVE)');
  exception when insufficient_privilege then
        insert into r(quoi, resultat) values ('anon → admin_comptes_connectes', 'refusé : ' || sqlerrm); end;
  begin perform public.admin_consentement_partenaire_stats();
        insert into r(quoi, resultat) values ('anon → admin_consentement_partenaire_stats', 'PASSE (ÉCHEC DE LA PREUVE)');
  exception when insufficient_privilege then
        insert into r(quoi, resultat) values ('anon → admin_consentement_partenaire_stats', 'refusé : ' || sqlerrm); end;
end $$;
reset role;

-- ── 2. authenticated non-admin (un coach) : la garde is_admin() refuse ──
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'coach_id', 'role', 'authenticated')::text, true);
do $$ begin
  begin perform public.admin_comptes_connectes(now() - interval '1 day', now());
        insert into r(quoi, resultat) values ('coach → admin_comptes_connectes', 'PASSE (ÉCHEC DE LA PREUVE)');
  exception when others then
        insert into r(quoi, resultat) values ('coach → admin_comptes_connectes', 'refusé : ' || sqlerrm); end;
  begin perform public.admin_consentement_partenaire_stats();
        insert into r(quoi, resultat) values ('coach → admin_consentement_partenaire_stats', 'PASSE (ÉCHEC DE LA PREUVE)');
  exception when others then
        insert into r(quoi, resultat) values ('coach → admin_consentement_partenaire_stats', 'refusé : ' || sqlerrm); end;
end $$;
reset role;

-- ── 3. admin : des nombres, rien d'autre ──
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, true);
do $$
declare s jsonb; c jsonb;
begin
  c := public.admin_comptes_connectes(now() - interval '30 days', now());
  insert into r(quoi, resultat) values ('admin → admin_comptes_connectes (30 j)', c::text);
  s := public.admin_consentement_partenaire_stats();
  insert into r(quoi, resultat) values ('admin → admin_consentement_partenaire_stats', s::text);
  insert into r(quoi, resultat) values ('4 cases = total ?',
    case when (s->>'accepte_v2')::int + (s->>'refuse_v2')::int + (s->>'en_attente')::int + (s->>'jamais_demande')::int
              = (s->>'total')::int then 'oui' else 'NON' end);
  insert into r(quoi, resultat) values ('en_attente + jamais_demande = pas_repondu + demande_parent ?',
    case when (s->>'en_attente')::int + (s->>'jamais_demande')::int
              = (s->>'pas_repondu')::int + (s->>'demande_parent')::int then 'oui' else 'NON' end);
  begin perform public.admin_comptes_connectes(now(), now() - interval '1 day');
        insert into r(quoi, resultat) values ('admin → fenêtre inversée', 'PASSE (ÉCHEC DE LA PREUVE)');
  exception when others then
        insert into r(quoi, resultat) values ('admin → fenêtre inversée', 'refusé : ' || sqlerrm); end;
end $$;
reset role;

-- ── 4. Contrôle à la main de admin_comptes_connectes (30 j), sans la fonction ──
insert into r(quoi, resultat)
select 'à la main (30 j)', jsonb_build_object('total', sum(n), 'par_role', jsonb_object_agg(rl, n))::text
  from (select coalesce(pu.role::text, 'SANS_ROLE') rl, count(*) n
          from auth.users au left join public.users pu on pu.id = au.id
         where au.last_sign_in_at >= now() - interval '30 days' and au.last_sign_in_at < now()
         group by 1) t;

-- ── 5. ACL complètes, triées ──
insert into r(quoi, resultat)
select 'ACL ' || p.oid::regprocedure::text,
       (select array_agg(t.g order by t.g)::text
          from (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') g from unnest(p.proacl::text[]) x) t)
  from pg_proc p
 where p.oid in ('public.admin_comptes_connectes(timestamptz, timestamptz)'::regprocedure,
                 'public.admin_consentement_partenaire_stats()'::regprocedure);

-- ── 6. Sabotage : on rend EXECUTE à anon, la garde d'ACL doit lever ──
grant execute on function public.admin_comptes_connectes(timestamptz, timestamptz) to anon;
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.admin_comptes_connectes(timestamptz, timestamptz)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    insert into r(quoi, resultat) values ('sabotage (anon ajouté)', 'la garde lève : ACL = ' || vus::text);
  else
    insert into r(quoi, resultat) values ('sabotage (anon ajouté)', 'LA GARDE NE VOIT RIEN (ÉCHEC)');
  end if;
end $$;

select n, quoi, resultat from r order by n;
rollback;
