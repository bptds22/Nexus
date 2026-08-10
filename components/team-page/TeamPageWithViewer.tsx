"use client";

// components/team-page/TeamPageWithViewer.tsx
//
// Enveloppe CLIENT de <TeamPage> pour la route web /college/[schoolId]/[teamId].
//
// ── CE QU'ELLE FAIT, ET RIEN D'AUTRE ────────────────────────────────────────
// Elle charge l'athlète connecté après hydratation et le réinjecte dans le
// `team` passé à <TeamPage>. Le rendu, le markup et le style restent ceux de
// <TeamPage> : ce composant n'en dessine aucun. Le widget « match parfait »
// est calculé par matchState(team, season), une fonction PURE de `team` — lui
// fournir `viewer` suffit à le faire apparaître, à l'identique.
//
// ── POURQUOI CÔTÉ CLIENT ────────────────────────────────────────────────────
// La lecture du viewer se faisait côté serveur, via cookies(). La route
// exporte un generateStaticParams (le bundle Capacitor en dépend) et Next la
// classe donc SSG : un rendu statique ne peut pas lire de cookie, et TOUTES
// les équipes rendaient 500. Déclarer la route dynamique était impossible —
// Next exige un littéral pour `dynamic`, et 'force-dynamic' est refusé par
// output:'export'. Déplacer la lecture était la seule voie qui garde le rendu
// statique (SEO public) ET fait vivre le widget.
//
// ── PAS DE SAUT DE MISE EN PAGE ─────────────────────────────────────────────
// L'état initial est `viewer: null` — exactement le rendu servi aujourd'hui à
// un visiteur non connecté : la box est ABSENTE, pas réservée. Aucun
// squelette, aucun clignotement, aucune hauteur fantôme. Pour un athlète
// connecté dont le poste correspond, la box se pose une fois la session lue.
// C'est le seul écart visible avec l'ancien rendu serveur, et il est assumé :
// le widget ne concerne qu'un visiteur authentifié et n'a aucune valeur SEO.
//
// L'HTML statique reste donc identique pour tous les visiteurs — c'est aussi
// ce qui le rend cachable sans fuite : aucune page ne part en cache avec le
// profil d'un athlète cuit dedans.

import { useEffect, useState } from "react";
import TeamPage from "./TeamPage";
import type { TeamData, ConnectedAthlete } from "./content";
import { createClient } from "@/lib/supabase/client";
import { loadViewerClient } from "@/lib/queries/teamPage/loadViewerClient";

export default function TeamPageWithViewer({ team }: { team: TeamData }) {
  const [viewer, setViewer] = useState<ConnectedAthlete | null>(null);

  useEffect(() => {
    let vivant = true;
    // loadViewerClient ne jette jamais (il journalise et rend null) : pas de
    // .catch ici, il n'attraperait rien.
    loadViewerClient(createClient()).then((v) => {
      if (vivant) setViewer(v);
    });
    return () => { vivant = false; };
  }, []);

  // Tant que `viewer` est null, on passe l'objet REÇU tel quel — pas une copie.
  // Une nouvelle référence à chaque rendu ferait retravailler <TeamPage> pour
  // rien alors que rien n'a changé.
  return <TeamPage team={viewer ? { ...team, viewer } : team} />;
}
