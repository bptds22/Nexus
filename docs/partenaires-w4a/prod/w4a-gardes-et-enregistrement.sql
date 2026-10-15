-- W4a en prod par psql — GARDES + ENREGISTREMENT, dans LA MÊME transaction que
-- la migration (psql -1 -f w4a-releve-avant.sql -f <W4a> -f <ce fichier>).
-- Une garde qui échoue (RAISE « NEXUS: ») annule TOUT : W4a, l'historique et
-- admin_operations. Les témoins viennent de _w4a_avant (w4a-releve-avant.sql).
-- GÉNÉRÉ par generer-gardes.mjs — la chaîne $w4a$ est la migration copiée
-- octet pour octet (LF) : ne pas éditer à la main, le md5 de garde casserait.

-- ── 1. Ce que W4a ne doit jamais toucher : comparé au relevé avant ─────────
do $$
declare
  a _w4a_avant%rowtype;
  f text; attendu text; v text;
begin
  select * into a from _w4a_avant;

  -- Fonctions dont W4a dépend : inchangées (md5 sans CR, valeurs prod du 2026-10-14).
  for f, attendu in values
    ('public.partenaire_evaluer_athlete(uuid, numeric, jsonb)', 'f3362b983b487984d1e4af10afb554e9'),
    ('public.partenaire_attribuer_badge(uuid, uuid)', '863de0ed48c2aa7d448a2545834a9a91'),
    ('public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid)', '9d5b7df467a3d9c4f55c66a9aa119d0f'),
    ('public.partenaire_peut_evaluer(uuid, uuid)', '19dad4fa398df07bbb23c1abdb029aec'),
    ('public.is_partner_eligible_athlete(uuid)', '5bfd92f0bd9ab0b26b623c9b499f7708'),
    ('public.set_my_partner_visibility(boolean, text)', '77df6f54b971a8de3816b2cd964538a5'),
    ('public.badge_refuser_doublon_partenaire()', 'e1eb1d2242710caa348325f6a72160b7'),
    ('public.badge_plafond()', '171a82c74237a5a6d9c5f50c74f44d5e'),
    ('public.ambassadeur_recalculer_paliers()', '481cf443a2db040fd840a1e229b325f2'),
    ('public.is_admin()', '3d5360775265e00e511e75f82859fb1c'),
    ('public.nom_normalise(text)', '8120de88d83de466733affec2cdeb8ad'),
    ('public.noms_proches(text, text)', '89aa4265452aeee7b5d9e2d9a1e50e15'),
    ('public.prenoms_compatibles(text, text)', '8335586298c4b18805931d32726433ca'),
    ('public.prenoms_proches(text, text)', '9c41b3cf4010a5ba84419a3597c16d33')
  loop
    if md5(replace(pg_get_functiondef(f::regprocedure), E'\r', '')) is distinct from attendu then
      raise exception 'NEXUS: % a changé pendant W4a', f;
    end if;
  end loop;

  -- Triggers d'athletes : ceux d'avant à l'identique, plus EXACTEMENT celui d'opt-in.
  select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text || ':' || md5(pg_get_triggerdef(oid)), ',' order by tgname)
    into v from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal
     and tgname <> 'trg_prospect_partenaire_sur_optin';
  if v is distinct from a.triggers_athletes then
    raise exception 'NEXUS: triggers d''athletes d''avant changés';
  end if;

  -- Tâches cron : celles d'avant à l'identique, plus EXACTEMENT la purge W4a.
  if (select count(*)::text || ' ' || md5(string_agg(jobname || ':' || schedule || ':' || command || ':' || active::text, ',' order by jobname))
        from cron.job where jobname <> 'prospects-partenaire-purge-quotidienne') is distinct from a.cron then
    raise exception 'NEXUS: tâches cron d''avant changées';
  end if;

  -- Données : rien d'écrit par la migration.
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || type || coalesce(read::text, '∅'), ',' order by id), ''))
        from public.athlete_notifications) is distinct from a.notifications then
    raise exception 'NEXUS: athlete_notifications a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(updated_at::text, '∅'), ',' order by id), ''))
        from public.partner_evaluations) is distinct from a.partner_evaluations then
    raise exception 'NEXUS: partner_evaluations a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅') || coalesce(masque_le::text, '∅'), ',' order by id), ''))
        from public.partner_athlete_badges) is distinct from a.partner_athlete_badges then
    raise exception 'NEXUS: partner_athlete_badges a bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(updated_at::text, '∅')
            || coalesce(partner_visibility_opt_in::text, '∅') || coalesce(partner_visibility_parental_consent::text, '∅'), ',' order by id), ''))
        from public.athletes) is distinct from a.athletes then
    raise exception 'NEXUS: athletes a bougé';
  end if;
  if (select count(*) from public.admin_operations) <> a.admin_operations then
    raise exception 'NEXUS: admin_operations a bougé avant l''enregistrement';
  end if;
end $$;

-- ── 2. Le nouvel état ──────────────────────────────────────────────────────
do $$
declare
  r record;
  vus text[];
  veut text[];
  n int := 0;
begin
  -- 32 fonctions, droits : liste COMPLÈTE, jamais par inclusion.
  for r in select p.oid, p.proname, p.prosecdef from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and (p.proname like 'prospect_partenaire%' or p.proname like 'partenaire_prospect%'
                   or p.proname like 'admin_prospect%'
                   or p.proname in ('admin_loi25_prospects_partenaires', 'purger_prospects_partenaire'))
  loop
    n := n + 1;
    veut := case
      when r.proname = 'prospect_partenaire_resoudre' then array['anon', 'authenticated', 'postgres', 'service_role']
      when r.proname in ('prospect_partenaire_peut_transferer', 'prospect_partenaire_journaliser',
                         'prospect_partenaire_normaliser_evaluation', 'prospect_partenaire_terminer',
                         'prospect_partenaire_contenu', 'prospect_partenaire_transferer',
                         'prospect_partenaire_candidats', 'prospect_partenaire_proposer',
                         'prospect_partenaire_proposer_auto', 'prospect_partenaire_sur_optin',
                         'prospect_partenaire_sport_concorde', 'prospect_partenaire_lever_proposition',
                         'prospect_partenaire_lever_reservation_lien',
                         'purger_prospects_partenaire') then array['postgres', 'service_role']
      else array['authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
    -- Toutes SECURITY DEFINER, sauf la normalisation (calcul pur, serveur seulement).
    if r.prosecdef is distinct from (r.proname <> 'prospect_partenaire_normaliser_evaluation') then
      raise exception 'NEXUS: SECURITY DEFINER inattendu sur %', r.proname;
    end if;
  end loop;
  if n <> 32 then
    raise exception 'NEXUS: 32 fonctions W4a attendues, % trouvées', n;
  end if;

  -- 4 tables : RLS active, aucune politique, aucun droit direct, vides.
  select count(*) into n from pg_class c
   where c.oid in ('public.partenaire_prospects'::regclass, 'public.partenaire_prospects_rapprochements'::regclass,
                   'public.partenaire_prospects_issues'::regclass, 'public.partenaire_prospects_journal'::regclass)
     and c.relrowsecurity
     and not exists (select 1 from unnest(coalesce(c.relacl, '{}'::aclitem[])) a
                      where split_part(a::text, '=', 1) in ('anon', 'authenticated', ''));
  if n <> 4 then
    raise exception 'NEXUS: une table W4a est sans RLS ou lisible par anon/authenticated/PUBLIC';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename like 'partenaire_prospects%') then
    raise exception 'NEXUS: aucune politique attendue sur les tables W4a';
  end if;
  if (select count(*) from public.partenaire_prospects) + (select count(*) from public.partenaire_prospects_rapprochements)
     + (select count(*) from public.partenaire_prospects_issues) + (select count(*) from public.partenaire_prospects_journal) <> 0 then
    raise exception 'NEXUS: tables W4a non vides après migration';
  end if;

  -- Le trigger d'opt-in : texte exact (AFTER UPDATE OF …, WHEN l'opt-in DEVIENT actif), actif.
  if (select pg_get_triggerdef(oid) || ':' || tgenabled::text from pg_trigger
       where tgrelid = 'public.athletes'::regclass and tgname = 'trg_prospect_partenaire_sur_optin')
     is distinct from $t$CREATE TRIGGER trg_prospect_partenaire_sur_optin AFTER UPDATE OF partner_visibility_opt_in, partner_visibility_parental_consent ON public.athletes FOR EACH ROW WHEN ((new.partner_visibility_opt_in AND ((old.partner_visibility_opt_in IS DISTINCT FROM new.partner_visibility_opt_in) OR (old.partner_visibility_parental_consent IS DISTINCT FROM new.partner_visibility_parental_consent)))) EXECUTE FUNCTION prospect_partenaire_sur_optin():O$t$ then
    raise exception 'NEXUS: trigger d''opt-in absent ou différent';
  end if;

  -- La purge : une seule tâche, 08:50 UTC, active.
  if (select count(*) from cron.job where jobname = 'prospects-partenaire-purge-quotidienne'
        and schedule = '50 8 * * *' and command = 'select public.purger_prospects_partenaire()' and active) <> 1 then
    raise exception 'NEXUS: tâche de purge W4a absente, en double ou différente';
  end if;

  -- La contrainte des notifications : l'ancienne liste + PARTENAIRE_EVALUATION, rien d'autre.
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check')
     is distinct from $c$CHECK ((type = ANY (ARRAY['PROFILE_VIEWED'::text, 'ADDED_TO_FAVORITES'::text, 'SUGGESTION_APPROVED'::text, 'SUGGESTION_REJECTED'::text, 'COACH_REPORT_UPDATED'::text, 'COACH_VERIFIED'::text, 'COACH_MODIFIED_PROFILE'::text, 'COACH_DISTINCTION_ADDED'::text, 'COACH_EVALUATION_UPDATED'::text, 'PROFILE_MILESTONE'::text, 'PROFILE_TIP'::text, 'ADMIN_BROADCAST'::text, 'TEAM_INVITATION'::text, 'SCHOOL_CLAIM_REJECTED'::text, 'COACH_CLAIMED'::text, 'AMBASSADEUR_PALIER_3'::text, 'AMBASSADEUR_PALIER_5'::text, 'PARTENAIRE_EVALUATION'::text])))$c$ then
    raise exception 'NEXUS: athlete_notifications_type_check inattendue';
  end if;
end $$;

