-- 20260917150912_search_filter_events
--
-- APPLIQUEE en PROD le 2026-09-17 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligne sur la version REELLE assignee par MCP (redigee sous
-- 20260917140000). Contre-verifie apres apply : ACL complete, RLS + 2 policies,
-- job pg_cron #3 actif, anon refuse (insert et select, 42501).
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- La barre de filtres de la recherche est saturee et BP veut savoir quels
-- filtres servent AVANT d'en cacher. Aucune telemetrie n'existait (diagnostic
-- du 2026-09-17) : pas de SDK d'analytics, et `recruiter_activity_log` ne
-- porte aucun evenement de recherche.
--
-- ── POURQUOI UNE TABLE DEDIEE, PAS recruiter_activity_log ────────────────────
-- `recruiter_activity_log` est LUE par une douzaine d'ecrans : fils d'activite,
-- pastille de non-lus (is_read = false) de la sidebar et de la tab bar,
-- dashboards coach et athlete, stats cegep, export Loi 25. Y ecrire un
-- evenement par filtre remplirait ces fils de bruit et gonflerait les
-- compteurs de non-lus.
--
-- ── CE QUI EST ECRIT — ET CE QUI NE L'EST JAMAIS ─────────────────────────────
--   user_id       conserve (decision BP 2026-09-17) : compter des utilisateurs
--                 DISTINCTS, pour qu'un seul compte tres actif ne fasse pas la
--                 statistique. C'est donc un renseignement personnel :
--                 export /admin/loi25 + purge a 180 jours (plus bas).
--   surface       l'ecran : recherche recruteur ou roster coach.
--   filtre        la CLE du filtre, liste fermee (CHECK) — plus deux gestes :
--                 `reinitialiser` et `panneau_avance`.
--   valeur        la valeur choisie d'un menu, on/off pour une case.
--   nb_resultats  le nombre de resultats affiches une fois le filtre applique
--                 (reperer les filtres qui menent a zero).
--
--   JAMAIS le texte tape dans la recherche : il contient des noms d'athletes,
--   souvent mineurs. Le client n'envoie que `search` = on/off. AUCUN
--   athlete_id. Pour les programmes, un NOMBRE, jamais les libelles.
--   Le CHECK de longueur sur `valeur` borne ce qu'un client modifie pourrait
--   y glisser ; il ne remplace pas la discipline du client.
--
-- ── ACCES ────────────────────────────────────────────────────────────────────
-- INSERT : un recruteur sur la surface recruteur, un coach sur la surface
--          coach, et toujours pour SON compte. Helpers SECURITY DEFINER
--          (is_recruiter / is_coach), jamais de sous-requete sur users.
-- SELECT : admin seulement (is_admin) — l'export Loi 25 et l'analyse.
-- UPDATE / DELETE : aucune policy. Un journal ne se reecrit pas ; la purge
--          tourne sous pg_cron (postgres), la suppression de compte cascade.
--
-- Les DEFAULT PRIVILEGES de Supabase accordent arwdDxtm a anon ET authenticated
-- sur toute table creee dans public. RLS les neutraliserait, mais la regle est
-- de ne pas laisser de privilege sans raison : tout est revoque, puis seul le
-- necessaire est rendu. Le gate compare l'ACL COMPLETE (grantee ET droits),
-- jamais par inclusion (regle CLAUDE.md du 2026-09-07).

create table public.search_filter_events (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  surface       text not null
                check (surface in ('recruteur_recherche', 'coach_athletes')),
  filtre        text not null
                check (filtre in (
                  -- cles de lib/recherche/filtres-url.ts (FiltresRecherche)
                  'search', 'sport', 'genderFilter', 'position', 'region',
                  'promotion', 'orgType', 'leagueFilter', 'divisionFilter',
                  'minGpa', 'minRating', 'sortBy', 'verifiedOnly',
                  'withVideoOnly', 'withSportBadge', 'withAcademicBadge',
                  'hideFavorites', 'filterOuvertDemenager', 'filterOuvertPrive',
                  'filterOuvertAnglophone', 'offertParMonCegep', 'filterNewOnly',
                  'progFilterIds',
                  -- gestes
                  'reinitialiser', 'panneau_avance')),
  valeur        text check (valeur is null or char_length(valeur) <= 80),
  nb_resultats  integer check (nb_resultats is null or nb_resultats >= 0),
  created_at    timestamptz not null default now()
);

comment on table public.search_filter_events is
  'Telemetrie d''usage des filtres de recherche (recruteur + coach). Jamais le texte recherche, jamais d''athlete_id. Purge 180 jours (pg_cron search-filter-events-purge-hebdo). Inclus dans l''export /admin/loi25.';

-- Purge et agregats par periode ; export Loi 25 et cascade par utilisateur.
create index search_filter_events_created_at_idx on public.search_filter_events (created_at);
create index search_filter_events_user_id_idx    on public.search_filter_events (user_id, created_at);

alter table public.search_filter_events enable row level security;

revoke all on table public.search_filter_events from public, anon, authenticated;
grant insert, select on table public.search_filter_events to authenticated;

create policy search_filter_events_insert_own
  on public.search_filter_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (   (surface = 'recruteur_recherche' and public.is_recruiter())
         or (surface = 'coach_athletes'      and public.is_coach()))
  );

create policy search_filter_events_select_admin
  on public.search_filter_events
  for select to authenticated
  using (public.is_admin());

-- ── PURGE 180 JOURS ──────────────────────────────────────────────────────────
-- Travail separe, sur le modele d'ambassadeur-purge-hebdo (20260915090700).
-- Horaire UTC : lundi 08:20, decale de 10 min de la purge ambassadeur pour que
-- deux travaux ne se recouvrent jamais. `cron.schedule` sur un nom existant
-- REMPLACE le travail : idempotent.
select cron.schedule(
  'search-filter-events-purge-hebdo',
  '20 8 * * 1',
  $job$
  delete from public.search_filter_events
   where created_at < now() - interval '180 days';
  $job$
);

-- ── GATES ────────────────────────────────────────────────────────────────────
do $$
declare
  vus  text[];
  veut text[] := array[
    'authenticated=ar',
    'postgres=arwdDxtm',
    'service_role=arwdDxtm'
  ];
  v_n  int;
begin
  -- ACL COMPLETE : grantee ET droits, grantor retire, triee. Toute entree en
  -- trop (anon revenu, PUBLIC, droit d'UPDATE) fait echouer la migration.
  select array_agg(split_part(x, '/', 1) order by split_part(x, '/', 1)) into vus
    from pg_class c, unnest(c.relacl::text[]) as x
   where c.oid = 'public.search_filter_events'::regclass;

  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de search_filter_events = %, attendu %', vus, veut;
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.search_filter_events'::regclass) then
    raise exception 'NEXUS: RLS non active sur search_filter_events';
  end if;

  select count(*) into v_n from pg_policy where polrelid = 'public.search_filter_events'::regclass;
  if v_n <> 2 then
    raise exception 'NEXUS: search_filter_events porte % policy(s), attendu 2', v_n;
  end if;

  select count(*) into v_n from cron.job where jobname = 'search-filter-events-purge-hebdo';
  if v_n <> 1 then
    raise exception 'NEXUS: purge search-filter-events-purge-hebdo non armee (% trouve(s))', v_n;
  end if;

  raise notice 'NEXUS: search_filter_events — ACL %, RLS active, 2 policies, purge lundi 08:20 UTC (180 j).', vus;
end $$;
