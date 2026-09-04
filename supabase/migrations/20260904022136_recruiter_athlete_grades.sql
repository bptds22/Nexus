-- ═══════════════════════════════════════════════════════════════
-- LOT 2 — GRADE RECRUTEUR : recruiter_athlete_grades
--
-- Le grade est le jugement de valeur PRIVÉ d'un recruteur sur un athlète
-- (A+ … D). Ce n'est pas une évaluation de coach, et ce n'est pas un stage
-- de pipeline : c'est l'opinion concurrentielle de celui qui recrute.
--
-- ── POURQUOI UNE TABLE, ET PAS `evaluations` ─────────────────────────────
-- `evaluations` porte le jugement du COACH sur SON athlète, avec une
-- contrainte d'unicité (coach_id, athlete_id) et une sémantique « la plus
-- récente gagne » déjà ambiguë en production : partner_athlete_profile
-- retient `created_at desc` là où selectBestEvaluation (frontend) retient
-- `updated_at desc`. Deux tris concurrents sur la même notion, dans du code
-- livré. Y verser un second auteur — le recruteur — ferait collisionner
-- deux jugements de nature opposée sur une règle déjà instable.
--
-- ── LA FRONTIÈRE : PREMIÈRE TABLE RECRUTEUR RÉELLEMENT PRIVÉE ────────────
-- Relevé sur pg_policies avant écriture (prod, 2026-09-03) — AUCUNE des
-- trois tables recruteur existantes n'est « propriétaire seul » :
--   recruiter_pipeline   4 policies SELECT (recruteur, coach, cégep, admin)
--   recruiter_favorites  lue par coach, athlète, admin, cégep admin
--   recruiter_notes      « notes privées » — et pourtant `cegep admin read
--                        notes` + `cegep admin insert notes`
-- Aucune n'est donc un gabarit valable ici. Le grade ne se copie sur
-- personne : propriétaire seul, sur les quatre verbes, sans exception.
-- Voir docs/pipeline-recruteur-frontieres.md.
--
-- ── LA PORTE LAISSÉE OUVERTE (arbitrage BP, 2026-09-03) ──────────────────
-- PAS de policy admin en lecture, délibérément. `is_admin()` ne laisse
-- passer qu'un seul compte aujourd'hui — celui du fondateur — qui dispose
-- déjà du dashboard Supabase et de la service-role pour un vrai besoin de
-- support : un chemin hors-bande et traçable, là où une policy est
-- permanente et invisible. Expand-then-contract : l'ajouter plus tard est
-- une migration, la retirer une fois qu'un écran admin s'est construit
-- dessus est un chantier.
-- LE JOUR OÙ UN ÉCRAN ADMIN L'EXIGE VRAIMENT : ajouter ici une policy
-- SELECT `is_admin()` — et seulement SELECT.
--
-- ── ON DELETE CASCADE : LA LEÇON, ENFIN APPLIQUÉE ────────────────────────
-- Les six clés étrangères des trois tables recruteur existantes sont NUES
-- (relevé pg_constraint, prod, 2026-09-03) : supprimer un athlète ou un
-- compte recruteur bute dessus. Cette table part avec CASCADE sur les deux.
-- La dette des six autres est consignée dans docs/post-launch-bugs.md ;
-- elle ne se corrige PAS ici (ce serait toucher trois tables vivantes pour
-- un lot qui n'en crée qu'une).
--
-- ── LE GATE PRO EST SUR L'ÉCRITURE, PAS SUR LA LECTURE NI LA SUPPRESSION ─
-- `user_has_pro()` garde INSERT et UPDATE. Volontairement PAS le DELETE :
-- un recruteur qui retombe en `free` doit pouvoir retirer ses grades, sinon
-- le déclassement l'enferme avec des données qu'il ne peut plus ni modifier
-- ni effacer. Et pas le SELECT : il continue de voir ce qu'il a écrit quand
-- il payait — on ne cache pas à quelqu'un ses propres données.
--
-- PIÈGE DE SIGNATURE, relevé avant écriture : `user_has_pro(uid uuid default
-- auth.uid())` accepte un argument et L'IGNORE — son corps appelle
-- `get_user_tier()`, qui teste `auth.uid()` (et ignore lui aussi son propre
-- param). On l'appelle donc NUE, comme ici. Ne jamais écrire
-- `user_has_pro(recruiter_id)` en croyant interroger ce recruteur-là : ce
-- serait toujours l'appelant qui répond. Même défaut que
-- `is_approved_partner`, consigné au backlog.
--
-- Le contrôle de rôle RECRUTEUR reprend la forme de `Recruiters manage own
-- notes` (EXISTS sur users.role) plutôt que le trigger
-- require_recruiter_role() de recruiter_pipeline : une policy de moins à
-- faire vivre qu'un trigger de plus.
--
-- `(select auth.uid())` et non `auth.uid()` nu : forme retenue partout
-- ailleurs dans ce schéma — Postgres l'évalue une fois (InitPlan) au lieu
-- d'une fois par ligne.
--
-- ── LE SILENCE EST UNE DÉCISION, PAS UN OUBLI ─────────────────────────
-- Un seul trigger sur cette table : `set_updated_at`. AUCUN journal, AUCUNE
-- notification. Ce n'est pas une omission — c'est la condition du mot
-- "privé". Relevé à côté (prod, 2026-09-03) : `recruiter_favorites` porte
-- SEPT triggers, dont `notify_athlete_favorited` et
-- `notify_parent_favorited` ; `recruiter_pipeline` en porte six, dont
-- `notify_parent_pipeline_stage` et `log_pipeline_change`. Mettre un athlète
-- en favori le lui dit ; le noter "C" ne doit RIEN lui dire, ni à son
-- parent, ni au fil d'activité du coach. Le jour où quelqu'un voudra
-- brancher un log ici, c'est cette ligne qu'il faut lire d'abord.
--
-- AUCUNE RPC ici : lectures et écritures directes sous RLS, comme le
-- pipeline. Donc aucun REVOKE anon à poser (la règle SECURITY DEFINER
-- maison ne s'applique qu'aux fonctions privilégiées, et il n'y en a pas).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.recruiter_athlete_grades (
  id           uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references auth.users(id)      on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  grade        varchar(2) not null
               check (grade in ('A+','A','B+','B','C+','C','D')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (recruiter_id, athlete_id)
);

-- Le kanban charge TOUS les grades du recruteur courant en une passe :
-- l'index porte sur recruiter_id seul. L'unicité (recruiter_id, athlete_id)
-- fournit déjà l'index composite pour l'upsert.
create index if not exists recruiter_athlete_grades_recruiter_idx
  on public.recruiter_athlete_grades (recruiter_id);

-- set_updated_at() est le gabarit maison : 13 triggers l'utilisent
-- (athletes, evaluations, users, subscriptions…) contre 2 pour son
-- doublon update_updated_at(). On prend le majoritaire.
drop trigger if exists trg_grades_updated_at on public.recruiter_athlete_grades;
create trigger trg_grades_updated_at
  before update on public.recruiter_athlete_grades
  for each row
  execute function public.set_updated_at();

alter table public.recruiter_athlete_grades enable row level security;

-- ── RLS — PROPRIÉTAIRE SEUL, QUATRE VERBES ──────────────────────────────

drop policy if exists recruiter_athlete_grades_select on public.recruiter_athlete_grades;
create policy recruiter_athlete_grades_select
  on public.recruiter_athlete_grades
  for select to authenticated
  using (recruiter_id = (select auth.uid()));

drop policy if exists recruiter_athlete_grades_insert on public.recruiter_athlete_grades;
create policy recruiter_athlete_grades_insert
  on public.recruiter_athlete_grades
  for insert to authenticated
  with check (
    recruiter_id = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role = 'RECRUTEUR'::user_role
    )
    and public.user_has_pro()
  );

drop policy if exists recruiter_athlete_grades_update on public.recruiter_athlete_grades;
create policy recruiter_athlete_grades_update
  on public.recruiter_athlete_grades
  for update to authenticated
  using (recruiter_id = (select auth.uid()))
  with check (
    recruiter_id = (select auth.uid())
    and public.user_has_pro()
  );

drop policy if exists recruiter_athlete_grades_delete on public.recruiter_athlete_grades;
create policy recruiter_athlete_grades_delete
  on public.recruiter_athlete_grades
  for delete to authenticated
  using (recruiter_id = (select auth.uid()));

comment on table public.recruiter_athlete_grades is
  'Grade prive du recruteur sur un athlete (A+..D). Proprietaire seul sur les 4 verbes, aucune lecture tierce. Distinct de evaluations (jugement du coach) et de recruiter_pipeline.stage.';
