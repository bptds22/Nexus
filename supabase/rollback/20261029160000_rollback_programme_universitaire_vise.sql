-- Rollback de 20261029160000_programme_universitaire_vise : complétion d'origine (md5 41d6dbdfd31e3f15979a2e825c194a2c), trigger,
-- fonctions et colonnes retirés. Les programmes visés saisis entre l'apply et le rollback sont PERDUS.

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '7ac5adb821b7f8b04bdf21617a008932' then
    raise exception 'NEXUS: calculate_profile_completion n''est pas le corps de 20261029160000';
  end if;
end $$;

create or replace function public.calculate_profile_completion()
 returns trigger
 language plpgsql
as $function$
DECLARE
  simplified_count INTEGER := 0;
  detailed_count INTEGER := 0;
  video_bonus INTEGER := 0;
  total INTEGER;
BEGIN
  -- TIER 1: Simplified fields (12 fields = 60%)
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.last_name IS NOT NULL AND NEW.last_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.date_naissance IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.genre IS NOT NULL AND NEW.genre != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.annee_diplomation IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.sport_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.position_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.numero_jersey IS NOT NULL AND NEW.numero_jersey != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.school_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.taille_pieds IS NOT NULL AND NEW.taille_pieds > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.poids_lbs IS NOT NULL AND NEW.poids_lbs > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.cote_globale_entraineur IS NOT NULL AND NEW.cote_globale_entraineur > 0 THEN simplified_count := simplified_count + 1; END IF;

  -- TIER 2: Video (15%)
  IF NEW.video_faits_saillants_url IS NOT NULL AND NEW.video_faits_saillants_url != '' THEN video_bonus := 15; END IF;

  -- TIER 3: Detailed fields (10 fields = 25%)
  IF NEW.moyenne_generale IS NOT NULL AND NEW.moyenne_generale > 0 THEN detailed_count := detailed_count + 1; END IF;
  -- Programme CEGEP vise — REPLI T1 : la nouvelle colonne compte, et
  -- l'ancienne continue de compter tant qu'elle n'est pas videe (T3).
  -- Retirer la seconde branche EN MEME TEMPS que le vidage, jamais avant.
  IF cardinality(NEW.programmes_vises) > 0
     OR (NEW.programme_cegep_vise IS NOT NULL AND jsonb_array_length(NEW.programme_cegep_vise::jsonb) > 0)
  THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.matieres_fortes IS NOT NULL AND jsonb_array_length(NEW.matieres_fortes::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.notes_coach IS NOT NULL AND NEW.notes_coach != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.envergure IS NOT NULL AND NEW.envergure != '' THEN detailed_count := detailed_count + 1; END IF;
  IF (NEW.test_40_verges IS NOT NULL OR NEW.saut_vertical IS NOT NULL OR NEW.saut_longueur IS NOT NULL OR NEW.developpe_couche IS NOT NULL OR NEW.navette_agilite IS NOT NULL OR NEW.sprint_100m IS NOT NULL) THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.bio IS NOT NULL AND NEW.bio != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.mentions_academiques IS NOT NULL AND jsonb_array_length(NEW.mentions_academiques::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.regions_cegep_preferees IS NOT NULL AND jsonb_array_length(NEW.regions_cegep_preferees::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;

  total := ROUND((simplified_count::NUMERIC / 12) * 60) + video_bonus + ROUND((detailed_count::NUMERIC / 10) * 25);
  IF total > 100 THEN total := 100; END IF;

  NEW.profile_completion := total;

  -- (Removed in Phase A 2026-05-04: auto-verify block that flipped
  --  NEW.verified := TRUE / NEW.verification_method := 'auto' /
  --  NEW.verified_at := NOW() when total >= 60. Verification is now
  --  100% explicit human consent — no server-side auto-elevation.)

  RETURN NEW;
END;
$function$;
drop trigger trg_athletes_programme_universitaire_vise on public.athletes;
drop function public.programme_universitaire_vise_garde();
alter table public.athletes
  drop constraint athletes_programme_universitaire_vise_libelle,
  drop constraint athletes_programme_universitaire_vise_longueur,
  drop column programme_universitaire_vise,
  drop column programme_universitaire_vise_id;
drop function nexus_prive.est_ecole_cegep(uuid);
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '41d6dbdfd31e3f15979a2e825c194a2c' then
    raise exception 'NEXUS: corps d''origine de calculate_profile_completion non restauré';
  end if;
end $$;
