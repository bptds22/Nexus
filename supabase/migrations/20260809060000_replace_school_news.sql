-- ============================================================================
-- 20260809060000_replace_school_news.sql
--
-- Même patron que 20260808143000_replace_school_cards.sql, appliqué à
-- school_news. Remplace le DELETE-tout + INSERT de saveNews par une RPC
-- transactionnelle sous verrou de jeton de contenu.
--
-- Trois défauts corrigés d'un coup, identiques à ceux des cartes campus :
--   1. MISE À JOUR PERDUE — le second éditeur du CÉGEP détruisait les nouvelles
--      ajoutées par le premier depuis son chargement, sans erreur ni trace.
--   2. DEMI-ÉCHEC — le DELETE était commité avant l'INSERT. Un refus du plafond
--      (trg_cap_news, 5 lignes) laissait la collection VIDE.
--   3. GARDE « LISTE VIDE » ABSENTE — saveNews effaçait tout sur liste vide.
--
-- Éprouvée avant apply en begin;…rollback; : save normal (n=2), jeton périmé
-- refusé en PT409 avec la nouvelle du premier éditeur intacte, plafond refusé
-- avec les 5 lignes intactes, recruteur d'un autre CÉGEP refusé en 42501.
-- ============================================================================

-- ── Jeton de contenu ────────────────────────────────────────────────────────
-- OPAQUE pour le client : il le reçoit au chargement et le rend au save, il ne
-- le calcule jamais. Couvre les champs éditables ET la position, donc un simple
-- réordonnancement est détecté. Collection vide -> md5('') : stable, pas NULL.
create or replace function public.sig_school_news(p_school_id uuid)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select md5(coalesce(
    string_agg(
      n.id::text || '|' || coalesce(n.titre, '') || '|' || coalesce(n.url, '')
                 || '|' || n.position::text,
      E'\n' order by n.position, n.id
    ), ''))
  from public.school_news n
  where n.school_id = p_school_id;
$function$;

comment on function public.sig_school_news(uuid) is
  'Jeton de contenu des nouvelles. Émis au chargement, rendu au save par replace_school_news.';


-- ── Remplacement transactionnel ─────────────────────────────────────────────
-- SECURITY INVOKER (défaut) : la policy news_write reste le contrôle réel, le
-- garde ci-dessous ne sert qu'à produire un refus lisible.
create or replace function public.replace_school_news(
  p_school_id      uuid,
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
  if p_school_id is null then
    raise exception 'NEXUS: Aucune école ciblée — rien n''a été modifié.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'NEXUS: Liste de nouvelles illisible — rien n''a été modifié.';
  end if;

  -- 1. DROITS, en tête : refus net plutôt qu'un DELETE de 0 ligne suivi d'un
  --    INSERT refusé.
  if not public.can_edit_school_page(p_school_id) then
    raise exception 'NEXUS: Tu n''as pas les droits d''édition sur cette école.'
      using errcode = '42501';
  end if;

  -- 2. VERROU DE CONTENU, avant toute écriture.
  v_actuel := public.sig_school_news(p_school_id);
  if p_jeton is null or p_jeton <> v_actuel then
    raise exception 'NEXUS: Quelqu''un a modifié cette section pendant que tu l''éditais. Recharge la page pour voir les changements.'
      using errcode = 'PT409';
  end if;

  -- 3. Garde « liste vide » : on ne bloque que s'il y a quelque chose à perdre.
  if jsonb_array_length(p_rows) = 0 and not p_autoriser_vide then
    if exists (select 1 from public.school_news where school_id = p_school_id) then
      raise exception 'NEXUS: Aucune nouvelle reçue — la liste n''a pas été effacée.';
    end if;
  end if;

  -- 4. titre est NOT NULL en base.
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where coalesce(btrim(r->>'titre'), '') = ''
  ) then
    raise exception 'NEXUS: Chaque nouvelle doit porter un titre.';
  end if;

  -- 5. Ce que l'éditeur conserve.
  select coalesce(array_agg((r->>'id')::uuid), '{}')
    into v_garde
  from jsonb_array_elements(p_rows) r
  where r->>'id' is not null;

  -- 6. Retraits — bornés à CETTE école.
  delete from public.school_news
  where school_id = p_school_id and id <> all (v_garde);

  -- 7. Mises à jour, position comprise (l'éditeur réordonne).
  update public.school_news n
     set titre    = btrim(r->>'titre'),
         url      = nullif(r->>'url', ''),
         position = (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where n.school_id = p_school_id
    and r->>'id' is not null
    and n.id = (r->>'id')::uuid
    and (n.titre, n.url, n.position)
        is distinct from
        (btrim(r->>'titre'), nullif(r->>'url',''), (r_idx - 1)::int);

  -- 8. Ajouts.
  insert into public.school_news (school_id, titre, url, position)
  select p_school_id, btrim(r->>'titre'), nullif(r->>'url',''), (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where r->>'id' is null;

  select count(*) into v_n from public.school_news where school_id = p_school_id;

  -- Le compte ET le nouveau jeton : sans lui, un second « Enregistrer » dans la
  -- même session se heurterait à son propre changement.
  return jsonb_build_object('n', v_n, 'jeton', public.sig_school_news(p_school_id));
end $function$;

comment on function public.replace_school_news(uuid, jsonb, text, boolean) is
  'Remplace les nouvelles d''une école en une transaction, sous verrou de jeton de contenu.';


-- ── Droits ──────────────────────────────────────────────────────────────────
-- REVOKE PUBLIC ne retire PAS un grant nominatif anon : les deux sont requis.
revoke all on function public.sig_school_news(uuid) from public;
revoke all on function public.sig_school_news(uuid) from anon;
grant execute on function public.sig_school_news(uuid) to authenticated, service_role;

revoke all on function public.replace_school_news(uuid, jsonb, text, boolean) from public;
revoke all on function public.replace_school_news(uuid, jsonb, text, boolean) from anon;
grant execute on function public.replace_school_news(uuid, jsonb, text, boolean) to authenticated, service_role;
