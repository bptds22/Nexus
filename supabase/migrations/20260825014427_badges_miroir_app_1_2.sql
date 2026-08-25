-- ═══════════════════════════════════════════════════════════════
-- MIROIR vers evaluations.distinctions — pour l'app mobile 1.2 EN MAGASIN.
--
-- La 1.2 lit evaluations.distinctions et ne connaîtra JAMAIS athlete_badges.
-- Tant qu'elle est distribuée, la colonne doit rester juste. Trois pièges,
-- traités ici explicitement.
--
-- ── PIÈGE 1 : les codes que la 1.2 ne connaît pas ────────────────
-- Son parseDistinctions filtre sur un BADGE_CONFIG à 7 entrées et JETTE
-- silencieusement tout code inconnu. Sur les 22, six seulement ont un
-- équivalent. Le miroir n'écrit QUE ces six et laisse tomber les seize autres.
--
-- Pourquoi ne pas rapprocher les autres d'un code voisin : afficher un badge
-- que le coach n'a pas donné est une erreur d'information sur un MINEUR montré
-- à des recruteurs. Un badge absent est une lacune ; un badge faux est une
-- faute. Les seize sont invisibles sur 1.2, visibles sur web et sur la 1.3.
--
-- ── PIÈGE 2 : la troncature à 5 ──────────────────────────────────
-- Les honneurs étant hors plafond, un athlète peut avoir 8 badges côté web
-- alors que la 1.2 n'en montre que 5. On ne peut pas l'empêcher — on rend la
-- coupe PRÉVISIBLE : honneurs d'abord, puis universels, puis sport. La 1.2
-- tronque donc dans le moins signifiant, pas au hasard de l'insertion.
--
-- ── PIÈGE 3 : updated_at ─────────────────────────────────────────
-- Écrire distinctions déclenche set_updated_at (BEFORE UPDATE, inconditionnel,
-- partagé par 13 triggers du schéma) : la ligne touchée deviendrait la plus
-- récente et selectBestEvaluation basculerait dessus. C'est le piège qui a
-- déjà mordu deux fois. On le neutralise SANS toucher set_updated_at, dont la
-- portée dépasse largement les badges.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Restauration d'updated_at, sous drapeau ───────────────────
create or replace function public.preserve_updated_at_si_miroir()
  returns trigger language plpgsql
as $fn$
begin
  -- Drapeau posé par le miroir via set_config(..., true) : LOCAL à la
  -- transaction, donc jamais rémanent d'une requête à l'autre.
  if coalesce(current_setting('nexus.mirror_write', true), '') = 'on' then
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$fn$;

-- ⚠⚠ LE NOM DE CE TRIGGER EST FONCTIONNEL, PAS DÉCORATIF ⚠⚠
-- PostgreSQL déclenche les triggers BEFORE dans l'ORDRE ALPHABÉTIQUE de leur
-- nom. Sur evaluations :
--     trg_cote_globale  <  trg_evaluations_updated_at  <  trg_zz_preserve_updated_at
-- Le « zz » garantit qu'il passe APRÈS set_updated_at et peut donc défaire ce
-- que celui-ci vient d'écrire. LE RENOMMER EN QUELQUE CHOSE QUI TRIE AVANT
-- « trg_evaluations_updated_at » CASSE LA GARANTIE EN SILENCE : updated_at
-- serait de nouveau bumpé, et le jeu de badges affiché basculerait au gré des
-- écritures du miroir. Aucun test ne l'attraperait — vérifier l'ordre avec :
--     select tgname from pg_trigger where tgrelid='public.evaluations'::regclass
--       and not tgisinternal order by tgname;
create trigger trg_zz_preserve_updated_at
  before update on public.evaluations
  for each row execute function public.preserve_updated_at_si_miroir();

-- ── 2. Pas de fausse activité BADGE_EARNED ───────────────────────
-- Le miroir modifie distinctions à chaque changement de badge : sans garde,
-- log_coach_activity_badge écrirait une activité par écriture du miroir.
-- SEULE la garde est ajoutée. Les deux défauts connus de cette fonction sont
-- CONSERVÉS TELS QUELS, sur consigne :
--   · elle se déclenche AU RETRAIT (garde `IS DISTINCT FROM`, pas « a gagné »)
--     et écrit 'BADGE_EARNED' pour une perte — le type ment ;
--   · actor_id = athletes.coach_id, pas l'auteur réel : quand le directeur
--     pose un badge, l'activité crédite le coach propriétaire.
-- Les deux disparaîtront quand les activités seront émises depuis
-- athlete_badges, où attribue_par donne l'auteur véritable.
create or replace function public.log_coach_activity_badge()
  returns trigger language plpgsql
  security definer set row_security to 'off' set search_path to 'public'
as $fn$
DECLARE
  v_athlete RECORD;