-- ── 3. Enregistrement ──────────────────────────────────────────────────────
create temp table _w4a on commit drop as
select '20261014200739'::text as version,
-- replace : un checkout Windows extrait ce fichier en CRLF ; le contenu
-- enregistré et son md5 sont ceux du blob git (LF).
replace($w4a$-- W4a — Cartes prospects PARTENAIRE, lien d'inscription à jeton, rapprochements (base seulement).
--
-- Plan validé par BP le 2026-10-14 (diagnostic W4 + deux changements + point 3) :
--  · un partenaire ÉVALUATEUR (partenaire_peut_evaluer, sport permis) crée une carte pour un
--    jeune absent de Nexus : prénom, nom, sport, position, école/équipe, promotion, et
--    facultativement une évaluation (règles W2) et des badges (W3/W3b). AUCUNE coordonnée,
--    photo ni date de naissance ; le partenaire atteste « 14 ans ou plus ». 60 jours, sans
--    prolongation. Plafond : 50 cartes actives par partenaire.
--  · Lien à jeton : 32 octets aléatoires, seule l'EMPREINTE sha256 est stockée, rendu une fois,
--    révocable. Sans connexion, la page ne reçoit QUE le nom du partenaire. Le premier compte
--    athlète qui l'ouvre RÉSERVE la carte (source LIEN).
--  · « C'est moi » : opt-in partenaire actif → transfert (W2/W3/W3b) puis carte supprimée ;
--    opt-in inactif → CONFIRMEE_ATTENTE_OPTIN jusqu'à l'échéance ; le transfert part tout seul
--    dès que l'opt-in devient actif (trigger sur athletes, qui ne bloque JAMAIS l'écriture).
--  · « Ce n'est pas moi » : par le lien → suppression immédiate ; sur une PROPOSITION (admin ou
--    automatique) → la carte revient à son état d'avant, la paire est marquée INFIRME.
--  · Rapprochements nom + école/équipe + sport (briques du lot D recruteur), calculés à la
--    demande, visibles de l'ADMIN seulement ; « Proposer au jeune » ou « Écarter ». L'admin ne
--    fusionne jamais à la place du jeune.
--  · Proposition AUTOMATIQUE (point 3) : un SEUL candidat de force MOYENNE, déjà éligible à la
--    visibilité partenaire, sport transférable → proposé sans l'admin ; le partenaire voit
--    « possible correspondance » tant que ce jeune lui reste visible. Calculée à l'enregistrement
--    d'une carte et à l'activation d'un opt-in ; aucun cron chaque minute.
--
-- Visibilité : tables à RLS active, SANS politique ni droit pour anon/authenticated ; tout passe
-- par les fonctions ci-dessous. Une seule table existante touchée : la liste de
-- athlete_notifications_type_check reçoit PARTENAIRE_EVALUATION.

do $$
begin
  if to_regclass('public.partenaire_prospects') is not null then
    raise exception 'NEXUS: W4a déjà appliquée (partenaire_prospects existe)';
  end if;
  -- La contrainte des notifications doit être EXACTEMENT celle relevée en prod le 2026-10-14.
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check')
     is distinct from
     'CHECK ((type = ANY (ARRAY[''PROFILE_VIEWED''::text, ''ADDED_TO_FAVORITES''::text, ''SUGGESTION_APPROVED''::text, ''SUGGESTION_REJECTED''::text, ''COACH_REPORT_UPDATED''::text, ''COACH_VERIFIED''::text, ''COACH_MODIFIED_PROFILE''::text, ''COACH_DISTINCTION_ADDED''::text, ''COACH_EVALUATION_UPDATED''::text, ''PROFILE_MILESTONE''::text, ''PROFILE_TIP''::text, ''ADMIN_BROADCAST''::text, ''TEAM_INVITATION''::text, ''SCHOOL_CLAIM_REJECTED''::text, ''COACH_CLAIMED''::text, ''AMBASSADEUR_PALIER_3''::text, ''AMBASSADEUR_PALIER_5''::text])))' then
    raise exception 'NEXUS: athlete_notifications_type_check ne correspond pas au relevé — ne pas écraser une liste inconnue';
  end if;
end $$;

-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.partenaire_prospects (
  id                  uuid primary key default gen_random_uuid(),
  partner_id          uuid not null references public.media_partners(id) on delete cascade,
  cree_par            uuid references public.users(id) on delete set null,
  prenom              text not null check (char_length(btrim(prenom)) between 1 and 60),
  nom                 text not null check (char_length(btrim(nom)) between 1 and 60),
  sport_id            uuid not null references public.sports(id),
  position_id         uuid references public.positions(id),
  school_id           uuid references public.schools(id) on delete set null,
  team_id             uuid references public.teams(id) on delete set null,
  promotion           integer check (promotion between 2020 and 2040),
  atteste_14_ans_le   timestamptz not null,
  -- Évaluation facultative : cote_globale NULL = pas d'évaluation. Normalisée à la saisie
  -- par les règles de partenaire_evaluer_athlete (W2) ; grille figée à la saisie.
  cote_globale        numeric(3,2) check (cote_globale between 1 and 5),
  traits              jsonb not null default '{}'::jsonb check (jsonb_typeof(traits) = 'object'),
  grille_id           uuid references public.evaluation_grilles(id),
  badges_partenaire   uuid[] not null default '{}',
  badges_nexus        uuid[] not null default '{}',
  statut              text not null default 'A_ENVOYER'
                        check (statut in ('A_ENVOYER', 'ENVOYEE', 'RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')),
  jeton_empreinte     text unique,
  jeton_cree_le       timestamptz,
  -- Réservation : par le lien (LIEN), par une proposition de l'admin (ADMIN) ou automatique (AUTO).
  reservee_par        uuid references public.users(id) on delete cascade,
  reservee_athlete    uuid references public.athletes(id) on delete cascade,
  reservee_le         timestamptz,
  reservation_source  text check (reservation_source in ('LIEN', 'ADMIN', 'AUTO')),
  -- État rendu si une PROPOSITION est infirmée ou annulée (A_ENVOYER ou ENVOYEE).
  statut_avant        text check (statut_avant in ('A_ENVOYER', 'ENVOYEE')),
  expire_le           timestamptz not null default now() + interval '60 days',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint partenaire_prospects_reservation_chk check (
    (statut in ('RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN'))
    = (reservee_par is not null and reservee_athlete is not null and reservee_le is not null and reservation_source is not null)),
  constraint partenaire_prospects_avant_chk check (
    (statut_avant is not null) = (reservation_source is not null and reservation_source <> 'LIEN')),
  constraint partenaire_prospects_lien_chk check (
    statut <> 'ENVOYEE' or jeton_empreinte is not null),
  constraint partenaire_prospects_evaluation_chk check (
    cote_globale is not null or traits = '{}'::jsonb)
);
create index partenaire_prospects_partner_idx on public.partenaire_prospects (partner_id);
create index partenaire_prospects_expire_idx on public.partenaire_prospects (expire_le);
create index partenaire_prospects_reservee_idx on public.partenaire_prospects (reservee_par) where reservee_par is not null;

comment on table public.partenaire_prospects is
  'W4 — carte prospect d''un PARTENAIRE évaluateur pour un jeune absent de Nexus. Minimum de champs, aucune coordonnée. Visible du partenaire auteur et de l''admin seulement, par fonctions. Supprimée à la réclamation, au refus par le lien, au retrait ou à l''expiration (60 j).';

-- Décisions de rapprochement (carte × athlète existant). ADMIN SEULEMENT : le partenaire n'en
-- voit jamais rien. Une ligne par paire ; une paire écartée n'est plus reproposée.
create table public.partenaire_prospects_rapprochements (
  id          uuid primary key default gen_random_uuid(),
  carte_id    uuid not null references public.partenaire_prospects(id) on delete cascade,
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  critere     text not null,
  force       text not null check (force in ('MOYENNE', 'FAIBLE')),
  origine     text not null check (origine in ('ADMIN', 'AUTO')),
  statut      text not null check (statut in ('PROPOSE', 'ECARTE', 'CONFIRME', 'INFIRME', 'CADUC')),
  decide_par  uuid references public.users(id) on delete set null,
  decide_le   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (carte_id, athlete_id)
);
create index partenaire_prospects_rapprochements_athlete_idx on public.partenaire_prospects_rapprochements (athlete_id);

comment on table public.partenaire_prospects_rapprochements is
  'W4 — décisions de rapprochement carte partenaire × athlète existant (admin, ou automatique si un seul candidat MOYENNE déjà visible du partenaire). Jamais lisible par le partenaire.';

-- Issue de chaque carte terminée. SANS nom, sauf l'instantané d'une carte RÉCLAMÉE,
-- gardé 7 jours pour l'annulation par l'admin, puis effacé par la purge.
create table public.partenaire_prospects_issues (
  id                  uuid primary key default gen_random_uuid(),
  carte_id            uuid not null,
  partner_id          uuid references public.media_partners(id) on delete cascade,
  issue               text not null
                        check (issue in ('RECLAMEE', 'REFUSEE', 'RETIREE', 'EXPIREE', 'SUPPRIMEE_ADMIN')),
  athlete_id          uuid references public.athletes(id) on delete set null,
  carte_creee_le      timestamptz not null,
  terminee_le         timestamptz not null default now(),
  terminee_par        uuid references public.users(id) on delete set null,
  annulable_jusqu_au  timestamptz,
  annulee_le          timestamptz,
  annulee_par         uuid references public.users(id) on delete set null,
  instantane          jsonb,
  transfert           jsonb,
  constraint partenaire_prospects_issues_chk
    check (issue = 'RECLAMEE' or (athlete_id is null and instantane is null and transfert is null))
);
create index partenaire_prospects_issues_partner_idx on public.partenaire_prospects_issues (partner_id, terminee_le desc);

comment on table public.partenaire_prospects_issues is
  'W4 — issue de chaque carte prospect partenaire terminée. Sans nom ; l''instantané d''une carte RÉCLAMÉE est effacé après 7 jours (délai d''annulation admin).';

-- Journal des gestes, SANS nom ni contenu de carte.
create table public.partenaire_prospects_journal (
  id          bigint generated always as identity primary key,
  carte_id    uuid not null,
  partner_id  uuid,
  acteur      uuid,
  action      text not null,
  athlete_id  uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index partenaire_prospects_journal_carte_idx on public.partenaire_prospects_journal (carte_id);
create index partenaire_prospects_journal_date_idx on public.partenaire_prospects_journal (created_at);

comment on table public.partenaire_prospects_journal is
  'W4 — journal des gestes sur les cartes prospects partenaire. Aucun nom. Purgé après 12 mois. Lu par l''export Loi 25.';

alter table public.partenaire_prospects                enable row level security;
alter table public.partenaire_prospects_rapprochements enable row level security;
alter table public.partenaire_prospects_issues         enable row level security;
alter table public.partenaire_prospects_journal        enable row level security;
-- Les privilèges par défaut de Supabase accordent tout à anon/authenticated : on retire.
revoke all on public.partenaire_prospects, public.partenaire_prospects_rapprochements,
              public.partenaire_prospects_issues, public.partenaire_prospects_journal
  from public, anon, authenticated;

-- Notification de proposition au jeune : liste complète, l'ancienne + PARTENAIRE_EVALUATION.
alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED',
    'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED',
    'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION',
    'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5',
    'PARTENAIRE_EVALUATION']::text[]));

-- ── Aides internes (serveur seulement) ────────────────────────────────────────

