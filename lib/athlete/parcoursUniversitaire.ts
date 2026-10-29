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

/** Ce qui coche seul un critère du cégépien (point 5, BP 2026-10-29) ; absent = coché à la main. */
export type AutoUniversite = "programme" | "video" | "chiffres" | "cibles" | "echange" | "verifie";

/** « Quand l'université cogne » — les 8 critères de Q7 (2026-10-28), revus au point 5 (2026-10-29) : 6 se cochent
    seuls, 7 restent à cocher (cote R, DEC, conditions d'admission, bourses, ligue, rôle proposé, budget). */
export const CRITERES_UNIVERSITE_COGNE: readonly { cle: string; titre: string; detail: string; auto?: AutoUniversite; tag?: string; href?: string }[] = [
  { cle: "programme_vise", auto: "programme", tag: "Plan", href: "/athlete/profil", titre: "Mon programme universitaire visé est choisi", detail: "Il est sur ta fiche : les recruteurs universitaires le voient." },
  { cle: "conditions", titre: "Je connais les conditions d'admission", detail: "Celles de mon programme, dans chaque université que je vise." },
  { cle: "cote_r", titre: "Ma cote R est à jour", detail: "Je connais la cote d'admission visée par le programme." },
  { cle: "dec", titre: "Mon DEC est sur la bonne voie", detail: "J'ai les cours préalables du programme." },
  { cle: "video_recente", auto: "video", tag: "Vitrine", href: "/athlete/profil", titre: "Vidéo de faits saillants de moins de 12 mois", detail: "Un recruteur universitaire veut te voir au niveau collégial, pas au secondaire." },
  { cle: "chiffres", auto: "chiffres", tag: "Profil", href: "/athlete/profil", titre: "Tes chiffres sont sur ta fiche", detail: "Au moins deux tests physiques remplis." },
  { cle: "cibles", auto: "cibles", tag: "Plan", titre: "Universités ciblées", detail: "Au moins une université dans tes cibles." },
  { cle: "echange", auto: "echange", tag: "Contact", titre: "J'ai échangé avec un recruteur universitaire", detail: "Tu as répondu à un recruteur universitaire dans tes messages." },
  { cle: "verifie", auto: "verifie", tag: "Crédibilité", titre: "Profil vérifié", detail: "Ton crochet bleu est actif : fiche validée ce mois-ci." },
  { cle: "bourses", titre: "Je connais les bourses", detail: "Athlétiques (U SPORTS) et d'études, et leurs dates limites." },
  { cle: "ligue", titre: "Je sais dans quelle ligue je joue ensuite", detail: "RSEQ au Québec ou U SPORTS ailleurs, et l'admissibilité U SPORTS." },
  { cle: "entraineur", titre: "J'ai parlé avec l'entraîneur", detail: "Je sais quel rôle on me propose : temps de jeu, encadrement." },
  { cle: "budget", titre: "Le budget est clair", detail: "Droits de scolarité, résidence, langue d'enseignement, distance de la maison." },
] as const;
