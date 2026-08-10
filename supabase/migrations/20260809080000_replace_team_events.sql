-- ============================================================================
-- 20260809080000_replace_team_events.sql
--
-- Même patron que replace_school_cards / replace_school_news /
-- replace_team_pennants, appliqué à team_events. Remplace le DELETE-tout +
-- INSERT de saveCamps (lib/queries/teamPage/teamPageData.ts) par une RPC
-- transactionnelle sous verrou de jeton de contenu.
--
-- Défauts corrigés : mise à jour perdue entre deux gestionnaires, demi-échec
-- laissant la liste VIDE si l'INSERT est refusé (trg_cap_team_events, 8 lignes),
-- et absence de garde « liste vide ».
--
-- team_events porte les camps et essais SAISIS DANS L'ÉDITEUR — à ne pas
-- confondre avec `games`, qui contient les 144 matchs scrapés du RSEQ et n'est
-- touchée par aucune de ces migrations.
--
-- Éprouvée avant apply en begin;…rollback; : save normal (n=2), jeton périmé
-- refusé en PT409 avec l'événement du premier éditeur intact, plafond 8 refusé
-- avec les 8 lignes intactes, recruteur d'un autre CÉGEP refusé en 42501.
-- ============================================================================

create or replace function public.sig_team_events(p_team_id uuid)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select md5(coalesce(
    string_agg(
      e.id::text || '|' || coalesce(e.titre, '') || '|' || coalesce(e.event_date::text, '')
                 || '|' || coalesce(e.lieu, '') || '|' || e.position::text,
      E'\n' order by e.position, e.id
    ), ''))
  from public.team_events e
  where e.team_id = p_team_id;
$function$;

comment on function public.sig_team_events(uuid) is
  'Jeton de contenu des événements. Émis au chargement, rendu au save par replace_team_events.';


create or replace function public.replace_team_events(
  p_team_id        uuid,
  p_rows           jsonb,
  p_jeton          text,
  p_autoriser_vide boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_garde  uuid[];
  v_actuel text;
  v_n      integer;
begin
  if p_team_id is null then
    raise exception 'NEXUS: Aucune équipe ciblée — rien n''a été modifié.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'NEXUS: Liste d''événements illisible — rien n''a été modifié.';
  end if;

  if not public.can_edit_team_page(p_team_id) then
    raise exception 'NEXUS: Tu n''as pas les droits d''édition sur cette équipe.'
      using errcode = '42501';
  end if;

  v_actuel := public.sig_team_events(p_team_id);
  if p_jeton is null or p_jeton <> v_actuel then
    raise exception 'NEXUS: Quelqu''un a modifié cette section pendant que tu l''éditais. Recharge la page pour voir les changements.'
      using errcode = 'PT409';
  end if;

  if jsonb_array_length(p_rows) = 0 and not p_autoriser_vide then
    if exists (select 1 from public.team_events where team_id = p_team_id) then
      raise exception 'NEXUS: Aucun événement reçu — la liste n''a pas été effacée.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where coalesce(btrim(r->>'titre'), '') = ''
  ) then
    raise exception 'NEXUS: Chaque événement doit porter un titre.';
  end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}')
    into v_garde
  from jsonb_array_elements(p_rows) r
  where r->>'id' is not null;

  delete from public.team_events
  where team_id = p_team_id and id <> all (v_garde);

  -- `event_date` et `lieu` sont facultatifs : la chaîne vide de l'éditeur
  -- devient NULL, elle ne devient pas une date invalide.
  update public.team_events e
     set titre      = btrim(r->>'titre'),
         event_date = nullif(r->>'event_date', '')::date,
         lieu       = nullif(r->>'lieu', ''),
         position   = (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where e.team_id = p_team_id
    and r->>'id' is not null
    and e.id = (r->>'id')::uuid
    and (e.titre, e.event_date, e.lieu, e.position)
        is distinct from
        (btrim(r->>'titre'), nullif(r->>'event_date','')::date,
         nullif(r->>'lieu',''), (r_idx - 1)::int);

  insert into public.team_events (team_id, titre, event_date, lieu, position)
  select p_team_id, btrim(r->>'titre'), nullif(r->>'event_date','')::date,
         nullif(r->>'lieu',''), (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where r->>'id' is null;

  select count(*) into v_n from public.team_events where team_id = p_team_id;

  return jsonb_build_object('n', v_n, 'jeton', public.sig_team_events(p_team_id));
end $function$;

comment on function public.replace_team_events(uuid, jsonb, text, boolean) is
  'Remplace les événements d''une équipe en une transaction, sous verrou de jeton de contenu.';


revoke all on function public.sig_team_events(uuid) from public;
revoke all on function public.sig_team_events(uuid) from anon;
grant execute on function public.sig_team_events(uuid) to authenticated, service_role;

revoke all on function public.replace_team_events(uuid, jsonb, text, boolean) from public;
revoke all on function public.replace_team_events(uuid, jsonb, text, boolean) from anon;
grant execute on function public.replace_team_events(uuid, jsonb, text, boolean) to authenticated, service_role;
