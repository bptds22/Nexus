-- ============================================================================
-- 20260808143000_replace_school_cards.sql
--
-- Remplace le DELETE-tout + INSERT de saveCards (lib/queries/schoolPage/
-- schoolPageData.ts) par une RPC transactionnelle sous verrou de jeton de
-- contenu. Patron : replace_school_programs.
--
-- Trois défauts corrigés d'un coup :
--   1. MISE À JOUR PERDUE — deux éditeurs du même CÉGEP (coordonnateur
--      offensif / défensif) partagent la page. Le second qui enregistrait
--      détruisait les cartes ajoutées par le premier depuis son chargement,
--      sans erreur ni trace. Le jeton rend le conflit VISIBLE.
--   2. DEMI-ÉCHEC — le DELETE était commité avant l'INSERT. Un refus du
--      plafond (trg_cap_campus_cards) laissait la collection VIDE. Tout se
--      joue désormais dans une seule transaction.
--   3. GARDE « LISTE VIDE » ABSENTE — saveCards effaçait tout sur une liste
--      vide, sans la protection que savePrograms possède déjà.
--
-- Éprouvé avant apply : save normal / jeton périmé / plafond / recruteur d'un
-- autre CÉGEP — 5 assertions, dans un begin;…rollback;.
--
-- saveNeeds est HORS PÉRIMÈTRE : upsert sur UNIQUE(team_id, slot_key), il ne
-- détruit aucune ligne. Même profil que les tables 1:1, laissées sans verrou.
-- ============================================================================

-- ── Signature de contenu ────────────────────────────────────────────────────
-- Jeton OPAQUE pour le client : il le reçoit au chargement et le rend au save,
-- il ne le calcule JAMAIS. Aucune double implémentation à garder d'accord —
-- c'est le piège classique du hash calculé des deux côtés.
-- Couvre les champs éditables ET la position : un simple réordonnancement est
-- donc détecté. Collection vide -> md5('') : valeur stable, pas NULL.
create or replace function public.sig_school_cards(p_school_id uuid)
returns text
language sql
stable
set search_path to 'public'
as $$
  select md5(coalesce(
    string_agg(
      c.id::text
        || '|' || coalesce(c.titre, '')
        || '|' || coalesce(c.legende, '')
        || '|' || coalesce(c.image_path, '')
        || '|' || c.position::text,
      E'\n' order by c.position, c.id
    ), ''))
  from public.school_campus_cards c
  where c.school_id = p_school_id;
$$;

comment on function public.sig_school_cards(uuid) is
  'Jeton de contenu des cartes campus. Émis au chargement, rendu au save par replace_school_cards.';