-- La garde W2 SANS session : au transfert, l'appelant est le jeune (ou son parent), pas le
-- partenaire, et partenaire_peut_evaluer() lit auth.uid(). Mêmes conditions : compte PARTNER,
-- organisation APPROUVÉE, évaluateur, sport permis.
create function public.prospect_partenaire_peut_transferer(p_partner_id uuid, p_sport_id uuid)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select coalesce((
    select mp.status = 'APPROVED' and mp.peut_evaluer
           and exists (select 1 from public.users u where u.id = mp.user_id and u.role = 'PARTNER'::public.user_role)
           and exists (select 1 from public.partenaire_sports_permis s
                        where s.partner_id = mp.id and s.sport_id = p_sport_id)
      from public.media_partners mp where mp.id = p_partner_id), false)
$$;

-- Le sport de la CARTE doit être celui de l'athlète : son sport principal, ou celui d'une de
-- ses équipes. Sinon rien ne passe (raison « autre_sport ») et aucune proposition automatique.
create function public.prospect_partenaire_sport_concorde(p_sport_id uuid, p_athlete uuid)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete and a.sport_id = p_sport_id)
      or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                  where ta.athlete_id = p_athlete and t.sport_id = p_sport_id)
$$;

create function public.prospect_partenaire_journaliser(
  p_carte uuid, p_partner uuid, p_action text, p_athlete uuid default null, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer
set search_path = public
set row_security = off
as $$
  insert into public.partenaire_prospects_journal (carte_id, partner_id, acteur, action, athlete_id, details)
  values (p_carte, p_partner, auth.uid(), p_action, p_athlete, coalesce(p_details, '{}'::jsonb));
$$;

-- Normalisation de l'évaluation : copie EXACTE des règles de partenaire_evaluer_athlete (W2),
-- sauf que l'évaluation est FACULTATIVE (ni cote ni critère → NULL).
create function public.prospect_partenaire_normaliser_evaluation(
  p_cote_globale numeric, p_traits jsonb, out cote numeric, out traits jsonb)
language plpgsql immutable
set search_path = public
as $$
declare
  v_cols constant text[] := array[
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite',
    'vitesse_explosivite', 'force_puissance', 'endurance_cardio',
    'agilite_coordination', 'vision_du_jeu', 'sens_tactique'];
  v_entiers constant text[] := array[
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite'];
  v_k   text;
  v_val jsonb;
  v_n   numeric;
  v_sum numeric := 0;
  v_cnt int := 0;
begin
  traits := '{}'::jsonb;
  p_traits := coalesce(p_traits, '{}'::jsonb);
  if jsonb_typeof(p_traits) <> 'object' then
    raise exception 'NEXUS: p_traits doit être un objet' using errcode = '22023';
  end if;
  for v_k, v_val in select key, value from jsonb_each(p_traits) loop
    if not v_k = any (v_cols) then
      raise exception 'NEXUS: critère inconnu : %', v_k using errcode = '22023';
    end if;
    continue when v_val = 'null'::jsonb;
    if jsonb_typeof(v_val) <> 'number' then
      raise exception 'NEXUS: valeur non numérique pour %', v_k using errcode = '22023';
    end if;
    v_n := (v_val #>> '{}')::numeric;
    continue when v_n = 0;
    if v_k = any (v_entiers) and (v_n <> trunc(v_n) or v_n < 1 or v_n > 5) then
      raise exception 'NEXUS: % attend un entier de 1 à 5', v_k using errcode = '22023';
    end if;
    if v_n < 0 or v_n > 5 then
      raise exception 'NEXUS: % hors de l''échelle (0 à 5)', v_k using errcode = '22023';
    end if;
    traits := traits || jsonb_build_object(v_k, v_n);
    v_sum := v_sum + v_n;
    v_cnt := v_cnt + 1;
  end loop;

  if v_cnt > 0 then
    cote := round(v_sum / v_cnt, 1);
  elsif p_cote_globale is null then
    cote := null;
  elsif p_cote_globale < 1 or p_cote_globale > 5 then
    raise exception 'NEXUS: cote globale obligatoire (1 à 5)' using errcode = '22023';
  else
    cote := round(p_cote_globale, 2);
  end if;
end $$;

-- Lève SANS BRUIT une proposition (ADMIN ou AUTO), en cours ou confirmée en attente d'opt-in :
-- paire CADUC (recalculable), notification du jeune marquée caduque, carte rendue à son état
-- d'avant. Rien n'est dit au partenaire, qui n'a jamais vu la proposition (Loi 25). Sans
-- proposition sur la carte : ne fait rien.
create function public.prospect_partenaire_lever_proposition(p_carte uuid, p_motif text)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare v public.partenaire_prospects%rowtype;
begin
  select * into v from public.partenaire_prospects where id = p_carte for update;
  if not found or coalesce(v.reservation_source, 'LIEN') = 'LIEN' then
    return;
  end if;
  update public.partenaire_prospects_rapprochements
     set statut = 'CADUC', decide_par = null, decide_le = now()
   where carte_id = p_carte and athlete_id = v.reservee_athlete and statut in ('PROPOSE', 'CONFIRME');
  update public.athlete_notifications
     set read = true, metadata = metadata || jsonb_build_object('caduque', true, 'caduque_le', now())
   where athlete_id = v.reservee_athlete and type = 'PARTENAIRE_EVALUATION'
     and metadata->>'carte_id' = p_carte::text and not coalesce((metadata->>'caduque')::boolean, false);
  update public.partenaire_prospects
     set statut = v.statut_avant, statut_avant = null, reservation_source = null,
         reservee_par = null, reservee_athlete = null, reservee_le = null, updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v.partner_id, 'PROPOSITION_CADUQUE', v.reservee_athlete,
            jsonb_build_object('motif', p_motif, 'origine', v.reservation_source, 'etait', v.statut));
end $$;

-- Lève SANS BRUIT une réservation par le LIEN (RESERVEE ou CONFIRMEE_ATTENTE_OPTIN), que le
-- partenaire voit « Lien envoyé » : la carte redevient ENVOYEE avec le MÊME jeton ; une
-- confirmation est annulée (le jeune rouvre le lien et reconfirme). Le rappel « active la
-- visibilité partenaire » disparaît avec la réservation (calculé, rien à marquer) ; une
-- réservation par le lien n'émet aucune notification. Sans réservation par le lien : rien.
create function public.prospect_partenaire_lever_reservation_lien(p_carte uuid, p_motif text)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare v public.partenaire_prospects%rowtype;
begin
  select * into v from public.partenaire_prospects where id = p_carte for update;
  if not found or v.reservation_source is distinct from 'LIEN' then
    return;
  end if;
  update public.athlete_notifications
     set read = true, metadata = metadata || jsonb_build_object('caduque', true, 'caduque_le', now())
   where athlete_id = v.reservee_athlete and type = 'PARTENAIRE_EVALUATION'
     and metadata->>'carte_id' = p_carte::text and not coalesce((metadata->>'caduque')::boolean, false);
  update public.partenaire_prospects
     set statut = 'ENVOYEE', reservation_source = null,
         reservee_par = null, reservee_athlete = null, reservee_le = null, updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v.partner_id, 'RESERVATION_LIEN_LEVEE', v.reservee_athlete,
            jsonb_build_object('motif', p_motif, 'etait', v.statut));
end $$;

-- Retire une carte en laissant son issue (sans nom) et un geste au journal. Une proposition en
-- cours est d'abord levée : la notification du jeune devient caduque.
create function public.prospect_partenaire_terminer(p_carte uuid, p_issue text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare v public.partenaire_prospects%rowtype;
begin
  perform public.prospect_partenaire_lever_proposition(p_carte, p_issue);
  delete from public.partenaire_prospects where id = p_carte returning * into v;
  if not found then return; end if;
  insert into public.partenaire_prospects_issues (carte_id, partner_id, issue, carte_creee_le, terminee_par)
  values (v.id, v.partner_id, p_issue, v.created_at, auth.uid());
  perform public.prospect_partenaire_journaliser(v.id, v.partner_id, p_issue, null, p_details);
end $$;

-- Ce que le jeune voit d'une carte qui lui est réservée.
create function public.prospect_partenaire_contenu(p_carte uuid, p_athlete uuid)
returns jsonb
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
    'carte_id',     c.id,
    'statut',       c.statut,
    'proposition',  c.reservation_source <> 'LIEN',
    'partenaire',   mp.organization_name,
    'prenom',       c.prenom,
    'nom',          c.nom,
    'sport',        s.nom,
    'position',     p.nom,
    'ecole',        coalesce(sc.name, tsc.name),
    'equipe',       t.name,
    'promotion',    c.promotion,
    'cote_globale', c.cote_globale,
    'traits',       c.traits,
    'badges', coalesce((
        select jsonb_agg(jsonb_build_object('libelle', pb.libelle, 'nexus', false, 'icone_path', pb.icone_path) order by pb.ordre)
          from public.partner_badges pb where pb.id = any (c.badges_partenaire) and pb.actif), '[]'::jsonb)
      || coalesce((
        select jsonb_agg(jsonb_build_object('libelle', b.libelle, 'nexus', true, 'code', b.code) order by b.ordre)
          from public.badges b where b.id = any (c.badges_nexus)), '[]'::jsonb),
    'visibilite_partenaire_active', coalesce(public.is_partner_eligible_athlete(p_athlete), false),
    'expire_le',    c.expire_le)
    from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
    join public.sports s on s.id = c.sport_id
    left join public.positions p on p.id = c.position_id
    left join public.schools sc on sc.id = c.school_id
    left join public.teams t on t.id = c.team_id
    left join public.schools tsc on tsc.id = t.school_id
   where c.id = p_carte
$$;

-- Le transfert proprement dit (carte réservée à cet athlète, opt-in vérifié par l'appelant) :
-- ce qui passe les règles W2/W3/W3b est écrit, élément par élément ; ce qui ne passe pas est
-- sauté avec sa raison. Puis issue RECLAMEE (instantané 7 j) et carte supprimée.
create function public.prospect_partenaire_transferer(p_carte uuid, p_athlete uuid)
returns jsonb
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte     public.partenaire_prospects%rowtype;
  v_athlete   public.athletes%rowtype;
  v_ok        boolean;
  v_concorde  boolean;
  v_eval_id   uuid;
  v_eval      text;
  v_badges    jsonb := '[]'::jsonb;
  v_b         uuid;
  v_bd        public.badges%rowtype;
  v_id        uuid;
  v_raison    text;
  v_par       uuid;
  v_transfert jsonb;
begin
  select * into v_carte from public.partenaire_prospects where id = p_carte for update;
  select * into v_athlete from public.athletes where id = p_athlete;
  if v_carte.id is null or v_athlete.id is null or v_carte.reservee_athlete is distinct from v_athlete.id then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;

  -- Le sport de la CARTE : celui de l'athlète (principal ou d'une de ses équipes), et permis au
  -- partenaire. Sinon rien ne passe, avec la raison « autre_sport » ou « non_permise ».
  v_concorde := public.prospect_partenaire_sport_concorde(v_carte.sport_id, v_athlete.id);
  v_ok  := v_concorde and public.prospect_partenaire_peut_transferer(v_carte.partner_id, v_carte.sport_id);
  v_par := case when exists (select 1 from public.users u where u.id = v_carte.cree_par) then v_carte.cree_par end;

  -- Évaluation (W2). Une évaluation existante du même partenaire est GARDÉE.
  if v_carte.cote_globale is null then
    v_eval := 'aucune';
  elsif not v_concorde then
    v_eval := 'autre_sport';
  elsif not v_ok then
    v_eval := 'non_permise';
  else
    insert into public.partner_evaluations (
      partner_id, athlete_id, evalue_par, cote_globale,
      leadership, discipline, coachabilite, intelligence_jeu,
      competitivite, esprit_equipe, resilience, attitude_mentalite,
      vitesse_explosivite, force_puissance, endurance_cardio,
      agilite_coordination, vision_du_jeu, sens_tactique, grille_id)
    values (
      v_carte.partner_id, v_athlete.id, v_par, v_carte.cote_globale,
      (v_carte.traits->>'leadership')::int, (v_carte.traits->>'discipline')::int,
      (v_carte.traits->>'coachabilite')::int, (v_carte.traits->>'intelligence_jeu')::int,
      (v_carte.traits->>'competitivite')::int, (v_carte.traits->>'esprit_equipe')::int,
      (v_carte.traits->>'resilience')::int, (v_carte.traits->>'attitude_mentalite')::int,
      (v_carte.traits->>'vitesse_explosivite')::numeric, (v_carte.traits->>'force_puissance')::numeric,
      (v_carte.traits->>'endurance_cardio')::numeric, (v_carte.traits->>'agilite_coordination')::numeric,
      (v_carte.traits->>'vision_du_jeu')::numeric, (v_carte.traits->>'sens_tactique')::numeric,
      v_carte.grille_id)
    on conflict (partner_id, athlete_id) do nothing
    returning id into v_eval_id;
    v_eval := case when v_eval_id is null then 'deja_evalue' else 'transferee' end;
  end if;

  -- Badges propres au partenaire (W3).
  foreach v_b in array v_carte.badges_partenaire loop
    v_id := null;
    v_raison := case
      when not v_concorde then 'autre_sport'
      when not v_ok then 'non_permise'
      when not exists (select 1 from public.partner_badges pb
                        where pb.id = v_b and pb.partner_id = v_carte.partner_id and pb.actif) then 'retire_du_catalogue'
      when exists (select 1 from public.partner_athlete_badges x
                    where x.partner_badge_id = v_b and x.athlete_id = v_athlete.id and x.retire_le is null) then 'deja_porte'
    end;
    if v_raison is null then
      begin
        insert into public.partner_athlete_badges (partner_id, partner_badge_id, athlete_id, attribue_par)
        values (v_carte.partner_id, v_b, v_athlete.id, v_par) returning id into v_id;
      exception when unique_violation then v_raison := 'deja_porte';
      end;
    end if;
    v_badges := v_badges || jsonb_build_object('badge_partenaire', v_b, 'attribution', v_id, 'raison', v_raison);
  end loop;

  -- Badges Nexus (W3b), contrôlés à nouveau sur la VRAIE fiche.
  foreach v_b in array v_carte.badges_nexus loop
    v_id := null;
    v_bd := null;
    select * into v_bd from public.badges where id = v_b;
    v_raison := case
      when not v_concorde then 'autre_sport'
      when not v_ok then 'non_permise'
      when v_bd.id is null or v_bd.famille not in ('universel', 'sport') or v_bd.requiert_contexte or not v_bd.actif then 'non_admissible'
      when v_bd.famille = 'sport'
           and not exists (select 1 from public.badge_sports bs where bs.badge_id = v_b and bs.sport_id = v_athlete.sport_id) then 'autre_sport'
      when exists (select 1 from public.athlete_badges ab
                    where ab.athlete_id = v_athlete.id and ab.badge_id = v_b and ab.retire_le is null) then 'deja_porte_coach'
      when exists (select 1 from public.partner_athlete_badges x
                    where x.athlete_id = v_athlete.id and x.badge_id = v_b and x.retire_le is null) then 'deja_porte_partenaire'
    end;
    if v_raison is null then
      begin
        insert into public.partner_athlete_badges (partner_id, badge_id, athlete_id, attribue_par)
        values (v_carte.partner_id, v_b, v_athlete.id, v_par) returning id into v_id;
      exception when unique_violation then v_raison := 'deja_porte_partenaire';
      end;
    end if;
    v_badges := v_badges || jsonb_build_object('badge_nexus', v_b, 'attribution', v_id, 'raison', v_raison);
  end loop;

  v_transfert := jsonb_build_object('evaluation', v_eval, 'evaluation_id', v_eval_id, 'badges', v_badges);

  update public.partenaire_prospects_rapprochements
     set statut = 'CONFIRME', decide_le = now()
   where carte_id = v_carte.id and athlete_id = v_athlete.id;
  insert into public.partenaire_prospects_issues (
    carte_id, partner_id, issue, athlete_id, carte_creee_le, terminee_par,
    annulable_jusqu_au, instantane, transfert)
  values (
    v_carte.id, v_carte.partner_id, 'RECLAMEE', v_athlete.id, v_carte.created_at, auth.uid(),
    now() + interval '7 days', to_jsonb(v_carte), v_transfert);
  perform public.prospect_partenaire_journaliser(v_carte.id, v_carte.partner_id, 'RECLAMEE', v_athlete.id,
            jsonb_build_object('evaluation', v_eval, 'source', v_carte.reservation_source,
                               'badges_transferes', (select count(*) from jsonb_array_elements(v_badges) e where e->>'attribution' is not null)));
  delete from public.partenaire_prospects where id = v_carte.id;

  return v_transfert || jsonb_build_object('statut', 'transferee',
           'partenaire', (select organization_name from public.media_partners where id = v_carte.partner_id));
end $$;

-- Candidats au rapprochement : briques du lot D recruteur (nom_normalise, noms_proches,
-- prenoms_compatibles, prenoms_proches), sans courriel ni téléphone (la carte n'en a pas).
-- Tous les athlètes ACTIFS (décision B). Cartes non réservées seulement. Les paires déjà
-- décidées sont exclues, sauf CADUC : une proposition levée sans décision (carte modifiée par
-- le partenaire, lien ouvert par un autre jeune) se recalcule sur la carte telle qu'elle est.
create function public.prospect_partenaire_candidats(p_carte uuid default null, p_athlete uuid default null)
returns table (carte_id uuid, athlete_id uuid, critere text, force text, promotion_concorde boolean)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  with car as (
    select c.id, c.sport_id, c.team_id, c.prenom, c.promotion,
           public.nom_normalise(c.nom) as nom_n,
           coalesce(t.school_id, c.school_id) as ecole
      from public.partenaire_prospects c
      left join public.teams t on t.id = c.team_id
     where c.statut in ('A_ENVOYER', 'ENVOYEE')
       and c.expire_le > now()
       and (p_carte is null or c.id = p_carte)
  ), ath as (
    select a.id, a.first_name, a.school_id, a.sport_id, a.annee_diplomation,
           public.nom_normalise(a.last_name) as nom_n
      from public.athletes a
     where a.status = 'ACTIF'::public.account_status
       and (p_athlete is null or a.id = p_athlete)
  ), paires as (
    select car.*, ath.id as ath_id, ath.first_name, ath.school_id as ath_ecole, ath.sport_id as ath_sport,
           ath.annee_diplomation, ath.nom_n as ath_nom
      from car join ath
        on car.nom_n <> '' and (car.nom_n = ath.nom_n or public.noms_proches(car.nom_n, ath.nom_n))
  ), qualifiees as (
    select p.*,
      p.nom_n = p.ath_nom as nom_exact,
      public.prenoms_compatibles(p.prenom, p.first_name) as prenom_ok,
      public.prenoms_proches(p.prenom, p.first_name) as prenom_proche,
      (p.team_id is not null
       and exists (select 1 from public.team_athletes ta where ta.athlete_id = p.ath_id and ta.team_id = p.team_id)) as meme_equipe,
      (p.ecole is not null
       and (p.ath_ecole = p.ecole
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.school_id = p.ecole))
       and (p.ath_sport = p.sport_id
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.sport_id = p.sport_id))) as meme_ecole_sport
      from paires p
  ), notees as (
    select q.*,
      case
        when q.prenom_ok and q.meme_equipe and q.nom_exact then 'EQUIPE'
        when q.prenom_ok and q.team_id is null and q.meme_ecole_sport and q.nom_exact then 'ETABLISSEMENT'
        when q.prenom_ok and q.meme_equipe then 'EQUIPE_PROCHE'
        when q.prenom_ok and q.meme_ecole_sport and q.nom_exact then 'ECOLE'
        when q.prenom_ok and q.meme_ecole_sport then 'ECOLE_PROCHE'
        -- Prénom à une lettre près : jamais plus haut que FAIBLE, même avec le nom exact.
        when not q.prenom_ok and q.prenom_proche and q.meme_equipe then 'EQUIPE_PROCHE'
        when not q.prenom_ok and q.prenom_proche and q.meme_ecole_sport then 'ECOLE_PROCHE'
      end as critere
      from qualifiees q
  )
  select n.id, n.ath_id, n.critere,
         case when n.critere in ('EQUIPE', 'ETABLISSEMENT') then 'MOYENNE' else 'FAIBLE' end,
         case when n.promotion is null or n.annee_diplomation is null then null
              else n.promotion = n.annee_diplomation end
    from notees n
   where n.critere is not null
     and not exists (select 1 from public.partenaire_prospects_rapprochements r
                      where r.carte_id = n.id and r.athlete_id = n.ath_id and r.statut <> 'CADUC')
