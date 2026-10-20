-- ════════════════════════════════════════════════════════════════════════════
-- Avis au parent au PREMIER CONTACT d'un recruteur (décision BP, 2026-10-20)
--
-- Avant : notify_first_recruiter_contact écrivait une ligne PARENT dans
-- recruiter_contact_notifications, que le parent ne peut pas lire, et
-- n'envoyait rien. Le courriel d'accueil parent promettait pourtant l'avis.
--
-- Maintenant, au premier message d'une UNITÉ (cégep du recruteur ; sans cégep :
-- le recruteur lui-même) à un athlète MINEUR à la date du message :
--   1. un courriel au parent — parent_email déclaré, à défaut l'adresse du
--      compte parent réclamé — par la fonction edge send-parent-contact ;
--   2. une notification portail CHILD_RECRUITER_CONTACT, si le compte parent
--      est réclamé (parent_athletes) ; sinon elle s'écrit à la réclamation ;
--   3. un push par la même fonction (canal send-push), hors heures calmes
--      (push_heure_calme, 21 h – 8 h) : reporté par le cron, jamais perdu.
-- L'avis « progressé : Contacté » d'un CONTACTE posé par ce même message n'est
-- plus écrit (filtre BEFORE INSERT sur parent_notifications) ; posé à la main
-- par le recruteur, il reste.
--
-- Rien ne nomme le recruteur, le cégep, le sport ni le message : textes fixes,
-- metadata {"event":"recruiter_contact"}. La clé d'unité vit dans
-- parent_contact_avis, illisible hors serveur.
--
-- Idempotence : un avis par (athlète, clé d'unité) — index unique partiel,
-- INSERT … ON CONFLICT DO NOTHING ; rejouer un message ne renvoie rien.
-- Périodes sans contact : trg_blackout_messages refuse déjà le message ; la
-- garde is_athlete_contactable() le redit ici.
--
-- Adresse des fonctions edge : Vault EDGE_FUNCTIONS_URL + PARENT_CONTACT_SECRET,
-- jamais codée en dur. Sans ces secrets, rien ne part (journalisé
-- NON_CONFIGURE) ; posés en prod à la mise en ligne, sur GO.
--
-- Additive : 1 table, 6 fonctions, 3 triggers, 1 cron, CHECK élargi. Aucune
-- fonction existante redéfinie, aucun DELETE.
-- Rollback : supabase/rollback/20261020170000_rollback_avis_parent_contact_recruteur.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_aviser_parent_contact') then
    raise exception 'NEXUS: 20261020170000 déjà appliquée (trg_aviser_parent_contact existe)';
  end if;
  if exists (select 1 from cron.job where jobname = 'parent-contact-push') then
    raise exception 'NEXUS: le cron parent-contact-push existe déjà';
  end if;
  if to_regprocedure('public.emit_parent_notification(uuid,text,text,text,jsonb)') is null
     or to_regprocedure('public.is_athlete_contactable(uuid)') is null
     or to_regprocedure('public.push_heure_calme(timestamptz)') is null then
    raise exception 'NEXUS: une fonction attendue manque (emit_parent_notification, is_athlete_contactable, push_heure_calme)';
  end if;
  -- Le filtre « Contacté » repose sur l'ordre alphabétique des triggers AFTER :
  -- trg_aviser_parent_contact passe AVANT trg_message_to_pipeline.
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.messages'::regclass and tgname = 'trg_message_to_pipeline') then
    raise exception 'NEXUS: trg_message_to_pipeline absent de messages';
  end if;
  -- 4 types (premier passage) ou 5 (après un rollback, qui garde le CHECK élargi).
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'parent_notifications_type_check'))
     not in ('CHECK ((type = ANY (ARRAY[''CHILD_FAVORITED''::text, ''CHILD_PIPELINE_STAGE''::text, ''CHILD_VISIT_PLANNED''::text, ''CHILD_PARTNER_VISIBILITY_REQUEST''::text])))',
             'CHECK ((type = ANY (ARRAY[''CHILD_FAVORITED''::text, ''CHILD_PIPELINE_STAGE''::text, ''CHILD_VISIT_PLANNED''::text, ''CHILD_PARTNER_VISIBILITY_REQUEST''::text, ''CHILD_RECRUITER_CONTACT''::text])))') then
    raise exception 'NEXUS: parent_notifications_type_check ne correspond pas au relevé';
  end if;
