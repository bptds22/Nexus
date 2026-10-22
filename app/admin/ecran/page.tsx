import type { Metadata } from "next";
import EcranMural from "./EcranMural";

/* ─────────────────────────────────────────────────────────────────
   /admin/ecran — écran mural (décision BP 2026-10-22).

   La garde est celle de tout /admin : app/admin/layout.tsx vérifie
   is_platform_admin côté serveur avant de rendre quoi que ce soit.
   AdminShell retire ici le menu et la barre (plein écran).

   Cette page ne lit rien : les chiffres viennent de /api/admin/ecran,
   qui a sa propre garde et ne renvoie que des nombres (Loi 25).
───────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Nexus en direct",
  robots: { index: false, follow: false },
};

export default function EcranMuralPage() {
  return <EcranMural />;
}
