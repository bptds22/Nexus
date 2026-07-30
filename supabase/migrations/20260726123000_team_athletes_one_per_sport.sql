-- ============================================================================
-- FIX 4 — team_athletes : UNE équipe par athlète PAR SPORT
--
-- Constat de l'audit : la règle « 1 seule équipe » était appliquée de façon
-- contradictoire selon la surface —
--   • DB              : UNIQUE (team_id, athlete_id) → multi-équipe autorisé
--   • écran roster    : INSERT nu → multi-équipe
--   • saveAthlete.ts  : DELETE .eq(athlete_id) puis INSERT → force 1, et
--                       supprimait SILENCIEUSEMENT les autres appartenances
--   • lib/config/gender.ts documentait explicitement le 1-N
--
-- Pourquoi PAS UNIQUE(athlete_id) tout court : les saisons RSEQ se chevauchent
-- massivement (sur 2025-2026 : Football 22 août→8 juin, Volleyball 17 sept→
-- 26 avril, Basketball 3 oct→10 mai, Futsal 8 oct→3 mai). Un athlète qui joue
-- football ET basketball a deux appartenances CONCURRENTES, pas séquentielles.
-- Avec 23 sports au calendrier, un UNIQUE(athlete_id) strict rendrait le
-- multi-sport impossible et laisserait athletes.sport_secondaire_id mort.
--
-- Pourquoi PAS d'axe season dans la clé : team_athletes porte l'appartenance
-- COURANTE (l'historique vit dans athletes.parcours_equipes). Sans season dans
-- la clé, passer de l'équipe football 2025-2026 à celle de 2026-2027 FORCE le
-- déplacement — le roster s'auto-corrige d'une saison à l'autre et le
-- calendrier pointe toujours l'équipe qui porte les matchs. Ajouter season
-- laisserait au contraire les lignes périmées s'accumuler.
--
-- Dry-run avant write : 0 violation (cloud 5 lignes, local 11), 0 ligne
-- orpheline, 0 teams.sport_id NULL. Aucun nettoyage de données nécessaire.
--
-- Bonus : l'index unique est athlete_id-first, il comble donc aussi l'index
-- manquant relevé au diagnostic perf (l'ancien UNIQUE (team_id, athlete_id)
-- est team-first et ne servait pas la recherche « mes 50 cibles → équipes »).
-- ============================================================================

-- ── Colonne dénormalisée ────────────────────────────────────────────────────
-- sport_id vit sur teams, pas sur team_athletes : un UNIQUE ne peut pas
-- traverser la jointure. On dénormalise, et deux triggers garantissent que la
-- copie ne peut pas dériver de la source.
ALTER TABLE public.team_athletes
  ADD COLUMN IF NOT EXISTS sport_id uuid REFERENCES public.sports(id);

UPDATE public.team_athletes ta
SET sport_id = t.sport_id
FROM public.teams t
WHERE t.id = ta.team_id
  AND ta.sport_id IS DISTINCT FROM t.sport_id;

-- ── Trigger 1 : dérive sport_id à l'écriture ────────────────────────────────
-- BEFORE, donc les appelants existants (qui n'envoient jamais sport_id)
-- continuent de fonctionner sans modification.
CREATE OR REPLACE FUNCTION public.team_athletes_set_sport_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  SELECT t.sport_id INTO NEW.sport_id
  FROM public.teams t WHERE t.id = NEW.team_id;
  IF NEW.sport_id IS NULL THEN
    RAISE EXCEPTION 'TEAM_WITHOUT_SPORT: team_id=%', NEW.team_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS team_athletes_set_sport_id_trg ON public.team_athletes;
CREATE TRIGGER team_athletes_set_sport_id_trg
  BEFORE INSERT OR UPDATE OF team_id ON public.team_athletes
  FOR EACH ROW EXECUTE FUNCTION public.team_athletes_set_sport_id();

-- ── Trigger 2 : resynchronise si teams.sport_id change ──────────────────────
CREATE OR REPLACE FUNCTION public.teams_resync_athlete_sport_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.team_athletes SET sport_id = NEW.sport_id WHERE team_id = NEW.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS teams_resync_athlete_sport_id_trg ON public.teams;
CREATE TRIGGER teams_resync_athlete_sport_id_trg
  AFTER UPDATE OF sport_id ON public.teams
  FOR EACH ROW WHEN (OLD.sport_id IS DISTINCT FROM NEW.sport_id)
  EXECUTE FUNCTION public.teams_resync_athlete_sport_id();

-- ── Contrainte ──────────────────────────────────────────────────────────────
ALTER TABLE public.team_athletes ALTER COLUMN sport_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_athletes_athlete_sport_uidx
  ON public.team_athletes (athlete_id, sport_id);

COMMENT ON COLUMN public.team_athletes.sport_id IS
  'Copie dénormalisée de teams.sport_id, maintenue par les triggers '
  'team_athletes_set_sport_id_trg et teams_resync_athlete_sport_id_trg. '
  'Existe uniquement pour porter UNIQUE (athlete_id, sport_id) — un athlète '
  'ne peut appartenir qu''à UNE équipe par sport, mais peut être multi-sport. '
  'Ne jamais écrire cette colonne directement : passer par team_id.';
