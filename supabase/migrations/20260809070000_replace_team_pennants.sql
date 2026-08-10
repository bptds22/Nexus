-- ============================================================================
-- 20260809070000_replace_team_pennants.sql
--
-- Même patron que replace_school_cards / replace_school_news, appliqué à
-- team_pennants. Remplace le DELETE-tout + INSERT de savePennants
-- (lib/queries/teamPage/teamPageData.ts) par une RPC transactionnelle sous
-- verrou de jeton de contenu.
--
-- Défauts corrigés : mise à jour perdue entre deux gestionnaires, demi-échec
-- laissant le palmarès VIDE si l'INSERT est refusé (trg_cap_team_pennants,
-- 8 lignes), et absence de garde « liste vide ».
--
-- Le garde de droits est can_edit_team_page — découplée du paywall recruteur
-- par 20260809030000 puis 20260809040000. Un coach déclaré sur l'équipe édite
-- donc son palmarès gratuitement.
--
-- Éprouvée avant apply en begin;…rollback; : save normal (n=2), jeton périmé
-- refusé en PT409 avec le fanion du premier éditeur intact, plafond 8 refusé
-- avec les 8 lignes intactes, recruteur d'un autre CÉGEP refusé en 42501.
-- ============================================================================

create or replace function public.sig_team_pennants(p_team_id uuid)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select md5(coalesce(
    string_agg(
      p.id::text || '|' || coalesce(p.titre, '') || '|' || coalesce(p.annee::text, '')
                 || '|' || coalesce(p.type, '') || '|' || p.position::text,
      E'\n' order by p.position, p.id
    ), ''))
  from public.team_pennants p
  where p.team_id = p_team_id;
$function$;

comment on function public.sig_team_pennants(uuid) is
  'Jeton de contenu des fanions. Émis au chargement, rendu au save par replace_team_pennants.';


create or replace function public.replace_team_pennants(
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
    raise exception 'NEXUS: Liste de fanions illisible — rien n''a été modifié.';
  end if;

  if not public.can_edit_team_page(p_team_id) then
    raise exception 'NEXUS: Tu n''as pas les droits d''édition sur cette équipe.'
      using errcode = '42501';
  end if;

  v_actuel := public.sig_team_pennants(p_team_id);
  if p_jeton is null or p_jeton <> v_actuel then
    raise exception 'NEXUS: Quelqu''un a modifié cette section pendant que tu l''éditais. Recharge la page pour voir les changements.'
      using errcode = 'PT409';
  end if;

  if jsonb_array_length(p_rows) = 0 and not p_autoriser_vide then
    if exists (select 1 from public.team_pennants where team_id = p_team_id) then
      raise exception 'NEXUS: Aucun fanion reçu — la liste n''a pas été effacée.';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where coalesce(btrim(r->>'titre'), '') = ''
  ) then
    raise exception 'NEXUS: Chaque fanion doit porter un titre.';
  end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}')
    into v_garde
  from jsonb_array_elements(p_rows) r
  where r->>'id' is not null;

  delete from public.team_pennants
  where team_id = p_team_id and id <> all (v_garde);

  -- `type` retombe sur le défaut de la colonne quand l'éditeur n'envoie rien —
  -- la contrainte team_pennants_type_check n'accepte que championnat/coupe/banniere.
  update public.team_pennants p
     set titre    = btrim(r->>'titre'),
         annee    = nullif(r->>'annee', '')::smallint,
         type     = coalesce(nullif(r->>'type', ''), 'championnat'),
         position = (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where p.team_id = p_team_id
    and r->>'id' is not null
    and p.id = (r->>'id')::uuid
    and (p.titre, p.annee, p.type, p.position)
        is distinct from
        (btrim(r->>'titre'), nullif(r->>'annee','')::smallint,
         coalesce(nullif(r->>'type',''),'championnat'), (r_idx - 1)::int);

  insert into public.team_pennants (team_id, titre, annee, type, position)
  select p_team_id, btrim(r->>'titre'), nullif(r->>'annee','')::smallint,
         coalesce(nullif(r->>'type',''),'championnat'), (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where r->>'id' is null;

  select count(*) into v_n from public.team_pennants where team_id = p_team_id;

  return jsonb_build_object('n', v_n, 'jeton', public.sig_team_pennants(p_team_id));
end $function$;

comment on function public.replace_team_pennants(uuid, jsonb, text, boolean) is
  'Remplace les fanions d''une équipe en une transaction, sous verrou de jeton de contenu.';


revoke all on function public.sig_team_pennants(uuid) from public;
revoke all on function public.sig_team_pennants(uuid) from anon;
grant execute on function public.sig_team_pennants(uuid) to authenticated, service_role;

revoke all on function public.replace_team_pennants(uuid, jsonb, text, boolean) from public;
revoke all on function public.replace_team_pennants(uuid, jsonb, text, boolean) from anon;
grant execute on function public.replace_team_pennants(uuid, jsonb, text, boolean) to authenticated, service_role;
