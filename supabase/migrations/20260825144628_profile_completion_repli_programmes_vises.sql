-- ═══════════════════════════════════════════════════════════════
-- T1 (suite) — le score de complétion apprend la nouvelle colonne,
-- SANS oublier l'ancienne.
--
-- LE PIÈGE QUE CETTE MIGRATION DÉSAMORCE
-- Il existe DEUX implémentations du score, qui ne connaissent pas
-- les mêmes champs :
--   • ce trigger        → écrit athletes.profile_completion,
--                         c'est ce que VOIT LE RECRUTEUR
--                         (programme = 1 champ sur 10 du palier
--                          « detailed » = 2,5 points)
--   • profileCompletion.ts → la checklist que VOIT L'ATHLÈTE
--                         (weight 3 sur 100)
-- Si l'un bascule sans l'autre, ou si l'un bascule avant le vidage
-- de T3, les 40 profils concernés perdent leurs points DE FAÇON
-- PERMANENTE — y compris après que l'athlète ait refait son choix,
-- puisque le test porterait sur une colonne définitivement vide.
--
-- D'OÙ LE « OR », ET PAS UN REMPLACEMENT
-- Tant que programme_cegep_vise est pleine, elle continue de compter.
-- Dès que programmes_vises est remplie, elle compte aussi. La fenêtre
-- où ni l'une ni l'autre ne compte n'existe jamais. Le retrait du
-- repli se fait en T3, dans la MÊME migration que le vidage.
-- Aucun profil ne bouge d'un point aujourd'hui.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_profile_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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

COMMENT ON FUNCTION public.calculate_profile_completion() IS
  'Score de completion serveur (celui que voit le recruteur). Jumeau TS : lib/utils/profileCompletion.ts, qui ne connait PAS les memes champs — dette anterieure, hors chantier. Le programme CEGEP est en REPLI depuis T1 : nouvelle colonne OU ancienne. Retirer la branche programme_cegep_vise dans la MEME migration que le vidage T3.';
