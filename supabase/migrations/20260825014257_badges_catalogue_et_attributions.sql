-- ═══════════════════════════════════════════════════════════════
-- BADGES — le badge devient un fait sur l'ATHLÈTE
--
-- POURQUOI
-- Les badges vivaient dans evaluations.distinctions (jsonb), sur une table
-- UNIQUE(coach_id, athlete_id) : ils étaient donc par COACH. Deux coachs
-- évaluant le même athlète portaient deux jeux concurrents, et
-- selectBestEvaluation n'en affichait qu'un — celui dont updated_at était le
-- plus récent, même si le coach n'avait pas touché aux badges. Une simple
-- sauvegarde de taille pouvait changer les badges affichés.
--
-- « Capitaine » est un fait sur l'athlète, pas une opinion de coach —
-- contrairement à la cote et aux 14 traits, qui méritent une ligne par
-- évaluateur. distinctions était le seul champ FACTUEL logé dans une table
-- d'OPINIONS. Toute la complexité en découlait.
--
-- CETTE MIGRATION NE SUPPRIME NI NE VIDE evaluations.distinctions : la
-- colonne reste, alimentée par un trigger miroir (migration suivante) pour
-- l'app mobile 1.2 en magasin, qui ne connaîtra jamais ces tables.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Catalogue ─────────────────────────────────────────────────
create table public.badges (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  libelle           text not null,
  famille           text not null check (famille in ('universel','honneur','sport')),
  sport_id          uuid null references public.sports(id),
  requiert_contexte boolean not null default false,
  ordre             int not null default 0,
  actif             boolean not null default true,
  created_at        timestamptz not null default now()
);

comment on table public.badges is
$c$Catalogue des badges. `code` est la clé stable citée par le frontend et
correspond au nom du fichier SVG (sans préfixe ni extension) ; l'uuid ne sort
jamais de la base.

famille :
  universel — sans contexte, tous sports
  honneur   — fait MILLÉSIMÉ, contexte obligatoire, HORS PLAFOND
  sport     — spécifique à un sport, compte dans le plafond

sport_id est nullable par construction (les universels et honneurs n'en ont
pas), mais une ligne famille='sport' avec sport_id NULL ne peut être filtrée
par aucun écran : voir le commentaire du seed.$c$;

comment on column public.badges.requiert_contexte is
'Quand true, athlete_badges.contexte doit être renseigné — vérifié par le trigger trg_badge_contexte_requis (un CHECK ne peut pas lire une autre table).';

-- ── 2. Attributions ──────────────────────────────────────────────
create table public.athlete_badges (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  badge_id     uuid not null references public.badges(id),
  contexte     text null,
  attribue_par uuid null references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  retire_le    timestamptz null,
  retire_par   uuid null references public.users(id) on delete set null,
  constraint athlete_badges_retrait_coherent
    check ((retire_le is null and retire_par is null) or retire_le is not null)
);

comment on table public.athlete_badges is
$c$Attributions. Le RETRAIT est doux (retire_le / retire_par) : un badge retiré
reste dans l'historique et sort des lectures. Aucune policy DELETE n'est
définie — la suppression dure est donc refusée à tous sauf aux rôles BYPASSRLS.$c$;

comment on column public.athlete_badges.contexte is
$c$Le millésime fait PARTIE DE LA CLÉ : MVP 2025 et MVP 2026 sont deux badges
distincts, pas un doublon. Formes attendues (non contraintes ici, le frontend
les compose) : « Verges · 2026 » pour leader-equipe / leader-ligue, « 2026 »
pour mvp / equipe-etoiles, texte libre pour nexus-x.$c$;

-- Unicité sur les lignes VIVANTES seulement : un badge retiré puis réattribué
-- ne doit pas être bloqué par son propre historique.
-- NULLS NOT DISTINCT (PG 15+) est indispensable : sans lui, deux lignes à
-- contexte NULL seraient toutes deux acceptées — Postgres considère NULL
-- distinct de NULL par défaut, et « Capitaine » pourrait être posé deux fois.
create unique index athlete_badges_unicite_vivante
  on public.athlete_badges (athlete_id, badge_id, contexte)
  nulls not distinct
  where retire_le is null;

create index athlete_badges_athlete_idx on public.athlete_badges (athlete_id);
create index athlete_badges_badge_idx   on public.athlete_badges (badge_id);

-- ── 3. Contexte obligatoire — trigger, pas CHECK ─────────────────
-- Un CHECK ne peut pas lire badges.requiert_contexte : la contrainte est
-- inter-tables. Elle vit donc dans un trigger, et s'applique à l'INSERT comme
-- à l'UPDATE (on ne doit pas pouvoir vider le contexte d'un honneur).
create or replace function public.badge_contexte_requis()
  returns trigger language plpgsql
  security definer set search_path to 'public'
as $fn$
declare v_requis boolean; v_code text;
begin
  select requiert_contexte, code into v_requis, v_code
  from public.badges where id = new.badge_id;

  if v_requis is null then
    raise exception 'NEXUS: badge_id % inconnu au catalogue', new.badge_id;
  end if;

  if v_requis and coalesce(btrim(new.contexte), '') = '' then
    raise exception 'NEXUS: le badge « % » exige un contexte (millésime, statistique…)', v_code;
  end if;

  return new;
end;
$fn$;

create trigger trg_badge_contexte_requis
  before insert or update on public.athlete_badges
  for each row execute function public.badge_contexte_requis();

