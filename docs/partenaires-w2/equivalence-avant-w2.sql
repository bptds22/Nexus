-- Équivalence « binaires publiés » : recruiter_search_athletes appelée SANS
-- p_inclure_partenaires doit rendre, après W2, exactement ce qu'elle rendait
-- avant W2 (mêmes lignes, même ordre, mêmes valeurs sur les colonnes d'avant W2).
--
-- Usage (base LOCALE) :
--   avant W2 : psql -v prep=0 -f equivalence-avant-w2.sql   → empreintes de référence
--   après W2 : psql -v prep=1 -f equivalence-avant-w2.sql   → mêmes empreintes attendues,
--              alors qu'une évaluation partenaire existe sur CHAQUE athlète ACTIF.
-- Une transaction annulée : rien ne survit.
\set ON_ERROR_STOP 1
\pset footer off
begin;

\if :prep
-- Une note partenaire partout : 5 sur les athlètes sans cote du coach (ceux que
-- W2 ferait monter), une note variable ailleurs ; plus une note d'un partenaire
-- SUSPENDU, qui ne doit jamais compter.
insert into public.partner_evaluations (partner_id, athlete_id, cote_globale)
select mp.id, a.id,
       case when a.cote_globale_entraineur is null then 5
            else 1 + (abs(hashtext(a.id::text)) % 40) / 10.0 end
  from public.athletes a
  cross join public.media_partners mp
 where a.status = 'ACTIF' and mp.organization_name = 'Média Preuve';
insert into public.partner_evaluations (partner_id, athlete_id, cote_globale)
select mp.id, a.id, 5
  from public.athletes a cross join public.media_partners mp
 where a.status = 'ACTIF' and mp.status = 'SUSPENDED';
select count(*) as evaluations_partenaires_posees from public.partner_evaluations;
\endif

create temp table _eq (recruteur text, appel text, lignes int, empreinte text) on commit drop;
grant all on _eq to authenticated;
-- Comptes résolus par courriel AVANT de changer de rôle.
create temp table _rec on commit drop as
select email, id from public.users
 where email in ('julie.lambert@exemple.test', 'r6.gratuit@preuve.local');
grant select on _rec to authenticated;

create function pg_temp.empreinte(p_rec text, p_appel text) returns void
language plpgsql as $$
declare n int; h text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from _rec where email = p_rec), 'role', 'authenticated')::text, true);
  -- Colonnes d'avant W2 seulement : les deux colonnes partenaire sont retirées
  -- (absentes avant W2, la soustraction est alors sans effet).
  execute format($q$select count(*), md5(coalesce(string_agg(
                      (to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text,
                      '|' order by r.ordinality), ''))
                    from public.recruiter_search_athletes(%s) with ordinality r$q$, p_appel)
    into n, h;
  insert into _eq values (p_rec, p_appel, n, h);
end $$;

set local role authenticated;
select pg_temp.empreinte(rec, appel)
  from unnest(array['julie.lambert@exemple.test', 'r6.gratuit@preuve.local']) rec,
       unnest(array[
         '',
         'p_min_rating => 4',
         'p_min_rating => 3, p_sort_by => ''rating_asc''',
         'p_min_rating => 1',
         'p_sort_by => ''rating_desc''',
         'p_sort_by => ''name_asc''',
         'p_sort_by => ''grad_desc''',
         'p_verified_only => true, p_min_rating => 4']) appel;
reset role;

select recruteur, appel, lignes, empreinte from _eq order by recruteur, appel;

rollback;
