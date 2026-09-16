-- ═══════════════════════════════════════════════════════════════════════════
-- M10 — Le badge Ambassadeur se pose TOUT SEUL au palier 5, si une place est
-- libre. Décision produit BP, 2026-09-16.
--
-- ⚠ CETTE MIGRATION RENVERSE UNE RÈGLE ÉCRITE EN M6. Elle la réécrit donc,
-- ici et dans les commentaires des deux fonctions concernées : aucune doc
-- contradictoire ne doit survivre à ce fichier. Qui lira M6 après coup y
-- trouvera le renvoi vers ici.
--
-- ── CE QUE M6 DISAIT, ET CE QUI EN RESTE ────────────────────────────────
-- M6 interdisait la pose dans ce trigger, pour trois raisons :
--   1. LE PLAFOND. `badge_plafond` lève, et le trigger étant AFTER,
--      l'exception annulerait la CONFIRMATION elle-même. → RÉSOLU : la pose
--      vit dans un sous-bloc BEGIN/EXCEPTION. Un sous-bloc plpgsql pose un
--      savepoint : l'INSERT du badge est défait seul, le palier et la
--      confirmation survivent. C'est déjà le motif 'plafond' que
--      `ambassadeur_basculer_badge` capture depuis M7.
--   2. « Jamais imposé » (règle BP). → PRÉSERVÉE, et c'est le cœur du
--      dispositif : on ne pose QUE s'il reste une place (< 5 badges vivants).
--      Aucun badge existant n'est jamais retiré, déplacé ni écrasé.
--   3. « Un badge est une place sur une ligne de cinq : le choix appartient à
--      celui qui la porte. » → PRÉSERVÉE AUSSI, dans l'autre sens : quand la
--      ligne est pleine, la machine ne choisit pas à la place de l'athlète.
--      Elle lui dit qu'une place doit se libérer, et lui laisse la main.
--      `ambassadeur_basculer_badge` reste le chemin du retrait ET de la pose
--      manuelle après libération — il n'est pas remplacé, il devient le
--      recours.
--
-- ── POURQUOI LE COMPTE, ET PAS SEULEMENT L'EXCEPTION ────────────────────
-- On pourrait se contenter de tenter l'INSERT et d'avaler le plafond. Le
-- compte préalable (`< 5`) existe pour une autre raison : DISTINGUER « pas de
-- place » d'un vrai incident. Sans lui, les deux arrivent par le même
-- `exception when others` et l'athlète recevrait le même message pour une
-- ligne pleine que pour une identité de service manquante. La course reste
-- possible (un badge posé entre le compte et l'INSERT) — l'exception la
-- rattrape et retombe sur le même message que « pleine », ce qui est le bon
-- message dans ce cas-là.
--
-- ── LE TYPE DE NOTIFICATION NE CHANGE PAS, ET C'EST DÉLIBÉRÉ ────────────
-- Un type dédié (AMBASSADEUR_BADGE_EN_ATTENTE) aurait été plus propre en
-- base. Il est écarté parce que le CLIENT tient une liste FERMÉE de types :
-- app/athlete/notifications/page.tsx câble la couleur (l.72), l'icône (l.94)
-- et le filtre d'onglet (l.151) sur des littéraux. Un type inconnu sortirait
-- de l'onglet « profil » — donc la notification qui demande à l'athlète de
-- libérer une place serait précisément celle qu'il ne verrait pas. On garde
-- AMBASSADEUR_PALIER_5 et on adapte le TEXTE. Le jour où le client apprend
-- un type de plus, cette ligne se relit.
--
-- ── IDEMPOTENCE ─────────────────────────────────────────────────────────
-- Inchangée : `notifie_le` garde la notification, la PK garde le palier. La
-- pose du badge, elle, est protégée par son propre index unique — un rejeu
-- tombe en unique_violation et se lit comme « déjà posé », pas comme un
-- échec.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ambassadeur_recalculer_paliers()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_parrain    uuid;
  v_n          int;
  v_palier     int;
  v_prenom     text;
  v_places     int;
  v_badge      uuid;
  v_service    uuid;
  v_badge_pose boolean;
begin
  v_parrain := coalesce(NEW.parrain_athlete_id, OLD.parrain_athlete_id);
  if v_parrain is null then return null; end if;

  select count(*) into v_n
    from public.ambassadeur_revendications
   where parrain_athlete_id = v_parrain and statut = 'CONFIRMEE';

  select first_name into v_prenom from public.athletes where id = v_parrain;

  foreach v_palier in array array[3, 5, 10] loop
    if v_n >= v_palier then
      insert into public.ambassadeur_paliers (athlete_id, palier)
      values (v_parrain, v_palier)
      on conflict (athlete_id, palier) do nothing;

      -- ── PALIER 5 : la pose automatique, AVANT la notification ──
      -- L'ordre compte : c'est le résultat de la pose qui choisit le texte.
      v_badge_pose := false;
      if v_palier = 5 and exists (
           select 1 from public.ambassadeur_paliers
            where athlete_id = v_parrain and palier = 5 and notifie_le is null)
      then
        begin
          select count(*) into v_places
            from public.athlete_badges
           where athlete_id = v_parrain and retire_le is null;

          if v_places < 5 then
            select id into v_badge   from public.badges where code = 'ambassadeur';
            select id into v_service from public.users  where is_service_identity limit 1;

            if v_badge is not null and v_service is not null then
              insert into public.athlete_badges
                (athlete_id, badge_id, contexte, attribue_par, origine)
              values (v_parrain, v_badge, null, v_service, 'systeme');
              v_badge_pose := true;
            end if;
          end if;
        exception
          when unique_violation then
            -- Déjà porté (l'athlète l'avait posé à la main). L'état voulu est
            -- atteint : on le traite comme une pose réussie.
            v_badge_pose := true;
          when others then
            -- Plafond franchi dans la course, identité de service absente,
            -- autre. Le palier est acquis quoi qu'il arrive.
            v_badge_pose := false;
            raise warning 'ambassadeur_recalculer_paliers: badge palier 5 non pose pour % (%)',
              v_parrain, sqlerrm;
        end;
      end if;

      -- ── Notifications athlète (3 et 5 seulement — cf. CHECK de M1) ──
      if v_palier in (3, 5) and exists (
           select 1 from public.ambassadeur_paliers
            where athlete_id = v_parrain and palier = v_palier and notifie_le is null)
      then
        begin
          insert into public.athlete_notifications (athlete_id, type, title, message, metadata, read)
          values (
            v_parrain,
            case v_palier when 3 then 'AMBASSADEUR_PALIER_3' else 'AMBASSADEUR_PALIER_5' end,
            case
              when v_palier = 3 then 'Trois recrues — ton outil d''ambassadeur est debloque'
              when v_badge_pose then 'Cinq recrues — le badge Ambassadeur est sur ta fiche'
              else                   'Cinq recrues — ton badge Ambassadeur t''attend'
            end,
            case
              when v_palier = 3 then coalesce(v_prenom || ', t', 'T')
                       || 'u as amene trois personnes sur Nexus. Cree ta story et fais-le savoir.'
              when v_badge_pose then 'Il est deja pose : va le voir sur ta fiche. '
                       || 'Tu peux le retirer quand tu veux depuis la page Ambassadeur.'
              else        'Ta ligne de badges est pleine (5 places). Retires-en un depuis ton '
                       || 'profil, puis reviens sur la page Ambassadeur pour poser celui-ci.'
            end,
            jsonb_build_object('palier', v_palier,
                               'badge_pose', case when v_palier = 5 then v_badge_pose else null end,
                               'lien', case v_palier when 3 then '/ma-story'
                                                     else '/athlete/ambassadeur' end),
            false);

          update public.ambassadeur_paliers
             set notifie_le = now()
           where athlete_id = v_parrain and palier = v_palier;
        exception when others then
          raise warning 'ambassadeur_recalculer_paliers: notification palier % non ecrite pour % (%)',
            v_palier, v_parrain, sqlerrm;
        end;
      end if;

      -- ── Palier 10 : la trace administrative ──
      if v_palier = 10 and exists (
           select 1 from public.ambassadeur_paliers
            where athlete_id = v_parrain and palier = 10 and notifie_le is null)
      then
        begin
          insert into public.admin_notifications (type, title, message, related_user_id, read)
          select 'AMBASSADEUR_ELITE',
                 'Palier 10 — post IG à faire',
                 coalesce(a.first_name || ' ' || a.last_name, 'Un athlète')
                   || ' a atteint 10 recrues confirmées. L''écran lui a promis un contact : '
                   || 'demander son @ Instagram et préparer le post sur @nexussportsca. '
                   || 'Suivi dans /admin/ambassadeurs.',
                 a.user_id,
                 false
            from public.athletes a
           where a.id = v_parrain;

          update public.ambassadeur_paliers
             set notifie_le = now()
           where athlete_id = v_parrain and palier = 10;
        exception when others then
          raise warning 'ambassadeur_recalculer_paliers: trace admin palier 10 non ecrite pour % (%)',
            v_parrain, sqlerrm;
        end;
      end if;
    end if;
  end loop;

  return null;
end;
$fn$;

comment on function public.ambassadeur_recalculer_paliers() is
$c$Recompte les revendications CONFIRMEE d'un parrain et inscrit les paliers
franchis.

PALIER 5 — POSE AUTOMATIQUE DU BADGE, SI UNE PLACE EST LIBRE (M10,
2026-09-16). La pose vit dans un sous-bloc BEGIN/EXCEPTION : ni le plafond ni
aucun incident ne peut annuler la confirmation qui l'a declenchee. On ne pose
QUE si l'athlete a moins de 5 badges vivants — aucun badge existant n'est
jamais retire ni ecrase. Ligne pleine : pas de pose, et la notification du
palier 5 demande a l'athlete de liberer une place.

Ceci REMPLACE la regle de M6 (« ce trigger ne pose aucun badge »). Les deux
raisons de fond de M6 sont preservees : rien n'est impose, et le choix de la
place reste a celui qui la porte.

Les paliers ne se defont jamais : une annulation admin baisse le compteur,
pas l'historique.$c$;

comment on function public.ambassadeur_basculer_badge(boolean) is
$c$Pose ou retire le badge Ambassadeur, a la demande de l'athlete.

DEPUIS M10 (2026-09-16) LE BADGE SE POSE DEJA TOUT SEUL au palier 5 quand une
place est libre. Cette RPC n'est donc plus le seul chemin de pose — elle reste
LE chemin du RETRAIT, et le recours pour poser quand la ligne etait pleine au
moment du palier et qu'une place s'est liberee depuis.

La garde du palier reste recalculee SERVEUR : un palier_atteint envoye par le
client serait le badge en libre-service.$c$;

-- ── GATE ────────────────────────────────────────────────────────────────
do $gate$
declare
  v_def text;
  v_poses int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ambassadeur_recalculer_paliers';

  if v_def is null then
    raise exception 'NEXUS: ambassadeur_recalculer_paliers introuvable apres remplacement';
  end if;

  -- UN SEUL bloc de pose. Deux voudrait dire un copier-coller oublie, et le
  -- badge poserait deux fois (ou dans une branche non gardee).
  v_poses := (length(v_def) - length(replace(v_def, 'insert into public.athlete_badges', '')))
             / length('insert into public.athlete_badges');
  if v_poses <> 1 then
    raise exception 'NEXUS: % insert into athlete_badges trouves, 1 attendu', v_poses;
  end if;

  -- La garde de la place libre doit etre la, sinon on impose le badge.
  if position('v_places < 5' in v_def) = 0 then
    raise exception 'NEXUS: la garde « place libre » (v_places < 5) est absente';
  end if;

  -- Le sous-bloc doit capturer le plafond, sinon la confirmation saute.
  if position('when unique_violation then' in v_def) = 0
     or position('when others then' in v_def) = 0 then
    raise exception 'NEXUS: le sous-bloc de pose ne capture pas ses exceptions';
  end if;

  -- Aucun type de notification hors du CHECK de la table.
  if position('AMBASSADEUR_BADGE_EN_ATTENTE' in v_def) > 0 then
    raise exception 'NEXUS: type de notification absent du CHECK de athlete_notifications';
  end if;

  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.ambassadeur_revendications'::regclass
       and t.tgname = 'trg_ambassadeur_paliers'
       and not t.tgisinternal
  ) then
    raise exception 'NEXUS: trg_ambassadeur_paliers absent de ambassadeur_revendications';
  end if;

  raise notice 'NEXUS: M10 posee — 1 bloc de pose, garde de place libre, exceptions capturees, trigger en place.';
end;
$gate$;
