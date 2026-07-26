import { notFound } from "next/navigation";

/* Portal parental — WEB ONLY (Lot 1a).
   Aucune route /parent n'est exposée dans l'arbre mobile (Capacitor) :
   le build mobile (NEXT_PUBLIC_CAPACITOR_BUILD=true) 404 tout /parent/*.
   Voir aussi lib/build/mobile-excluded-routes.ts (segment '/parent'). */
export default function ParentRootLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  return <>{children}</>;
}
