"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import DeactivatedBadge from "./DeactivatedBadge";

/* ═══════════════════════════════════════════════════════════════
   EntityLink — Universal clickable entity name component.
   Renders a discreet link (white text, red on hover) or plain
   bold text when no valid route exists.
   When isDeactivated is true, name is gray + DeactivatedBadge shown.
═══════════════════════════════════════════════════════════════ */

export type EntityType = "athlete" | "coach" | "recruiter" | "school" | "cegep" | "trainer";
export type Portal = "coach" | "recruiter";

export interface EntityLinkProps {
  type: EntityType;
  id?: string;
  name: string;
  portal: Portal;
  className?: string;
  isDeactivated?: boolean;
  deactivatedAt?: string | null;
  nested?: boolean;
}

function getEntityRoute(type: EntityType, id: string, portal: Portal): string {
  switch (type) {
    case "athlete":
      if (portal === "coach") return `/coach/athletes/${id}/apercu`;
      if (portal === "recruiter") return `/recruteur/athletes/${id}`;
      return "#";

    case "coach":
      if (portal === "recruiter") return `/recruteur/coach/${id}`;
      return "#";

    case "recruiter":
      if (portal === "coach") return `/recruteur/${id}/profil`;
      return "#";

    case "school":
      return `/ecoles/${id}`;

    case "cegep":
      return `/cegeps/${id}`;

    case "trainer":
      return "#";

    default:
      return "#";
  }
}

export default function EntityLink({ type, id, name, portal, className = "", isDeactivated, deactivatedAt, nested }: EntityLinkProps) {
  const router = useRouter();
  const deactivatedTooltip = isDeactivated && deactivatedAt
    ? `Cet entraîneur a été désactivé le ${new Date(deactivatedAt).toLocaleDateString("fr-CA")}`
    : undefined;

  if (!id) {
    return (
      <span className={`font-bold ${isDeactivated ? "text-[#6B7280]" : "text-white"} ${className}`} title={deactivatedTooltip}>
        {name}
        {isDeactivated && <DeactivatedBadge className="ml-2" />}
      </span>
    );
  }

  const route = getEntityRoute(type, id, portal);

  if (route === "#") {
    return (
      <span className={`font-bold ${isDeactivated ? "text-[#6B7280]" : "text-white"} ${className}`} title={deactivatedTooltip}>
        {name}
        {isDeactivated && <DeactivatedBadge className="ml-2" />}
      </span>
    );
  }

  if (nested) {
    return (
      <span className="inline-flex items-center gap-2" title={deactivatedTooltip}>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(route); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); router.push(route); } }}
          className={`font-bold cursor-pointer ${isDeactivated ? "text-[#6B7280] hover:text-[#9CA3AF]" : "text-white hover:text-[#E63946]"} hover:underline transition-colors duration-150 ${className}`}
        >
          {name}
        </span>
        {isDeactivated && <DeactivatedBadge />}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2" title={deactivatedTooltip}>
      <Link
        href={route}
        className={`font-bold ${isDeactivated ? "text-[#6B7280] hover:text-[#9CA3AF]" : "text-white hover:text-[#E63946]"} hover:underline transition-colors duration-150 ${className}`}
      >
        {name}
      </Link>
      {isDeactivated && <DeactivatedBadge />}
    </span>
  );
}
