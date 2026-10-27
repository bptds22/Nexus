-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1 cégep — crochet bleu au cégépien DÉJÀ ancré (décision BP 2026-10-27 : oui pour le témoin de
-- Jonquière). Écriture de DONNÉES, gardée. APRÈS C1b en prod seulement. Fichier GÉNÉRÉ (mode rejeu-blanc)
-- par scripts/cegep-lot-c1/generer-crochet.sh : rejeu-blanc (finit par ROLLBACK) ou apply (COMMIT).
--
-- UNE transaction : gardes (C1b inscrite, interrupteur OFF, exactement 1 cégépien(s) ACTIF non
-- vérifié(s), comme au relevé du 2026-10-27) → UPDATE verified = true, méthode auto_cegep, aucun
-- auteur → aucun avis ni activité créés (C1b les fait taire pour auto_cegep) → admin_operations
-- CEGEP_CROCHET_AUTO_EXISTANTS (apply) → rollback. Aucun nom affiché. Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local search_path = public, extensions;
set local application_name = 'nexus-cegep-c1-crochet-rejeu-blanc';
select now() as debut, current_user;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261027230100') then
    raise exception 'NEXUS: C1b (20261027230100) n''est pas inscrite — l''appliquer d''abord';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_CROCHET_AUTO_EXISTANTS') then
    raise exception 'NEXUS: le crochet des cégépiens existants a déjà été posé';
  end if;
  if public.lancement_collegial_actif() then
    raise exception 'NEXUS: interrupteur lancement_collegial ON — à poser interrupteur OFF';
  end if;
end $$;

create temp table _cibles on commit drop as
select a.id from public.athletes a join public.schools s on s.id = a.school_id
 where s.type::text = 'CEGEP' and a.status = 'ACTIF' and not a.verified;
select (select count(*) from _cibles) as cegepiens_non_verifies,
       (select count(*) from public.athletes a join public.schools s on s.id = a.school_id where s.type::text = 'CEGEP') as cegepiens_total;
do $$
begin
  if (select count(*) from _cibles) <> 1 then
    raise exception 'NEXUS: % cégépien(s) ACTIF non vérifié(s), attendu 1 — relevé à refaire', (select count(*) from _cibles);
  end if;
end $$;

create temp table _avant on commit drop as
select (select count(*) from public.athlete_notifications) as notifications,
       (select count(*) from public.activities) as activites,
       (select count(*) from public.recruiter_activity_log) as journal_recruteurs,
       (select count(*) from public.newsroom_events) as newsroom,
       (select count(*) from net.http_request_queue) as file_pg_net,
       (select count(*) filter (where verified) from public.athletes) as verifiees;

update public.athletes a
   set verified = true, verification_method = 'auto_cegep', verified_at = now(), verified_by = null
  from _cibles c where a.id = c.id;

select 'après' as phase,
       (select count(*) from public.athletes a join _cibles c using (id)
         where a.verified and a.verification_method = 'auto_cegep' and a.verified_by is null) as poses_auto_cegep,
       (select count(*) from public.athlete_notifications) - b.notifications as notifications_ajoutees,
       (select count(*) from public.activities) - b.activites as activites_ajoutees,
       (select count(*) from public.recruiter_activity_log) - b.journal_recruteurs as journal_recruteurs_ajoute,
       (select count(*) from public.newsroom_events) - b.newsroom as newsroom_ajoutes,
       (select count(*) from net.http_request_queue) - b.file_pg_net as pg_net_ajoutes,
       (select count(*) filter (where verified) from public.athletes) - b.verifiees as verifiees_en_plus
  from _avant b;
do $$
begin
  if (select count(*) from public.athletes a join _cibles c using (id)
       where a.verified and a.verification_method = 'auto_cegep' and a.verified_by is null) <> 1 then
    raise exception 'NEXUS: crochet non posé sur toutes les cibles';
  end if;
  if (select count(*) from public.athlete_notifications) <> (select notifications from _avant)
     or (select count(*) from public.activities) <> (select activites from _avant)
     or (select count(*) from public.newsroom_events) <> (select newsroom from _avant)
     or (select count(*) from net.http_request_queue) <> (select file_pg_net from _avant) then
    raise exception 'NEXUS: le crochet a créé un avis, une activité, une nouvelle ou un envoi';
  end if;
end $$;

-- rejeu à blanc : rien n'est inscrit dans admin_operations.
select clock_timestamp() as avant_fin;
rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
