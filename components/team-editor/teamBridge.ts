// components/team-editor/teamBridge.ts
//
// Pont éditeur → VRAIS composants team-page. Les aperçus ne réimplémentent
// rien : ils construisent une TeamData avec le MÊME assembleur que la page
// publique (buildTeamData) et la donnent à TeamHero / CalendarSection /
// PresentationSection / BesoinsWidget / DejaEngageesSection.
//
// Différence assumée avec la page publique : le roster n'est pas chargé dans
// l'éditeur (le moteur dérivé n'a pas voix au chapitre ici — chaque plaque a sa
// ligne saisie, qui gagne). Les compteurs « X des Y graduent » de la vue
// athlète restent donc l'affaire de la page publique.

import type { TeamData, Pennant } from "@/components/team-page/content";
import { buildTeamData, type CommitRow, type GameRow } from "@/lib/queries/teamPage/dbToTeamPage";
import { toTeamNeeds, type PositionRow } from "@/lib/queries/teamPage/sportSlots";
import type { TeamContentState, EditorPennant, EditorCamp, EditorNeed } from "@/lib/queries/teamPage/teamPageData";
import type { TeamIdentity } from "./teamEditorContext";

export interface PreviewParts {
  content: TeamContentState;
  pennants: EditorPennant[];
  camps: EditorCamp[];
  needs: EditorNeed[];
  positions: PositionRow[];
  games: GameRow[];
  commits: CommitRow[];
  hiddenSections: string[];
  heroUrl: string | null;
  coachPhotoUrl: string | null;
  /** Nom résolu (compte désigné → saisie → staff). Absent → celui du staff. */
  headCoachName?: string;
}

export function previewTeam(id: TeamIdentity, p: PreviewParts): TeamData {
  const pennants: Pennant[] = p.pennants
    .filter((x) => x.titre.trim())
    .map((x) => ({ titre: x.titre, annee: x.annee ?? 0, type: x.type }));

  return buildTeamData({
    team: {
      id: id.teamId, name: id.teamName, division: id.division, gender: id.genre,
      season: id.season, school_id: id.schoolId, sport_id: "",
    },
    sportNom: id.sportNom,
    sportKey: id.sportKey,
    school: {
      name: id.schoolName, nickname: id.nickname, initiales: id.initiales,
      logoUrl: id.logoUrl, colorPrimary: id.colorPrimary,
      colorDark: id.colorDark, colorLight: id.colorLight, wallWords: id.wallWords,
    },
    content: { ...p.content, hidden_sections: p.hiddenSections },
    pennants,
    camps: p.camps.filter((c) => c.titre.trim()).map((c) => ({ titre: c.titre, event_date: c.event_date, lieu: c.lieu })),
    needs: toTeamNeeds(p.needs, p.positions),
    games: p.games,
    roster: [],
    commitRows: p.commits,
    headCoachName: p.headCoachName ?? id.headCoachName,
    staff: id.staff,
    heroUrl: p.heroUrl,
    coachPhotoUrl: p.coachPhotoUrl,
  });
}

/** Aperçu d'UNE section : les autres n'ont pas à être calculées. */
export function previewWith(id: TeamIdentity, p: PreviewParts, over: Partial<PreviewParts>): TeamData {
  return previewTeam(id, { ...p, ...over });
}
