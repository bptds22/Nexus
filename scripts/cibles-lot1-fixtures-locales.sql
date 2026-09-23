-- ═══════════════════════════════════════════════════════════════════════════
-- cibles-lot1-fixtures-locales.sql — le décor de la preuve du lot 1
--
-- 🔴 DOCKER LOCAL UNIQUEMENT. Ce fichier CRÉE des comptes et des athlètes.
--    Il ne doit JAMAIS toucher la prod : il n'y existe plus d'athlète
--    jetable, chaque fiche restante appartient à une personne réelle, le
--    plus souvent mineure (cf. CLAUDE.md, « Athlete fixtures »).
--
-- À REJOUER AVEC (depuis l'outil PowerShell, jamais git-bash — MSYS
-- réécrirait /tmp/... en chemin Windows) :
--
--   docker cp scripts/cibles-lot1-fixtures-locales.sql supabase_db_Nexus:/tmp/f.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/f.sql
--
-- CE QUE LE DÉCOR DOIT CONTENIR, ET POURQUOI CHAQUE PIÈCE EST LÀ
-- --------------------------------------------------------------
--  · un athlète ACTIF et un athlète DESACTIVE ciblant LE MÊME cégep
--    → sans le second, le filtre `status = 'ACTIF'` de la RPC (miroir de
--      recruiter_athlete_cards) serait vrai sans être testé ;
--  · un recruteur AVEC cégep et un recruteur SANS
--    → le second prouve que la RPC rend zéro ligne au lieu de LEVER ;
--  · un coach rattaché à une école SECONDAIRE **qui porte une cible**
--    (posée en fin de fichier)
--    → sans cette cible, « coach = 0 ligne » serait vrai par absence de
--      données et ne prouverait rien de la garde `role = 'RECRUTEUR'`.
--      C'est le piège qui a failli passer à la première rédaction.
--
-- Les fixtures restent en place après la preuve (décision BP : pouvoir
-- rejouer). Pour repartir à neuf : `supabase db reset`.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

-- ── écoles ──────────────────────────────────────────────────────────────
insert into public.schools (id, name, type) values
  ('11111111-0000-0000-0000-000000000001', 'Cégep Preuve Lot1',      'CEGEP'),
  ('11111111-0000-0000-0000-000000000002', 'École Secondaire Preuve','SECONDAIRE')
on conflict (id) do nothing;

-- ── comptes auth (FK public.users -> auth.users) ────────────────────────
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('22222222-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r1.avec.cegep@preuve.local',now(),now()),
  ('22222222-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r2.sans.cegep@preuve.local',now(),now()),
  ('22222222-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c1.coach@preuve.local',       now(),now()),
  ('22222222-0000-0000-0000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a1.athlete@preuve.local',     now(),now())
on conflict (id) do nothing;

-- ── profils applicatifs ─────────────────────────────────────────────────
-- R1 : recruteur AVEC cégep · R2 : recruteur SANS cégep (school_id null)
-- C1 : coach rattaché à une école SECONDAIRE — c'est le cas que la garde
--      `role = 'RECRUTEUR'` doit fermer même s'il porte bien un school_id.
-- Le trigger `on_auth_user_created` a DÉJÀ créé la ligne public.users à
-- l'insertion dans auth.users ci-dessus : on met à jour, on n'insère pas.
insert into public.users (id, email, role, status, school_id) values
  ('22222222-0000-0000-0000-00000000000a','r1.avec.cegep@preuve.local','RECRUTEUR','ACTIF','11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-00000000000b','r2.sans.cegep@preuve.local','RECRUTEUR','ACTIF', null),
  ('22222222-0000-0000-0000-00000000000c','c1.coach@preuve.local',     'COACH',    'ACTIF','11111111-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-00000000000d','a1.athlete@preuve.local',   'ATHLETE',  'ACTIF', null)
on conflict (id) do update
  set role = excluded.role, status = excluded.status, school_id = excluded.school_id;

-- ── athlètes : un ACTIF, un NON-ACTIF, tous deux ciblant le MÊME cégep ──
-- Le non-ACTIF est le cœur de la preuve : il doit être absent du résultat,
-- en miroir de recruiter_athlete_cards (`AND a.status = 'ACTIF'`).
insert into public.athletes (id, first_name, last_name, status, user_id) values
  ('33333333-0000-0000-0000-00000000000a','Actif',   'Preuve','ACTIF',    '22222222-0000-0000-0000-00000000000d'),
  ('33333333-0000-0000-0000-00000000000b','Inactif', 'Preuve','DESACTIVE', null)
on conflict (id) do nothing;

-- ── cibles : les deux pointent le cégep de R1 ───────────────────────────
insert into public.athlete_targets (athlete_id, school_id, created_at) values
  ('33333333-0000-0000-0000-00000000000a','11111111-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('33333333-0000-0000-0000-00000000000b','11111111-0000-0000-0000-000000000001', now() - interval '1 day')
on conflict (athlete_id, school_id) do nothing;

-- ── LA CIBLE QUI REND LE TEST « COACH » SIGNIFIANT ──────────────────────
-- Elle pointe l'école SECONDAIRE du coach. Sans elle, le coach rendrait
-- zéro ligne parce qu'aucune donnée ne le concerne — pas parce que la
-- garde `role = 'RECRUTEUR'` l'arrête. Avec elle, un coach qui franchirait
-- la garde repartirait avec 1 ligne, et le test échouerait bruyamment.
insert into public.athlete_targets (athlete_id, school_id, created_at) values
  ('33333333-0000-0000-0000-00000000000a','11111111-0000-0000-0000-000000000002', now())
on conflict (athlete_id, school_id) do nothing;

commit;

select 'FIXTURES POSEES — cibles=' || (select count(*) from public.athlete_targets)::text
    || ' athletes=' || (select count(*) from public.athletes)::text as etat;
