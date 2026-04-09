/* ─────────────────────────────────────────────────────────────────
   Activity message generator — builds display text from Activity data.
   Returns text with multi-entity placeholders + entity metadata
   for EntityLink rendering.

   Placeholders: {athlete}, {coach}, {recruiter}, {school}, {cegep}
───────────────────────────────────────────────────────────────── */

import type { Activity } from "@/lib/types/activity";

export interface EntityRef {
  id?: string;
  name: string;
}

export interface ActivityMessageParts {
  text: string; // contains {athlete}, {coach}, {recruiter}, {school}, {cegep}
  entities: {
    athlete?: EntityRef;
    coach?: EntityRef;
    recruiter?: EntityRef;
    school?: EntityRef;
    cegep?: EntityRef;
  };
}

export function getActivityMessage(a: Activity): ActivityMessageParts {
  const athlete: EntityRef | undefined = a.athleteName
    ? { id: a.athleteId, name: a.athleteName }
    : undefined;
  const coach: EntityRef | undefined = a.coachName
    ? { id: a.coachId, name: a.coachName }
    : undefined;
  const recruiter: EntityRef | undefined = a.recruiterName
    ? { id: a.recruiterId, name: a.recruiterName }
    : undefined;
  const school: EntityRef | undefined = a.schoolName
    ? { id: a.schoolId, name: a.schoolName }
    : undefined;
  const cegep: EntityRef | undefined = a.cegepName
    ? { id: a.cegepId, name: a.cegepName }
    : undefined;

  const pos = a.athletePosition ? ` (${a.athletePosition})` : "";

  const entities: ActivityMessageParts["entities"] = {};
  if (athlete) entities.athlete = athlete;
  if (coach) entities.coach = coach;
  if (recruiter) entities.recruiter = recruiter;
  if (school) entities.school = school;
  if (cegep) entities.cegep = cegep;

  switch (a.type) {
    case "message_received":
      if (a.portal === "coach") {
        return {
          entities,
          text: recruiter
            ? `{recruiter} ({cegep}) a envoyé un message concernant {athlete}${pos}`
            : `Un recruteur a envoyé un message concernant {athlete}${pos}`,
        };
      }
      return {
        entities,
        text: coach
          ? `{coach} ({school}) a répondu concernant {athlete}${pos}`
          : `Un coach a répondu concernant {athlete}${pos}`,
      };

    case "athlete_favorited":
      return {
        entities,
        text: `{athlete}${pos} a été ajouté aux favoris par un recruteur`,
      };

    case "video_added":
      return {
        entities,
        text: `Une nouvelle vidéo a été ajoutée au profil de {athlete}${pos}`,
      };

    case "badge_earned":
      return {
        entities,
        text: `{athlete}${pos} a obtenu le badge « ${a.badgeName ?? "Badge"} »`,
      };

    case "profile_verified":
      return {
        entities,
        text: `Le profil de {athlete}${pos} a été vérifié`,
      };

    case "scouting_report":
      return {
        entities,
        text: `Un nouveau rapport de dépistage est disponible pour {athlete}${pos}`,
      };

    case "athlete_added":
      return {
        entities,
        text: a.portal === "coach"
          ? `{athlete}${pos} a été ajouté à votre liste`
          : `{athlete}${pos} de {school} a été ajouté à la plateforme`,
      };

    case "letter_of_intent":
      return {
        entities,
        text: cegep
          ? `{athlete}${pos} a signé une lettre d'intention avec {cegep}`
          : `{athlete}${pos} a signé une lettre d'intention`,
      };

    case "profile_viewed":
      return {
        entities,
        text: cegep
          ? `Un recruteur de {cegep} a consulté le profil de {athlete}${pos}`
          : `Le profil de {athlete}${pos} a été consulté`,
      };

    case "profile_incomplete":
      return {
        entities,
        text: `Le profil de {athlete}${pos} est à ${a.profileCompleteness ?? 0}% — complétez-le pour augmenter la visibilité`,
      };

    case "new_athlete_in_sport":
      return {
        entities,
        text: `{athlete}${pos} de {school} vient d'être ajouté en ${a.sportName ?? "sport"}`,
      };

    case "favorite_profile_updated":
      return {
        entities,
        text: `Le profil de {athlete}${pos} (dans vos favoris) a été mis à jour`,
      };

    case "favorite_stats_updated":
      return {
        entities,
        text: `Les statistiques de {athlete}${pos} (dans vos favoris) ont été mises à jour`,
      };

    case "coach_response":
      return {
        entities,
        text: coach
          ? `{coach} a répondu à votre message concernant {athlete}${pos}`
          : `Un coach a répondu à votre message concernant {athlete}${pos}`,
      };

    default:
      return { entities, text: `Activité concernant {athlete}` };
  }
}

/* ── Relative time helper ──────────────────────────────────────── */

export function relativeTimeFromNow(isoStr: string, now: Date): string {
  const d = new Date(isoStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