$$;

-- Réserve une carte pour un athlète et le lui propose (notification). Source ADMIN ou AUTO.
create function public.prospect_partenaire_proposer(
  p_carte uuid, p_athlete uuid, p_origine text, p_critere text, p_force text)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_user  uuid;
  v_org   text;
begin
  select * into v_carte from public.partenaire_prospects where id = p_carte for update;
  if not found or v_carte.statut not in ('A_ENVOYER', 'ENVOYEE') or v_carte.expire_le <= now() then
    raise exception 'NEXUS: cette carte ne peut pas être proposée (déjà réservée ou expirée)' using errcode = '22023';
  end if;
  select a.user_id into v_user
    from public.athletes a join public.users u on u.id = a.user_id
   where a.id = p_athlete and a.status = 'ACTIF'::public.account_status and u.role = 'ATHLETE'::public.user_role;
  if v_user is null then
    raise exception 'NEXUS: cet athlète n''a pas de compte actif à qui proposer la carte' using errcode = '22023';
  end if;
  select organization_name into v_org from public.media_partners where id = v_carte.partner_id;

  update public.partenaire_prospects
     set statut = 'RESERVEE', statut_avant = v_carte.statut, reservation_source = p_origine,
         reservee_par = v_user, reservee_athlete = p_athlete, reservee_le = now(), updated_at = now()
   where id = p_carte;
  insert into public.partenaire_prospects_rapprochements (carte_id, athlete_id, critere, force, origine, statut, decide_par)
  values (p_carte, p_athlete, p_critere, p_force, p_origine, 'PROPOSE', case when p_origine = 'ADMIN' then auth.uid() end)
  on conflict (carte_id, athlete_id) do update
    set statut = 'PROPOSE', origine = excluded.origine, critere = excluded.critere, force = excluded.force,
        decide_par = excluded.decide_par, decide_le = now();
  insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
  values (p_athlete, 'PARTENAIRE_EVALUATION',
          coalesce(v_org, 'Un partenaire') || ' t''a évalué. C''est toi ?',
          'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.',
          jsonb_build_object('carte_id', p_carte));
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'PROPOSITION_' || p_origine, p_athlete,
            jsonb_build_object('critere', p_critere, 'force', p_force));
