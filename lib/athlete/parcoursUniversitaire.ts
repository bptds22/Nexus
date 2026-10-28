/* Parcours universitaire de l'athlète (chantier cégep, lot E6 — retour du test de bout en bout de BP, 2026-10-28, C1 à C6 ;
   Q6 : sous l'interrupteur lancement_universitaire ON).

   Un athlète dont la fiche est rattachée à un CÉGEP y est déjà : tout son parcours (recherche, Mon parcours, cibles,
   « quand … cogne », visibilité) parle de l'UNIVERSITÉ au lieu du cégep. Règle UNIQUE, ici, testée ; les pages ne
   recalculent jamais la condition elles-mêmes. La base ne montre les universités qu'à ce lecteur (lot E1). */

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { lireLancementUniversitaire } from "@/lib/config/lancementUniversitaire";

/** La règle : fiche rattachée à un cégep ET interrupteur universitaire ON. */
export function parcoursUniversitaireActif(typeEcoleFiche: string | null | undefined, lancementUniversitaire: boolean): boolean {
  return lancementUniversitaire && typeEcoleFiche === "CEGEP";
}

/** Lit la fiche de l'athlète connecté et l'interrupteur. Faux en cas de doute (pas de session, erreur, OFF). */
export async function estParcoursUniversitaire(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data } = await supabase.from("athletes")
      .select("schools:school_id(type)").eq("user_id", session.user.id).maybeSingle();
    const ecole = (data as { schools: { type: string | null } | { type: string | null }[] | null } | null)?.schools ?? null;
    const type = Array.isArray(ecole) ? ecole[0]?.type ?? null : ecole?.type ?? null;
    if (type !== "CEGEP") return false;
    return parcoursUniversitaireActif(type, await lireLancementUniversitaire(supabase));
  } catch {
    return false;
  }
}

/** Hook : `null` tant que la réponse n'est pas connue (les pages gardent leur texte d'origine en attendant). */
export function useParcoursUniversitaire(): boolean | null {
  const [actif, setActif] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let annule = false;
    estParcoursUniversitaire(createClient()).then((v) => { if (!annule) setActif(v); });
    return () => { annule = true; };
  }, []);
  return actif;
}

/* ── Les textes du parcours universitaire ─────────────────────────────────── */

/** « Quand l'université cogne » — les 8 critères validés par BP (Q7, 2026-10-28). */
export const CRITERES_UNIVERSITE_COGNE: readonly { cle: string; titre: string; detail: string }[] = [
  { cle: "programme", titre: "Mon programme d'études est offert", detail: "Et je connais ses conditions d'admission." },
  { cle: "cote_r", titre: "Ma cote R est à jour", detail: "Je connais la cote d'admission visée par le programme." },
  { cle: "dec", titre: "Mon DEC est sur la bonne voie", detail: "J'ai les cours préalables du programme." },
  { cle: "video", titre: "Vidéo récente et stats collégiales", detail: "Une vidéo de match de moins de 12 mois et mes statistiques." },
  { cle: "bourses", titre: "Je connais les bourses", detail: "Athlétiques (U SPORTS) et d'études, et leurs dates limites." },
  { cle: "ligue", titre: "Je sais dans quelle ligue je joue ensuite", detail: "RSEQ au Québec ou U SPORTS ailleurs, et l'admissibilité U SPORTS." },
  { cle: "entraineur", titre: "J'ai parlé avec l'entraîneur", detail: "Je sais quel rôle on me propose : temps de jeu, encadrement." },
  { cle: "budget", titre: "Le budget est clair", detail: "Droits de scolarité, résidence, langue d'enseignement, distance de la maison." },
] as const;