BEGIN
  -- AJOUT 2026-08-25 : une écriture du miroir n'est pas un geste de coach.
  IF coalesce(current_setting('nexus.mirror_write', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- Only fire if distinctions actually changed
  IF (OLD.distinctions IS DISTINCT FROM NEW.distinctions) AND NEW.distinctions IS NOT NULL THEN
    SELECT first_name, last_name, coach_id
    INTO v_athlete
    FROM athletes
    WHERE id = NEW.athlete_id;

    IF v_athlete.coach_id IS NOT NULL THEN
      INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
      VALUES (
        'BADGE_EARNED',
        v_athlete.coach_id,
        'coach',
        NEW.athlete_id,
        v_athlete.coach_id,
        jsonb_build_object(
          'first_name', v_athlete.first_name,
          'last_name', v_athlete.last_name,
          'distinctions', NEW.distinctions
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- ── 3. Le miroir ─────────────────────────────────────────────────
create or replace function public.badges_vers_distinctions(p_athlete_id uuid)
  returns void language plpgsql
  security definer set row_security to 'off' set search_path to 'public'
as $fn$
declare v_json jsonb;
begin
  -- Les six codes rétro-compatibles, dédoublonnés sur le code ANCIEN :
  -- MVP 2025 et MVP 2026 sont deux badges pour nous, un seul pour la 1.2
  -- (son catalogue n'a pas de millésime). On garde le premier dans l'ordre.
  with corr(code_neuf, code_ancien, porte_detail) as (
    values ('mvp','mvp',false), ('leader-equipe','team_leader',true),
           ('leader-ligue','league_leader',true), ('equipe-etoiles','allstar',false),
           ('nexus-x','custom',true), ('capitaine','captain',false)
  ),
  vivants as (
    select c.code_ancien, c.porte_detail, ab.contexte,
           -- honneur(0) < universel(1) < sport(2), puis l'ordre du catalogue
           case b.famille when 'honneur' then 0 when 'universel' then 1 else 2 end as rang,
           b.ordre,
           row_number() over (
             partition by c.code_ancien
             order by case b.famille when 'honneur' then 0 when 'universel' then 1 else 2 end,
                      b.ordre, ab.created_at
           ) as rn
    from public.athlete_badges ab
    join public.badges b on b.id = ab.badge_id
    join corr c on c.code_neuf = b.code
    where ab.athlete_id = p_athlete_id
      and ab.retire_le is null
  )
  select coalesce(jsonb_agg(
           case when porte_detail and coalesce(btrim(contexte),'') <> ''
                then jsonb_build_object('badge', code_ancien, 'detail', contexte)
                else jsonb_build_object('badge', code_ancien) end
           order by rang, ordre
         ), '[]'::jsonb)
    into v_json
  from vivants where rn = 1;

  -- Écrit sur TOUTES les évaluations de l'athlète : quelle que soit la ligne
  -- que selectBestEvaluation retiendra, elle portera le même jeu. Le problème
  -- « quelle ligne gagne » disparaît au lieu d'être arbitré.
  perform set_config('nexus.mirror_write', 'on', true);
  update public.evaluations
     set distinctions = v_json
   where athlete_id = p_athlete_id
     and distinctions is distinct from v_json;   -- pas d'écriture inutile
  perform set_config('nexus.mirror_write', '', true);
end;
$fn$;

revoke all on function public.badges_vers_distinctions(uuid) from public, anon;

create or replace function public.trg_badges_vers_distinctions()
  returns trigger language plpgsql
  security definer set search_path to 'public'
as $fn$
begin
  perform public.badges_vers_distinctions(coalesce(new.athlete_id, old.athlete_id));
  return null;
end;
$fn$;

create trigger trg_athlete_badges_miroir
  after insert or update or delete on public.athlete_badges
  for each row execute function public.trg_badges_vers_distinctions();

comment on function public.badges_vers_distinctions(uuid) is
$c$Recompose evaluations.distinctions depuis athlete_badges, pour l'app mobile
1.2 en magasin.

N'écrit QUE les six codes rétro-compatibles (capitaine, equipe-etoiles, mvp,
leader-equipe, leader-ligue, nexus-x). Les seize autres sont invisibles sur
1.2 — décision assumée : un badge faux vaut pire qu'un badge absent.

Ordre : honneurs, puis universels, puis sport — pour que la troncature à 5 de
la 1.2 coupe dans le moins signifiant.

Écrit sur TOUTES les lignes evaluations de l'athlète, et préserve updated_at
via le drapeau nexus.mirror_write (voir trg_zz_preserve_updated_at, dont le
nom conditionne l'ordre de déclenchement).

LIMITE CONNUE : un athlète SANS aucune ligne evaluations n'a rien à mirroiter.
Ses badges seront invisibles sur 1.2 jusqu'à sa première évaluation.$c$;