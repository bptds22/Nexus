-- Defait le banc : consentement_partenaire_v2, push_preferences, athletes (opt-in).
-- admin_operations est en AJOUT SEULEMENT (declencheur admin_operations_immuable) : les lignes du
-- banc y restent, comptees a la fin. On ne contourne pas ce declencheur.
\set ON_ERROR_STOP on
begin;
delete from public.consentement_partenaire_v2;
insert into public.consentement_partenaire_v2
       (athlete_id, accepte_le, refuse_le, plus_tard_nb, plus_tard_le, demande_parent_le, push_le, maj_le)
select athlete_id, accepte_le, refuse_le, plus_tard_nb, plus_tard_le, demande_parent_le, push_le, maj_le
  from _test_relance_v2.cpv2;

delete from public.push_preferences pp using _test_relance_v2.roles r where r.user_id = pp.user_id;
insert into public.push_preferences select * from _test_relance_v2.prefs_avant;

set local session_replication_role = replica;
update public.athletes a set partner_visibility_opt_in = r.opt_in_avant, partner_visibility_opted_in_at = r.opted_avant
  from _test_relance_v2.roles r where r.athlete_id = a.id;
set local session_replication_role = origin;

do $$
begin
  if (select count(*) from public.consentement_partenaire_v2) <> (select count(*) from _test_relance_v2.cpv2)
     or exists (select athlete_id, accepte_le, refuse_le, plus_tard_nb, plus_tard_le, demande_parent_le, push_le, maj_le
                  from public.consentement_partenaire_v2
                except
                select athlete_id, accepte_le, refuse_le, plus_tard_nb, plus_tard_le, demande_parent_le, push_le, maj_le
                  from _test_relance_v2.cpv2) then
    raise exception 'NEXUS: consentement_partenaire_v2 differe de l''instantane';
  end if;
  if exists (select 1 from public.athletes a join _test_relance_v2.roles r on r.athlete_id = a.id
              where a.partner_visibility_opt_in is distinct from r.opt_in_avant
                 or a.partner_visibility_opted_in_at is distinct from r.opted_avant) then
    raise exception 'NEXUS: opt-in d''un athlete du banc non restaure';
  end if;
  if (select count(*) from net.http_request_queue) <> (select n from _test_relance_v2.queue_avant) then
    raise exception 'NEXUS: net.http_request_queue a bouge (un appel reseau a ete mis en file)';
  end if;
end $$;
select 'lignes du banc dans admin_operations (journal immuable) : ' || count(*)
  from public.admin_operations where id not in (select id from _test_relance_v2.ops_avant);
drop schema _test_relance_v2 cascade;
commit;
select 'RESTAURE OK';