end $$;

-- Proposition AUTOMATIQUE (point 3) : pour chaque carte libre, s'il existe UN SEUL candidat de
-- force MOYENNE, qu'il est déjà visible du partenaire (is_partner_eligible_athlete) et que le
-- sport de la CARTE est le sien (principal ou d'une équipe) et permis au partenaire, la carte
-- lui est proposée. Sinon : l'admin décide.
create function public.prospect_partenaire_proposer_auto(p_carte uuid default null, p_athlete uuid default null)
returns integer
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare r record; v_carte uuid; v_partner uuid; v_sport uuid; n int := 0;
begin
  -- Les cartes à examiner : celle qu'on vient d'enregistrer, ou celles où CET athlète est un
  -- candidat MOYENNE (on part de l'athlète, jamais de tout le croisement cartes × athlètes).
  for v_carte in
    select p_carte where p_carte is not null
    union
    select distinct k.carte_id from public.prospect_partenaire_candidats(null, p_athlete) k
     where p_carte is null and p_athlete is not null and k.force = 'MOYENNE'
  loop
    -- Unicité vérifiée sur la carte ENTIÈRE : deux candidats MOYENNE = ambigu = l'admin décide.
    select u.* into r
      from (select (array_agg(k.athlete_id))[1] as athlete_id, (array_agg(k.critere))[1] as critere
              from public.prospect_partenaire_candidats(v_carte, null) k
             where k.force = 'MOYENNE'
            having count(*) = 1) u;
    continue when r.athlete_id is null;
    continue when p_athlete is not null and r.athlete_id <> p_athlete;
    continue when not coalesce(public.is_partner_eligible_athlete(r.athlete_id), false);
    select c.partner_id, c.sport_id into v_partner, v_sport from public.partenaire_prospects c where c.id = v_carte;
    continue when not public.prospect_partenaire_sport_concorde(v_sport, r.athlete_id);
    continue when not public.prospect_partenaire_peut_transferer(v_partner, v_sport);
    perform public.prospect_partenaire_proposer(v_carte, r.athlete_id, 'AUTO', r.critere, 'MOYENNE');
    n := n + 1;
    r := null;
  end loop;
  return n;
end $$;

-- Trigger sur athletes : l'opt-in partenaire vient de devenir actif. 1) les cartes que ce jeune a
-- confirmées en attente sont transférées ; 2) les rapprochements MOYENNE uniques lui sont
-- proposés. N'échoue JAMAIS : toute erreur est journalisée et l'opt-in est enregistré.
create function public.prospect_partenaire_sur_optin()
returns trigger
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare r record;
begin
  if new.user_id is null or not coalesce(public.is_partner_eligible_athlete(new.id), false) then
    return null;
  end if;
  for r in select c.id, c.partner_id from public.partenaire_prospects c
            where c.reservee_athlete = new.id and c.statut = 'CONFIRMEE_ATTENTE_OPTIN' and c.expire_le > now()
  loop
    begin
      perform public.prospect_partenaire_transferer(r.id, new.id);
    exception when others then
      begin
        perform public.prospect_partenaire_journaliser(r.id, r.partner_id, 'TRANSFERT_ECHEC', new.id,
                  jsonb_build_object('sqlstate', sqlstate));
      exception when others then null;
      end;
    end;
  end loop;
  if exists (select 1 from public.partenaire_prospects where statut in ('A_ENVOYER', 'ENVOYEE')) then
    begin
      perform public.prospect_partenaire_proposer_auto(null, new.id);
    exception when others then
      begin
        perform public.prospect_partenaire_journaliser('00000000-0000-0000-0000-000000000000'::uuid, null,
                  'PROPOSITION_AUTO_ECHEC', new.id, jsonb_build_object('sqlstate', sqlstate));
      exception when others then null;
      end;
    end;
  end if;
  return null;
end $$;

-- Le WHEN écarte toute écriture qui n'ACTIVE pas l'opt-in : la fonction n'est même pas appelée.
create trigger trg_prospect_partenaire_sur_optin
after update of partner_visibility_opt_in, partner_visibility_parental_consent on public.athletes
for each row
when (new.partner_visibility_opt_in
      and (old.partner_visibility_opt_in is distinct from new.partner_visibility_opt_in
           or old.partner_visibility_parental_consent is distinct from new.partner_visibility_parental_consent))
execute function public.prospect_partenaire_sur_optin();

-- ── Partenaire ────────────────────────────────────────────────────────────────

-- Créer (p_carte NULL) ou modifier une carte. Aucune prolongation de l'échéance.
create function public.partenaire_prospect_enregistrer(
  p_carte             uuid,
  p_prenom            text,
  p_nom               text,
  p_sport_id          uuid,
  p_position_id       uuid,
  p_school_id         uuid,
  p_team_id           uuid,
  p_promotion         integer,
  p_atteste_14_ans    boolean,
  p_cote_globale      numeric default null,
  p_traits            jsonb default '{}'::jsonb,
  p_badges_partenaire uuid[] default '{}',
  p_badges_nexus      uuid[] default '{}')
returns uuid
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_mp      public.media_partners%rowtype;
  v_carte   public.partenaire_prospects%rowtype;
  v_eval    record;
  v_grille  uuid;
  v_bp      uuid[] := coalesce((select array_agg(distinct x) from unnest(p_badges_partenaire) x where x is not null), '{}');
  v_bn      uuid[] := coalesce((select array_agg(distinct x) from unnest(p_badges_nexus) x where x is not null), '{}');
  v_libelle text;
  v_id      uuid;
begin
  select * into v_mp from public.media_partners where user_id = auth.uid();
  if not found then
    raise exception 'NEXUS: réservé aux partenaires' using errcode = '42501';
  end if;
  if not public.partenaire_peut_evaluer(v_mp.id, p_sport_id) then
    raise exception 'NEXUS: cartes prospects non permises (permission, sport ou statut du partenaire)' using errcode = '42501';
  end if;
  if not coalesce(p_atteste_14_ans, false) then
    raise exception 'NEXUS: confirme que ce jeune a 14 ans ou plus' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_prenom, '')), '') is null or nullif(btrim(coalesce(p_nom, '')), '') is null then
    raise exception 'NEXUS: prénom et nom obligatoires' using errcode = '22023';
  end if;
  if p_position_id is not null
     and not exists (select 1 from public.positions p where p.id = p_position_id and p.sport_id = p_sport_id) then
    raise exception 'NEXUS: cette position n''appartient pas au sport choisi' using errcode = '22023';
  end if;
  if p_team_id is not null
     and not exists (select 1 from public.teams t where t.id = p_team_id and t.sport_id = p_sport_id) then
    raise exception 'NEXUS: cette équipe n''est pas du sport choisi' using errcode = '22023';
  end if;
  if p_promotion is not null
     and (p_promotion < extract(year from now())::int - 1 or p_promotion > extract(year from now())::int + 6) then
    raise exception 'NEXUS: promotion hors des années possibles' using errcode = '22023';
  end if;
  if cardinality(v_bp) > 10 or cardinality(v_bn) > 10 then
    raise exception 'NEXUS: 10 badges au plus de chaque sorte' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_bp) b
              where not exists (select 1 from public.partner_badges pb
                                 where pb.id = b and pb.partner_id = v_mp.id and pb.actif)) then
    raise exception 'NEXUS: badge partenaire introuvable, désactivé ou d''un autre partenaire' using errcode = '42501';
  end if;
  select coalesce(bd.libelle, '?') into v_libelle
    from unnest(v_bn) b left join public.badges bd on bd.id = b
   where bd.id is null or bd.famille not in ('universel', 'sport') or bd.requiert_contexte or not bd.actif
   limit 1;
  if found then
    raise exception 'NEXUS: le badge « % » ne peut pas être attribué par un partenaire', v_libelle using errcode = '42501';
  end if;
  select bd.libelle into v_libelle
    from unnest(v_bn) b join public.badges bd on bd.id = b
   where bd.famille = 'sport'
     and not exists (select 1 from public.badge_sports bs where bs.badge_id = bd.id and bs.sport_id = p_sport_id)
   limit 1;
  if found then
    raise exception 'NEXUS: le badge « % » ne s''applique pas au sport de cette carte', v_libelle using errcode = '22023';
  end if;

  select * into v_eval from public.prospect_partenaire_normaliser_evaluation(p_cote_globale, p_traits);
  if v_eval.cote is not null then
    select pg.grille_id into v_grille from public.position_grille pg where pg.position_id = p_position_id;
    if v_grille is null then
      select g.id into v_grille from public.evaluation_grilles g where g.code = 'GENERIQUE';
    end if;
  end if;

  if p_carte is null then
    perform pg_advisory_xact_lock(hashtext('w4-prospects:' || v_mp.id::text));
    if (select count(*) from public.partenaire_prospects where partner_id = v_mp.id) >= 50 then
      raise exception 'NEXUS: limite de 50 cartes prospects actives atteinte' using errcode = '54000';
    end if;
    insert into public.partenaire_prospects (
      partner_id, cree_par, prenom, nom, sport_id, position_id, school_id, team_id, promotion,
      atteste_14_ans_le, cote_globale, traits, grille_id, badges_partenaire, badges_nexus)
    values (
      v_mp.id, auth.uid(), btrim(p_prenom), btrim(p_nom), p_sport_id, p_position_id, p_school_id, p_team_id, p_promotion,
      now(), v_eval.cote, v_eval.traits, v_grille, v_bp, v_bn)
    returning id into v_id;
    perform public.prospect_partenaire_journaliser(v_id, v_mp.id, 'CREEE');
  else
    select * into v_carte from public.partenaire_prospects where id = p_carte for update;
    if not found or v_carte.partner_id <> v_mp.id then
      raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
    end if;
    -- Loi 25 : une proposition (ADMIN ou AUTO), que le partenaire ne voit pas, ne change RIEN
    -- à ce qu'il peut faire. Le jeune n'a confirmé que la carte qu'il a vue : la proposition est
    -- levée sans bruit (paire CADUC, notification caduque), puis la modification s'applique et
    -- la proposition automatique est recalculée plus bas sur la carte modifiée.
    perform public.prospect_partenaire_lever_proposition(p_carte, 'MODIFIEE');
    -- Même règle pour une carte réservée par SON lien (il la voit « Lien envoyé ») : la
    -- réservation est levée, la carte redevient ENVOYEE avec le même lien ; le jeune rouvre le
    -- lien et (re)confirme la carte modifiée.
    perform public.prospect_partenaire_lever_reservation_lien(p_carte, 'MODIFIEE');
    select * into v_carte from public.partenaire_prospects where id = p_carte;
    -- Reste refusé : une carte expirée (le partenaire voit son échéance).
    if v_carte.statut not in ('A_ENVOYER', 'ENVOYEE') or v_carte.expire_le <= now() then
      raise exception 'NEXUS: cette carte ne peut pas être modifiée pour l''instant' using errcode = '42501';
    end if;
    update public.partenaire_prospects set
      prenom = btrim(p_prenom), nom = btrim(p_nom), sport_id = p_sport_id, position_id = p_position_id,
      school_id = p_school_id, team_id = p_team_id, promotion = p_promotion, atteste_14_ans_le = now(),
      cote_globale = v_eval.cote, traits = v_eval.traits, grille_id = v_grille,
      badges_partenaire = v_bp, badges_nexus = v_bn, updated_at = now()
    where id = p_carte;
    perform public.prospect_partenaire_journaliser(p_carte, v_mp.id, 'MODIFIEE');
    v_id := p_carte;
  end if;

  -- Point 3 : proposition automatique éventuelle. Jamais bloquante pour l'enregistrement.
  begin
    perform public.prospect_partenaire_proposer_auto(v_id, null);
  exception when others then
    perform public.prospect_partenaire_journaliser(v_id, v_mp.id, 'PROPOSITION_AUTO_ECHEC', null,
              jsonb_build_object('sqlstate', sqlstate));
  end;
  return v_id;
