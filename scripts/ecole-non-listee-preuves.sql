-- Preuves de 20261001211000_ecole_non_listee. LOCAL, tout annulé.
\set A '''d3a00000-0000-4000-8000-00000000a001'''
\set U '''842da8f6-41bf-4b75-bc72-83afc68bfe1c'''
begin;
update public.users set onboarding_complete=false where id=:U;
select set_config('request.jwt.claims', json_build_object('sub',:U,'role','authenticated')::text, true);
set local role authenticated;
-- l'athlète, en onboarding : pas d'école, texte libre
update public.athletes set school_id=null, coach_id=null, ecole_non_listee='Cégep Garneau' where id=:A;
-- resauvegarde à l'identique (le web sauve à chaque étape) : pas de 2e avis
update public.athletes set ecole_non_listee='Cégep Garneau ' where id=:A;
-- texte modifié : un 2e avis
update public.athletes set ecole_non_listee='Cégep Garneau, Québec' where id=:A;
-- trop court : refusé par la contrainte
savepoint s;
\set ON_ERROR_STOP 0
update public.athletes set ecole_non_listee='x' where id=:A;
rollback to savepoint s;
-- l'athlète ne lit pas admin_notifications
select count(*) as "lu par l'athlète (attendu 0)" from public.admin_notifications;
reset role;
select type, message from public.admin_notifications where related_user_id=:U order by created_at;
rollback;