-- ── Remplacement transactionnel ─────────────────────────────────────────────
-- SECURITY INVOKER (défaut), comme replace_school_programs : la policy
-- campus_cards_write reste le contrôle réel. Le garde ci-dessous ne sert qu'à
-- produire un refus lisible plutôt qu'un demi-échec silencieux.
create or replace function public.replace_school_cards(
  p_school_id      uuid,
  p_rows           jsonb,
  p_jeton          text,
  p_autoriser_vide boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_garde  uuid[];
  v_actuel text;
  v_n      integer;
begin
  if p_school_id is null then
    raise exception 'NEXUS: Aucune école ciblée — rien n''a été modifié.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'NEXUS: Liste de cartes illisible — rien n''a été modifié.';
  end if;

  -- 1. DROITS, en tête. Sans ce garde, un appelant non autorisé obtiendrait un
  --    DELETE de 0 ligne suivi d'un INSERT refusé : un demi-échec silencieux
  --    plutôt qu'un refus net.
  if not public.can_edit_school_page(p_school_id) then
    raise exception 'NEXUS: Tu n''as pas les droits d''édition sur cette école.'
      using errcode = '42501';
  end if;

  -- 2. VERROU DE CONTENU, avant toute écriture. Un refus ici ne touche pas une
  --    seule ligne — c'est tout l'intérêt de le placer à cet endroit.
  v_actuel := public.sig_school_cards(p_school_id);
  if p_jeton is null or p_jeton <> v_actuel then
    raise exception 'NEXUS: Quelqu''un a modifié cette section pendant que tu l''éditais. Recharge la page pour voir les changements.'
      using errcode = 'PT409';
  end if;

  -- 3. Garde « liste vide » : on ne bloque que s'il y a quelque chose à perdre.
  if jsonb_array_length(p_rows) = 0 and not p_autoriser_vide then
    if exists (select 1 from public.school_campus_cards where school_id = p_school_id) then
      raise exception 'NEXUS: Aucune carte reçue — la liste n''a pas été effacée.';
    end if;
  end if;

  -- 4. titre est NOT NULL en base : on refuse proprement plutôt que de laisser
  --    remonter une violation not-null illisible.
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where coalesce(btrim(r->>'titre'), '') = ''
  ) then
    raise exception 'NEXUS: Chaque carte campus doit porter un titre.';
  end if;

  -- 5. Ce que l'éditeur conserve (lignes déjà en base).
  select coalesce(array_agg((r->>'id')::uuid), '{}')
    into v_garde
  from jsonb_array_elements(p_rows) r
  where r->>'id' is not null;

  -- 6. Retraits — bornés à CETTE école par la clause elle-même.
  delete from public.school_campus_cards
  where school_id = p_school_id and id <> all (v_garde);

  -- 7. Mises à jour, position comprise : l'éditeur réordonne, et la position
  --    fait partie du jeton, donc elle doit être écrite comme le reste.
  --    `is distinct from` évite de réécrire les lignes inchangées.
  update public.school_campus_cards c
     set titre      = btrim(r->>'titre'),
         legende    = r->>'legende',
         image_path = nullif(r->>'image_path', ''),
         position   = (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where c.school_id = p_school_id
    and r->>'id' is not null
    and c.id = (r->>'id')::uuid
    and (c.titre, c.legende, c.image_path, c.position)
        is distinct from
        (btrim(r->>'titre'), r->>'legende', nullif(r->>'image_path',''), (r_idx - 1)::int);

  -- 8. Ajouts. `position` reprend l'ordre du tableau reçu.
  insert into public.school_campus_cards (school_id, titre, legende, image_path, position)
  select p_school_id, btrim(r->>'titre'), r->>'legende',
         nullif(r->>'image_path',''), (r_idx - 1)::int
  from jsonb_array_elements(p_rows) with ordinality as t(r, r_idx)
  where r->>'id' is null;

  select count(*) into v_n
  from public.school_campus_cards where school_id = p_school_id;

  -- Le compte ET le nouveau jeton : sans ce dernier, un second « Enregistrer »
  -- dans la même session se heurterait à son propre changement.
  return jsonb_build_object('n', v_n, 'jeton', public.sig_school_cards(p_school_id));
end $$;

comment on function public.replace_school_cards(uuid, jsonb, text, boolean) is
  'Remplace les cartes campus d''une école en une transaction, sous verrou de jeton de contenu.';


-- ── Droits ──────────────────────────────────────────────────────────────────
-- REVOKE PUBLIC ne retire PAS un grant nominatif anon : les deux sont requis.
-- (replace_school_programs porte aujourd'hui « anon=X/postgres » faute de ça.)
revoke all on function public.sig_school_cards(uuid) from public;
revoke all on function public.sig_school_cards(uuid) from anon;
grant execute on function public.sig_school_cards(uuid) to authenticated, service_role;

revoke all on function public.replace_school_cards(uuid, jsonb, text, boolean) from public;
revoke all on function public.replace_school_cards(uuid, jsonb, text, boolean) from anon;
grant execute on function public.replace_school_cards(uuid, jsonb, text, boolean) to authenticated, service_role;
