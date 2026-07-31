-- ============================================================================
-- Plafond des événements d'équipe : 3 -> 8.
--
-- POURQUOI : team_events ne sert plus seulement aux camps de sélection. Depuis
-- que l'intitulé saisi est réellement rendu sur la tuile, le collège y met des
-- portes ouvertes, un tournoi, une visite de campus. Trois lignes pour toute
-- une saison, c'était le budget d'un seul type d'événement.
--
-- CE QUI N'EST PAS TOUCHÉ : la fonction public._cap_rows_per_team(). Elle est
-- générique — sa limite vient de TG_ARGV[0], sa table de TG_TABLE_NAME — et
-- elle est PARTAGÉE avec trg_cap_team_pennants (plafond 8, inchangé). Modifier
-- la fonction déplacerait aussi le plafond des fanions. On ne recrée donc que
-- le trigger, avec un autre argument.
--
-- Le plafond vit à trois endroits qui doivent bouger ensemble, sinon la base
-- autorise ce que l'interface refuse :
--   1. ce trigger
--   2. lib/queries/teamPage/teamPageData.ts  -> MAX_TEAM_EVENTS
--   3. components/team-editor/CalendarCampsSection.tsx (garde + toast)
-- Depuis ce chantier, 2 et 3 lisent la même constante — seul ce fichier-ci
-- porte encore une valeur écrite à la main.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_cap_team_events ON public.team_events;

CREATE TRIGGER trg_cap_team_events
  BEFORE INSERT ON public.team_events
  FOR EACH ROW EXECUTE FUNCTION public._cap_rows_per_team('8');