end $$;

-- ── Type de notification portail ────────────────────────────────────────────
alter table public.parent_notifications drop constraint parent_notifications_type_check;
alter table public.parent_notifications add constraint parent_notifications_type_check
  check (type = any (array['CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED',
                           'CHILD_PARTNER_VISIBILITY_REQUEST', 'CHILD_RECRUITER_CONTACT']));

-- ── Journal des avis (serveur seulement) ────────────────────────────────────
-- IF NOT EXISTS : le rollback garde la table et ses lignes (aucun DELETE).
create table if not exists public.parent_contact_avis (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.athletes(id) on delete cascade,
  cle_unite           text not null,    -- 'C:<cégep>' ou 'R:<recruteur>' — interne, jamais montré
  statut              text not null check (statut in ('AVISE', 'AGE_INCONNU', 'SANS_DESTINATAIRE')),
  message_id          uuid references public.messages(id) on delete set null,
  langue              text not null default 'fr' check (langue in ('fr', 'en')),
  courriel_source     text check (courriel_source in ('DECLARE', 'COMPTE')),
  courriel_statut     text check (courriel_statut in ('EN_FILE', 'NON_CONFIGURE')),
  courriel_request_id bigint,
  parent_user_id      uuid references public.users(id) on delete set null,
  portail_ecrit_le    timestamptz,
  push_statut         text check (push_statut in ('EN_ATTENTE', 'ENVOYE')),
  push_request_id     bigint,
  push_traite_le      timestamptz,
  cree_le             timestamptz not null default now()
);
create unique index if not exists parent_contact_avis_avise_uidx
  on public.parent_contact_avis (athlete_id, cle_unite) where statut = 'AVISE';
create unique index if not exists parent_contact_avis_cas_uidx
  on public.parent_contact_avis (athlete_id, cle_unite, statut) where statut <> 'AVISE';
create index if not exists parent_contact_avis_push_idx
  on public.parent_contact_avis (cree_le) where push_statut = 'EN_ATTENTE';
comment on table public.parent_contact_avis is
  'Avis au parent au premier contact d''un recruteur (une ligne AVISE par athlète et unité). '
  'Serveur seulement : la clé d''unité n''en sort jamais.';
alter table public.parent_contact_avis enable row level security;
revoke all on public.parent_contact_avis from public, anon, authenticated;

-- ── Configuration présente ? (adresse et secret au Vault) ───────────────────
-- Lue AVANT d'occuper la place AVISE : un avis non envoyable ne doit pas
-- consommer l'unicité, sinon il ne partirait jamais une fois les secrets posés.
create function public.parent_contact_configure()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from vault.decrypted_secrets
                  where name = 'EDGE_FUNCTIONS_URL' and nullif(btrim(decrypted_secret), '') is not null)
     and exists (select 1 from vault.decrypted_secrets
                  where name = 'PARENT_CONTACT_SECRET' and nullif(btrim(decrypted_secret), '') is not null)
$$;