-- ── 4. Plafond — EN BASE, pas en JS ──────────────────────────────
-- Le plafond n'existait qu'en JavaScript, dans 35 sites applicatifs : un
-- UPDATE direct pouvait en poser 12. Il devient une garantie de la base.
--
-- 5 badges VIVANTS maximum de famille 'universel' ou 'sport'.
-- Les 'honneur' sont HORS PLAFOND : un honneur est un fait millésimé, pas un
-- choix d'affichage. Un athlète de terminale avec trois MVP ne doit pas
-- sacrifier ses badges de sport pour les montrer.
create or replace function public.badge_plafond()
  returns trigger language plpgsql
  security definer set search_path to 'public'
as $fn$
declare v_n int; v_max constant int := 5;
begin
  -- Ne compte que les lignes VIVANTES et les familles plafonnées.
  select count(*) into v_n
  from public.athlete_badges ab
  join public.badges b on b.id = ab.badge_id
  where ab.athlete_id = new.athlete_id
    and ab.retire_le is null
    and b.famille in ('universel','sport');

  if v_n > v_max then
    raise exception
      'NEXUS: plafond de % badges de sport/universels atteint pour cet athlète (% actifs). Les honneurs ne comptent pas dans ce plafond.',
      v_max, v_n;
  end if;
  return null;
end;
$fn$;

-- AFTER : le compte doit inclure la ligne qu'on vient d'écrire.
-- Sur UPDATE, un retrait (retire_le posé) fait BAISSER le compte, jamais
-- monter — la garde reste correcte sans distinguer les cas.
create trigger trg_badge_plafond
  after insert or update on public.athlete_badges
  for each row execute function public.badge_plafond();

-- ── 5. Qui peut attribuer ────────────────────────────────────────
-- SECURITY DEFINER + row_security off : opaque au planner, aucune sous-requête
-- RLS inline dans la policy.
create or replace function public.coach_can_award_badge(p_athlete_id uuid)
  returns boolean language sql stable
  security definer set row_security to 'off' set search_path to 'public'
as $fn$
  select public.is_coach() and (
       exists (select 1 from public.athletes a
               where a.id = p_athlete_id and a.coach_id = auth.uid())
    or public.coach_can_manage_athlete(p_athlete_id)
    or exists (select 1 from public.athletes a
               where a.id = p_athlete_id
                 and a.school_id is not null
                 and a.school_id = public.current_user_school_id())
  );
$fn$;

revoke all on function public.coach_can_award_badge(uuid) from public, anon;
grant execute on function public.coach_can_award_badge(uuid) to authenticated;

-- ── 6. RLS ───────────────────────────────────────────────────────
alter table public.badges         enable row level security;
alter table public.athlete_badges enable row level security;

-- Catalogue : lecture publique (aucune donnée personnelle), écriture admin.
create policy "badges public read"   on public.badges for select to public using (true);
create policy "badges admins insert" on public.badges for insert to public with check (public.is_admin());
create policy "badges admins update" on public.badges for update to public using (public.is_admin()) with check (public.is_admin());
create policy "badges admins delete" on public.badges for delete to public using (public.is_admin());

-- Attributions — LECTURE. Disjonction calquée sur « authenticated read
-- evaluations », qui est la référence du schéma pour ce périmètre.
-- AUCUNE branche partenaire, VOLONTAIREMENT : la policy directe partenaire sur
-- evaluations a été retirée le 2026-08-20 (migration
-- 20260820023055_drop_partner_direct_table_policies) au profit des projections
-- SECURITY DEFINER. Rouvrir une lecture directe ici contredirait cette
-- décision. Le partenaire lit les badges par partner_athlete_profile et
-- top_athletes_view — voir la migration des projections.
create policy "athlete_badges read" on public.athlete_badges
  for select to public
  using (
       exists (select 1 from public.athletes a
               where a.id = athlete_id and a.user_id = (select auth.uid()))
    or public.coach_can_read_athlete_evals(athlete_id)
    or public.is_director_of_athlete_school(athlete_id)
    or (public.is_recruiter() and public.athlete_is_active(athlete_id))
    or public.is_admin()
  );

-- ATTRIBUTION : coach seulement, sur un athlète de son périmètre, et il ne
-- peut attribuer QU'EN SON PROPRE NOM (attribue_par = lui).
create policy "athlete_badges coach insert" on public.athlete_badges
  for insert to authenticated
  with check (
    attribue_par = (select auth.uid())
    and public.coach_can_award_badge(athlete_id)
  );

-- RETRAIT : celui qui a attribué, ou un admin. Le USING borne les lignes
-- visibles ; le WITH CHECK empêche de réécrire attribue_par ou de changer
-- l'athlète au passage.
create policy "athlete_badges retrait" on public.athlete_badges
  for update to authenticated
  using (attribue_par = (select auth.uid()) or public.is_admin())
  with check (attribue_par = (select auth.uid()) or public.is_admin());

-- Pas de policy DELETE : le retrait est doux, la suppression dure est refusée.

-- ── 7. Grants ────────────────────────────────────────────────────
-- pg_default_acl accorde ALL à anon ET authenticated sur toute table neuve du
-- schéma public. On révoque ce blanc-seing avant de rendre le nécessaire.
revoke all on public.badges         from anon, authenticated;
revoke all on public.athlete_badges from anon, authenticated;

grant select on public.badges to anon, authenticated;
grant insert, update, delete on public.badges to authenticated;   -- borné par la RLS admin

-- anon n'a RIEN sur les attributions : ce sont des données sur des mineurs.
grant select, insert, update on public.athlete_badges to authenticated;