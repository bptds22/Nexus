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

    /* RECRUTEUR VU PAR UN COACH — AUCUNE DESTINATION (2026-09-09).
       Ça pointait `/recruteur/${id}/profil`. Cette route N'EXISTE PAS : il n'y
       a pas de segment `app/recruteur/[id]`, seulement `app/recruteur/profil`,
       qui est « Mon profil » DANS le portail recruteur. Un coach qui cliquait
       le nom du recruteur qui venait de le contacter tombait sur un 404.
       Trois surfaces le rendaient — la liste Messages, l'en-tête du fil, et le
       panneau latéral — et toutes les trois mentaient de la même façon.

       On rend donc "#", et EntityLink dégrade en texte simple : pas de href,
       pas de curseur main, pas de soulignement. Un nom qui ne mène nulle part
       ne doit pas se présenter comme un lien.

       ⚠ CE N'EST PAS LE BESOIN QUI EST NIÉ, C'EST LA DESTINATION QUI MANQUE.
       « Qui me contacte ? » est une vraie question de coach. La page profil
       recruteur vue coach est au backlog ; le jour où elle existe, cette ligne
       redevient une route et les trois surfaces se rallument d'un coup. */
    case "recruiter":
      return "#";

    case "school":
    case "cegep":
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
