-- ═══════════════════════════════════════════════════════════════
-- Référentiel de grilles d'évaluation — migration ADDITIVE.
--
-- Rien de ce qui existe n'est modifié : aucune des 14 colonnes de
-- public.evaluations n'est renommée, retypée ou supprimée ; aucun CHECK
-- n'est touché ; aucun libellé FR existant n'est modifié ; aucune des
-- fonctions calc_cote_globale / apply_approved_suggestion /
-- recruiter_athlete_profile / notify_athlete_suggestion_result n'est
-- redéfinie.
--
-- evaluations.grille_id est NULLABLE et SANS default : les lignes
-- existantes restent à NULL et AUCUN backfill n'est exécuté. NULL se lit
-- « grille GENERIQUE » — ce repli est appliqué par le frontend, pas ici.
-- Conséquence voulue : zéro ligne de evaluations touchée, donc
-- trg_evaluations_updated_at ne se déclenche jamais et l'ordre de
-- selectBestEvaluation (tri sur updated_at) reste intact.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Catalogue des grilles ──────────────────────────────────────
create table public.evaluation_grilles (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  libelle            text not null,
  sport_id           uuid null references public.sports(id),
  slot_1_libelle     text not null,
  slot_2_libelle     text not null,
  slot_3_libelle     text not null,
  slot_4_libelle     text not null,
  slot_5_libelle     text not null,
  slot_1_definition  text null,
  slot_2_definition  text null,
  slot_3_definition  text null,
  slot_4_definition  text null,
  slot_5_definition  text null,
  ordre              int  not null default 0,
  actif              boolean not null default true,
  created_at         timestamptz default now()
);

comment on table public.evaluation_grilles is
  'Référentiel des grilles d''évaluation. Porte UNIQUEMENT les libellés des 5 fentes variables ; les 9 critères fixes sont câblés côté frontend et n''apparaissent pas ici. sport_id NULL = grille transversale (GENERIQUE).';
comment on column public.evaluation_grilles.code is
  'Clé stable lisible (FB-QB, FL-RUSH, GENERIQUE). C''est elle que le frontend cite, jamais l''uuid.';

-- ── 2. Rattachement position → grille ─────────────────────────────
create table public.position_grille (
  position_id uuid primary key references public.positions(id) on delete cascade,
  grille_id   uuid not null references public.evaluation_grilles(id)
);

comment on table public.position_grille is
  'Une position mène à au plus une grille (PK sur position_id). Une position SANS ligne ici retombe sur GENERIQUE.';

-- ── 3. Binding fente → colonne ────────────────────────────────────
-- Rend explicite en base la convention que le frontend devra suivre.
-- Aucun CHECK sur `colonne` : Postgres n'offre pas de FK vers le
-- catalogue système, et un CHECK en dur ferait doublon avec le seed.
create table public.evaluation_slots (
  slot    smallint primary key check (slot between 1 and 5),
  colonne text not null unique
);

comment on table public.evaluation_slots is
  'Quelle colonne de public.evaluations alimente chacune des 5 fentes variables. Table de documentation exécutable : elle ne contraint rien, elle publie la convention.';

-- ── 4. Rattachement de l'évaluation à sa grille ───────────────────
alter table public.evaluations
  add column grille_id uuid null references public.evaluation_grilles(id);

comment on column public.evaluations.grille_id is
  'Grille ayant servi à la saisie. NULL = GENERIQUE (repli appliqué par le frontend). Volontairement nullable et sans default : aucun backfill n''a été exécuté, les lignes antérieures restent à NULL.';

-- ── 5. RLS — aligné sur public.positions / public.sports ──────────
alter table public.evaluation_grilles enable row level security;
alter table public.position_grille    enable row level security;
alter table public.evaluation_slots   enable row level security;

create policy "evaluation_grilles public read" on public.evaluation_grilles
  for select using (true);
create policy "evaluation_grilles admins insert" on public.evaluation_grilles
  for insert with check (public.is_admin());
create policy "evaluation_grilles admins update" on public.evaluation_grilles
  for update using (public.is_admin()) with check (public.is_admin());
create policy "evaluation_grilles admins delete" on public.evaluation_grilles
  for delete using (public.is_admin());

create policy "position_grille public read" on public.position_grille
  for select using (true);
create policy "position_grille admins insert" on public.position_grille
  for insert with check (public.is_admin());
create policy "position_grille admins update" on public.position_grille
  for update using (public.is_admin()) with check (public.is_admin());
create policy "position_grille admins delete" on public.position_grille
  for delete using (public.is_admin());

create policy "evaluation_slots public read" on public.evaluation_slots
  for select using (true);
create policy "evaluation_slots admins insert" on public.evaluation_slots
  for insert with check (public.is_admin());
create policy "evaluation_slots admins update" on public.evaluation_slots
  for update using (public.is_admin()) with check (public.is_admin());
create policy "evaluation_slots admins delete" on public.evaluation_slots
  for delete using (public.is_admin());

-- ── 6. Grants ─────────────────────────────────────────────────────
-- pg_default_acl accorde ALL à anon ET authenticated sur toute table
-- neuve du schéma public. On révoque ce blanc-seing, puis on rend
-- exactement ce qui est voulu :
--   anon          → SELECT seul (référentiel public, aucune donnée perso)
--   authenticated → SELECT + écritures, bornées par la RLS is_admin()
-- Sans le GRANT d'écriture à authenticated, les policies admin seraient
-- inatteignables : le grant de table est évalué AVANT la RLS.
revoke all on public.evaluation_grilles from anon, authenticated;
revoke all on public.position_grille    from anon, authenticated;
revoke all on public.evaluation_slots   from anon, authenticated;

grant select on public.evaluation_grilles to anon;
grant select on public.position_grille    to anon;
grant select on public.evaluation_slots   to anon;

grant select, insert, update, delete on public.evaluation_grilles to authenticated;
grant select, insert, update, delete on public.position_grille    to authenticated;
grant select, insert, update, delete on public.evaluation_slots   to authenticated;
