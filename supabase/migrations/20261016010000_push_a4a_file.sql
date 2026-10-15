-- Push A4a (lot mobile 1.4.5, côté SERVEUR seulement) — décision BP du 2026-10-15.
--
-- Le jeune reçoit un push quand on lui donne un badge ou qu'on l'évalue (son coach ou un
-- partenaire, sur sa fiche ou par une carte prospect confirmée), et quand un partenaire lui
-- propose une carte (PARTENAIRE_EVALUATION). Tout passe par une FILE :
--
--  · push_file            : la file (serveur seulement) — une ligne par événement ;
--  · push_envois          : le journal des pushs réellement partis (serveur seulement) ;
--  · push_preferences     : désactivation PAR TYPE (absence de ligne = actif). Nouvelle table plutôt
--                           que notification_preferences : celle-ci est OPT-IN (push défaut false),
--                           sa liste fermée de 6 événements est celle des courriels du coach, et
--                           l'écran Paramètres coach l'écrit — la réutiliser couperait les pushs à
--                           quiconque a enregistré ses réglages, ou mêlerait deux taxinomies ;
--  · push_traiter_file()  : cron toutes les 10 min. Heures calmes 21 h – 8 h (heure du Québec) :
--                           rien ne part, la file attend 8 h. Regroupement : un groupe (même jeune,
--                           même source) part 10 min après son premier élément, en UN push
--                           (« 3 nouveaux badges de L'Esprit Sportif ») ;
--  · push_to_user         : + collapse_id (optionnel) et délai pg_net de 15 s.
--
-- Règles : ni cote, ni grade, ni nom de recruteur ou de cégep dans un push ; un coach n'est nommé
-- que par coach_nommable (secondaire ou civil), sinon « ton entraîneur » ; un partenaire peut être
-- nommé. Au clic, data.type = 'announcement' (l'appli 1.4.4 ouvre l'accueil).
--
-- Déclencheurs : badges du coach (appliquer_badges_saisie compare les badges ACTIFS avant/après :
-- un changement de contexte ou un ré-enregistrement n'est pas un nouveau badge ; un admin qui
-- corrige ne déclenche rien) ; évaluation du coach (INSERT, ou UPDATE qui change la cote globale —
-- le miroir badges → distinctions ne la change pas) ; badges et évaluations partenaire (triggers
-- sur les tables : couvrent l'attribution directe ET le transfert d'une carte confirmée).
-- PARTENAIRE_EVALUATION : nouveau texte, push en file ; les notifications encore sans réponse
-- reçoivent le nouveau texte. « Prise en charge par un coach » : nom seulement si coach_nommable.
-- Rollback : supabase/rollback/20261016010000_rollback_push_a4a_file.sql

do $$
begin
  if to_regclass('public.push_file') is not null then
    raise exception 'NEXUS: migration déjà appliquée (push_file existe)';
  end if;
  if exists (select 1 from cron.job where jobname = 'push-file-envoi') then
    raise exception 'NEXUS: le cron push-file-envoi existe déjà';
  end if;
  if to_regprocedure('public.coach_nommable(uuid)') is null then
    raise exception 'NEXUS: coach_nommable absente (20261015125824 requise)';
  end if;
  -- Versions remplacées, empreinte SANS commentaires (-- et /* */) ni espaces : identiques en prod.
  if (select md5(btrim(regexp_replace(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.push_to_user(uuid,text,text,jsonb)'::regprocedure)
     is distinct from 'b09389f115d10e55c00239870c9f7af1' then
    raise exception 'NEXUS: push_to_user ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.appliquer_badges_saisie(uuid,jsonb)'::regprocedure)
     is distinct from '7b25d620b3096795a616954dd3ae64b6' then
    raise exception 'NEXUS: appliquer_badges_saisie ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.prospect_partenaire_proposer(uuid,uuid,text,text,text)'::regprocedure)
     is distinct from '9d82dd19b7c76f98851f5e0d75f1c17a' then
    raise exception 'NEXUS: prospect_partenaire_proposer ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.claim_school_athletes(uuid[])'::regprocedure)
     is distinct from '5dab8e200fb38fa04009313708d42fa4' then
    raise exception 'NEXUS: claim_school_athletes ne correspond pas au relevé';
  end if;
end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.push_envois (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  categorie   text not null,
  cle         text not null,
  titre       text not null,
  texte       text not null,
  collapse_id text not null,
  nb_elements integer not null check (nb_elements >= 1),
  envoye_le   timestamptz not null default now()
);
create index push_envois_user_idx on public.push_envois (user_id, envoye_le desc);
comment on table public.push_envois is
  'Journal des pushs partis par la file (push_traiter_file). Serveur seulement.';

create table public.push_file (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  categorie   text not null check (categorie in ('BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES')),
  genre       text not null check (genre in ('BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH',
                                             'EVALUATION_PARTENAIRE', 'CARTE_PARTENAIRE')),
  cle         text not null,                 -- regroupement : même jeune + même clé = un seul push
  source_nom  text,                          -- coach nommable ou partenaire ; null = « ton entraîneur »
  detail      jsonb not null default '{}'::jsonb,
  cree_le     timestamptz not null default now(),
  statut      text not null default 'EN_ATTENTE'
              check (statut in ('EN_ATTENTE', 'ENVOYE', 'SANS_JETON', 'PREFERENCE', 'ANNULE')),
  traite_le   timestamptz,
  envoi_id    bigint references public.push_envois(id) on delete set null
);
create index push_file_attente_idx on public.push_file (user_id, cle, cree_le) where statut = 'EN_ATTENTE';
create index push_file_traite_idx on public.push_file (traite_le) where statut <> 'EN_ATTENTE';
comment on table public.push_file is
  'File des pushs (badges, évaluations, cartes partenaires). Serveur seulement ; traitée par push_traiter_file.';

create table public.push_preferences (
  user_id   uuid not null references public.users(id) on delete cascade,
  categorie text not null check (categorie in ('BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES')),
  actif     boolean not null,
  maj_le    timestamptz not null default now(),
  primary key (user_id, categorie)
);
comment on table public.push_preferences is
  'Pushs désactivés par type. Absence de ligne = actif. Écriture par push_preference_definir seulement.';

alter table public.push_envois enable row level security;
alter table public.push_file enable row level security;
alter table public.push_preferences enable row level security;
create policy "push_preferences lecture propre" on public.push_preferences
  for select to authenticated using (user_id = auth.uid());

revoke all on public.push_envois, public.push_file, public.push_preferences from public, anon, authenticated;
grant select on public.push_preferences to authenticated;
revoke all on sequence public.push_envois_id_seq, public.push_file_id_seq from public, anon, authenticated;

-- ── push_to_user : + collapse_id, délai 15 s ────────────────────────────────
-- Remplacée (signature élargie, 5e paramètre par défaut) : les appelants à 4 arguments restent valides.

drop function public.push_to_user(uuid, text, text, jsonb);

create function public.push_to_user(p_user_id uuid, p_title text, p_body text, p_data jsonb,
                                    p_collapse_id text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
DECLARE
  v_secret text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'PUSH_DISPATCH_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('user_id', p_user_id, 'title', p_title, 'body', p_body, 'data', p_data)
               || case when nullif(btrim(coalesce(p_collapse_id, '')), '') is null then '{}'::jsonb
                       else jsonb_build_object('collapse_id', left(btrim(p_collapse_id), 64)) end,
    -- 5 s par défaut : le push aboutissait mais était noté expiré (docs/push-pgnet-timeout-20260823.md).
    timeout_milliseconds := 15000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_to_user: livraison échouée pour %: %', p_user_id, SQLERRM;
END;
$function$;

-- ── Heures calmes : 21 h – 8 h, heure du Québec ─────────────────────────────

create function public.push_heure_calme(p_moment timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select extract(hour from (p_moment at time zone 'America/Toronto')) >= 21
      or extract(hour from (p_moment at time zone 'America/Toronto')) < 8
$$;

-- ── Les textes (une seule source) ───────────────────────────────────────────
-- Jamais de cote, de grade, de recruteur ni de cégep. p_source_nom : coach déjà passé par
-- coach_nommable (null = « ton entraîneur »), ou nom du partenaire.

create function public.push_textes(p_genre text, p_source_nom text, p_n integer, p_libelle text)
returns table (titre text, texte text)
language sql
immutable
set search_path = public
as $$
  select
    case
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') and p_n > 1 then p_n || ' nouveaux badges'
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') then 'Nouveau badge'
      when p_genre in ('EVALUATION_COACH', 'EVALUATION_PARTENAIRE') then 'Nouvelle évaluation'
      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'
    end,
    case
      when p_genre = 'BADGE_PARTENAIRE' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' and nullif(btrim(p_libelle), '') is not null then
        'Tu as reçu le badge ' || btrim(p_libelle) || ' de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' then
        'Tu as reçu un badge de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_COACH' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce('ton coach ' || nullif(btrim(p_source_nom), ''), 'ton entraîneur') || '.'
      when p_genre = 'BADGE_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a donné un badge.'
      when p_genre = 'EVALUATION_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a évalué.'
      when p_genre = 'EVALUATION_PARTENAIRE' then
        coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
      when p_genre = 'CARTE_PARTENAIRE' then 'Réponds dans l''appli Nexus ou sur nexussports.ca.'
    end
$$;

-- ── Mise en file (jamais bloquante pour l'écriture qui la déclenche) ─────────

create function public.push_mettre_en_file(p_athlete uuid, p_categorie text, p_genre text, p_cle text,
                                           p_source_nom text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.push_file (user_id, categorie, genre, cle, source_nom, detail)
  select a.user_id, p_categorie, p_genre, p_cle, nullif(btrim(coalesce(p_source_nom, '')), ''),
         coalesce(p_detail, '{}'::jsonb)
    from public.athletes a
   where a.id = p_athlete and a.user_id is not null;
exception when others then
  raise warning 'push_mettre_en_file: % pour athlète % — %', p_genre, p_athlete, SQLERRM;
end;
$$;

-- ── Traitement de la file (cron toutes les 10 min) ──────────────────────────

create function public.push_traiter_file(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$$;

-- ── Préférences : le jeune coupe un type ────────────────────────────────────

create function public.push_preference_definir(p_categorie text, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NEXUS: aucune session authentifiée' using errcode = '42501';
  end if;
  if p_categorie is null or p_categorie not in ('BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES') then
    raise exception 'NEXUS: type de notification inconnu' using errcode = '22023';
  end if;
  if p_actif is null then
    raise exception 'NEXUS: choisis activé ou désactivé' using errcode = '22023';
  end if;
  insert into public.push_preferences (user_id, categorie, actif, maj_le)
  values (v_uid, p_categorie, p_actif, now())
  on conflict (user_id, categorie) do update set actif = excluded.actif, maj_le = now();
end;
$$;

create function public.push_preferences_miennes()
returns table (categorie text, actif boolean)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select c.categorie, coalesce(p.actif, true)
    from unnest(array['BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES']) with ordinality as c(categorie, o)
    left join public.push_preferences p on p.user_id = auth.uid() and p.categorie = c.categorie
   where auth.uid() is not null
   order by c.o
$$;

-- ── Déclencheurs : évaluations (coach, partenaire) et badges partenaire ──────

create function public.push_sur_evaluation_coach()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- La cote globale est calculée par calc_cote_globale (BEFORE) : un push quand elle apparaît ou
  -- change, jamais pour une écriture qui ne la touche pas (miroir des distinctions, commentaires).
  if NEW.cote_globale is not null
     and (tg_op = 'INSERT' or NEW.cote_globale is distinct from OLD.cote_globale) then
    perform public.push_mettre_en_file(NEW.athlete_id, 'BADGES_EVALUATIONS', 'EVALUATION_COACH',
              'eval:coach:' || coalesce(NEW.coach_id::text, '-'),
              public.coach_nommable(NEW.coach_id)->>'nom', '{}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'push_sur_evaluation_coach: %', SQLERRM;
  return null;
end;
$$;

create function public.push_sur_evaluation_partenaire()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if NEW.cote_globale is not null
     and (tg_op = 'INSERT' or NEW.cote_globale is distinct from OLD.cote_globale) then
    perform public.push_mettre_en_file(NEW.athlete_id, 'BADGES_EVALUATIONS', 'EVALUATION_PARTENAIRE',
              'eval:partenaire:' || NEW.partner_id,
              (select m.organization_name from public.media_partners m where m.id = NEW.partner_id),
              '{}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'push_sur_evaluation_partenaire: %', SQLERRM;
  return null;
end;
$$;

create function public.push_sur_badge_partenaire()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if NEW.retire_le is null then
    perform public.push_mettre_en_file(NEW.athlete_id, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE',
              'badges:partenaire:' || NEW.partner_id,
              (select m.organization_name from public.media_partners m where m.id = NEW.partner_id),
              jsonb_build_object('partner_athlete_badge_id', NEW.id,
                'libelle', coalesce((select pb.libelle from public.partner_badges pb where pb.id = NEW.partner_badge_id),
                                    (select b.libelle from public.badges b where b.id = NEW.badge_id))));
  end if;
  return null;
exception when others then
  raise warning 'push_sur_badge_partenaire: %', SQLERRM;
  return null;
end;
$$;

create trigger trg_push_evaluation_coach after insert or update on public.evaluations
  for each row execute function public.push_sur_evaluation_coach();
create trigger trg_push_evaluation_partenaire after insert or update on public.partner_evaluations
  for each row execute function public.push_sur_evaluation_partenaire();
create trigger trg_push_badge_partenaire after insert on public.partner_athlete_badges
  for each row execute function public.push_sur_badge_partenaire();

-- ── Badges du coach : les badges ACTIFS avant / après, rien d'autre ─────────

create or replace function public.appliquer_badges_saisie(p_athlete_id uuid, p_entrees jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_auteur uuid;
  v_admin  boolean;
  v_inconnus text;
  v_avant  uuid[];
  v_nom    text;
  r        record;
begin
  v_auteur := auth.uid();
  if v_auteur is null then
    raise exception 'NEXUS: aucune session authentifiée — impossible d''attribuer un badge sans auteur.';
  end if;

  v_admin := public.is_admin();
  if not (v_admin or public.coach_can_award_badge(p_athlete_id)) then
    raise exception
      'NEXUS: vous n''avez pas le droit d''attribuer des badges à cet athlète.';
  end if;

  select string_agg(distinct coalesce(e->>'code', e->>'badge'), ', ')
    into v_inconnus
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) is null;

  if v_inconnus is not null then
    raise exception 'NEXUS: badge(s) inconnu(s) au catalogue : %.', v_inconnus;
  end if;

  -- Push A4a : les badges ACTIFS avant la saisie. Un nouveau badge = un badge actif après qui ne
  -- l'était pas avant — un contexte modifié ou un ré-enregistrement n'en est pas un.
  select coalesce(array_agg(distinct ab.badge_id), '{}'::uuid[]) into v_avant
    from public.athlete_badges ab
   where ab.athlete_id = p_athlete_id and ab.retire_le is null;

  update public.athlete_badges ab
     set retire_le = now(), retire_par = v_auteur
    from public.badges b
   where b.id = ab.badge_id
     and ab.athlete_id = p_athlete_id
     and ab.retire_le is null
     and ab.origine <> 'systeme'
     and (
           v_admin
        or (ab.origine = 'saisie' and ab.attribue_par = v_auteur)
        or ab.origine = 'transposition'
     )
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
        where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) = b.code
          and nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), '')
              is not distinct from ab.contexte
     );

  insert into public.athlete_badges
    (athlete_id, badge_id, contexte, attribue_par, origine)
  select p_athlete_id, b.id,
         nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), ''),
         v_auteur, 'saisie'
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  join public.badges b on b.code = public.code_badge_catalogue(coalesce(e->>'code', e->>'badge'))
  on conflict (athlete_id, badge_id, contexte) where retire_le is null
  do nothing;

  -- Push A4a : un par nouveau badge, regroupés par la file. Un admin qui corrige ne déclenche rien.
  if not v_admin then
    v_nom := public.coach_nommable(v_auteur)->>'nom';
    for r in
      select distinct ab.badge_id, b.libelle
        from public.athlete_badges ab
        join public.badges b on b.id = ab.badge_id
       where ab.athlete_id = p_athlete_id and ab.retire_le is null
         and not (ab.badge_id = any (v_avant))
    loop
      perform public.push_mettre_en_file(p_athlete_id, 'BADGES_EVALUATIONS', 'BADGE_COACH',
                'badges:coach:' || v_auteur, v_nom,
                jsonb_build_object('badge_id', r.badge_id, 'libelle', r.libelle));
    end loop;
  end if;
end;
$function$;

-- ── PARTENAIRE_EVALUATION : nouveau texte, push en file ─────────────────────

create or replace function public.prospect_partenaire_proposer(p_carte uuid, p_athlete uuid, p_origine text, p_critere text, p_force text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_user  uuid;
  v_org   text;
  v_notif uuid;
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
          'Réponds dans l''appli Nexus ou sur nexussports.ca.',
          jsonb_build_object('carte_id', p_carte))
  returning id into v_notif;
  perform public.push_mettre_en_file(p_athlete, 'CARTES_PARTENAIRES', 'CARTE_PARTENAIRE', 'carte:' || p_carte, v_org,
            jsonb_build_object('carte_id', p_carte, 'notification_id', v_notif));
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'PROPOSITION_' || p_origine, p_athlete,
            jsonb_build_object('critere', p_critere, 'force', p_force));
end $function$;

-- Les propositions encore sans réponse prennent le nouveau texte.
update public.athlete_notifications n
   set message = 'Réponds dans l''appli Nexus ou sur nexussports.ca.'
 where n.type = 'PARTENAIRE_EVALUATION'
   and n.message = 'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.'
   and not coalesce((n.metadata->>'caduque')::boolean, false)
   and exists (select 1 from public.partenaire_prospects_rapprochements r
                where r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
                  and r.statut = 'PROPOSE');

-- ── « Prise en charge par un coach » : nommé seulement s'il est nommable ────

create or replace function public.claim_school_athletes(p_athlete_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_school uuid;
  v_coach  jsonb;
  v_quoi   text;
  r        record;
  v_n      integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun utilisateur authentifié';
  END IF;
  IF p_athlete_ids IS NULL OR array_length(p_athlete_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'NEXUS: seul un entraîneur peut réclamer un athlète';
  END IF;

  v_school := public.current_user_school_id();
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun établissement rattaché à ton compte';
  END IF;

  -- Règle RSEQ : le coach (et son école) ne sont nommés que s'il est du secondaire ou du civil.
  v_coach := public.coach_nommable(v_uid);
  v_quoi := CASE WHEN v_coach IS NOT NULL
                 THEN format('Le coach %s t''a pris en charge à %s.', v_coach->>'nom',
                             coalesce(nullif(v_coach->>'ecole', ''), 'ton établissement'))
                 ELSE 'Ton entraîneur t''a pris en charge.' END;

  FOR r IN
    UPDATE public.athletes a
       SET coach_id = v_uid, updated_at = now()
     WHERE a.id = ANY (p_athlete_ids)
       AND a.coach_id IS NULL
       AND a.school_id = v_school
    RETURNING a.id, a.user_id
  LOOP
    v_n := v_n + 1;

    BEGIN
      INSERT INTO public.athlete_notifications (athlete_id, type, title, message, metadata)
      VALUES (
        r.id,
        'COACH_CLAIMED',
        'Un entraîneur t''a pris en charge',
        v_quoi || ' Ouvre l''app pour voir ton profil. Il peut maintenant gérer ton profil et répondre aux recruteurs pour toi.',
        jsonb_build_object('coach_id', v_uid, 'school_id', v_school)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'claim_school_athletes: notification in-app échouée pour athlète %: %', r.id, SQLERRM;
    END;

    PERFORM public.push_to_user(
      r.user_id,
      'Nexus',
      v_quoi || ' Ouvre l''app pour voir ton profil.',
      jsonb_build_object('type', 'announcement', 'athlete_id', r.id)
    );
  END LOOP;

  RETURN v_n;
END;
$function$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.push_to_user(uuid, text, text, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.push_heure_calme(timestamptz) from public, anon, authenticated;
revoke all on function public.push_textes(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.push_mettre_en_file(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.push_traiter_file(timestamptz) from public, anon, authenticated;
revoke all on function public.push_sur_evaluation_coach() from public, anon, authenticated;
revoke all on function public.push_sur_evaluation_partenaire() from public, anon, authenticated;
revoke all on function public.push_sur_badge_partenaire() from public, anon, authenticated;
revoke all on function public.push_preference_definir(text, boolean) from public, anon, authenticated;
grant execute on function public.push_preference_definir(text, boolean) to authenticated;
revoke all on function public.push_preferences_miennes() from public, anon, authenticated;
grant execute on function public.push_preferences_miennes() to authenticated;

-- ── Cron : toutes les 10 minutes ────────────────────────────────────────────

select cron.schedule('push-file-envoi', '*/10 * * * *', $cron$select public.push_traiter_file()$cron$);

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r   record;
  vus text[];
begin
  for r in
    select * from (values
      ('push_to_user(uuid,text,text,jsonb,text)', array['postgres']),
      ('push_heure_calme(timestamptz)', array['postgres', 'service_role']),
      ('push_textes(text,text,integer,text)', array['postgres', 'service_role']),
      ('push_mettre_en_file(uuid,text,text,text,text,jsonb)', array['postgres', 'service_role']),
      ('push_traiter_file(timestamptz)', array['postgres', 'service_role']),
      ('push_sur_evaluation_coach()', array['postgres', 'service_role']),
      ('push_sur_evaluation_partenaire()', array['postgres', 'service_role']),
      ('push_sur_badge_partenaire()', array['postgres', 'service_role']),
      ('push_preference_definir(text,boolean)', array['authenticated', 'postgres', 'service_role']),
      ('push_preferences_miennes()', array['authenticated', 'postgres', 'service_role']),
      ('appliquer_badges_saisie(uuid,jsonb)', array['authenticated', 'postgres', 'service_role']),
      ('claim_school_athletes(uuid[])', array['authenticated', 'postgres']),
      ('prospect_partenaire_proposer(uuid,uuid,text,text,text)', array['postgres', 'service_role'])
    ) as v(fn, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc p,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(p.proacl::text[]) as x) t
     where p.oid = ('public.' || r.fn)::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.fn, vus, r.veut;
    end if;
  end loop;
  for r in select * from (values ('push_file'), ('push_envois'), ('push_preferences')) as v(t) loop
    select array_agg(distinct t.g order by t.g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(c.relacl::text[]) as x) t
     where c.oid = ('public.' || r.t)::regclass;
    if vus is distinct from (case r.t when 'push_preferences' then array['authenticated', 'postgres', 'service_role']
                                      else array['postgres', 'service_role'] end) then
      raise exception 'NEXUS: ACL de % = %', r.t, vus;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || r.t)::regclass) then
      raise exception 'NEXUS: RLS absente sur %', r.t;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname in ('trg_push_evaluation_coach', 'trg_push_evaluation_partenaire',
                                                       'trg_push_badge_partenaire')) <> 3 then
    raise exception 'NEXUS: triggers de push absents';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'push_to_user') <> 1 then
    raise exception 'NEXUS: push_to_user doit exister en une seule signature';
  end if;
  if (select count(*) from cron.job where jobname = 'push-file-envoi' and schedule = '*/10 * * * *') <> 1 then
    raise exception 'NEXUS: cron push-file-envoi absent';
  end if;
  if position('coach_nommable(' in (select prosrc from pg_proc where oid = 'public.claim_school_athletes(uuid[])'::regprocedure)) = 0
     or position('coach_nommable(' in (select prosrc from pg_proc where oid = 'public.appliquer_badges_saisie(uuid,jsonb)'::regprocedure)) = 0
     or position('coach_nommable(' in (select prosrc from pg_proc where oid = 'public.push_sur_evaluation_coach()'::regprocedure)) = 0 then
    raise exception 'NEXUS: un push nomme un coach sans passer par coach_nommable';
  end if;
  raise notice 'NEXUS push A4a : file, préférences, heures calmes, regroupement — OK';
end $$;
