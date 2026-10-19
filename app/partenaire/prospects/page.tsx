"use client";

/* /partenaire/prospects — ancienne adresse de « Mes athlètes » (cartes prospects).
   Depuis la fusion du 2026-10-18 (6.1), elle mène à la pastille « En attente »
   de /partenaire/mes-athletes. Redirection côté client (export statique de l'appli). */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { adresseVue } from "@/lib/partenaires/vueMesAthletes";

export default function ProspectsPartenairePage() {
  const router = useRouter();
  useEffect(() => { router.replace(adresseVue("attente")); }, [router]);
  return null;
}
