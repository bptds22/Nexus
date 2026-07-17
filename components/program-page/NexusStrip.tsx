// components/program-page/NexusStrip.tsx
// The "Recrutés via Nexus" strip — X masqué + counter both in the école PRIMARY
// colour (var(--red)); recolours per school. (C8: counter moved off #E63946.)

import * as React from "react";
import { NexusMark } from "@/components/shared/dna";

export default function NexusStrip({
  text,
  count,
}: {
  text: string;
  count: number;
}) {
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
