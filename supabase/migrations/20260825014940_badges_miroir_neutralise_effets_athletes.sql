-- ═══════════════════════════════════════════════════════════════
-- Le miroir ne doit RIEN changer sur public.athletes.
--
-- ── CE QUI A ÉTÉ TROUVÉ ──────────────────────────────────────────
-- calc_cote_globale (BEFORE INSERT OR UPDATE sur evaluations, SANS clause
-- WHEN) se termine invariablement par :
--     UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale ...
-- Le miroir écrit sur TOUTES les lignes evaluations d'un athlète. Deux
-- athlètes en production ont plusieurs évaluations à cotes DIVERGENTES :
--     Gabriel Mandziuk  3.00 (récente) / 4.00 (ancienne)  → dénorm. 3.00
--     Athlete Nexus     5.00 (récente) / 4.60 (ancienne)  → dénorm. 5.00
-- La colonne dénormalisée vaut aujourd'hui la cote de l'évaluation la plus
-- récente, ce que retient selectBestEvaluation. Sans cette migration, poser un
-- badge ferait écrire les deux lignes dans un ordre NON GARANTI : la cote
-- affichée de Gabriel passerait à 4.00 selon l'ordre choisi par le planificateur.
-- Un badge qui modifie une note montrée aux recruteurs.
--
-- Trois triggers AFTER UPDATE sur athletes auraient suivi :
--   · log_athlete_update — garde `cote_globale_entraineur IS DISTINCT FROM` :
--     aurait inséré un 'PROFILE_UPDATED' dans recruiter_activity_log pour
--     CHAQUE recruteur ayant mis l'athlète en favori, à chaque badge posé.
--   · emit_five_star_newsroom_event — `AFTER UPDATE OF cote_globale_entraineur`.
--     Ses gardes (NEW>=4.5 et NON OLD>=4.5) épargnent les données ACTUELLES,
--     par chance et non par construction : un athlète à 4.40 ayant une seconde
--     évaluation à 4.60 aurait vu un badge publier « atteint 5 étoiles » au
--     fil d'actualité public.
--   · log_coach_activity_verified — gardé sur `verified`, jamais concerné.
--
-- ── POURQUOI CE CORRECTIF-CI ─────────────────────────────────────
-- calc_cote_globale est hors périmètre et le reste : elle sert tout le calcul
-- de cote, bien au-delà des badges. On neutralise donc son effet de bord côté
-- athletes, sous le MÊME drapeau que pour updated_at, plutôt que de la modifier
-- ou de jouer sur l'ordre des lignes mises à jour (qu'aucun ORDER BY ne rend
-- déterministe dans un UPDATE).
--
-- Effet : pendant une écriture du miroir, la ligne athletes est réécrite à
-- l'identique. Toutes les gardes `IS DISTINCT FROM` des triggers AFTER sont
-- alors fausses — aucun journal, aucun événement, aucune cote déplacée.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.preserve_athlete_denorm_si_miroir()
  returns trigger language plpgsql
as $fn$
begin
  if coalesce(current_setting('nexus.mirror_write', true), '') = 'on' then
    -- Les deux seules colonnes qu'une écriture du miroir peut atteindre :
    -- cote_globale_entraineur (par calc_cote_globale) et updated_at (par
    -- set_updated_at). calculate_profile_completion recalcule à partir de
    -- champs que le miroir ne touche pas et rend donc la même valeur.
    new.cote_globale_entraineur := old.cote_globale_entraineur;
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$fn$;

-- ⚠⚠ NOM FONCTIONNEL — MÊME PIÈGE QUE trg_zz_preserve_updated_at ⚠⚠
-- Les triggers BEFORE se déclenchent dans l'ORDRE ALPHABÉTIQUE. Sur athletes :
--   trg_athletes_updated_at < trg_notify_parent_on_minor
--     < trg_profile_completion < trg_zz_preserve_athlete_denorm
-- Le « zz » garantit le dernier mot. Renommer ce trigger en quelque chose qui
-- trie avant `trg_athletes_updated_at` casse la garantie EN SILENCE.
create trigger trg_zz_preserve_athlete_denorm
  before update on public.athletes
  for each row execute function public.preserve_athlete_denorm_si_miroir();