end $$;

-- Génère le lien : le jeton n'est rendu qu'ICI, une seule fois ; seule son empreinte reste.
-- Un nouveau lien remplace le précédent.
-- Loi 25 : sur une carte en PROPOSITION (ADMIN ou AUTO, en cours ou confirmée), le lien se crée
-- exactement comme sur une carte libre ; la proposition reste, et l'état que le partenaire
-- voit (statut_avant) devient « ENVOYEE ». Le lien est utilisable tant que la proposition n'est
-- pas confirmée (prospect_partenaire_ouvrir).
-- Carte réservée par le LIEN (vue « Lien envoyé ») : comme sur une carte « Lien envoyé » —
-- l'ancien jeton meurt, la réservation est levée sans bruit (RESERVATION_LIEN_LEVEE).
create function public.partenaire_prospect_lien(p_carte uuid)
returns text
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_jeton text := encode(extensions.gen_random_bytes(32), 'hex');
  v_prop  boolean;
  v_vu    text;
begin
  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  if not public.partenaire_peut_evaluer(v_carte.partner_id, v_carte.sport_id) then
    raise exception 'NEXUS: cartes prospects non permises (permission, sport ou statut du partenaire)' using errcode = '42501';
  end if;
  if v_carte.expire_le > now() then
    perform public.prospect_partenaire_lever_reservation_lien(p_carte, 'NOUVEAU_LIEN');
    select * into v_carte from public.partenaire_prospects where id = p_carte;
  end if;
  v_prop := coalesce(v_carte.reservation_source, 'LIEN') <> 'LIEN';
  v_vu   := case when v_prop then v_carte.statut_avant else v_carte.statut end;
  if v_vu not in ('A_ENVOYER', 'ENVOYEE') or v_carte.expire_le <= now() then
    raise exception 'NEXUS: cette carte ne peut pas recevoir de nouveau lien pour l''instant' using errcode = '42501';
  end if;
  update public.partenaire_prospects
     set statut       = case when v_prop then statut else 'ENVOYEE' end,
         statut_avant = case when v_prop then 'ENVOYEE' else statut_avant end,
         jeton_empreinte = encode(extensions.digest(v_jeton, 'sha256'), 'hex'),
         jeton_cree_le = now(), updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id,
            case when v_vu = 'ENVOYEE' then 'LIEN_REMPLACE' else 'LIEN_GENERE' end);
  return v_jeton;
end $$;

create function public.partenaire_prospect_revoquer_lien(p_carte uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_prop  boolean;
  v_vu    text;
begin
  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  -- Loi 25 : sur une carte en PROPOSITION, la révocation se comporte comme sur une carte libre ;
  -- la proposition reste, l'état vu par le partenaire (statut_avant) devient « A_ENVOYER ».
  -- Carte réservée par le LIEN : la réservation est levée sans bruit, puis le lien révoqué.
  perform public.prospect_partenaire_lever_reservation_lien(p_carte, 'REVOCATION');
  select * into v_carte from public.partenaire_prospects where id = p_carte;
  v_prop := coalesce(v_carte.reservation_source, 'LIEN') <> 'LIEN';
  v_vu   := case when v_prop then v_carte.statut_avant else v_carte.statut end;
  if v_vu not in ('A_ENVOYER', 'ENVOYEE') then
    raise exception 'NEXUS: ce lien ne peut pas être révoqué pour l''instant' using errcode = '42501';
  end if;
  if v_vu = 'A_ENVOYER' then return; end if;
  update public.partenaire_prospects
     set statut       = case when v_prop then statut else 'A_ENVOYER' end,
         statut_avant = case when v_prop then 'A_ENVOYER' else statut_avant end,
         jeton_empreinte = null, jeton_cree_le = null, updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'LIEN_REVOQUE');
end $$;

