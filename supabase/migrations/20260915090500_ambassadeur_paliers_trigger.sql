-- ═══════════════════════════════════════════════════════════════════════════
-- M6 — Les paliers : recompte, franchissement, notification.
--
-- CE TRIGGER NE POSE AUCUN BADGE. Le palier 5 rend le badge DISPONIBLE ;
-- c'est l'athlète qui décide de le porter, par ambassadeur_basculer_badge()
-- (M7). Trois raisons, et la première suffirait :
--
--   1. LE PLAFOND. 5 badges vivants maximum, toutes familles (20260826010127).
--      Quatre athlètes sur cinq y sont DÉJÀ en prod. Une pose automatique
--      ferait lever badge_plafond, et comme le trigger est AFTER INSERT,
--      l'exception annulerait TOUTE la transaction — donc la CONFIRMATION de
--      la revendication elle-même. L'athlète perdrait son palier sans rien
--      comprendre. Le badge doit vivre hors de cette transaction.
--   2. « Jamais imposé » (règle BP).
--   3. Un badge est une place sur une ligne de cinq : le choix appartient à
--      celui qui la porte.
--
-- IDEMPOTENCE STRUCTURELLE : la clé primaire (athlete_id, palier) + un
-- `on conflict do nothing`. Le trigger peut rejouer autant qu'il veut.
--
-- LES PALIERS NE SE DÉFONT PAS. Une annulation administrative fait BAISSER le
-- compteur, mais la ligne de palier reste. Défaire un palier retirerait un
-- badge déjà posé et démentirait une notification déjà lue — on ne réécrit
-- pas le passé d'un jeune de 16 ans pour un ajustement de compteur. Le
-- compteur, lui, est bien recalculé : c'est ce que montre l'onglet admin.
--
-- PALIER 10 : aucune notification à l'ATHLÈTE (le CHECK de M1 ne porte que
-- _3 et _5, délibérément) — mais une ALERTE ADMIN, ajoutée le 2026-09-15.
--
-- POURQUOI ELLE N'ÉTAIT PAS LÀ, ET POURQUOI ELLE L'EST MAINTENANT. La version
-- initiale disait « la ligne de palier suffit, l'onglet Ambassadeurs la lit ».
-- C'était vrai tant que l'écran ne promettait rien. Depuis, la carte du palier
-- 10 dit à l'athlète que « l'équipe Nexus te contacte dans les prochains
-- jours » : une promesse faite à un jeune que RIEN ne déclenchait. On ne met
-- pas ça en production.
--
-- ⚠ CE QUE CETTE LIGNE NE SUFFIT PAS À FAIRE — lire docs/ ou le rapport :
-- `public.admin_notifications` est un TROU NOIR. Deux écrans y écrivent
-- (demandes d'accès Loi 25 dans ConfidentialiteSection, demandes de transfert
-- dans TransfertSection) et AUCUN ne la lit. En prod elle porte la RLS
-- ACTIVÉE avec ZÉRO policy : même un écran admin ne pourrait pas la lire sous
-- `authenticated`. 35 lignes y dorment déjà.
-- La trace écrite ici est donc un JOURNAL, pas une alerte. Ce qui tient
-- réellement la promesse, c'est le marqueur « post IG à faire » de l'onglet
-- /admin/ambassadeurs, qui lit `ambassadeur_paliers` (policy is_admin()) et
-- `ambassadeur_suivi.post_ig_le` — deux tables réellement lisibles.
--
-- `type` n'a AUCUN check en base (vérifié) : pas de piège à la M1 ici.
-- `related_user_id` n'a pas de FK non plus — on y met donc le `user_id` du
-- parrain, PAS son athlete_id, sous peine d'un identifiant qui ne désigne
-- rien dans la table qu'il prétend référencer.
--
-- L'ÉCRITURE DE NOTIFICATION EST ENVELOPPÉE. Une notification ne doit jamais
-- faire échouer l'action qu'elle annonce. Mais c'est précisément ce qui rend
-- un type absent du CHECK invisible (cf. M1) : d'où `notifie_le`, qui reste
-- NULL en cas d'échec et rend le trou LISIBLE au lieu de le taire.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ambassadeur_recalculer_paliers()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_parrain uuid;
  v_n       int;
  v_palier  int;
  v_prenom  text;
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

      -- Notification seulement si la ligne vient d'être créée ET n'a pas
      -- encore été annoncée. Les deux conditions : le `do nothing` ci-dessus
      -- ne dit pas s'il a inséré, et un rejeu ne doit pas re-notifier.
      if v_palier in (3, 5) and exists (
           select 1 from public.ambassadeur_paliers
            where athlete_id = v_parrain and palier = v_palier and notifie_le is null)
      then
        begin
          insert into public.athlete_notifications (athlete_id, type, title, message, metadata, read)
          values (
            v_parrain,
            case v_palier when 3 then 'AMBASSADEUR_PALIER_3' else 'AMBASSADEUR_PALIER_5' end,
            case v_palier
              when 3 then 'Trois recrues — ton outil d''ambassadeur est debloque'
              else        'Cinq recrues — le badge Ambassadeur est a toi' end,
            case v_palier
              when 3 then coalesce(v_prenom || ', t', 'T')
                       || 'u as amene trois personnes sur Nexus. Cree ta story et fais-le savoir.'
              else        'Tu peux maintenant porter le badge Ambassadeur sur ta fiche. '
                       || 'Il prend une des cinq places de ta ligne de badges — a toi de choisir.' end,
            jsonb_build_object('palier', v_palier,
                               'lien', case v_palier when 3 then '/ma-story'
                                                     else '/athlete/ambassadeur' end),
            false);

          update public.ambassadeur_paliers
             set notifie_le = now()
           where athlete_id = v_parrain and palier = v_palier;
        exception when others then
          -- Le palier est acquis quoi qu'il arrive. notifie_le reste NULL :
          -- le trou est lisible, et un rejeu reste possible.
          raise warning 'ambassadeur_recalculer_paliers: notification palier % non ecrite pour % (%)',
            v_palier, v_parrain, sqlerrm;
        end;
      end if;

      -- ── Palier 10 : la trace administrative ──
      -- Même enveloppe que ci-dessus : une trace ne doit jamais faire échouer
      -- le franchissement qu'elle documente. Même garde d'idempotence par
      -- notifie_le — la ligne de palier n'est marquée qu'une fois, donc on
      -- n'empile pas un rappel à chaque nouvelle recrue au-delà de dix.
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
                 -- user_id, PAS athlete_id : related_user_id designe un compte.
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

