-- ════════════════════════════════════════════════════════════════════════════
-- Black-out par portée (point 8, plan validé BP 2026-10-29) — REJEU À BLANC (finit par ROLLBACK), version 20261029190000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> blackout (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → témoins → relevé AVANT (get_active_blackout de chaque athlète) → migration →
-- portées posées → relevé APRÈS (seuls les cégépiens peuvent changer) → essais par paire (chaque essai crée sa
-- période d'essai et la défait aussitôt, NX000) → rollback BLACKOUT joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-blackout-portee';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029190000') then
    raise exception 'NEXUS: version 20261029190000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261029190000' then raise exception 'NEXUS: version 20261029190000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_BLACKOUT_PORTEE', 'ROLLBACK_BLACKOUT_PORTEE')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from public.blackout_periods where id = '2d32b641-fcc3-496e-8396-d75458c18cf6') then
    raise exception 'NEXUS: la période « Silence RSEQ - Football » attendue est absente';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as universitaire_on
  from supabase_migrations.schema_migrations;

-- ── Témoins (athlètes sans conversation, pour que l'essai du trigger ne heurte rien) ─
create temp table _t on commit drop as
select (select a.id from public.athletes a left join public.schools s on s.id = a.school_id
         where coalesce(s.type::text, '') <> 'CEGEP' and not coalesce(a.is_showcase, false)
           and not exists (select 1 from public.conversations c where c.athlete_id = a.id)
         order by a.id limit 1) as sec,
       (select a.id from public.athletes a join public.schools s on s.id = a.school_id
         where s.type::text = 'CEGEP' and not coalesce(a.is_showcase, false)
           and not exists (select 1 from public.conversations c where c.athlete_id = a.id)
         order by a.id limit 1) as ceg,
       (select u.id from public.users u join public.schools s on s.id = u.school_id
         where u.role = 'RECRUTEUR'::public.user_role and s.type::text = 'CEGEP' order by u.id limit 1) as r_col,
       (select u.id from public.users u join public.schools s on s.id = u.school_id
         where u.role = 'RECRUTEUR'::public.user_role and s.type::text = 'UNIVERSITE' order by u.id limit 1) as r_uni_reel,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1) as coach,
       (select count(*) from public.blackout_periods) as periodes_avant;
