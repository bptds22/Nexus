-- ═══════════════════════════════════════════════════════════════════════════
-- Visibilité partenaires — l'athlète de 14 ans et plus consent LUI-MÊME.
-- Décision BP 2026-10-02 (1.4.4, paquet A).
--
-- ── AVANT ────────────────────────────────────────────────────────────────
--   set_my_partner_visibility : accorder exigeait 18 ans révolus ; un mineur
--     ne pouvait que RETIRER, l'accord appartenait au parent.
--   is_partner_eligible_athlete : opt_in ET (18 ans OU accord parental).
--   emit_five_star_on_eligibility_flip : recopie la même règle pour l'état
--     « avant » (v_was_eligible).
--
-- ── APRÈS ────────────────────────────────────────────────────────────────
--   seuil = 14 ans révolus (même plancher que l'auto-inscription, Loi 25 :
--   à 14 ans, le mineur consent seul à ce qui le concerne).
--   Sous 14 ans, ou date de naissance inconnue : inchangé — retrait seulement,
--   l'accord passe par le parent (set_child_consent, portail parent), et
--   l'accord parental reste une voie d'éligibilité valable à tout âge.
--   Date de naissance inconnue : ni majeur ni 14 ans (prudence).
--
-- ── EFFET SUR LES DONNÉES À L'APPLICATION ────────────────────────────────
--   Aucun. Relevé prod 2026-10-02 : aucun 14-17 n'a opt_in = true sans
--   accord parental (54 à false/false, 95 à true/true). Le changement
--   d'éligibilité ne rend donc personne visible ; il ouvre le geste.
--   Le pré-contrôle ci-dessous le revérifie et refuse sinon.
--
-- ── ACL ──────────────────────────────────────────────────────────────────
--   CREATE OR REPLACE conserve l'ACL. Relevée avant, comparée en entier après
--   (règle CLAUDE.md). is_partner_eligible_athlete et le trigger portent
--   aujourd'hui PUBLIC/anon : HÉRITÉ, hors périmètre, conservé à l'identique.
--
-- ── AVIS AU PARENT (section 3b) ──────────────────────────────────────────
--   Journal avis_parent_partenaires + trigger aviser_parent_partenaires() →
--   fonction send-avis-parent-partenaires (à DÉPLOYER AVANT d'appliquer).
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Pré-contrôle : personne ne devient éligible par le seul effet du seuil.
do $$
declare v_n int;
begin
  select count(*) into v_n
    from public.athletes a
   where a.partner_visibility_opt_in = true
     and coalesce(a.partner_visibility_parental_consent, false) = false
     and a.date_naissance is not null
     and a.date_naissance >  current_date - interval '18 years'
     and a.date_naissance <= current_date - interval '14 years';
  if v_n <> 0 then
    raise exception 'NEXUS: % athlète(s) 14-17 opt_in sans accord parental — le seuil les rendrait visibles. Trancher avant.', v_n;
  end if;
end $$;

-- 1. L'athlète gère SA visibilité : 14 ans et plus accordent ou retirent.
create or replace function public.set_my_partner_visibility(
  p_granted        boolean,
  p_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $$
declare
  v_uid       uuid := auth.uid();
  v_ath       public.athletes;
  v_n         int;
  v_majeur    boolean;
  v_quatorze  boolean;
  v_pref      jsonb;
  v_prev      text;
  v_new       text;
  v_ip        text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_granted is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_value');
  end if;
  if p_policy_version is null or length(trim(p_policy_version)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'policy_version_required');
  end if;

  select count(*) into v_n from public.athletes where user_id = v_uid;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  elsif v_n > 1 then
    return jsonb_build_object('ok', false, 'reason', 'ambiguous');
  end if;
  select * into v_ath from public.athletes where user_id = v_uid;

  v_majeur   := v_ath.date_naissance is not null
                and v_ath.date_naissance <= current_date - interval '18 years';
  v_quatorze := v_ath.date_naissance is not null
                and v_ath.date_naissance <= current_date - interval '14 years';

  if p_granted and not v_quatorze then
    return jsonb_build_object('ok', false, 'reason', 'parent_required');
  end if;

  v_prev := case when v_ath.partner_visibility_opt_in then 'granted' else 'withdrawn' end;
  v_new  := case when p_granted then 'granted' else 'withdrawn' end;

  begin
    v_ip := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for';
  exception when others then v_ip := null; end;

  update public.athletes set
    partner_visibility_opt_in      = p_granted,
    partner_visibility_opted_in_at = case when p_granted then now() else partner_visibility_opted_in_at end
  where id = v_ath.id;

  select privacy_preferences into v_pref from public.users where id = v_uid;
  v_pref := coalesce(v_pref, '{}'::jsonb);
  if p_granted then
    v_pref := jsonb_set(v_pref, '{consent_partner_visibility}', to_jsonb(now()));
  else
    v_pref := jsonb_set(v_pref, '{consent_partner_visibility}', 'null'::jsonb);
    v_pref := jsonb_set(v_pref, '{consent_parental_partner_visibility}', 'null'::jsonb);
  end if;
  update public.users set privacy_preferences = v_pref where id = v_uid;

  insert into public.consent_audit_trail
    (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
  values (
    v_ath.consent_id, v_ath.id, null,
    case when p_granted then 'GRANTED' else 'WITHDRAWN' end,
    v_prev, v_new, v_ip,
    jsonb_build_object(
      'acting_role',     'ATHLETE',
      'athlete_user_id', v_uid,
      'consent_key',     'image_partenaire',
      'majeur',          v_majeur,
      'quatorze_ans',    v_quatorze,
      'policy_version',  p_policy_version
    )
  );

  return jsonb_build_object('ok', true, 'granted', p_granted, 'previous', v_prev);
end;
$$;

comment on function public.set_my_partner_visibility(boolean, text) is
  'Athlète : accorde (14 ans et plus) ou retire (tous) sa visibilité partenaires. Journalisé à chaque appel avec policy_version. Registre §50 ; seuil 14 ans décidé le 2026-10-02.';

-- 2. Éligibilité : opt_in ET (14 ans OU accord parental).
create or replace function public.is_partner_eligible_athlete(p_athlete_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select
    a.partner_visibility_opt_in = true
    and (
      extract(year from age(a.date_naissance)) >= 14
      or a.partner_visibility_parental_consent = true
    )
  from public.athletes a
  where a.id = p_athlete_id;
$$;

-- 3. Le trigger recopie la règle pour l'état « avant » : même seuil.
create or replace function public.emit_five_star_on_eligibility_flip()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
  v_was_eligible BOOLEAN;
  v_is_eligible BOOLEAN;
BEGIN
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM newsroom_events
    WHERE athlete_id = NEW.id
      AND event_type = 'FIVE_STAR_SIGNUP'
  ) THEN
    RETURN NEW;
  END IF;

  v_was_eligible :=
    COALESCE(OLD.partner_visibility_opt_in, false) = true
    AND (
      EXTRACT(YEAR FROM AGE(OLD.date_naissance)) >= 14
      OR COALESCE(OLD.partner_visibility_parental_consent, false) = true
    )
    AND COALESCE(OLD.verified, false) = true
    AND COALESCE(OLD.modified_since_verification, false) = false
    AND OLD.cote_globale_entraineur IS NOT NULL;

  v_is_eligible := is_partner_eligible_athlete(NEW.id);

  IF v_was_eligible OR NOT v_is_eligible THEN
    RETURN NEW;
  END IF;

  SELECT sch.name, s.nom
    INTO v_school_name, v_sport_name
  FROM (SELECT 1) dummy
  LEFT JOIN schools sch ON sch.id = NEW.school_id
  LEFT JOIN sports s ON s.id = NEW.sport_id;

  v_athlete_name := NEW.first_name || ' ' || NEW.last_name;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.id,
    NEW.school_id,
    NEW.sport_id,
    v_athlete_name || ' atteint 5 etoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 - ' || COALESCE(v_sport_name, 'sport-etudes'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name,
      'emitted_via', 'eligibility_flip'
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- 3b. L'AVIS AU PARENT (décision BP 2026-10-02, politique 2026-10-v1 §7.5).
--     Quand un athlète de 14 à 17 ans active LUI-MÊME sa visibilité, son
--     parent reçoit un courriel « [Prénom] a autorisé la visibilité
--     partenaires médias », avec un lien vers l'espace parent où il peut la
--     retirer. Fonction send-avis-parent-partenaires (LCAP : désabonnement
--     parent, même liste que la relance partenaires).
--
--     Journal : une ligne par avis. RESERVE à l'écriture par le trigger, puis
--     ENVOYE | ECHEC | ANNULE par la fonction ; SANS_SECRET si le Vault n'a
--     pas le secret (jamais d'échec silencieux sans trace).
--     RLS active, AUCUNE policy : ni lu ni écrit par un client.
create table if not exists public.avis_parent_partenaires (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  statut      text not null default 'RESERVE'
              check (statut in ('RESERVE', 'ENVOYE', 'ECHEC', 'ANNULE', 'SANS_SECRET')),
  resend_id   text,
  erreur      text,
  cree_le     timestamptz not null default now(),
  envoye_le   timestamptz
);
create index if not exists avis_parent_partenaires_athlete_idx
  on public.avis_parent_partenaires (athlete_id, cree_le desc);
alter table public.avis_parent_partenaires enable row level security;
revoke all on table public.avis_parent_partenaires from anon, authenticated;
comment on table public.avis_parent_partenaires is
  'Avis au parent quand un 14-17 ans active lui-même sa visibilité partenaires (2026-10-02). Écrit par aviser_parent_partenaires(), mis à jour par send-avis-parent-partenaires. Aucune policy.';

--     Le trigger. Conditions, toutes requises :
--       · opt_in passe à vrai (INSERT à vrai, ou UPDATE faux → vrai) ;
--       · PAS par le parent (partner_visibility_parental_consent n'est pas
--         vrai : set_child_consent et le lien parent le posent à vrai) ;
--       · 14 à 17 ans révolus ;
--       · un courriel parent, non désabonné ;
--       · aucun avis dans les 24 dernières heures pour cette fiche (un
--         jeune qui bascule l'interrupteur dix fois n'envoie pas dix courriels).
--     Ne bloque JAMAIS le geste de l'athlète : toute erreur devient un warning.
--     pg_net ne transporte que l'avis_id.
create or replace function public.aviser_parent_partenaires()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $$
declare
  v_age    int;
  v_avis   uuid;
  v_secret text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-avis-parent-partenaires';
begin
  if not coalesce(NEW.partner_visibility_opt_in, false) then return null; end if;
  if TG_OP = 'UPDATE' and coalesce(OLD.partner_visibility_opt_in, false) then return null; end if;
  if coalesce(NEW.partner_visibility_parental_consent, false) then return null; end if;
  if NEW.date_naissance is null then return null; end if;
  v_age := extract(year from age(NEW.date_naissance))::int;
  if v_age < 14 or v_age > 17 then return null; end if;
  if nullif(btrim(NEW.parent_email), '') is null then return null; end if;

  begin
    if exists (select 1 from public.parent_courriel_desabonnements
                where courriel_sha256 = public.courriel_sha256(NEW.parent_email)) then
      return null;
    end if;
    if exists (select 1 from public.avis_parent_partenaires
                where athlete_id = NEW.id and cree_le > now() - interval '24 hours') then
      return null;
    end if;

    insert into public.avis_parent_partenaires (athlete_id) values (NEW.id) returning id into v_avis;

    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'PARENT_NOTICE_SECRET' limit 1;
    if v_secret is null then
      update public.avis_parent_partenaires set statut = 'SANS_SECRET' where id = v_avis;
      raise warning 'aviser_parent_partenaires: PARENT_NOTICE_SECRET absent du Vault (avis %)', v_avis;
      return null;
    end if;

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-parent-notice-secret', v_secret),
      body    := jsonb_build_object('avis_id', v_avis)
    );
  exception when others then
    raise warning 'aviser_parent_partenaires a échoué pour athlete %: %', NEW.id, SQLERRM;
  end;
  return null;
end;
$$;

revoke all on function public.aviser_parent_partenaires() from public, anon, authenticated, service_role;

drop trigger if exists trg_aviser_parent_partenaires on public.athletes;
create trigger trg_aviser_parent_partenaires
  after insert or update of partner_visibility_opt_in on public.athletes
  for each row execute function public.aviser_parent_partenaires();

-- 4. Gates d'ACL — comparaison COMPLÈTE, jamais par inclusion.
do $$
declare
  c    record;
  vus  text[];
begin
  for c in
    select * from (values
      ('public.set_my_partner_visibility(boolean, text)',
       array['authenticated','postgres','service_role']),
      ('public.is_partner_eligible_athlete(uuid)',
       array['PUBLIC','anon','authenticated','postgres','service_role']),
      ('public.emit_five_star_on_eligibility_flip()',
       array['PUBLIC','anon','authenticated','postgres','service_role']),
      ('public.aviser_parent_partenaires()',
       array['postgres'])
    ) as t(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = c.f::regprocedure;
    -- Les deux côtés triés par la MÊME collation (PUBLIC se range après postgres).
    if vus is distinct from (select array_agg(x order by x) from unnest(c.veut) x) then
      raise exception 'NEXUS: ACL de % = %, attendu %', c.f, vus, c.veut;
    end if;
  end loop;
  raise notice 'NEXUS: ACL exactes sur les quatre fonctions';
end $$;

-- 5. Sécurité inchangée : DEFINER sur les trois, search_path posé.
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc
   where oid in ('public.set_my_partner_visibility(boolean, text)'::regprocedure,
                 'public.is_partner_eligible_athlete(uuid)'::regprocedure,
                 'public.emit_five_star_on_eligibility_flip()'::regprocedure)
     and prosecdef and proconfig is not null;
  if v_n <> 3 then
    raise exception 'NEXUS: attendu 3 fonctions SECURITY DEFINER avec search_path, vu %', v_n;
  end if;
end $$;

-- 6. Le journal des avis est fermé aux clients : RLS active, zéro policy,
--    aucun privilège pour anon / authenticated ; le trigger est en place.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.avis_parent_partenaires'::regclass) then
    raise exception 'NEXUS: avis_parent_partenaires sans RLS';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.avis_parent_partenaires'::regclass) then
    raise exception 'NEXUS: avis_parent_partenaires porte une policy';
  end if;
  if has_table_privilege('authenticated', 'public.avis_parent_partenaires', 'SELECT')
     or has_table_privilege('anon', 'public.avis_parent_partenaires', 'SELECT') then
    raise exception 'NEXUS: avis_parent_partenaires lisible par anon/authenticated';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_aviser_parent_partenaires'
                  and tgrelid = 'public.athletes'::regclass and tgenabled = 'O') then
    raise exception 'NEXUS: trg_aviser_parent_partenaires absent ou désactivé';
  end if;
end $$;
