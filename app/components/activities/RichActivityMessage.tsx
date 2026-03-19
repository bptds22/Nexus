"use client";

import EntityLink from "@/components/shared/EntityLink";
import type { Portal, EntityType } from "@/components/shared/EntityLink";
import type { EntityRef } from "./activityMessages";
import type { ActivityEvent } from "@/lib/types/activityEvents";

/* ─────────────────────────────────────────────────────────────────
   RichActivityMessage — Parses entity placeholders in activity
   text and renders them as clickable EntityLink components.

   Supports: {athlete}, {coach}, {recruiter}, {school}, {cegep}
───────────────────────────────────────────────────────────────── */

const ENTITY_PATTERN = /\{(athlete|coach|recruiter|school|cegep)\}/g;

const PLACEHOLDER_TO_TYPE: Record<string, EntityType> = {
  athlete: "athlete",
  coach: "coach",
  recruiter: "recruiter",
  school: "school",
  cegep: "cegep",
};

interface Props {
  text: string;
  entities: {
    athlete?: EntityRef;
    coach?: EntityRef;
    recruiter?: EntityRef;
    school?: EntityRef;
    cegep?: EntityRef;
  };
  portal: Portal;
}

/** Build entity refs from an ActivityEvent (dashboard feeds) */
export function eventToEntities(ev: ActivityEvent): Props["entities"] {
  const entities: Props["entities"] = {};
  if (ev.athleteName) entities.athlete = { id: ev.athleteId, name: ev.athleteName };
  if (ev.coachName) entities.coach = { id: ev.coachId, name: ev.coachName };
  if (ev.recruiterName) entities.recruiter = { id: ev.recruiterId, name: ev.recruiterName };
  if (ev.schoolName) entities.school = { id: ev.schoolId, name: ev.schoolName };
  if (ev.cegepName) entities.cegep = { id: ev.cegepId, name: ev.cegepName };
  return entities;
}

export default function RichActivityMessage({ text, entities, portal }: Props) {
  const parts: (string | { key: string; type: EntityType; ref: EntityRef })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  ENTITY_PATTERN.lastIndex = 0;

  while ((match = ENTITY_PATTERN.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const placeholder = match[1] as keyof typeof entities;
    const ref = entities[placeholder];
    const entityType = PLACEHOLDER_TO_TYPE[placeholder];

    if (ref && entityType) {
      parts.push({ key: `${placeholder}-${match.index}`, type: entityType, ref });
    } else {
      // Fallback: render placeholder text as-is if no entity data
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") {
          return <span key={i}>{part}</span>;
        }
        return (
          <EntityLink
            key={part.key}
            type={part.type}
            id={part.ref.id}
            name={part.ref.name}
            portal={portal}
          />
        );
      })}
    </>
  );
}