alter table _t add column r_uni uuid;
-- Sans recruteur universitaire en prod, l'essai prend le recruteur collégial : la règle ne regarde que le rôle.
update _t set r_uni = coalesce(r_uni_reel, r_col);
do $$ begin
  if exists (select 1 from _t where sec is null or ceg is null or r_col is null or coach is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;
select r_uni_reel is not null as recruteur_universitaire_reel, periodes_avant from _t;

create temp table _avant on commit drop as
select a.id, exists (select 1 from public.schools s where s.id = a.school_id and s.type::text = 'CEGEP') as cegepien,
       (select g.id from public.get_active_blackout(a.id) g) as periode
  from public.athletes a;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _m on commit drop as
select '20261029190000'::text as version,
       $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Black-out par portée (point 8 des retours 1.4.6, plan validé par BP le 2026-10-29).
--
-- Avant : une période ne regardait que le sport et la promotion de l'athlète. Sous l'interrupteur
-- universitaire ON, « Silence RSEQ - Football » aurait aussi coupé les échanges recruteur universitaire ↔
-- cégépien.
--
-- Règle de BP : la période suit le NIVEAU DE L'ATHLÈTE.
--   portee = 'secondaire' : recruteurs collégiaux ET universitaires ↔ athlète du secondaire (tout athlète
--                           qui n'est pas cégépien : même effet qu'avant pour lui) ;
--   portee = 'cegep'      : recruteur universitaire ↔ cégépien (seul recruteur qui lui écrit, lot C0) ;
--   portee = 'tous'       : tout athlète (comportement d'avant, valeur par défaut).
-- Les conversations recruteur ↔ coach ne sont PAS visées (le trigger ne regarde que RECRUTEUR_ATHLETE,
-- inchangé ; ADMIN_USER reste exempté explicitement).
--
-- Contenu :
--   1. blackout_periods.portee (text, défaut 'tous', CHECK) ; « Silence RSEQ- Football » → 'secondaire'
--      (par id, prod seulement ; « La pause des fêtes » et les autres gardent 'tous').
--   2. get_active_blackout(uuid) : même signature, même sortie (1.4.5 mobile intacte) + filtre de portée.
--      Athlète absent → toutes portées (comme avant pour la bannière générale).
--   3. get_active_blackout(uuid, uuid) et is_messaging_blacked_out(uuid, uuid) : la paire réelle. Un
--      interlocuteur connu qui n'est pas RECRUTEUR (coach, parent…) n'est jamais visé.
--   4. enforce_messaging_blackout() : passe le recruiter_id de la conversation.
--   5. non_contact_carte(uuid, integer, text) : variante avec le niveau de la carte prospect (pour la 1.4.6) ;
--      la variante à 2 arguments est inchangée.
--
-- Rollback : supabase/rollback/20261029190000_rollback_blackout_portee.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.get_active_blackout(uuid)'::regprocedure)
     is distinct from 'f93e81bed72c2c180b83da6c6cd01c94' then
    raise exception 'NEXUS: get_active_blackout(uuid) n''est pas le corps attendu';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.enforce_messaging_blackout()'::regprocedure)
     is distinct from 'b6b069f4e7c43b96cbc0a5805cb80f7b' then
    raise exception 'NEXUS: enforce_messaging_blackout n''est pas le corps attendu';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'blackout_periods' and column_name = 'portee') then
    raise exception 'NEXUS: blackout_periods.portee existe déjà';
  end if;
end $$;

-- ── 1. Portée ───────────────────────────────────────────────────────────────
alter table public.blackout_periods
  add column portee text not null default 'tous'
  constraint blackout_portee_valide check (portee in ('secondaire', 'cegep', 'tous'));

comment on column public.blackout_periods.portee is
  'Qui est visé, selon le niveau de l''athlète : secondaire (recruteurs collégiaux et universitaires ↔ athlète '
  'du secondaire), cegep (recruteur universitaire ↔ cégépien), tous.';

-- Silence RSEQ - Football (prod) : ligue du secondaire.
update public.blackout_periods set portee = 'secondaire'
 where id = '2d32b641-fcc3-496e-8396-d75458c18cf6';

-- ── 2. get_active_blackout(uuid) : même contrat, filtre de portée ───────────
create or replace function public.get_active_blackout(p_athlete uuid default null::uuid)
 returns table(id uuid, libelle text, date_debut date, date_fin date, sport_nom text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select b.id, b.libelle, b.date_debut, b.date_fin, s.nom
  from public.blackout_periods b
  left join public.athletes a on a.id = p_athlete
  left join public.sports   s on s.id = b.sport_id
  where b.actif
    and coalesce(a.is_showcase, false) = false
    and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
    and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)
    and (
          (b.promo_min is null and b.promo_max is null)
       or a.annee_diplomation is null
       or (    (b.promo_min is null or a.annee_diplomation >= b.promo_min)
           and (b.promo_max is null or a.annee_diplomation <= b.promo_max))
    )
    -- La période suit le niveau de l'athlète ; athlète inconnu → toutes portées.
    and (
          b.portee = 'tous'
       or a.id is null
       or b.portee = case when exists (select 1 from public.schools sc
                                        where sc.id = a.school_id and sc.type::text = 'CEGEP')
                          then 'cegep' else 'secondaire' end
    )
  order by b.date_fin desc, b.date_debut asc
  limit 1;
$function$;

-- ── 3. La paire réelle ──────────────────────────────────────────────────────
create function public.get_active_blackout(p_athlete uuid, p_recruteur uuid)
 returns table(id uuid, libelle text, date_debut date, date_fin date, sport_nom text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- Seul un RECRUTEUR (collégial ou universitaire) est visé ; un interlocuteur connu d'un autre rôle
  -- (coach, parent…) ne l'est jamais. Interlocuteur absent → règle de l'athlète seul.
  select g.*
    from public.get_active_blackout(p_athlete) g
   where p_recruteur is null
      or exists (select 1 from public.users u
                  where u.id = p_recruteur and u.role = 'RECRUTEUR'::public.user_role)
      or not exists (select 1 from public.users u where u.id = p_recruteur);
$function$;

create function public.is_messaging_blacked_out(p_athlete uuid, p_recruteur uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.get_active_blackout(p_athlete, p_recruteur));
$function$;

comment on function public.get_active_blackout(uuid, uuid) is
  'Période de black-out active pour la paire (athlète, recruteur) : portée selon le niveau de l''athlète ; '
  'un interlocuteur qui n''est pas RECRUTEUR n''est jamais visé. Au plus une ligne.';
comment on function public.is_messaging_blacked_out(uuid, uuid) is
  'Vrai si get_active_blackout(athlète, recruteur) rend une ligne.';

revoke all on function public.get_active_blackout(uuid, uuid) from public, anon;
grant execute on function public.get_active_blackout(uuid, uuid) to authenticated, service_role;
revoke all on function public.is_messaging_blacked_out(uuid, uuid) from public, anon;
grant execute on function public.is_messaging_blacked_out(uuid, uuid) to authenticated, service_role;

-- ── 4. Le trigger passe le recruteur de la conversation ─────────────────────
create or replace function public.enforce_messaging_blackout()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_type      public.conversation_type;
  v_athlete   uuid;
  v_recruteur uuid;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    v_type := NEW.conversation_type;
    v_athlete := NEW.athlete_id;
    v_recruteur := NEW.recruiter_id;
  ELSE
    SELECT c.conversation_type, c.athlete_id, c.recruiter_id
      INTO v_type, v_athlete, v_recruteur
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;

  -- ── EXEMPTIONS EXPLICITES ────────────────────────────────────────
  -- Types HORS périmètre du black-out de la ligue, par décision produit.
  -- ADMIN_USER : messagerie de service de la plateforme (maintenance,
  -- information, support). Ce n'est pas du recrutement ; le black-out
  -- protège l'intégrité du recrutement, pas la communication de service.
  --
  -- Écrit ici DÉLIBÉRÉMENT plutôt qu'obtenu par le fait que le test
  -- ci-dessous ne vise que RECRUTEUR_ATHLETE : si le black-out est un jour
  -- élargi à d'autres types, cette exemption reste vraie et VISIBLE, au
  -- lieu de disparaître sans que personne ne le remarque.
  -- Voir CLAUDE.md, MIGRATION SAFETY CHECKLIST règle 11.
  -- RECRUTEUR_COACH : pas visé non plus (décision BP 2026-10-29), par le test ci-dessous.
  IF v_type = ANY (ARRAY['ADMIN_USER']::public.conversation_type[]) THEN
    RETURN NEW;
  END IF;

  -- La portée suit le niveau de l'athlète (blackout_periods.portee, 20261029190000).
  IF v_type = 'RECRUTEUR_ATHLETE' AND public.is_messaging_blacked_out(v_athlete, v_recruteur) THEN
    RAISE EXCEPTION 'Période de black-out — la messagerie est suspendue par la ligue pour protéger l''intégrité du recrutement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 5. Carte prospect avec niveau (1.4.6) ───────────────────────────────────
create function public.non_contact_carte(p_sport uuid, p_promo integer, p_niveau text)
 returns table(date_fin date, libelle text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- p_niveau : 'cegep' ou 'secondaire' (type de la carte) ; autre ou null → toutes portées.
  select b.date_fin, b.libelle
    from public.blackout_periods b
   where b.actif
     and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
     and (b.sport_id is null or p_sport is null or b.sport_id = p_sport)
     and (
           (b.promo_min is null and b.promo_max is null)
        or p_promo is null
        or (    (b.promo_min is null or p_promo >= b.promo_min)
            and (b.promo_max is null or p_promo <= b.promo_max))
     )
     and (b.portee = 'tous' or p_niveau is null or p_niveau not in ('cegep', 'secondaire') or b.portee = p_niveau)
   order by b.date_fin desc, b.date_debut asc
   limit 1
$function$;

comment on function public.non_contact_carte(uuid, integer, text) is
  'Période de non-contact pour une carte prospect (sport, promotion, niveau cegep|secondaire) ; même règle que get_active_blackout.';
revoke all on function public.non_contact_carte(uuid, integer, text) from public, anon;
grant execute on function public.non_contact_carte(uuid, integer, text) to authenticated, service_role;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback de 20261029190000_blackout_portee : corps d'avant de get_active_blackout(uuid) (md5 f93e81bed72c2c180b83da6c6cd01c94)
-- et de enforce_messaging_blackout() (md5 b6b069f4e7c43b96cbc0a5805cb80f7b), variantes à la paire et non_contact_carte
-- à 3 arguments retirées, colonne portee retirée (les portées saisies entre-temps sont perdues).

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.get_active_blackout(uuid)'::regprocedure)
     is distinct from '857f842445e6e7612b729f953215a6dc' then
    raise exception 'NEXUS: get_active_blackout(uuid) n''est pas le corps de 20261029190000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.enforce_messaging_blackout()'::regprocedure)
     is distinct from '94e9d8881f605d44e495f36f0a6d7b70' then
    raise exception 'NEXUS: enforce_messaging_blackout n''est pas le corps de 20261029190000';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.get_active_blackout(p_athlete uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, libelle text, date_debut date, date_fin date, sport_nom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select b.id, b.libelle, b.date_debut, b.date_fin, s.nom
  from public.blackout_periods b
  left join public.athletes a on a.id = p_athlete
  left join public.sports   s on s.id = b.sport_id
  where b.actif
    and coalesce(a.is_showcase, false) = false
    and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
    and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)
    and (
          (b.promo_min is null and b.promo_max is null)
       or a.annee_diplomation is null
       or (    (b.promo_min is null or a.annee_diplomation >= b.promo_min)
           and (b.promo_max is null or a.annee_diplomation <= b.promo_max))
    )
  order by b.date_fin desc, b.date_debut asc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_messaging_blackout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- ── EXEMPTIONS EXPLICITES ────────────────────────────────────────
  -- Types HORS périmètre du black-out de la ligue, par décision produit.
  -- ADMIN_USER : messagerie de service de la plateforme (maintenance,
  -- information, support). Ce n'est pas du recrutement ; le black-out
  -- protège l'intégrité du recrutement, pas la communication de service.
  --
  -- Écrit ici DÉLIBÉRÉMENT plutôt qu'obtenu par le fait que le test
  -- ci-dessous ne vise que RECRUTEUR_ATHLETE : si le black-out est un jour
  -- élargi à d'autres types, cette exemption reste vraie et VISIBLE, au
  -- lieu de disparaître sans que personne ne le remarque.
  -- Voir CLAUDE.md, MIGRATION SAFETY CHECKLIST règle 11.
  IF v_type = ANY (ARRAY['ADMIN_USER']::public.conversation_type[]) THEN
    RETURN NEW;
  END IF;

  IF v_type = 'RECRUTEUR_ATHLETE' AND public.is_messaging_blacked_out(v_athlete) THEN
    RAISE EXCEPTION 'Période de black-out — la messagerie est suspendue par la ligue pour protéger l''intégrité du recrutement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

drop function public.non_contact_carte(uuid, integer, text);
drop function public.is_messaging_blacked_out(uuid, uuid);
drop function public.get_active_blackout(uuid, uuid);
alter table public.blackout_periods drop column portee;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '33cd4ad4b1ea5f635edbb2c9ef73cc4f' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> 'f1ad2f003259e6f5101328f9e346fcb4' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _m);
  end if;
  execute (select contenu from _m);
end $apply$;
set local search_path = public, extensions;

select libelle, portee, actif, date_debut, date_fin from public.blackout_periods order by date_debut;

-- Relevé APRÈS : un athlète qui n'est pas cégépien garde exactement la même période qu'avant.
select count(*) filter (where not v.cegepien) as athletes_secondaire,
       count(*) filter (where not v.cegepien and v.periode is distinct from (select g.id from public.get_active_blackout(v.id) g)) as secondaire_changes,
       count(*) filter (where v.cegepien) as cegepiens,
       count(*) filter (where v.cegepien and v.periode is distinct from (select g.id from public.get_active_blackout(v.id) g)) as cegepiens_changes
  from _avant v;

-- ── Essais (chacun crée sa période d'essai, puis tout est défait) ────────────
create function pg_temp.essai(p_portee text, p_quoi text) returns text language plpgsql as $$
declare t record; v text; p uuid := '00000000-0000-4000-8000-0000000b1a01';
begin
  select * into t from _t;
  begin
    insert into public.blackout_periods (id, libelle, sport_id, date_debut, date_fin, portee)
    values (p, 'Essai portée', null, (now() at time zone 'America/Montreal')::date, date '2099-12-31', p_portee);
    if p_quoi = 'secondaire + recruteur collégial' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec, t.r_col) g where g.id = p);
    elsif p_quoi = 'secondaire + recruteur universitaire' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec, t.r_uni) g where g.id = p);
    elsif p_quoi = 'cégépien + recruteur universitaire' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.ceg, t.r_uni) g where g.id = p);
    elsif p_quoi = 'secondaire + coach' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec, t.coach) g where g.id = p);
    elsif p_quoi = 'secondaire, 1 argument (1.4.5)' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec) g where g.id = p);
    elsif p_quoi = 'cégépien, 1 argument (1.4.5)' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.ceg) g where g.id = p);
    elsif p_quoi = 'sans athlète (bannière)' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout() g where g.id = p);
    elsif p_quoi = 'carte cégep' then
      v := 'visé ' || exists (select 1 from public.non_contact_carte(null, null, 'cegep') g where g.date_fin = '2099-12-31');
    elsif p_quoi = 'carte secondaire' then
      v := 'visé ' || exists (select 1 from public.non_contact_carte(null, null, 'secondaire') g where g.date_fin = '2099-12-31');
    elsif p_quoi = 'conversation recruteur ↔ secondaire' then
      insert into public.conversations (recruiter_id, athlete_id, conversation_type) values (t.r_col, t.sec, 'RECRUTEUR_ATHLETE');
      v := 'acceptée';
    elsif p_quoi = 'conversation recruteur ↔ cégépien' then
      insert into public.conversations (recruiter_id, athlete_id, conversation_type) values (t.r_uni, t.ceg, 'RECRUTEUR_ATHLETE');
      v := 'acceptée';
    elsif p_quoi = 'conversation recruteur ↔ coach' then
      insert into public.conversations (recruiter_id, coach_id, athlete_id, conversation_type) values (t.r_col, t.coach, t.sec, 'RECRUTEUR_COACH');
      v := 'acceptée';
    end if;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when check_violation then return 'refusée ' || sqlstate;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;

