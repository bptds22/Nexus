// components/program-page/NexusStrip.tsx
// The "Recrutés via Nexus" strip — X masqué in école color, counter stays the
// FIXED platform red #E63946 (moment plateforme, not the école color).

import * as React from "react";

export default function NexusStrip({
  text,
  count,
}: {
  text: string;
  count: number;
}) {
  return (
    <div className="nstrip rvy">
      <div className="nxmask" />
      <div className="t">
        <b>Recrutés via Nexus</b>
        <span>{text}</span>
      </div>
      <div className="nn" data-count={count}>0</div>
    </div>
  );
}
