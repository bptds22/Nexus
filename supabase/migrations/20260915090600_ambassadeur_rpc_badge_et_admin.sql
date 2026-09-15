-- ═══════════════════════════════════════════════════════════════════════════
-- M7 — La bascule du badge (athlète) et l'arbitrage (administrateur).
--
-- DEUX FONCTIONS, DEUX MONDES, UN SEUL FICHIER parce qu'elles partagent la
-- même discipline : garde explicite en tête (la RLS ne protège pas une
-- SECURITY DEFINER en row_security off), et unique_violation attrapée dans un
-- bloc INTERNE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. L'athlète porte, ou retire, son badge ─────────────────────────────
--
-- C'EST LA SEULE VOIE D'ATTRIBUTION DU BADGE AMBASSADEUR. Le catalogue le
-- porte en actif = false (M3), donc aucun picker ne le propose — ni au coach,
-- ni à l'admin, ni à l'athlète, ni au binaire mobile en magasin. La garde
-- « palier 5 » vit ICI, et nulle part ailleurs : c'est pour cela qu'aucun
-- autre chemin ne doit exister.
--
-- attribue_par = L'IDENTITÉ DE SERVICE, pas l'athlète. Le badge n'est pas un
-- jugement de quelqu'un, c'est un fait constaté par la plateforme.
-- Conséquence assumée : la policy `athlete_badges retrait` étant
-- `attribue_par = auth.uid() or is_admin()`, l'athlète ne pourra pas le
-- retirer par une autre surface — seulement par cette bascule, et un admin
-- par le picker. C'est le bon comportement pour un badge automatique.
--
-- LE PLAFOND EST ATTRAPÉ, PAS CONTOURNÉ. Quatre athlètes sur cinq portent
-- déjà 5 badges en prod : l'INSERT lèvera couramment. On rend un motif, et
-- l'écran dit quoi faire. Le texte brut du trigger ne sort jamais.
create or replace function public.ambassadeur_basculer_badge(p_actif boolean)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid     uuid;
  v_parrain uuid;
  v_badge   uuid;
  v_service uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NEXUS: tu dois etre connecte.';
  end if;

  select a.id into v_parrain from public.athletes a where a.user_id = v_uid limit 1;
  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete peut porter ce badge.';
  end if;

  select id into v_badge from public.badges where code = 'ambassadeur';
  if v_badge is null then
    -- Le catalogue n'a pas la ligne : on le DIT, on ne laisse pas
    -- badge_contexte_requis lever un message qui parlerait d'un uuid.
    return jsonb_build_object('ok', false, 'motif', 'badge_absent_du_catalogue');
  end if;

  -- ── Retrait ──
  if not coalesce(p_actif, false) then
    update public.athlete_badges
       set retire_le = now(), retire_par = v_uid
     where athlete_id = v_parrain
       and badge_id   = v_badge
       and retire_le is null;
    return jsonb_build_object('ok', true, 'porte', false);
  end if;

  -- ── Pose — la garde du palier, recalculée SERVEUR ──
  -- Jamais depuis le client : un `palier_atteint: true` envoyé par le
  -- navigateur serait le badge en libre-service.
  if not exists (select 1 from public.ambassadeur_paliers
                  where athlete_id = v_parrain and palier = 5) then
    return jsonb_build_object('ok', false, 'motif', 'palier_non_atteint');
  end if;

  select id into v_service from public.users where is_service_identity limit 1;
  if v_service is null then
    raise exception 'NEXUS: identite de service absente — impossible d''attribuer le badge.';
  end if;

  begin
    insert into public.athlete_badges
      (athlete_id, badge_id, contexte, attribue_par, origine)
    values (v_parrain, v_badge, null, v_service, 'systeme');
  exception
    when unique_violation then
      -- Déjà porté. Ce n'est pas une erreur : l'écran voulait cet état.
      return jsonb_build_object('ok', true, 'porte', true, 'motif', 'deja_porte');
    when raise_exception then
      -- badge_plafond. C'est le SEUL NEXUS: atteignable ici :
      -- badge_contexte_requis ne peut pas lever (requiert_contexte = false,
      -- et le badge_id vient d'être résolu au catalogue).
      return jsonb_build_object('ok', false, 'motif', 'plafond');
  end;

  return jsonb_build_object('ok', true, 'porte', true);
end;
$fn$;

revoke all on function public.ambassadeur_basculer_badge(boolean) from public, anon;
grant execute on function public.ambassadeur_basculer_badge(boolean) to authenticated;

comment on function public.ambassadeur_basculer_badge(boolean) is
$c$Pose ou retire le badge Ambassadeur sur l'athlète connecté. Seule voie
d'attribution : le catalogue porte le badge en actif = false, donc aucun
picker ne le propose.

Motifs de refus : palier_non_atteint · plafond (5 badges vivants, toutes
familles — l''athlète doit en retirer un) · badge_absent_du_catalogue.

attribue_par = identité de service (users.is_service_identity), jamais
l''athlète : le badge est un fait de la plateforme, pas un jugement.$c$;

-- ── 2. L'administrateur tranche ──────────────────────────────────────────
--
-- Trois gestes : confirmer une EN_ATTENTE (homonymie départagée), rejeter
-- une EN_ATTENTE, annuler une CONFIRMEE (fraude constatée — décision BP du
-- 2026-09-15 : le rejet est doux, le motif consigné, l'index unique se
-- libère et le compteur du parrain se recalcule au trigger).
create or replace function public.ambassadeur_admin_trancher(
  p_revendication_id   uuid,
  p_action             text,
  p_filleul_athlete_id uuid default null,
  p_raison             text default null)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid uuid;
  v_r   record;
begin
  v_uid := auth.uid();
  -- GARDE EXPLICITE. La fonction est SECURITY DEFINER en row_security off :
  -- les policies de la table ne la protègent PAS. Sans ce test, tout compte
  -- connecté trancherait n'importe quelle revendication via /rest/v1/rpc/.
  if v_uid is null or not public.is_admin() then
    raise exception 'NEXUS: reserve a l''administration.';
  end if;

  select * into v_r from public.ambassadeur_revendications where id = p_revendication_id;
  if v_r.id is null then
    return jsonb_build_object('ok', false, 'motif', 'introuvable');
  end if;

  if p_action = 'confirmer' then
    if v_r.statut <> 'EN_ATTENTE' then
      return jsonb_build_object('ok', false, 'motif', 'statut_incompatible');
    end if;
    if p_filleul_athlete_id is null then
      return jsonb_build_object('ok', false, 'motif', 'filleul_requis');
    end if;
    if p_filleul_athlete_id = v_r.parrain_athlete_id then
      return jsonb_build_object('ok', false, 'motif', 'soi_meme');
    end if;
    if not exists (select 1 from public.athletes
                    where id = p_filleul_athlete_id
                      and status = 'ACTIF' and user_id is not null) then
      return jsonb_build_object('ok', false, 'motif', 'filleul_non_revendicable');
    end if;

    begin
      update public.ambassadeur_revendications
         set filleul_athlete_id = p_filleul_athlete_id,
             statut             = 'CONFIRMEE',
             confirmee_le       = now(),
             methode            = 'admin',
             tranchee_par       = v_uid,
             -- Les candidats écartés sortent de la base : ce sont des
             -- identités de mineurs que plus rien ne rattache à cette ligne.
             candidats          = null
       where id = p_revendication_id;
    exception when unique_violation then
      -- Un autre parrain a confirmé cette personne entre-temps, ou ce parrain
      -- la porte déjà. Motif unique et opaque, comme dans la RPC de saisie.
      return jsonb_build_object('ok', false, 'motif', 'deja_parrainee');
    end;

    return jsonb_build_object('ok', true, 'statut', 'CONFIRMEE');
  end if;

  if p_action in ('rejeter', 'annuler') then
    if v_r.statut = 'REJETEE' then
      return jsonb_build_object('ok', false, 'motif', 'deja_rejetee');
    end if;
    if nullif(btrim(coalesce(p_raison, '')), '') is null then
      return jsonb_build_object('ok', false, 'motif', 'raison_requise');
    end if;

    -- Rejet DOUX : la ligne reste, son filleul reste (les index uniques sont
    -- partiels sur statut <> 'REJETEE', la place se libère d'elle-même).
    -- confirmee_le est remis à NULL pour que ambassadeur_confirmee_coherente
    -- reste vraie et que l'historique ne mente pas.
    update public.ambassadeur_revendications
       set statut       = 'REJETEE',
           raison_rejet = btrim(p_raison),
           tranchee_par = v_uid,
           confirmee_le = null
     where id = p_revendication_id;

    return jsonb_build_object('ok', true, 'statut', 'REJETEE');
  end if;

  return jsonb_build_object('ok', false, 'motif', 'action_inconnue');
end;
$fn$;

revoke all on function public.ambassadeur_admin_trancher(uuid, text, uuid, text) from public, anon;
grant execute on function public.ambassadeur_admin_trancher(uuid, text, uuid, text) to authenticated;

comment on function public.ambassadeur_admin_trancher(uuid, text, uuid, text) is
$c$Arbitrage administratif. Actions : confirmer (départage une homonymie),
rejeter (une EN_ATTENTE), annuler (une CONFIRMEE — fraude constatée).

Le rejet est DOUX : la ligne reste, le motif est consigné, les index uniques
partiels libèrent la personne (ils excluent REJETEE), et le trigger des
paliers recalcule le compteur du parrain. Les paliers déjà franchis, eux,
restent acquis.

is_admin() est testé EN TÊTE : la fonction est SECURITY DEFINER en
row_security off, les policies ne la protègent pas.$c$;
