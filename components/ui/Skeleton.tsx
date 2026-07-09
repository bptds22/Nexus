import type { CSSProperties } from "react";

/* ═══════════════════════════════════════════════════════════════
   Skeleton — primitive de chargement réutilisable (mobile + web).

   Une forme grise qui pulse, cohérente avec le design system :
   fond #1A1D24 (couleur carte, légèrement plus clair que le fond
   page #111317 → visible) + `animate-pulse` (shimmer Tailwind).
   Aligné sur les DashboardSkeleton existants (même teinte #1A1D24).

   Paramétrable via props (width/height/rounded) OU className
   (ex. <Skeleton className="h-4 w-32 rounded-full" />). Les props
   inline prennent le dessus sur les classes équivalentes.

   Usage :
     <Skeleton height={16} width={120} rounded={6} />
     <Skeleton className="h-16 w-full rounded-2xl" />
═══════════════════════════════════════════════════════════════ */

export interface SkeletonProps {
  className?: string;
  /** Largeur (number = px, string = valeur CSS brute). */
  width?: number | string;
  /** Hauteur (number = px, string = valeur CSS brute). */
  height?: number | string;
  /** border-radius (number = px, string = valeur CSS brute). */
  rounded?: number | string;
  style?: CSSProperties;
}

export function Skeleton({ className = "", width, height, rounded, style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-[#1A1D24] ${className}`}
      style={{
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(rounded !== undefined ? { borderRadius: rounded } : {}),
        ...style,
      }}
    />
  );
}