-- ── Appel de send-parent-contact (adresse et secret au Vault) ───────────────
create function public.parent_contact_appeler(p_body jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_base   text;
  v_secret text;
begin
  select decrypted_secret into v_base from vault.decrypted_secrets where name = 'EDGE_FUNCTIONS_URL' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'PARENT_CONTACT_SECRET' limit 1;
  if nullif(btrim(coalesce(v_base, '')), '') is null or nullif(btrim(coalesce(v_secret, '')), '') is null then
    return null;
  end if;
  return net.http_post(
    url     := rtrim(btrim(v_base), '/') || '/send-parent-contact',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-parent-contact-secret', v_secret),
    body    := p_body,
    timeout_milliseconds := 15000);
end $$;

-- ── Push : hors heures calmes seulement ; le cron reprend le reste ──────────
create function public.parent_contact_envoyer_push(p_maintenant timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  r     record;
  v_req bigint;
  v_n   integer := 0;
begin
  if public.push_heure_calme(p_maintenant) then
    return 0;
  end if;
  for r in
    select id, parent_user_id, langue from public.parent_contact_avis
     where push_statut = 'EN_ATTENTE' and parent_user_id is not null
     order by cree_le
     for update skip locked
  loop
    v_req := public.parent_contact_appeler(
      jsonb_build_object('mode', 'push', 'user_id', r.parent_user_id, 'lang', r.langue));
    if v_req is null then
      continue;                       -- pas configuré : reste EN_ATTENTE, repris plus tard
    end if;
    update public.parent_contact_avis
       set push_statut = 'ENVOYE', push_request_id = v_req, push_traite_le = p_maintenant
     where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ── Notification portail (+ push si p_push) ─────────────────────────────────
create function public.parent_contact_ecrire_portail(p_avis uuid, p_push boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_athlete uuid;
begin
  update public.parent_contact_avis
     set portail_ecrit_le = now(),
         push_statut = case when p_push then 'EN_ATTENTE' else push_statut end
   where id = p_avis and statut = 'AVISE' and portail_ecrit_le is null and parent_user_id is not null
  returning athlete_id into v_athlete;
  if v_athlete is null then
    return;
  end if;
  -- Textes fixes : ni recruteur, ni cégep, ni sport, ni message.
  perform public.emit_parent_notification(
    v_athlete, 'CHILD_RECRUITER_CONTACT', 'Contact d''un recruteur',
    'Un recruteur a contacté votre enfant.',
    jsonb_build_object('event', 'recruiter_contact'));
  if p_push then
    perform public.parent_contact_envoyer_push();
  end if;
end $$;

-- ── Trigger : premier message d'une unité à un mineur ───────────────────────
create function public.aviser_parent_contact_recruteur()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_athlete  uuid;
  v_recruteur uuid;
  v_type     public.conversation_type;
  v_cegep    uuid;
  v_cle      text;
  v_dob      date;
  v_declare  text;
  v_parent   uuid;
  v_compte   text;
  v_dest     text;
  v_avis     uuid;
  v_token    text;
  v_req      bigint;
begin
  select c.athlete_id, c.recruiter_id, c.conversation_type
    into v_athlete, v_recruteur, v_type
    from public.conversations c where c.id = NEW.conversation_id;
  if v_type is distinct from 'RECRUTEUR_ATHLETE'::public.conversation_type
     or v_athlete is null or NEW.sender_id is distinct from v_recruteur then
    return NEW;
  end if;

  -- Ce message va poser CONTACTE (trg_message_to_pipeline, après celui-ci) :
  -- le filtre de parent_notifications retient l'avis « progressé ».
  perform set_config('nexus.contact_par_message', v_athlete::text, true);

  begin
    if not public.is_athlete_contactable(v_athlete) then
      return NEW;
    end if;

    select u.school_id into v_cegep from public.users u where u.id = v_recruteur;
    v_cle := coalesce('C:' || v_cegep::text, 'R:' || v_recruteur::text);

    select a.date_naissance, nullif(btrim(a.parent_email), '')
      into v_dob, v_declare
      from public.athletes a where a.id = v_athlete;

    if v_dob is null then
      insert into public.parent_contact_avis (athlete_id, cle_unite, statut, message_id)
      values (v_athlete, v_cle, 'AGE_INCONNU', NEW.id)
      on conflict (athlete_id, cle_unite, statut) where statut <> 'AVISE' do nothing;
      return NEW;
    end if;
    if (coalesce(NEW.created_at, now()) at time zone 'America/Toronto')::date
         >= v_dob + interval '18 years' then
      return NEW;                     -- majeur à la date du message
    end if;

    select pa.parent_user_id, nullif(btrim(u.email), '')
      into v_parent, v_compte
      from public.parent_athletes pa
      join public.users u on u.id = pa.parent_user_id
     where pa.athlete_id = v_athlete
     limit 1;
    v_dest := coalesce(v_declare, v_compte);

    if v_dest is null then
      insert into public.parent_contact_avis (athlete_id, cle_unite, statut, message_id)
      values (v_athlete, v_cle, 'SANS_DESTINATAIRE', NEW.id)
      on conflict (athlete_id, cle_unite, statut) where statut <> 'AVISE' do nothing;
      return NEW;
    end if;

    if not public.parent_contact_configure() then
      raise warning 'aviser_parent_contact_recruteur: EDGE_FUNCTIONS_URL ou PARENT_CONTACT_SECRET absent du Vault — rien de journalisé (rattrapable)';
      return NEW;
    end if;

    insert into public.parent_contact_avis (athlete_id, cle_unite, statut, message_id,
                                            courriel_source, parent_user_id)
    values (v_athlete, v_cle, 'AVISE', NEW.id,
            case when v_declare is not null then 'DECLARE' else 'COMPTE' end, v_parent)
    on conflict (athlete_id, cle_unite) where statut = 'AVISE' do nothing
    returning id into v_avis;
    if v_avis is null then
      return NEW;                     -- unité déjà avisée : rien de nouveau
    end if;

    -- Parent pas encore réclamé : le bouton mène à la réclamation du compte.
    if v_parent is null then
      select i.token into v_token
        from public.parent_invitations i
       where i.athlete_id = v_athlete and i.claimed_at is null and i.expires_at > now()
       order by i.created_at desc limit 1;
    end if;

    v_req := public.parent_contact_appeler(jsonb_build_object(
      'mode', 'courriel', 'to', v_dest, 'lang', 'fr', 'claim_token', v_token));
    update public.parent_contact_avis
       set courriel_request_id = v_req,
           courriel_statut = case when v_req is null then 'NON_CONFIGURE' else 'EN_FILE' end
     where id = v_avis;

    if v_parent is not null then
      perform public.parent_contact_ecrire_portail(v_avis, true);
    end if;
  exception when others then
    raise warning 'aviser_parent_contact_recruteur: message % — %', NEW.id, SQLERRM;
  end;
  return NEW;
end $$;

create trigger trg_aviser_parent_contact
  after insert on public.messages
  for each row execute function public.aviser_parent_contact_recruteur();

-- ── Trigger : réclamation du compte parent → notifications en attente ───────
create function public.parent_contact_a_la_reclamation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  r record;
begin
  for r in
    select id from public.parent_contact_avis
     where athlete_id = NEW.athlete_id and statut = 'AVISE' and portail_ecrit_le is null
     order by cree_le
  loop
    update public.parent_contact_avis set parent_user_id = NEW.parent_user_id where id = r.id;
    perform public.parent_contact_ecrire_portail(r.id, false);
  end loop;
  return NEW;
exception when others then
  raise warning 'parent_contact_a_la_reclamation: athlète % — %', NEW.athlete_id, SQLERRM;
  return NEW;
end $$;

create trigger trg_parent_contact_reclamation
  after insert on public.parent_athletes
  for each row execute function public.parent_contact_a_la_reclamation();

-- ── Filtre : pas de « progressé : Contacté » quand CONTACTE vient d'un message ─
create function public.parent_notif_filtrer_contacte()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.type = 'CHILD_PIPELINE_STAGE'
     and NEW.metadata->>'stage' = 'CONTACTE'
     and coalesce(current_setting('nexus.contact_par_message', true), '') = NEW.athlete_id::text then
    return null;                      -- non écrite (pas un DELETE : la ligne n'existe jamais)
  end if;
  return NEW;
end $$;

create trigger trg_parent_notif_filtrer_contacte
  before insert on public.parent_notifications
  for each row execute function public.parent_notif_filtrer_contacte();

-- ── Cron : pushs reportés par les heures calmes ─────────────────────────────
select cron.schedule('parent-contact-push', '*/10 * * * *', 'select public.parent_contact_envoyer_push()');

-- ── ACL : serveur seulement, liste complète ─────────────────────────────────
revoke all on function public.parent_contact_configure() from public, anon, authenticated, service_role;
revoke all on function public.parent_contact_appeler(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.parent_contact_envoyer_push(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.parent_contact_ecrire_portail(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.aviser_parent_contact_recruteur() from public, anon, authenticated, service_role;
revoke all on function public.parent_contact_a_la_reclamation() from public, anon, authenticated, service_role;
revoke all on function public.parent_notif_filtrer_contacte() from public, anon, authenticated, service_role;

do $$
declare
  f    regprocedure;
  vus  text[];
  veut constant text[] := array['postgres'];
begin
  foreach f in array array[
    'public.parent_contact_configure()'::regprocedure,
    'public.parent_contact_appeler(jsonb)'::regprocedure,
    'public.parent_contact_envoyer_push(timestamptz)'::regprocedure,
    'public.parent_contact_ecrire_portail(uuid,boolean)'::regprocedure,
    'public.aviser_parent_contact_recruteur()'::regprocedure,
    'public.parent_contact_a_la_reclamation()'::regprocedure,
    'public.parent_notif_filtrer_contacte()'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if (select array_agg(t.g order by t.g)
        from pg_class c,
             lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                        from unnest(c.relacl::text[]) as x) t
       where c.oid = 'public.parent_contact_avis'::regclass)
     is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de parent_contact_avis inattendue';
  end if;
end $$;