create temp table _e (o int, portee text, geste text, attendu text, obtenu text) on commit drop;
insert into _e (o, portee, geste, attendu) values
  ( 1, 'secondaire', 'secondaire + recruteur collégial',      'visé true'),
  ( 2, 'secondaire', 'secondaire + recruteur universitaire',  'visé true'),
  ( 3, 'secondaire', 'cégépien + recruteur universitaire',    'visé false'),
  ( 4, 'secondaire', 'secondaire + coach',                    'visé false'),
  ( 5, 'secondaire', 'secondaire, 1 argument (1.4.5)',        'visé true'),
  ( 6, 'secondaire', 'cégépien, 1 argument (1.4.5)',          'visé false'),
  ( 7, 'secondaire', 'sans athlète (bannière)',               'visé true'),
  ( 8, 'cegep',      'cégépien + recruteur universitaire',    'visé true'),
  ( 9, 'cegep',      'secondaire + recruteur collégial',      'visé false'),
  (10, 'cegep',      'secondaire + recruteur universitaire',  'visé false'),
  (11, 'tous',       'secondaire + recruteur collégial',      'visé true'),
  (12, 'tous',       'cégépien + recruteur universitaire',    'visé true'),
  (13, 'tous',       'secondaire + coach',                    'visé false'),
  (14, 'cegep',      'carte cégep',                           'visé true'),
  (15, 'cegep',      'carte secondaire',                      'visé false'),
  (16, 'secondaire', 'conversation recruteur ↔ secondaire',   'refusée 23514'),
  (17, 'secondaire', 'conversation recruteur ↔ cégépien',     'acceptée'),
  (18, 'tous',       'conversation recruteur ↔ cégépien',     'refusée 23514'),
  (19, 'tous',       'conversation recruteur ↔ coach',        'acceptée');
