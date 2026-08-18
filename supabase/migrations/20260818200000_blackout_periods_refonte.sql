-- ═══════════════════════════════════════════════════════════════
-- Blackout RSEQ — refonte du schéma, des fonctions et des triggers.
--
-- POURQUOI UN SEUL FICHIER, ET POURQUOI C'EST SÛR.
-- Entre le `drop table` et la recréation des fonctions,
-- is_messaging_blacked_out référence des colonnes disparues : dans cet
-- intervalle, TOUTE insertion dans conversations et messages échouerait,
-- pour tous les types de conversation, pas seulement RECRUTEUR_ATHLETE.
-- Cet état ne doit jamais être observable.
-- Vérifié expérimentalement le 18 août : apply_migration enveloppe le
-- fichier dans une transaction unique (sonde `create table` + `1/0` — la
-- table créée n'a pas survécu à l'échec, et schema_migrations n'a gardé
-- aucune trace). L'intervalle est donc invisible, et un échec en cours de
-- route ramène tout en bloc.
--
-- POURQUOI DROP PLUTÔT QU'ALTER.
-- La table porte 0 ligne. Un drop/create est plus lisible qu'un alter en
-- huit temps, et ne perd rien. Les corps de fonction en `language sql` avec
-- délimiteur `$function$` ne créent pas de dépendance suivie au catalogue :
-- le `cascade` ne les emporte pas, il les laisse simplement cassées — d'où
-- leur recréation obligatoire ici même.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS.
-- Elle ne peuple pas la table. Les périodes réelles sont saisies par BP.
-- Tant que la table est vide, is_messaging_blacked_out rend toujours false
-- et rien ne change pour personne — c'est voulu.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Désarmer d'abord : plus rien ne peut se déclencher pendant la bascule.
drop trigger if exists trg_blackout_conversations on public.conversations;
drop trigger if exists trg_blackout_messages      on public.messages;

-- ── 2. La table. `cascade` emporte les 2 policies, recréées en 4.
--       Aucune vue ne dépend d'elle (vérifié via pg_depend/pg_rewrite).
drop table if exists public.blackout_periods cascade;

create table public.blackout_periods (
  id          uuid primary key default gen_random_uuid(),

  -- Obligatoire : aucune période ne doit être anonyme dans l'écran d'admin.
  -- C'est aussi ce libellé qui remplacera BLACKOUT_MESSAGE côté client le
  -- jour où la RPC rendra autre chose qu'un booléen.
  libelle     text not null,

  -- NULL = toutes disciplines. RESTRICT : supprimer un sport ne doit pas
  -- faire disparaître silencieusement une restriction en vigueur.
  sport_id    uuid references public.sports(id) on delete restrict,

  -- Bornes sur athletes.annee_diplomation. NULL = pas de borne de ce côté.
  -- Les deux NULL + sport_id NULL = période globale.
  promo_min   integer,
  promo_max   integer,

  -- DATE, pas timestamptz : une période de silence RSEQ est annoncée en
  -- dates de calendrier, jamais avec une heure. Le timestamptz de l'ancien
  -- schéma produisait en prime une erreur de borne — « jusqu'au 15 mars »
  -- stocké 2026-03-15T00:00:00 cessait de protéger à minuit, le 15 n'était
  -- pas couvert. Avec DATE et `between`, ce que l'admin saisit est ce qui
  -- s'applique, bornes incluses.
  date_debut  date not null,
  date_fin    date not null,

  -- Désarmer sans supprimer : on ne perd jamais la trace d'une décision.
  actif       boolean not null default true,

  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint blackout_dates_coherentes
    check (date_fin >= date_debut),
  -- Même logique que les dates : une fourchette inversée ne couvrirait
  -- personne et passerait pour une règle active. On la refuse à l'écriture.
  constraint blackout_promos_coherentes
    check (promo_min is null or promo_max is null or promo_max >= promo_min)
);

comment on table public.blackout_periods is
  'Periodes de silence RSEQ. NULL = joker (sport / bornes de promotion). Lue par is_messaging_blacked_out().';

-- ── 3. Index partiel : la question posée à chaque insertion de message est
--       « une periode ACTIVE couvre-t-elle aujourd'hui ? ». Les lignes
--       desarmees s'accumulent (on ne supprime jamais) et n'ont aucune
--       raison de peser dessus.
create index blackout_periods_actif_dates_idx
  on public.blackout_periods (date_debut, date_fin)
  where actif;

-- ── 4. RLS + les deux policies, aux noms vivants (inchangés depuis des mois).
alter table public.blackout_periods enable row level security;

