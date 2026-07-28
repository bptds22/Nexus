"use client";

// components/team-editor/PreviewShell.tsx
//
// Enveloppe les aperçus dans le MÊME contexte que <TeamPage> : conteneur
// `.tp nx-dna` + les variables de thème de l'équipe. Les composants team-page
// ne sont pas self-contained (ils lisent --red, --cream, --hero-focal…). Le CSS
// scopé (DNA_CSS + TP_CSS) est injecté UNE fois par TeamEditor.

import * as React from "react";
import { DNA_CSS } from "@/components/shared/dna";
import { TP_CSS } from "@/components/team-page/TeamPage";
import { lighten } from "@/lib/queries/teamPage/dbToTeamPage";
import { useTeamEditor } from "./teamEditorContext";

const PREVIEW_OVERRIDE = `
.te-prev.tp{padding:0}
.te-prev.tp .rv{opacity:1!important;transform:none!important}
.te-prev.tp section{padding:26px 20px;border-bottom:0}
.te-prev.tp .sec-in{max-width:none}
/* Le hero public est FULL-BLEED (width:100vw + margin-left négatif) : dans une
   colonne d'aperçu il déborde sur tout l'écran. On le ramène à la largeur du
   conteneur — la seule règle de mise en page réécrite pour l'aperçu. */
.te-prev{position:relative;overflow:hidden;border-radius:14px;border:1px solid #2A2F3A}
.te-prev.tp .hero{width:100%;margin-left:0;margin-top:0;min-height:0;height:300px}
.te-prev.tp .stage{height:300px}
`;
/** À injecter UNE fois (TeamEditor) — CSS scopé .tp partagé par tous les aperçus. */
export const TEAM_PREVIEW_CSS = DNA_CSS + TP_CSS + PREVIEW_OVERRIDE;

/** Débounce par valeur — le composant lourd ne re-rend qu'après stabilisation. */
export function useDebounced<T>(value: T, ms = 180): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function TeamPreviewShell({
  children, focal, zoom,
}: { children: React.ReactNode; focal?: string; zoom?: number }) {
  const { identity } = useTeamEditor();
  const style = React.useMemo(() => {
    const lt = lighten(identity.colorPrimary);
    const [r, g, b] = hexToRgb(identity.colorPrimary);
    const [lr, lg, lb] = hexToRgb(lt);
    return {
      "--red": identity.colorPrimary,
      "--red-lt": lt,
      "--ink": identity.colorDark,
      "--cream": identity.colorLight,
      "--bg": "#111317", "--card": "#1A1D24", "--card-deep": "#12151C",
      "--line": "#1E2129", "--line-card": "#262A33",
      "--gold-ink": "#8F6A15", "--plaque-off": "#20262F",
      "--plaque-off-ink": "#5C6575", "--plaque-off-mut": "#4C5462",
      "--p-ink": "#EDEFF3", "--p-soft": "#C9CCD4", "--p-mut": "#8A909C",
      "--p-inv": "#15171B", "--p-mut-inv": "#6B7280",
      "--nx-red": "#E63946", "--nx-red-deep": "#B32330", "--green": "#22C55E",
      "--pop": "cubic-bezier(0.34,1.56,0.64,1)",
      "--red-tint-bg": `rgba(${r},${g},${b},0.15)`,
      "--red-tint-bd": `rgba(${r},${g},${b},0.38)`,
      "--red-lt-55": `rgba(${lr},${lg},${lb},0.55)`,
      "--red-fall": `rgba(${r},${g},${b},0.32)`,
      "--dna-mark": identity.colorPrimary, "--dna-ink": "#EDEFF3",
      "--hero-focal": focal ?? "50% 25%",
      "--hero-zoom": String(Math.max(100, zoom ?? 100) / 100),
    } as React.CSSProperties;
  }, [identity, focal, zoom]);

  return <div className="te-prev tp nx-dna" style={style}>{children}</div>;
}
