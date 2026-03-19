"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Coach root → redirect to tableau-de-bord */
export default function CoachRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/coach/tableau-de-bord");
  }, [router]);

  return null;
}