update _e set obtenu = pg_temp.essai(portee, geste);
select o, portee, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?" from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if exists (select 1 from _avant v where not v.cegepien
               and v.periode is distinct from (select g.id from public.get_active_blackout(v.id) g)) then
    raise exception 'NEXUS: un athlète du secondaire a changé de période';
  end if;
  if (select portee from public.blackout_periods where id = '2d32b641-fcc3-496e-8396-d75458c18cf6') <> 'secondaire' then
    raise exception 'NEXUS: Silence RSEQ - Football n''est pas en portée secondaire';
  end if;
  if exists (select 1 from public.blackout_periods where id <> '2d32b641-fcc3-496e-8396-d75458c18cf6' and portee <> 'tous') then
    raise exception 'NEXUS: une autre période a changé de portée';
  end if;
  if (select count(*) from public.blackout_periods) <> (select periodes_avant from _t) then
    raise exception 'NEXUS: une période d''essai est restée';
  end if;
  raise notice 'NEXUS: VERDICT black-out par portée — paires conformes, secondaire inchangé, coach jamais visé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.get_active_blackout(uuid)'::regprocedure) <> 'f93e81bed72c2c180b83da6c6cd01c94'
     or (select md5(prosrc) from pg_proc where oid = 'public.enforce_messaging_blackout()'::regprocedure) <> 'b6b069f4e7c43b96cbc0a5805cb80f7b' then
    raise exception 'NEXUS: après rollback, un corps n''est pas celui d''avant';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blackout_periods' and column_name = 'portee')
     or to_regprocedure('public.get_active_blackout(uuid, uuid)') is not null
     or to_regprocedure('public.non_contact_carte(uuid, integer, text)') is not null then
    raise exception 'NEXUS: après rollback, un objet du lot reste';
  end if;
  raise notice 'NEXUS: rollback vérifié (corps d''avant par md5, colonne et variantes retirées)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
