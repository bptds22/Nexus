-- ═══════════════════════════════════════════════════════════════════════════
-- ANNULATION EXPLICITE du seuil de test ambassadeur — retour à M10 finale.
--
-- Annule `TEMPORAIRE_ambassadeur_seuil_test_palier5_a_2`, appliquée en prod le
-- 2026-09-16 à 13:38:49 UTC. Celle-là abaissait le seuil du palier 5 à DEUX
-- confirmées pour vérifier, sur le seul compte de BP (athlete d4cd6432), que
-- la pose automatique du badge fonctionne bout en bout.
--
-- LE TEST EST VERT, et voici ce qu'il a prouvé :
--   paliers      : 5 atteint_le=2026-09-16 13:39:02  notifie_le=13:39:02
--   notification : AMBASSADEUR_PALIER_5 | « le badge Ambassadeur est sur ta
--                  fiche » | badge_pose=true
--   badge        : POSÉ, origine=systeme
--   plafond      : 4 → 5 badges vivants, jamais 6
-- Les quatre lignes de test ont ensuite été retirées (badge, palier,
-- notification) et les deux revendications CONFIRMÉE laissées intactes.
--
-- La fenêtre se referme ici : les seuils redeviennent [3, 5, 10] POUR TOUT LE
-- MONDE. Le corps ci-dessous est celui de M10
-- (20260916140000_ambassadeur_badge_auto_palier5) au caractère près ; la seule
-- différence avec la version TEMPORAIRE est la disparition de `v_seuil` et du
-- `case v_palier when 5 then 2 else v_palier end`.
--
-- ⚠ CE QUE `v_seuil` A APPRIS, ET QUI RESSERVIRA. La version de test s'écrivait
-- d'abord `if v_n >= case v_palier when 5 then 2 ... end then`. PostgreSQL l'a
-- refusée : « syntax error at end of input ». L'analyseur plpgsql termine
-- l'expression d'un IF au PREMIER `THEN` rencontré — celui du CASE. Un CASE
-- dans une condition IF doit passer par une variable ou des parenthèses. Ce
-- n'était pas l'outil qui rognait l'envoi, c'était le langage.
--
-- L'historique des migrations dit donc, dans l'ordre :
--   20260916133613  ambassadeur_badge_auto_palier5                  (la règle)
--   20260916133849  TEMPORAIRE_ambassadeur_seuil_test_palier5_a_2   (le test)
--   20260916134500  annule_TEMPORAIRE_seuil_test_ambassadeur        (la fermeture)
--
-- ⚠ ÉCART DE NOMMAGE À CONNAÎTRE : les versions posées par `apply_migration`
-- sont horodatées par Supabase à l'instant de l'envoi (…133613, …133849), pas
-- par le nom du fichier miroir. Les deux ne coïncident pas au chiffre près ;
-- c'est l'ORDRE qui fait foi, et il est correct.
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

-- ── GATE : plus aucun seuil de test, et M10 entière ──
DO $gate$
DECLARE
  v_def text;
  v_poses int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ambassadeur_recalculer_paliers';

  IF position('when 5 then 2' in v_def) > 0 OR position('v_seuil' in v_def) > 0 THEN
    RAISE EXCEPTION 'NEXUS: le seuil de TEST survit à la migration de nettoyage';
  END IF;

  v_poses := (length(v_def) - length(replace(v_def, 'insert into public.athlete_badges', '')))
             / length('insert into public.athlete_badges');
  IF v_poses <> 1 THEN
    RAISE EXCEPTION 'NEXUS: % insert into athlete_badges trouvés, 1 attendu', v_poses;
  END IF;
  IF position('v_places < 5' in v_def) = 0 THEN
    RAISE EXCEPTION 'NEXUS: la garde « place libre » est absente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.ambassadeur_revendications'::regclass
       AND t.tgname = 'trg_ambassadeur_paliers' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'NEXUS: trg_ambassadeur_paliers absent';
  END IF;

  RAISE NOTICE 'NEXUS: seuil de test annulé — M10 finale, seuils [3, 5, 10] pour tous.';
END;
$gate$;
