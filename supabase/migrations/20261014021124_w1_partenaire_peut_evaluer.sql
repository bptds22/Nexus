-- ═══════════════════════════════════════════════════════════════════════════
-- W1 — « Partenaire évaluateur » : permission + sports permis + garde unique.
--
-- 1. media_partners.peut_evaluer (false par défaut). La garde W0
--    (media_partners_garde_colonnes, liste blanche) ne la nomme pas : un
--    partenaire ne peut donc PAS la modifier lui-même. Ce fichier ne touche
--    pas à la garde ; la gate ci-dessous vérifie qu'elle ne l'ouvre pas.
-- 2. partenaire_sports_permis (partner_id, sport_id) : seul l'admin écrit,
--    le partenaire lit les siens, personne d'autre ne lit.
-- 3. partenaire_peut_evaluer(partner_id, sport_id) : LA garde des lots W2–W5.
--    Vrai seulement si, pour l'appelant :
--      · partenaire_admis() (rôle PARTNER + ligne APPROVED) ;
--      · partner_id est SA ligne (user_id = auth.uid()) — la fonction ne
--        renseigne pas sur la permission d'un autre partenaire ;
--      · peut_evaluer = true ;
--      · le sport figure dans partenaire_sports_permis.
--    Sans session (service_role, cron), auth.uid() est NULL → faux.
--
-- Additif seul : aucun partenaire existant ne change de comportement
-- (peut_evaluer = false partout, aucun sport permis).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La permission ───────────────────────────────────────────────────────
alter table public.media_partners
  add column peut_evaluer boolean not null default false;

comment on column public.media_partners.peut_evaluer is
  'Partenaire évaluateur (W1) : posé par l''admin seulement (garde W0 en liste blanche). Lu par partenaire_peut_evaluer().';

-- ── 2. Les sports permis ───────────────────────────────────────────────────
create table public.partenaire_sports_permis (
  partner_id uuid not null references public.media_partners(id) on delete cascade,
  sport_id   uuid not null references public.sports(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint partenaire_sports_permis_pkey primary key (partner_id, sport_id)
);

comment on table public.partenaire_sports_permis is
  'Sports qu''un partenaire évaluateur peut évaluer (W1). Écriture admin seulement ; le partenaire lit les siens.';

create index partenaire_sports_permis_sport_idx on public.partenaire_sports_permis (sport_id);

alter table public.partenaire_sports_permis enable row level security;

create policy psp_admin_tout
  on public.partenaire_sports_permis
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Sous-requête sur media_partners : le partenaire y lit sa propre ligne
-- (« Partners read own profile ») ; pas de lecture de users.
create policy psp_partenaire_lit_les_siens
  on public.partenaire_sports_permis
  for select
  to authenticated
  using (exists (select 1 from public.media_partners mp
                  where mp.id = partner_id and mp.user_id = auth.uid()));

revoke all on public.partenaire_sports_permis from public, anon, authenticated;
grant select, insert, update, delete on public.partenaire_sports_permis to authenticated;

-- ── 3. La garde unique ─────────────────────────────────────────────────────
create function public.partenaire_peut_evaluer(p_partner_id uuid, p_sport_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select coalesce(
    public.partenaire_admis()
    and exists (select 1 from public.media_partners mp
                 where mp.id = p_partner_id
                   and mp.user_id = auth.uid()
                   and mp.peut_evaluer)
    and exists (select 1 from public.partenaire_sports_permis s
                 where s.partner_id = p_partner_id
                   and s.sport_id = p_sport_id),
    false)
$$;

comment on function public.partenaire_peut_evaluer(uuid, uuid) is
  'Garde unique W2–W5 : l''appelant est un partenaire admis, partner_id est sa ligne, peut_evaluer = true et le sport est permis.';

revoke all on function public.partenaire_peut_evaluer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.partenaire_peut_evaluer(uuid, uuid) to authenticated, service_role;

-- ── Gates (comparaison complète, jamais par inclusion) ─────────────────────
do $$
declare
  vus text[];
  veut text[];
  src text;
begin
  -- a. La garde W0 ne laisse pas passer peut_evaluer.
  select prosrc into src from pg_proc
   where oid = 'public.media_partners_garde_colonnes()'::regprocedure;
  if src ~ 'peut_evaluer' then
    raise exception 'NEXUS: la garde W0 nomme peut_evaluer — le partenaire pourrait la modifier';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.media_partners'::regclass
                    and tgname = 'trg_media_partners_garde_colonnes'
                    and tgenabled = 'O') then
    raise exception 'NEXUS: trigger trg_media_partners_garde_colonnes absent ou inactif';
  end if;

  -- b. Aucun partenaire existant n'est évaluateur.
  if exists (select 1 from public.media_partners where peut_evaluer) then
    raise exception 'NEXUS: un partenaire a peut_evaluer = true après l''ajout de la colonne';
  end if;

  -- c. ACL de la garde.
  veut := array['authenticated', 'postgres', 'service_role'];
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.partenaire_peut_evaluer(uuid, uuid)'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL partenaire_peut_evaluer = %, attendu %', vus, veut;
  end if;

  -- d. Policies de partenaire_sports_permis.
  veut := array[
    'psp_admin_tout:ALL:{authenticated}',
    'psp_partenaire_lit_les_siens:SELECT:{authenticated}'
  ];
  select array_agg(policyname || ':' || cmd || ':' || roles::text order by policyname) into vus
    from pg_policies
   where schemaname = 'public' and tablename = 'partenaire_sports_permis';
  if vus is distinct from veut then
    raise exception 'NEXUS: policies partenaire_sports_permis = %, attendu %', vus, veut;
  end if;

  -- e. Privilèges de table pour anon / authenticated (PUBLIC n'en a aucun).
  veut := array['authenticated:DELETE', 'authenticated:INSERT', 'authenticated:SELECT', 'authenticated:UPDATE'];
  -- aclexplode plutôt qu'information_schema : ce dernier filtre selon les
  -- rôles de l'appelant, et postgres n'est pas superuser en prod.
  select array_agg(g.nom || ':' || a.privilege_type order by g.nom, a.privilege_type) into vus
    from pg_class c,
         lateral aclexplode(c.relacl) a,
         lateral (select case when a.grantee = 0 then 'PUBLIC'
                              else a.grantee::regrole::text end as nom) g
   where c.oid = 'public.partenaire_sports_permis'::regclass
     and g.nom in ('anon', 'authenticated', 'PUBLIC');
  if vus is distinct from veut then
    raise exception 'NEXUS: privilèges partenaire_sports_permis = %, attendu %', vus, veut;
  end if;
end $$;
