"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { RecruteurListeDetailMobile } from "@/components/shared/RecruteurListeDetailMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function PageClient() {
  // Iter 7.19 — useDynamicParam lit l'id depuis sessionStorage si le shell
  // pré-généré "placeholder" est rendu (cf. lib/platform/mobileRoutes.ts).
  // Sur le web, retourne directement le vrai id depuis l'URL.
  const id = useDynamicParam("id");
  const router = useRouter();

  useEffect(() => {
    if (!IS_CAPACITOR) {
      router.replace("/recruteur/listes");
    }
  }, [router]);

  if (!id || id === "placeholder") return null;
  if (IS_CAPACITOR) {
    return <RecruteurListeDetailMobile listId={id} />;
  }
  // Desktop : flash de redirection (useEffect ci-dessus fait le replace).
  return null;
}