-- AFTER : le compte doit inclure la ligne qu'on vient d'écrire.
-- INSERT couvre la confirmation instantanée (concordance forte) ;
-- UPDATE OF statut couvre l'arbitrage admin — dans les deux sens, puisqu'une
-- annulation doit faire redescendre le compteur affiché.
-- `drop if exists` avant le create : sans lui la migration n'est PAS
-- rejouable — elle passe sur une base vierge (le seul cas qui compte en prod)
-- mais lève « trigger already exists » dès qu'on la relance en local, ce qui
-- arrive à chaque fois qu'on corrige la fonction au-dessus. Le coût est nul,
-- l'aller-retour perdu ne l'est pas.
drop trigger if exists trg_ambassadeur_paliers on public.ambassadeur_revendications;
create trigger trg_ambassadeur_paliers
  after insert or update of statut on public.ambassadeur_revendications
  for each row execute function public.ambassadeur_recalculer_paliers();

comment on function public.ambassadeur_recalculer_paliers() is
$c$Recompte les revendications CONFIRMEE d'un parrain et inscrit les paliers
franchis. NE POSE AUCUN BADGE — le palier 5 rend le badge disponible, la pose
appartient à l'athlete (ambassadeur_basculer_badge). Une pose ici ferait lever
badge_plafond et annulerait la confirmation elle-meme.

Les paliers ne se defont jamais : une annulation admin baisse le compteur,
pas l'historique.$c$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_ambassadeur_paliers') then
    raise exception 'NEXUS: le trigger des paliers n''est pas pose.';
  end if;
  raise notice 'NEXUS: trigger des paliers pose (3, 5, 10 — notifications sur 3 et 5).';
end $$;
