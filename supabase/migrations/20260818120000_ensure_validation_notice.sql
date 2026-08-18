-- ═══════════════════════════════════════════════════════════════
-- ensure_validation_notice() — la relance de re-validation mensuelle.
--
-- POURQUOI UNE RPC PLUTÔT QU'UN INSERT CLIENT.
-- `athlete_notifications` porte une seule policy INSERT : « admins insert
-- notifications » (is_admin()). Un athlète NE PEUT PAS y écrire. Le
-- useEffect qui vivait dans app/athlete/profil/page.tsx tentait cet insert
-- et repartait en 42501 — sans que personne le voie, l'erreur n'étant pas
-- testée. C'est la vraie raison du zéro PROFILE_TIP en production, et
-- déplacer cet effet vers le tableau de bord ne l'aurait pas réparé.
-- Les six notifications athlète existantes sont toutes écrites par des
-- fonctions SECURITY DEFINER ; celle-ci suit le même patron.
--
-- IDEMPOTENCE — DEUX VERROUS, PAS UN.
-- La surface d'appel est doublée (web + mobile), donc deux clients peuvent
-- appeler en même temps.
--   1. `on conflict do nothing`, adossé à l'index unique partiel ci-dessous.
--   2. l'index lui-même, qui rend le doublon impossible même si deux
--      transactions concurrentes franchissent le même instant.
-- Le seul `insert ... where not exists` n'aurait PAS suffi : sous READ
-- COMMITTED, deux transactions simultanées peuvent toutes deux lire
-- « aucune ligne » avant que l'une écrive. L'index est ce qui rend la
-- garantie réelle.
--
-- LA RÈGLE EST CELLE DU CLIENT, RECOPIÉE UNE FOIS.
-- Miroir exact de lib/utils/profileValidation.ts :
--   due     = last_profile_validation < 1er du mois courant (ou NULL)
--   expiré  = due ET on a dépassé le 15
-- Fuseau America/Montreal explicite : `current_date` suivrait le TimeZone
-- de la session (UTC sous PostgREST) et décalerait la frontière d'un jour
-- en soirée.
-- ═══════════════════════════════════════════════════════════════

-- Verrou 2 : le doublon devient structurellement impossible.
-- Partiel — il ne couvre que les notifications porteuses d'un `kind`,
-- donc les 63 lignes existantes (metadata sans `kind`) ne sont pas
-- concernées et l'index reste petit.
create unique index if not exists athlete_notifications_kind_month_uniq
  on public.athlete_notifications (
    athlete_id,
    (metadata ->> 'kind'),
    (metadata ->> 'month')
  )
  where type = 'PROFILE_TIP' and metadata ->> 'kind' is not null;

create or replace function public.ensure_validation_notice()
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_athlete  uuid;
  v_verified boolean;
  v_last     timestamptz;
  v_today    date;
  v_month    text;
  v_rows     integer;
begin
  -- L'athlète appelant, résolu par auth.uid() — jamais par un paramètre.
  -- Un paramètre laisserait un client demander la création d'une
  -- notification chez quelqu'un d'autre.
  select a.id, a.verified, a.last_profile_validation
    into v_athlete, v_verified, v_last
  from public.athletes a
  where a.user_id = auth.uid()
  limit 1;

  -- Appelant non athlète, ou athlète non vérifié : rien à relancer.
  if v_athlete is null or v_verified is not true then
    return false;
  end if;

  v_today := (now() at time zone 'America/Montreal')::date;

  -- due ET passé le 15 — sinon on ne dit rien.
  if not (
       (v_last is null or v_last < date_trunc('month', v_today::timestamp))
       and extract(day from v_today) > 15
     ) then
    return false;
  end if;

  v_month := to_char(v_today, 'YYYY-MM');

  insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
  values (
    v_athlete,
    'PROFILE_TIP',
    '⚠️ Ton badge vérifié a été désactivé',
    'Confirme tes informations pour le réactiver.',
    jsonb_build_object('kind', 'monthly_validation_expired', 'month', v_month)
  )
  on conflict do nothing;

  get diagnostics v_rows = row_count;

  -- true = une notification vient d'être créée ; false = elle existait déjà
  -- ou l'athlète n'est pas concerné. L'appelant n'a rien à en faire, mais le
  -- retour rend la fonction testable sans lire la table.
  return v_rows > 0;
end;
$function$;

comment on function public.ensure_validation_notice() is
  'Crée au plus une notification PROFILE_TIP par athlète et par mois quand le badge vérifié est expiré. Idempotente. Appelée à l''ouverture du tableau de bord (web + mobile).';

-- anon n'a aucune raison d'appeler ceci : sans session, auth.uid() est nul
-- et la fonction ne ferait rien — autant fermer la porte.
revoke all on function public.ensure_validation_notice() from public, anon;
grant execute on function public.ensure_validation_notice() to authenticated;