-- LECTURE : tout utilisateur authentifié. Ce n'est pas une donnée sensible,
-- c'est un calendrier réglementaire, le même pour tout le monde.
create policy "blackout read"
  on public.blackout_periods for select
  to authenticated
  using (true);

-- ÉCRITURE : administrateur PLATEFORME uniquement. Pas is_admin(), pas
-- is_school_admin : une restriction est une décision de ligue, pas
-- d'établissement. Un directeur d'école doit être refusé ici.
create policy "blackout admin write"
  on public.blackout_periods for all
  to authenticated
  using       (public.is_platform_admin((select auth.uid())))
  with check  (public.is_platform_admin((select auth.uid())));

-- ── 5. Privilèges. anon n'a aucune raison de toucher cette table ; le
--       GRANT ALL par défaut de Supabase lui donnait jusqu'ici INSERT,
--       UPDATE, DELETE et TRUNCATE — ce dernier n'étant PAS soumis à la RLS.
revoke all on public.blackout_periods from anon;
grant select on public.blackout_periods to authenticated;

-- ── 6. is_messaging_blacked_out — le paramètre est enfin honoré.
create or replace function public.is_messaging_blacked_out(p_athlete uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.blackout_periods b
    -- LEFT JOIN volontaire : si p_athlete est NULL ou introuvable, toutes
    -- les colonnes de `a` sont NULL et les tests ci-dessous rendent VRAI.
    -- Un athlète qu'on ne peut pas identifier est COUVERT, pas exempté.
    left join public.athletes a on a.id = p_athlete
    where b.actif
      -- Fuseau explicite : current_date suivrait le TimeZone de la session
      -- (UTC sous PostgREST) et decalerait la frontiere d'une journee en
      -- soiree — le 14 mars a 20 h a Montreal, il est deja le 15 en UTC.
      and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin

      -- Sport : NULL cote periode = toutes disciplines.
      --         NULL cote athlete = couvert (meme regle que la promotion).
      and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)

      -- Promotion. LE NULL N'EST PAS UNE PORTE DE SORTIE : un athlete dont
      -- annee_diplomation est inconnue est COUVERT par une periode bornee,
      -- il n'y echappe pas. Une restriction de ligue ne doit pas tomber par
      -- simple absence de donnee — c'est le sens de securite du repli.
      and (
            (b.promo_min is null and b.promo_max is null)
         or a.annee_diplomation is null
         or (    (b.promo_min is null or a.annee_diplomation >= b.promo_min)
             and (b.promo_max is null or a.annee_diplomation <= b.promo_max))
      )
  );
$function$;

comment on function public.is_messaging_blacked_out(uuid) is
  'Vrai si une periode de silence RSEQ active couvre cet athlete aujourd hui. Sport et bornes de promotion honores ; un athlete inconnu ou sans annee de diplomation est couvert, jamais exempte.';

-- ── 7. is_athlete_contactable — la négation de la précédente.
--       Fin du stub `SELECT true`. Une seule règle, une seule source : le
--       hook client, la policy recruteur_athlete_conversations_insert et les
--       deux triggers lisent désormais tous le même calcul et ne peuvent
--       plus diverger. Effet de bord voulu : le terme
--       `is_athlete_contactable(athlete_id)` du WITH CHECK de cette policy,
--       inerte depuis sa création, se met à mordre.
create or replace function public.is_athlete_contactable(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select not public.is_messaging_blacked_out(p_athlete);
$function$;

comment on function public.is_athlete_contactable(uuid) is
  'Negation de is_messaging_blacked_out(). Source unique de la regle de contact.';

-- ── 8. Le trigger — inchangé sur le fond, recréé pour que le fichier soit
--       auto-suffisant. RECRUTEUR_ATHLETE seul : le recruteur garde le droit
--       de parler a l'entraineur pendant la periode (decision BP).
create or replace function public.enforce_messaging_blackout()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_type    public.conversation_type;
  v_athlete uuid;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    v_type := NEW.conversation_type;
    v_athlete := NEW.athlete_id;
  ELSE
    SELECT c.conversation_type, c.athlete_id
      INTO v_type, v_athlete
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;

  IF v_type = 'RECRUTEUR_ATHLETE' AND public.is_messaging_blacked_out(v_athlete) THEN
    RAISE EXCEPTION 'Période de black-out — la messagerie est suspendue par la ligue pour protéger l''intégrité du recrutement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 9. Réarmer, en dernier : les fonctions existent, la table aussi.
create trigger trg_blackout_conversations
  before insert on public.conversations
  for each row execute function public.enforce_messaging_blackout();

create trigger trg_blackout_messages
  before insert on public.messages
  for each row execute function public.enforce_messaging_blackout();
