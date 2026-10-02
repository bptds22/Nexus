-- Preuves par rôle du volet 5 (20261002130635). LOCAL seulement : tout est annulé (rollback final).
-- Fixture locale d3a00000-…a001 ; adapter les \set pour un autre environnement. Attendu : 13 lignes ✅.
\set ON_ERROR_STOP 0
\set A '''d3a00000-0000-4000-8000-00000000a001'''
\set U '''842da8f6-41bf-4b75-bc72-83afc68bfe1c'''
\set C '''22222222-0000-0000-0000-00000000000c'''
\set S2 '''59ff9e48-65a4-40f7-a8da-793bc7da1e98'''
begin;
create temp table r(preuve text, attendu text, obtenu text);
grant all on r to authenticated;
-- helper : rejoue un UPDATE sous un rôle, capture OK / REFUS
create or replace function pg_temp.essai(p text, att text, sub uuid, q text) returns void language plpgsql as $f$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',sub,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
    get diagnostics n = row_count;
    raise exception using errcode='NX000', message='__OK__'||n;  -- annule l'UPDATE, garde le constat
  exception when others then
    execute 'reset role';
    if sqlerrm like '__OK__%' then
      n := substr(sqlerrm,7)::int;
      insert into r values (p, att, case when n=1 then 'OK (1 ligne)' else 'RIEN ('||n||' ligne)' end);
    else
      insert into r values (p, att, 'REFUS: '||sqlerrm);
    end if;
  end;
end $f$;

-- Onboarding NON terminé
update public.users set onboarding_complete=false where id=:U;
select pg_temp.essai('1 onb=false school_id', 'OK', :U::uuid, format('update public.athletes set school_id=%L where id=%L', :S2, :A));
select pg_temp.essai('2 onb=false coach_id',  'OK', :U::uuid, format('update public.athletes set coach_id=null where id=%L', :A));
select pg_temp.essai('3 onb=false verified',  'REFUS', :U::uuid, format('update public.athletes set verified=not coalesce(verified,false) where id=%L', :A));
select pg_temp.essai('3b onb=false status',   'REFUS', :U::uuid, format('update public.athletes set status=''DESACTIVE'' where id=%L', :A));
select pg_temp.essai('3c onb=false profile_completion', 'REFUS', :U::uuid, format('update public.athletes set profile_completion=coalesce(profile_completion,0)+1 where id=%L', :A));
select pg_temp.essai('3d onb=false date_naissance (libre)', 'OK', :U::uuid, format('update public.athletes set date_naissance=date_naissance-1 where id=%L', :A));
-- onboarding_complete NULL = pas fini
update public.users set onboarding_complete=null where id=:U;
select pg_temp.essai('1b onb=NULL school_id', 'OK', :U::uuid, format('update public.athletes set school_id=%L where id=%L', :S2, :A));
-- Onboarding terminé
update public.users set onboarding_complete=true where id=:U;
select pg_temp.essai('4 onb=true school_id', 'REFUS', :U::uuid, format('update public.athletes set school_id=%L where id=%L', :S2, :A));
select pg_temp.essai('4b onb=true coach_id', 'REFUS', :U::uuid, format('update public.athletes set coach_id=null where id=%L', :A));
select pg_temp.essai('4c onb=true date_naissance', 'REFUS', :U::uuid, format('update public.athletes set date_naissance=date_naissance-1 where id=%L', :A));
select pg_temp.essai('4d onb=true bio (libre)', 'OK', :U::uuid, format('update public.athletes set bio=coalesce(bio,'''')||''x'' where id=%L', :A));
-- 5 : le coach de l'athlète édite la fiche (trigger ne s'en mêle pas)
select pg_temp.essai('5 coach school_id+verified', 'OK', :C::uuid, format('update public.athletes set school_id=%L, verified=true where id=%L', :S2, :A));
-- 5b : un autre utilisateur ne voit rien à modifier (RLS) — 0 ligne, pas d'effet
-- 6 : policy
insert into r select '6 policy users read own', 'présente', case when exists(select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users read own') then 'présente' else 'ABSENTE' end;
select preuve, attendu, obtenu, case when obtenu like attendu||'%' then '✅' else '❌' end from r;
rollback;
