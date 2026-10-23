import type { Metadata } from "next";
import QG from "./QG";

/* ─────────────────────────────────────────────────────────────────
   /admin/qg — QG admin (décision BP 2026-10-22, lot 1).

   La garde est celle de tout /admin : app/admin/layout.tsx vérifie
   is_platform_admin côté serveur avant de rendre quoi que ce soit.
   Le menu admin reste ; le QG a son propre bouton plein écran.

   Cette page ne lit rien : les chiffres viennent de /api/admin/qg,
   qui a sa propre garde et ne renvoie que des nombres (Loi 25).
───────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "QG Nexus",
  robots: { index: false, follow: false },
};

export default function QgPage() {
  return <QG />;
}
