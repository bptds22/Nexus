/* ═══════════════════════════════════════════════════════════════
   Doublons d'une carte prospect à créer — UNE fonction pour le web
   (CreerCarteModal) et l'app (CreerProspectMobile), recette 1.4.4.

   Décision BP : avertir, jamais bloquer.
   - même NOM normalisé + même ÉTABLISSEMENT, prénom compatible (composé ou
     abrégé) : contre les cartes de l'unité et contre les athlètes Nexus ;
     à défaut, un nom PROCHE (tolérance aux fautes, lot D) ;
   - même COURRIEL : contre une carte de l'unité ou un athlète Nexus.
   Un athlète MASQUÉ n'est jamais suggéré : la recherche recruteur,
   athletes_nom_proche et athlete_nexus_par_courriel ne rendent une identité
   que si elle est visible.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { cartesDoublons, carteAuCourriel, athleteAuCourriel, memePersonneProbable } from "@/lib/cartes/carteProspect";

export interface DoublonCarte {
  texte: string;
  /** Fiche de l'athlète Nexus en cause, s'il y en a une. */
  lien?: string;
}

export async function chercherDoublonsCarte(supabase: SupabaseClient, d: {
  prenom: string;
  nom: string;
  sportId: string;
  etablissement: { id: string; name: string };
  /** Courriel déjà validé, ou chaîne vide. */
  courriel: string;
}): Promise<DoublonCarte[]> {
  const { prenom, nom, sportId, etablissement, courriel } = d;
  const trouves: DoublonCarte[] = [];

  // Même nom + même établissement, prénom compatible — cartes de l'unité.
  const cartes = await cartesDoublons(supabase, { prenom, nom, sportId, schoolId: etablissement.id });
  if (cartes.length > 0) {
    const c = cartes[0];
    trouves.push({ texte: `Ton unité suit déjà « ${c.prenom} ${c.nom} » (${etablissement.name}).` });
  }

  // … et athlètes Nexus : la recherche ne rend un nom que s'il est visible.
  const { data } = await supabase.rpc("recruiter_search_athletes", { p_search: nom.trim(), p_limit: 50 });
  const nexus = ((data ?? []) as { id: string; identity_visible: boolean; first_name: string | null; last_name: string | null; school_id: string | null }[])
    .find((a) => a.identity_visible && a.school_id === etablissement.id
      && memePersonneProbable(prenom, nom, a.first_name ?? "", a.last_name ?? ""));
  if (nexus) {
    trouves.push({
      texte: `« ${nexus.first_name} ${nexus.last_name} », de ${etablissement.name}, est déjà sur Nexus — ajoute-le plutôt à ton processus depuis sa fiche.`,
      lien: `/recruteur/athletes/${nexus.id}`,
    });
  } else {
    // Tolérance aux fautes (lot D) : un nom PROCHE, prénom compatible, même
    // établissement — « Lea Gagno » trouve « Léa Gagnon ».
    const { data: proches } = await supabase.rpc("athletes_nom_proche", { p_prenom: prenom, p_nom: nom, p_ecole: etablissement.id });
    const proche = ((proches ?? []) as { id: string; first_name: string | null; last_name: string | null }[])[0];
    if (proche) {
      trouves.push({
        texte: `Un athlète au nom proche existe : ${proche.first_name} ${proche.last_name} — c'est lui ?`,
        lien: `/recruteur/athletes/${proche.id}`,
      });
    }
  }

  // Même courriel.
  if (courriel) {
    const [carteC, athleteC] = await Promise.all([
      carteAuCourriel(supabase, courriel, sportId),
      athleteAuCourriel(supabase, courriel),
    ]);
    if (carteC) trouves.push({ texte: `Ce courriel est déjà celui de la carte « ${carteC.prenom} ${carteC.nom} » de ton unité.` });
    if (athleteC && athleteC.id !== nexus?.id) {
      trouves.push({
        texte: `Ce courriel est celui de « ${athleteC.first_name} ${athleteC.last_name} », déjà sur Nexus.`,
        lien: `/recruteur/athletes/${athleteC.id}`,
      });
    }
  }
  return trouves;
}
