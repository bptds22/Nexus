/* ═══════════════════════════════════════════════════════════════
   Route détail d'une liste — iter 7.17 Sprint 2
   Server component avec generateStaticParams (sentinel) + Suspense
   wrap. Le PageClient lit l'id via useParams() à runtime.
═══════════════════════════════════════════════════════════════ */

import { Suspense } from "react";
import PageClient from "./PageClient";

export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  );
}
