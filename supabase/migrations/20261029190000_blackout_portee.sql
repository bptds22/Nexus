-- ════════════════════════════════════════════════════════════════════════════
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
