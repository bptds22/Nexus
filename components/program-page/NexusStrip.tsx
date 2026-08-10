// components/program-page/NexusStrip.tsx
// The "Recrutés via Nexus" strip — X masqué + counter both in the école PRIMARY
// colour (var(--red)); recolours per school. (C8: counter moved off #E63946.)
//
// Compte à 0 → la bande DISPARAÎT. Elle existe pour prouver un résultat ; à
// zéro elle annonce « 0 recruté » en gros sur la page publique d'un collège,
// ce qui est pire que son absence. Le compte vient de
// count_recruited_by_school (recruiter_pipeline, stages ENGAGE et
// LETTRE_SIGNEE) — il redeviendra visible au premier engagement réel.

import * as React from "react";
import { NexusMark } from "@/components/shared/dna";

export default function NexusStrip({
  text,
  count,
}: {
  text: string;
  count: number;
}) {
  if (!count || count <= 0) return null;

  return (
    <div className="nstrip rvy">
      <NexusMark size={46} />
      <div className="t">
        <b>Recrutés via Nexus</b>
        <span>{text}</span>
      </div>
      <div className="nn" data-count={count}>0</div>
    </div>
  );
}
