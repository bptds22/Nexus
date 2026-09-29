-- ═══════════════════════════════════════════════════════════════════════════
-- Relance des PARENTS — consentement « visibilité partenaires » par lien.
-- Décision BP 2026-09-28 (registre §48, §52). Modèle : relance inscription
-- (20260921152458).
--
-- LE CONSTAT. 57 mineurs ACTIF ne sont pas visibles des partenaires ; pour
-- ~33 d'entre eux, la case n'a JAMAIS été proposée (inscription Google/Apple :
-- /consentements ne l'affichait pas ; ou fiche créée hors de l'écran parental).
-- On demande au PARENT, par courriel, d'accepter ou de refuser — et on
-- journalise les DEUX réponses. Les 22 inscrits par courriel (qui ont vu la
-- case) sont exclus : décision BP.
--
-- ── SÉCURITÉ ─────────────────────────────────────────────────────────────
-- Le jeton de consentement est ALÉATOIRE (32 octets), à USAGE UNIQUE, valable
-- 60 jours, et n'est stocké QUE haché (sha256) : une fuite de la table ne
-- donne aucun lien utilisable. Toutes les fonctions sont service_role
-- SEULEMENT — la page et les routes web les appellent côté serveur. Rien
-- n'est exposé à anon ni à authenticated.
--
-- Le désabonnement d'un parent ne passe pas par courriel_desabonnements
-- (clé = user_id ; un parent n'a en général pas de compte) : registre dédié,
-- clé = sha256 du courriel normalisé. Aucune adresse n'y est copiée.
--
-- CE FICHIER N'ENVOIE RIEN. Aucun cron.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Le journal de consentement sait dire « refusé » ───────────────────
-- Élargissement additif : toute ligne existante reste valide.
alter table public.consent_audit_trail drop constraint consent_audit_trail_action_check;
alter table public.consent_audit_trail add constraint consent_audit_trail_action_check
  check (action = any (array['ATTESTED','WITHDRAWN','EXPIRED','PDF_DOWNLOADED','PDF_UPLOADED','GRANTED','REFUSED']));

-- ── 1. Le journal des envois ─────────────────────────────────────────────
create table public.relances_partenaires (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  campagne    text not null check (campagne ~ '^[a-z0-9_]{1,64}$'),
  statut      text not null default 'RESERVE' check (statut in ('RESERVE','ENVOYE','ECHEC')),
  resend_id   text null,
  erreur      text null,
  reserve_le  timestamptz not null default now(),
  envoye_le   timestamptz null,
  constraint relances_partenaires_envoye_coherent check (statut <> 'ENVOYE' or envoye_le is not null)
);
comment on table public.relances_partenaires is
$c$Journal des courriels « visibilité partenaires » envoyés aux parents. Ligne
RÉSERVÉE avant l'appel Resend, puis ENVOYE ou ECHEC. Un parent par athlète,
une fois par campagne (index relances_partenaires_une_par_campagne). Écriture :
service_role. Lecture : admin.$c$;

create unique index relances_partenaires_une_par_campagne
  on public.relances_partenaires (athlete_id, campagne) where statut <> 'ECHEC';

alter table public.relances_partenaires enable row level security;
create policy "relances partenaires admin read" on public.relances_partenaires
  for select to authenticated using (public.is_admin());
revoke all on public.relances_partenaires from anon, authenticated;
grant select on public.relances_partenaires to authenticated;  -- borné admin (RLS)

-- ── 2. Les jetons de consentement ────────────────────────────────────────
create table public.consentement_partenaire_jetons (
  id            uuid primary key default gen_random_uuid(),
  relance_id    uuid not null references public.relances_partenaires(id) on delete cascade,
  athlete_id    uuid not null references public.athletes(id) on delete cascade,
  jeton_sha256  text not null unique check (jeton_sha256 ~ '^[0-9a-f]{64}$'),
  cree_le       timestamptz not null default now(),
  expire_le     timestamptz not null default now() + interval '60 days',
  utilise_le    timestamptz null,
  decision      text null check (decision in ('ACCEPTE','REFUSE')),
  constraint jeton_utilise_coherent check ((utilise_le is null) = (decision is null))
);
comment on table public.consentement_partenaire_jetons is
$c$Liens « visibilité partenaires » envoyés aux parents. Le jeton n'est
stocké que HACHÉ. Usage unique : utilise_le + decision posés ensemble, une
seule fois. Écriture et lecture : service_role (la page publique passe par le
serveur). Lecture admin.$c$;

alter table public.consentement_partenaire_jetons enable row level security;
create policy "jetons partenaires admin read" on public.consentement_partenaire_jetons
  for select to authenticated using (public.is_admin());
revoke all on public.consentement_partenaire_jetons from anon, authenticated;
grant select on public.consentement_partenaire_jetons to authenticated;  -- borné admin (RLS)

-- ── 3. Le registre de désabonnement des parents ──────────────────────────
create table public.parent_courriel_desabonnements (
  courriel_sha256 text primary key check (courriel_sha256 ~ '^[0-9a-f]{64}$'),
  desabonne_le    timestamptz not null default now(),
  source          text not null check (source in ('lien','un_clic','admin'))
);
comment on table public.parent_courriel_desabonnements is
$c$Registre LCAP des PARENTS qui ne veulent plus de courriels de Nexus. Clé =
sha256 de l'adresse normalisée (lower + trim) — aucune adresse en clair.
Écriture : service_role. Lecture : admin.$c$;

alter table public.parent_courriel_desabonnements enable row level security;
create policy "desabonnements parents admin read" on public.parent_courriel_desabonnements
  for select to authenticated using (public.is_admin());
revoke all on public.parent_courriel_desabonnements from anon, authenticated;
grant select on public.parent_courriel_desabonnements to authenticated;  -- borné admin (RLS)

-- ── 4. Helpers ───────────────────────────────────────────────────────────
create or replace function public.courriel_sha256(p text)
  returns text language sql immutable
  set search_path to 'public', 'pg_temp'
as $fn$
  select encode(extensions.digest(lower(btrim(p)), 'sha256'), 'hex');
$fn$;
revoke all on function public.courriel_sha256(text) from public, anon, authenticated;
grant execute on function public.courriel_sha256(text) to service_role;

-- ── 5. Les cibles ────────────────────────────────────────────────────────
-- Mineur 14-17 ACTIF, non visible des partenaires, aucune trace « oui »,
-- aucun choix déjà journalisé, courriel parent plausible, pas désabonné,
-- pas déjà relancé pour la campagne — et PAS inscrit par courriel via l'écran
-- parental (ceux-là ont vu la case : décision BP).
create or replace function public.relance_partenaires_cibles(p_campagne text)
  returns table (
    athlete_id     uuid,
    parent_email   text,
    parent_prenom  text,
    prenom         text,
    fournisseur    text
  )
  language sql stable security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
  select a.id, lower(btrim(a.parent_email)), nullif(btrim(a.parent_first_name), ''),
         nullif(btrim(a.first_name), ''), coalesce(u.raw_app_meta_data->>'provider', 'sans_compte')
    from public.athletes a
    left join auth.users u   on u.id = a.user_id
    left join public.users pu on pu.id = a.user_id
   where a.status = 'ACTIF'
     and a.partner_visibility_opt_in = false
     and a.date_naissance is not null
     and a.date_naissance >  current_date - interval '18 years'
     and a.date_naissance <= current_date - interval '14 years'
     and a.parent_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and coalesce(u.raw_user_meta_data->>'consent_parental_partner_visibility',
                  pu.privacy_preferences->>'consent_parental_partner_visibility') is null
     and not (coalesce(u.raw_app_meta_data->>'provider', '') = 'email'
              and coalesce(u.raw_user_meta_data ? 'consent_parental_profile', false))
     and not exists (select 1 from public.consent_audit_trail c
                      where c.athlete_id = a.id and c.metadata->>'consent_key' = 'image_partenaire')
     and not exists (select 1 from public.parent_courriel_desabonnements d
                      where d.courriel_sha256 = public.courriel_sha256(a.parent_email))
     and not exists (select 1 from public.relances_partenaires r
                      where r.athlete_id = a.id and r.campagne = p_campagne and r.statut <> 'ECHEC')
   order by a.created_at;
$fn$;
revoke all on function public.relance_partenaires_cibles(text) from public, anon, authenticated;
grant execute on function public.relance_partenaires_cibles(text) to service_role;

-- ── 6. Réserver : journal + jeton, en une fois ───────────────────────────
-- Rend le jeton EN CLAIR une seule fois (pour le courriel) ; la base n'en
-- garde que le haché. unique_violation (23505) si déjà réservé/envoyé.
create or replace function public.relance_partenaires_reserver(p_athlete_id uuid, p_campagne text)
  returns table (relance_id uuid, jeton text)
  language plpgsql volatile security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
declare
  v_relance uuid;
  v_jeton   text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.relances_partenaires (athlete_id, campagne)
    values (p_athlete_id, p_campagne) returning id into v_relance;
  insert into public.consentement_partenaire_jetons (relance_id, athlete_id, jeton_sha256)
    values (v_relance, p_athlete_id, encode(extensions.digest(v_jeton, 'sha256'), 'hex'));
  return query select v_relance, v_jeton;
end;
$fn$;
revoke all on function public.relance_partenaires_reserver(uuid, text) from public, anon, authenticated;
grant execute on function public.relance_partenaires_reserver(uuid, text) to service_role;

-- ── 7. Lire l'état d'un lien (la page, avant le choix) ───────────────────
-- Rend le prénom de l'athlète seulement — le parent doit savoir de quel
-- enfant il s'agit ; rien d'autre (un lien transféré n'apprend pas plus).
create or replace function public.consentement_partenaire_jeton_etat(p_jeton text)
  returns jsonb
  language plpgsql stable security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
declare
  j public.consentement_partenaire_jetons;
  a public.athletes;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('etat', 'invalide');
  end if;
  select * into j from public.consentement_partenaire_jetons
   where jeton_sha256 = encode(extensions.digest(p_jeton, 'sha256'), 'hex');
  if j.id is null then return jsonb_build_object('etat', 'invalide'); end if;
  select * into a from public.athletes where id = j.athlete_id;
  if j.utilise_le is not null then
    return jsonb_build_object('etat', 'utilise', 'decision', j.decision, 'prenom', a.first_name);
  end if;
  if j.expire_le <= now() then return jsonb_build_object('etat', 'expire'); end if;
  if a.date_naissance is null or a.date_naissance <= current_date - interval '18 years' then
    return jsonb_build_object('etat', 'majeur', 'prenom', a.first_name);
  end if;
  return jsonb_build_object('etat', 'valide', 'prenom', a.first_name);
end;
$fn$;
revoke all on function public.consentement_partenaire_jeton_etat(text) from public, anon, authenticated;
grant execute on function public.consentement_partenaire_jeton_etat(text) to service_role;

-- ── 8. Répondre (Accepter / Refuser) ─────────────────────────────────────
-- Usage unique garanti par l'UPDATE conditionnel (utilise_le is null) : deux
-- clics simultanés → un seul gagne, l'autre lit 'deja_utilise'.
-- Accepter : fiche + trace à oui, parental_consents.consent_photo suivi comme
--   set_child_consent. Refuser : fiche + trace à non. Journal dans les DEUX cas.
create or replace function public.consentement_partenaire_par_jeton(
  p_jeton text, p_accorde boolean, p_policy_version text, p_ip text default null)
  returns jsonb
  language plpgsql volatile security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
declare
  v_sha  text;
  j      public.consentement_partenaire_jetons;
  a      public.athletes;
  v_pref jsonb;
  v_prev text;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalide');
  end if;
  if p_accorde is null then return jsonb_build_object('ok', false, 'reason', 'invalid_value'); end if;
  if p_policy_version is null or length(btrim(p_policy_version)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'policy_version_required');
  end if;
  v_sha := encode(extensions.digest(p_jeton, 'sha256'), 'hex');

  select * into j from public.consentement_partenaire_jetons where jeton_sha256 = v_sha;
  if j.id is null then return jsonb_build_object('ok', false, 'reason', 'invalide'); end if;
  if j.utilise_le is not null then return jsonb_build_object('ok', false, 'reason', 'deja_utilise'); end if;
  if j.expire_le <= now() then return jsonb_build_object('ok', false, 'reason', 'expire'); end if;

  select * into a from public.athletes where id = j.athlete_id;
  if a.date_naissance is null or a.date_naissance <= current_date - interval '18 years' then
    -- Un majeur décide lui-même (set_my_partner_visibility) : le parent n'a plus la main.
    return jsonb_build_object('ok', false, 'reason', 'majeur');
  end if;

  update public.consentement_partenaire_jetons
     set utilise_le = now(), decision = case when p_accorde then 'ACCEPTE' else 'REFUSE' end
   where id = j.id and utilise_le is null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'deja_utilise'); end if;

  v_prev := case when a.partner_visibility_opt_in then 'granted' else 'withdrawn' end;

  update public.athletes set
    partner_visibility_opt_in           = p_accorde,
    partner_visibility_parental_consent = p_accorde,
    partner_visibility_opted_in_at      = case when p_accorde then now() else partner_visibility_opted_in_at end
  where id = a.id;

  if a.user_id is not null then
    select privacy_preferences into v_pref from public.users where id = a.user_id;
    v_pref := jsonb_set(coalesce(v_pref, '{}'::jsonb), '{consent_parental_partner_visibility}',
                        case when p_accorde then to_jsonb(now()) else 'null'::jsonb end);
    update public.users set privacy_preferences = v_pref where id = a.user_id;
  end if;

  if a.consent_id is not null then
    update public.parental_consents set consent_photo = p_accorde where id = a.consent_id;
  end if;

  insert into public.consent_audit_trail
    (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
  values (
    a.consent_id, a.id, null,
    case when p_accorde then 'GRANTED' else 'REFUSED' end,
    v_prev, case when p_accorde then 'granted' else 'refused' end, p_ip,
    jsonb_build_object(
      'acting_role',     'PARENT_LIEN',
      'consent_key',     'image_partenaire',
      'policy_version',  p_policy_version,
      'jeton_id',        j.id,
      'relance_id',      j.relance_id,
      'parent_courriel_sha256', public.courriel_sha256(a.parent_email)
    )
  );

  return jsonb_build_object('ok', true, 'decision', case when p_accorde then 'ACCEPTE' else 'REFUSE' end,
                            'prenom', a.first_name);
end;
$fn$;
revoke all on function public.consentement_partenaire_par_jeton(text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.consentement_partenaire_par_jeton(text, boolean, text, text) to service_role;

-- ── 9. Désabonner un parent (jeton HMAC vérifié par la route web) ─────────
create or replace function public.parent_desabonner(p_athlete_id uuid, p_source text)
  returns boolean
  language plpgsql volatile security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
declare v_mail text;
begin
  select parent_email into v_mail from public.athletes where id = p_athlete_id;
  if v_mail is null or btrim(v_mail) = '' then return false; end if;
  insert into public.parent_courriel_desabonnements (courriel_sha256, source)
    values (public.courriel_sha256(v_mail), p_source)
    on conflict (courriel_sha256) do nothing;
  return true;
end;
$fn$;
revoke all on function public.parent_desabonner(uuid, text) from public, anon, authenticated;
grant execute on function public.parent_desabonner(uuid, text) to service_role;

-- ── 10. Gates — listes COMPLÈTES triées, jamais par inclusion ────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['postgres','service_role'];
begin
  foreach f in array array[
    'public.courriel_sha256(text)',
    'public.relance_partenaires_cibles(text)',
    'public.relance_partenaires_reserver(uuid, text)',
    'public.consentement_partenaire_jeton_etat(text)',
    'public.consentement_partenaire_par_jeton(text, boolean, text, text)',
    'public.parent_desabonner(uuid, text)'
  ]::regprocedure[] loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', f, vus, veut;
    end if;
  end loop;

  -- Tables : anon n'a RIEN ; authenticated n'a que SELECT (borné admin par RLS).
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public'
                and table_name in ('relances_partenaires','consentement_partenaire_jetons','parent_courriel_desabonnements')
                and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type <> 'SELECT'))) then
    raise exception 'NEXUS: droits de table trop larges sur les tables de relance partenaires';
  end if;
  raise notice 'NEXUS: ACL exactes (6 fonctions service_role, 3 tables admin en lecture)';
end $$;