-- Le partenaire retire sa carte, à tout moment : minimisation.
create function public.partenaire_prospect_supprimer(p_carte uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  perform 1 from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  perform public.prospect_partenaire_terminer(p_carte, 'RETIREE');
end $$;

-- Ce que le partenaire voit de SES cartes. Le statut est MASQUÉ : une réservation par le lien
-- se lit « ENVOYEE » ; une proposition de l'admin, ou une confirmation en attente d'opt-in,
-- se lit comme l'état d'avant. Seule une proposition AUTOMATIQUE à un jeune encore visible
-- du partenaire se lit « CORRESPONDANCE_POSSIBLE » (point 3).
create function public.partenaire_prospects_mes_cartes()
returns table (
  id uuid, prenom text, nom text, sport_id uuid, position_id uuid, school_id uuid, team_id uuid,
  promotion integer, cote_globale numeric, traits jsonb, badges_partenaire uuid[], badges_nexus uuid[],
  statut text, expire_le timestamptz, created_at timestamptz, updated_at timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select c.id, c.prenom, c.nom, c.sport_id, c.position_id, c.school_id, c.team_id, c.promotion,
         c.cote_globale, c.traits, c.badges_partenaire, c.badges_nexus,
         case
           when c.statut in ('A_ENVOYER', 'ENVOYEE') then c.statut
           when c.reservation_source = 'LIEN' then 'ENVOYEE'
           when c.reservation_source = 'AUTO' and c.statut = 'RESERVEE'
                and coalesce(public.is_partner_eligible_athlete(c.reservee_athlete), false) then 'CORRESPONDANCE_POSSIBLE'
           else c.statut_avant
         end,
         c.expire_le, c.created_at, c.updated_at
    from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where mp.user_id = auth.uid()
   order by c.created_at desc
$$;

-- Issues des cartes du partenaire, SANS nom. L'athlète d'une carte réclamée est rendu
-- (il a activé la visibilité partenaire pour que le transfert ait lieu).
create function public.partenaire_prospects_mes_issues()
returns table (carte_id uuid, issue text, athlete_id uuid, carte_creee_le timestamptz, terminee_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select i.carte_id, i.issue,
         case when i.issue = 'RECLAMEE' and i.annulee_le is null then i.athlete_id end,
         i.carte_creee_le, i.terminee_le
    from public.partenaire_prospects_issues i
    join public.media_partners mp on mp.id = i.partner_id
   where mp.user_id = auth.uid()
   order by i.terminee_le desc
$$;

-- ── Le jeune ──────────────────────────────────────────────────────────────────

-- Page du lien, AVANT connexion : le nom du partenaire, rien d'autre. Un lien invalide,
-- expiré, révoqué ou réservé à un autre compte rend la même réponse. Une carte en proposition
-- NON confirmée garde son lien valide (le lien prend le dessus à l'ouverture).
create function public.prospect_partenaire_resoudre(p_jeton text)
returns table (valide boolean, partenaire text)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  with trouve as (
    select mp.organization_name
      from public.partenaire_prospects c
      join public.media_partners mp on mp.id = c.partner_id and mp.status = 'APPROVED'
     where coalesce(p_jeton, '') ~ '^[0-9a-f]{64}$'
       and c.jeton_empreinte = encode(extensions.digest(p_jeton, 'sha256'), 'hex')
       and c.expire_le > now()
       and (c.statut = 'ENVOYEE'
            or (c.statut = 'RESERVEE' and c.reservation_source in ('ADMIN', 'AUTO'))
            or (c.reservee_par is not null and c.reservee_par = auth.uid()))
  )
  select true, organization_name from trouve
  union all
  select false, null::text where not exists (select 1 from trouve)
$$;

-- Ouverture CONNECTÉE par un compte athlète : réserve la carte à ce compte (source LIEN) et
-- rend son contenu. Si la carte est PROPOSÉE (ADMIN ou AUTO) à un autre jeune et que celui-ci
-- n'a pas encore confirmé, la réservation par le lien prend le dessus : la proposition est
-- levée (paire CADUC, notification caduque). Une proposition confirmée (attente d'opt-in)
-- garde la carte : le lien est alors refusé.
create function public.prospect_partenaire_ouvrir(p_jeton text)
returns jsonb
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte   public.partenaire_prospects%rowtype;
  v_athlete uuid;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: connexion requise' using errcode = '42501';
  end if;
  select a.id into v_athlete
    from public.athletes a join public.users u on u.id = a.user_id
   where a.user_id = auth.uid() and u.role = 'ATHLETE'::public.user_role
   order by a.created_at limit 1;
  if v_athlete is null then
    raise exception 'NEXUS: ce lien s''adresse à un athlète inscrit' using errcode = '42501';
  end if;

  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id and mp.status = 'APPROVED'
   where coalesce(p_jeton, '') ~ '^[0-9a-f]{64}$'
     and c.jeton_empreinte = encode(extensions.digest(p_jeton, 'sha256'), 'hex')
   for update of c;
  if not found or v_carte.expire_le <= now()
     or not (v_carte.statut = 'ENVOYEE'
             or (v_carte.statut = 'RESERVEE' and v_carte.reservation_source in ('ADMIN', 'AUTO'))
             or v_carte.reservee_par is not distinct from auth.uid()) then
    raise exception 'NEXUS: ce lien n''est plus valide' using errcode = 'P0002';
  end if;

  if v_carte.reservee_par is distinct from auth.uid()
     and v_carte.statut = 'RESERVEE' and v_carte.reservation_source in ('ADMIN', 'AUTO') then
    perform public.prospect_partenaire_lever_proposition(v_carte.id, 'LIEN_OUVERT');
    select * into v_carte from public.partenaire_prospects where id = v_carte.id;
  end if;

  if v_carte.statut = 'ENVOYEE' then
    update public.partenaire_prospects
       set statut = 'RESERVEE', reservation_source = 'LIEN', reservee_par = auth.uid(),
           reservee_athlete = v_athlete, reservee_le = now(), updated_at = now()
     where id = v_carte.id;
    perform public.prospect_partenaire_journaliser(v_carte.id, v_carte.partner_id, 'RESERVEE', v_athlete);
  end if;
  return public.prospect_partenaire_contenu(v_carte.id, v_athlete);
end $$;

-- Les cartes réservées à MOI (par le lien ou proposées), y compris celles en attente d'opt-in :
-- alimente l'écran de réponse et le rappel « active la visibilité partenaire ».
create function public.prospect_partenaire_mes_cartes()
returns jsonb
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select coalesce(jsonb_agg(public.prospect_partenaire_contenu(c.id, c.reservee_athlete) order by c.reservee_le), '[]'::jsonb)
    from public.partenaire_prospects c
   where c.reservee_par = auth.uid()
     and c.statut in ('RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')
     and c.expire_le > now()
$$;

-- « C'est moi ». Opt-in actif → transfert immédiat. Sinon → CONFIRMEE_ATTENTE_OPTIN : le
-- transfert partira tout seul quand l'opt-in deviendra actif (trigger), avant l'échéance.
create function public.prospect_partenaire_confirmer(p_carte uuid)
returns jsonb
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte   public.partenaire_prospects%rowtype;
  v_athlete public.athletes%rowtype;
begin
  select * into v_carte from public.partenaire_prospects
   where id = p_carte and reservee_par = auth.uid() and statut in ('RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')
   for update;
  if not found or v_carte.expire_le <= now() then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  select * into v_athlete from public.athletes where id = v_carte.reservee_athlete;
  if v_athlete.status is distinct from 'ACTIF'::public.account_status then
    raise exception 'NEXUS: athlète non actif' using errcode = '42501';
  end if;

  if coalesce(public.is_partner_eligible_athlete(v_athlete.id), false) then
    return public.prospect_partenaire_transferer(v_carte.id, v_athlete.id);
  end if;

  if v_carte.statut = 'RESERVEE' then
    update public.partenaire_prospects set statut = 'CONFIRMEE_ATTENTE_OPTIN', updated_at = now() where id = v_carte.id;
    update public.partenaire_prospects_rapprochements set statut = 'CONFIRME', decide_le = now()
     where carte_id = v_carte.id and athlete_id = v_athlete.id;
    perform public.prospect_partenaire_journaliser(v_carte.id, v_carte.partner_id, 'CONFIRMEE_ATTENTE_OPTIN', v_athlete.id);
  end if;
  return jsonb_build_object('statut', 'attente_optin', 'expire_le', v_carte.expire_le,
           'partenaire', (select organization_name from public.media_partners where id = v_carte.partner_id));
end $$;

-- « Ce n'est pas moi ». Par le LIEN : suppression immédiate (rien ne garde le compte ni le nom).
-- Sur une PROPOSITION : la carte revient à son état d'avant et la paire est INFIRME (décision A).
create function public.prospect_partenaire_infirmer(p_carte uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare v_carte public.partenaire_prospects%rowtype;
begin
  select * into v_carte from public.partenaire_prospects
   where id = p_carte and reservee_par = auth.uid() and statut in ('RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')
   for update;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  if v_carte.reservation_source = 'LIEN' then
    perform public.prospect_partenaire_terminer(p_carte, 'REFUSEE');
    return;
  end if;
  update public.partenaire_prospects_rapprochements set statut = 'INFIRME', decide_le = now()
   where carte_id = p_carte and athlete_id = v_carte.reservee_athlete;
  update public.partenaire_prospects
     set statut = v_carte.statut_avant, statut_avant = null, reservation_source = null,
         reservee_par = null, reservee_athlete = null, reservee_le = null, updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'PROPOSITION_INFIRMEE', v_carte.reservee_athlete);
end $$;

-- ── Admin ─────────────────────────────────────────────────────────────────────

-- Cartes actives, puis issues. Les noms ne sortent que des cartes actives et de l'instantané
-- (7 jours) d'une carte réclamée.
create function public.admin_prospects_partenaires()
returns table (
  id uuid, carte_id uuid, partenaire text, prenom text, nom text, sport text, statut text,
  reservation_source text, reservee_athlete uuid, athlete_id uuid, created_at timestamptz,
  expire_le timestamptz, terminee_le timestamptz, annulable boolean)
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  return query
    select c.id, c.id, mp.organization_name, c.prenom, c.nom, s.nom, c.statut,
           c.reservation_source, c.reservee_athlete, null::uuid, c.created_at, c.expire_le,
           null::timestamptz, c.statut in ('RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')
      from public.partenaire_prospects c
      join public.media_partners mp on mp.id = c.partner_id
      join public.sports s on s.id = c.sport_id
    union all
    select i.id, i.carte_id, mp.organization_name, i.instantane->>'prenom', i.instantane->>'nom', s.nom,
           case when i.annulee_le is not null then 'RECLAMATION_ANNULEE' else i.issue end,
           i.instantane->>'reservation_source', null::uuid, i.athlete_id, i.carte_creee_le, null::timestamptz,
           i.terminee_le,
           i.issue = 'RECLAMEE' and i.annulee_le is null and i.annulable_jusqu_au > now() and i.instantane is not null
      from public.partenaire_prospects_issues i
      left join public.media_partners mp on mp.id = i.partner_id
      left join public.sports s on s.id = (i.instantane->>'sport_id')::uuid
    order by 11 desc;
end $$;

-- Rapprochements : candidats calculés à la demande (non décidés) + décisions enregistrées.
create function public.admin_prospects_rapprochements()
returns table (
  carte_id uuid, athlete_id uuid, athlete_prenom text, athlete_nom text, critere text, force text,
  promotion_concorde boolean, visible_partenaire boolean, statut text, origine text, decide_le timestamptz)
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  return query
    select k.carte_id, k.athlete_id, a.first_name, a.last_name, k.critere, k.force, k.promotion_concorde,
           coalesce(public.is_partner_eligible_athlete(k.athlete_id), false), 'CANDIDAT'::text, null::text, null::timestamptz
      from public.prospect_partenaire_candidats(null, null) k
      join public.athletes a on a.id = k.athlete_id
    union all
    select r.carte_id, r.athlete_id, a.first_name, a.last_name, r.critere, r.force, null::boolean,
           coalesce(public.is_partner_eligible_athlete(r.athlete_id), false), r.statut, r.origine, r.decide_le
      from public.partenaire_prospects_rapprochements r
      join public.athletes a on a.id = r.athlete_id
    order by 1, 9, 6;
end $$;

-- « Proposer au jeune » : la carte lui est réservée et il est notifié. Il confirme ou infirme
-- lui-même : AUCUNE fonction ne fusionne à sa place.
create function public.admin_prospect_proposer(p_carte uuid, p_athlete uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare k record;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  select * into k from public.prospect_partenaire_candidats(p_carte, p_athlete);
  if not found then
    -- Une paire déjà écartée peut être reproposée par l'admin (il change d'avis) ;
    -- sinon elle doit être un candidat réel.
    select r.critere, r.force into k from public.partenaire_prospects_rapprochements r
     where r.carte_id = p_carte and r.athlete_id = p_athlete and r.statut = 'ECARTE';
    if not found then
      raise exception 'NEXUS: ce rapprochement n''est pas un candidat' using errcode = '22023';
    end if;
  end if;
  perform public.prospect_partenaire_proposer(p_carte, p_athlete, 'ADMIN', k.critere, k.force);
end $$;

create function public.admin_prospect_ecarter(p_carte uuid, p_athlete uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare k record; v_partner uuid;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  select * into k from public.prospect_partenaire_candidats(p_carte, p_athlete);
  if not found then
    raise exception 'NEXUS: ce rapprochement n''est pas un candidat' using errcode = '22023';
  end if;
  insert into public.partenaire_prospects_rapprochements (carte_id, athlete_id, critere, force, origine, statut, decide_par)
  values (p_carte, p_athlete, k.critere, k.force, 'ADMIN', 'ECARTE', auth.uid());
  select partner_id into v_partner from public.partenaire_prospects where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v_partner, 'PROPOSITION_ECARTEE', p_athlete);
end $$;

create function public.admin_prospect_supprimer(p_carte uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  perform 1 from public.partenaire_prospects where id = p_carte for update;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  perform public.prospect_partenaire_terminer(p_carte, 'SUPPRIMEE_ADMIN');
end $$;

-- Annulation par l'admin :
--  · carte réservée (ou en attente d'opt-in) → réservation levée ; par le lien : lien révoqué,
--    retour à « à envoyer » ; sur une proposition : retour à l'état d'avant, paire CADUC ;
--  · issue RÉCLAMÉE depuis moins de 7 jours → transfert défait (évaluation retirée avec trace
--    dans partner_evaluation_retraits, badges retirés), carte restaurée sans lien.
create function public.admin_prospect_annuler(p_id uuid)
returns text
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_issue public.partenaire_prospects_issues%rowtype;
  v_ev    public.partner_evaluations%rowtype;
  v_ids   uuid[];
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;

  select * into v_carte from public.partenaire_prospects where id = p_id for update;
  if found then
    if v_carte.statut not in ('RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN') then
      raise exception 'NEXUS: rien à annuler sur cette carte' using errcode = '22023';
    end if;
    if v_carte.reservation_source = 'LIEN' then
      update public.partenaire_prospects
         set statut = 'A_ENVOYER', reservation_source = null, reservee_par = null, reservee_athlete = null,
             reservee_le = null, jeton_empreinte = null, jeton_cree_le = null, updated_at = now()
       where id = p_id;
    else
      -- Proposition : levée (notification caduque), puis la paire est ÉCARTÉE par l'admin — une
      -- paire CADUC redeviendrait candidate et pourrait être reproposée automatiquement.
      perform public.prospect_partenaire_lever_proposition(p_id, 'ANNULEE_ADMIN');
      update public.partenaire_prospects_rapprochements set statut = 'ECARTE', decide_par = auth.uid(), decide_le = now()
       where carte_id = p_id and athlete_id = v_carte.reservee_athlete;
    end if;
    perform public.prospect_partenaire_journaliser(p_id, v_carte.partner_id, 'RESERVATION_ANNULEE', v_carte.reservee_athlete);
    return 'RESERVATION_ANNULEE';
  end if;

  select * into v_issue from public.partenaire_prospects_issues where id = p_id for update;
  if not found or v_issue.issue <> 'RECLAMEE' or v_issue.annulee_le is not null
     or v_issue.instantane is null or v_issue.annulable_jusqu_au <= now() then
    raise exception 'NEXUS: rien à annuler (introuvable, déjà annulée ou délai de 7 jours dépassé)' using errcode = '22023';
  end if;

  if v_issue.transfert->>'evaluation_id' is not null then
    select * into v_ev from public.partner_evaluations where id = (v_issue.transfert->>'evaluation_id')::uuid for update;
    if found then
      insert into public.partner_evaluation_retraits (evaluation_id, partner_id, athlete_id, cote_globale, evaluation, retire_par)
      values (v_ev.id, v_ev.partner_id, v_ev.athlete_id, v_ev.cote_globale, to_jsonb(v_ev), auth.uid());
      delete from public.partner_evaluations where id = v_ev.id;
    end if;
  end if;
  select coalesce(array_agg((e->>'attribution')::uuid), '{}') into v_ids
    from jsonb_array_elements(coalesce(v_issue.transfert->'badges', '[]'::jsonb)) e
   where e->>'attribution' is not null;
  update public.partner_athlete_badges set retire_le = now(), retire_par = auth.uid()
   where id = any (v_ids) and retire_le is null;

  insert into public.partenaire_prospects
  select (jsonb_populate_record(null::public.partenaire_prospects,
            v_issue.instantane || jsonb_build_object(
              'statut', 'A_ENVOYER', 'statut_avant', null, 'reservation_source', null,
              'reservee_par', null, 'reservee_athlete', null, 'reservee_le', null,
              'jeton_empreinte', null, 'jeton_cree_le', null, 'updated_at', now()))).*;

  update public.partenaire_prospects_issues
     set annulee_le = now(), annulee_par = auth.uid(), instantane = null
   where id = p_id;
  perform public.prospect_partenaire_journaliser(v_issue.carte_id, v_issue.partner_id, 'RECLAMATION_ANNULEE',
            v_issue.athlete_id, jsonb_build_object('badges_retires', cardinality(v_ids),
                                                   'evaluation_retiree', v_issue.transfert->>'evaluation_id' is not null));
  return 'RECLAMATION_ANNULEE';
end $$;

-- Export Loi 25 (/admin/loi25). Gestes du journal concernant un compte : comme acteur, comme
-- athlète visé, ou comme titulaire du partenaire. Côté PARTENAIRE, tout ce qui touche un
-- rapprochement est retiré et l'athlète effacé : l'export peut lui être remis (droit d'accès)
-- et ne doit pas révéler qu'un mineur est sur Nexus. Pour un partenaire, ses cartes ACTIVES
-- sont jointes (sans empreinte de jeton ni réservation).
create function public.admin_loi25_prospects_partenaires(
  p_user uuid default null, p_debut timestamptz default null, p_fin timestamptz default null)
returns table (horodatage timestamptz, source text, action text, partner_id uuid, carte_id uuid,
               acteur uuid, athlete_id uuid, details jsonb)
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
declare
  v_partenaire boolean := p_user is not null
                          and exists (select 1 from public.media_partners mp where mp.user_id = p_user);
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''administrateur' using errcode = '42501';
  end if;
  return query
    -- Tout compte NON partenaire (athlète, admin…) : ses gestes et ceux qui le visent.
    select j.created_at, 'partenaire_prospects_journal'::text, j.action, j.partner_id, j.carte_id,
           j.acteur, j.athlete_id, j.details
      from public.partenaire_prospects_journal j
     where not v_partenaire
       and (p_debut is null or j.created_at >= p_debut)
       and (p_fin   is null or j.created_at <= p_fin)
       and (p_user is null
            or j.acteur = p_user
            or j.athlete_id in (select a.id from public.athletes a where a.user_id = p_user))
    union all
    -- Compte PARTENAIRE : les gestes sur ses cartes, SANS athlète ni détail, et sans rien de
    -- ce qui touche un rapprochement — même quand c'est son propre enregistrement qui a
    -- déclenché une proposition automatique.
    select j.created_at, 'partenaire_prospects_journal'::text, j.action, j.partner_id, j.carte_id,
           case when j.acteur = p_user then j.acteur end, null::uuid, '{}'::jsonb
      from public.partenaire_prospects_journal j
     where v_partenaire
       and j.partner_id in (select mp.id from public.media_partners mp where mp.user_id = p_user)
       and j.action in ('CREEE', 'MODIFIEE', 'LIEN_GENERE', 'LIEN_REMPLACE', 'LIEN_REVOQUE', 'RETIREE',
                        'RECLAMEE', 'REFUSEE', 'EXPIREE', 'SUPPRIMEE_ADMIN')
       and (p_debut is null or j.created_at >= p_debut)
       and (p_fin   is null or j.created_at <= p_fin)
    union all
    select c.created_at, 'partenaire_prospects'::text, 'CARTE_ACTIVE'::text, c.partner_id, c.id,
           c.cree_par, null::uuid,
           to_jsonb(c) - array['jeton_empreinte', 'reservee_par', 'reservee_athlete', 'reservee_le',
                               'reservation_source', 'statut_avant', 'statut']
      from public.partenaire_prospects c
     where p_user is not null
       and c.partner_id in (select mp.id from public.media_partners mp where mp.user_id = p_user)
    order by 1;
end $$;

-- ── Purge quotidienne ─────────────────────────────────────────────────────────

create function public.purger_prospects_partenaire()
returns integer
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare v_id uuid; n int := 0;
begin
  for v_id in select id from public.partenaire_prospects where expire_le <= now() for update skip locked loop
    perform public.prospect_partenaire_terminer(v_id, 'EXPIREE');
    n := n + 1;
  end loop;
  update public.partenaire_prospects_issues set instantane = null
   where instantane is not null and annulable_jusqu_au <= now();
  delete from public.partenaire_prospects_issues  where terminee_le < now() - interval '12 months';
  delete from public.partenaire_prospects_journal where created_at  < now() - interval '12 months';
  return n;
end $$;

select cron.schedule('prospects-partenaire-purge-quotidienne', '50 8 * * *', 'select public.purger_prospects_partenaire()');

-- ── Droits : retirer ce que les privilèges par défaut ont posé, puis accorder ─

do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and (p.proname like 'prospect_partenaire%' or p.proname like 'partenaire_prospect%'
                   or p.proname like 'admin_prospect%' or p.proname in ('admin_loi25_prospects_partenaires',
                                                                         'purger_prospects_partenaire'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

grant execute on function
  public.partenaire_prospect_enregistrer(uuid, text, text, uuid, uuid, uuid, uuid, integer, boolean, numeric, jsonb, uuid[], uuid[]),
  public.partenaire_prospect_lien(uuid),
  public.partenaire_prospect_revoquer_lien(uuid),
  public.partenaire_prospect_supprimer(uuid),
  public.partenaire_prospects_mes_cartes(),
  public.partenaire_prospects_mes_issues(),
  public.prospect_partenaire_resoudre(text),
  public.prospect_partenaire_ouvrir(text),
  public.prospect_partenaire_mes_cartes(),
  public.prospect_partenaire_confirmer(uuid),
  public.prospect_partenaire_infirmer(uuid),
  public.admin_prospects_partenaires(),
  public.admin_prospects_rapprochements(),
  public.admin_prospect_proposer(uuid, uuid),
  public.admin_prospect_ecarter(uuid, uuid),
  public.admin_prospect_supprimer(uuid),
  public.admin_prospect_annuler(uuid),
  public.admin_loi25_prospects_partenaires(uuid, timestamptz, timestamptz)
to authenticated;
grant execute on function public.prospect_partenaire_resoudre(text) to anon;

-- ── Garde finale : ACL comparées EN ENTIER (règle du 2026-09-07) ──────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
  n int := 0;
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and (p.proname like 'prospect_partenaire%' or p.proname like 'partenaire_prospect%'
                   or p.proname like 'admin_prospect%' or p.proname in ('admin_loi25_prospects_partenaires',
                                                                         'purger_prospects_partenaire'))
  loop
    n := n + 1;
    veut := case
      when r.proname = 'prospect_partenaire_resoudre' then array['anon', 'authenticated', 'postgres', 'service_role']
      when r.proname in ('prospect_partenaire_peut_transferer', 'prospect_partenaire_journaliser',
                         'prospect_partenaire_normaliser_evaluation', 'prospect_partenaire_terminer',
                         'prospect_partenaire_contenu', 'prospect_partenaire_transferer',
                         'prospect_partenaire_candidats', 'prospect_partenaire_proposer',
                         'prospect_partenaire_proposer_auto', 'prospect_partenaire_sur_optin',
                         'prospect_partenaire_sport_concorde', 'prospect_partenaire_lever_proposition',
                         'prospect_partenaire_lever_reservation_lien',
                         'purger_prospects_partenaire') then array['postgres', 'service_role']
      else array['authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if n <> 32 then
    raise exception 'NEXUS: 32 fonctions W4a attendues, % trouvées', n;
  end if;

  if exists (select 1 from pg_class c
              where c.oid in ('public.partenaire_prospects'::regclass, 'public.partenaire_prospects_rapprochements'::regclass,
                              'public.partenaire_prospects_issues'::regclass, 'public.partenaire_prospects_journal'::regclass)
                and (not c.relrowsecurity
                     or exists (select 1 from unnest(coalesce(c.relacl, '{}'::aclitem[])) a
                                 where split_part(a::text, '=', 1) in ('anon', 'authenticated', '')))) then
    raise exception 'NEXUS: une table W4a est lisible par anon/authenticated ou sans RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
               and tablename like 'partenaire_prospects%') then
    raise exception 'NEXUS: aucune politique attendue sur les tables W4a';
  end if;
  if (select count(*) from cron.job where jobname = 'prospects-partenaire-purge-quotidienne') <> 1 then
    raise exception 'NEXUS: tâche de purge W4a absente ou en double';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.athletes'::regclass
        and tgname = 'trg_prospect_partenaire_sur_optin') <> 1 then
    raise exception 'NEXUS: trigger d''opt-in absent';
  end if;
  raise notice 'NEXUS W4a : 4 tables (RLS, aucun droit direct), 32 fonctions, ACL exactes, trigger d''opt-in, purge planifiée — OK';
end $$;
$w4a$, E'\r', '')::text as contenu;

do $$
begin
  if (select md5(contenu) from _w4a) <> '719b7c7456c282f8ea6c907d2232d363' then
    raise exception 'NEXUS: contenu W4a embarqué altéré (md5 %)', (select md5(contenu) from _w4a);
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'w4a_prospects_partenaire', array[contenu], 'bptds22@gmail.com' from _w4a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_W4A_PROSPECTS_PARTENAIRE',
       'W4a Partenaire : cartes prospects, lien d''inscription à jeton, attente d''opt-in, rapprochements admin, export Loi 25 (GO BP)',
       jsonb_build_object(
         'nom', 'w4a_prospects_partenaire',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_w4a_prospects_partenaire.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_w4a_prospects_partenaire.sql',
         'voie', 'psql -1 (session pooler) : relevé avant + migration + gardes dans une seule transaction',
         'md5_fichier', '719b7c7456c282f8ea6c907d2232d363',
         'tables', '4 (RLS, aucune politique, aucun droit direct)',
         'fonctions', '32 — ACL complètes : 1 anon+authenticated, 17 authenticated, 14 serveur seulement',
         'trigger', 'trg_prospect_partenaire_sur_optin (AFTER UPDATE OF opt-in, WHEN opt-in devient actif, erreurs attrapées)',
         'cron', 'prospects-partenaire-purge-quotidienne 50 8 * * *',
         'contrainte', 'athlete_notifications_type_check + PARTENAIRE_EVALUATION',
         'inchanges', '14 fonctions W2/W3/W3b/lot D (md5), 17 triggers athletes, tâches cron, données'),
       (select id from public.users where email = 'bptds22@gmail.com')
  from _w4a;

select version as version_w4a_enregistree from _w4a;
