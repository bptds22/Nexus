"use client";

import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
   Tuiles du tableau de bord recruteur — 4 chiffres, 4 portes.

   Ordre (décision BP 2026-09-23) : Relances à faire · Te ciblent ·
   Visites à venir · Nouveaux (10 j).

   Chaque tuile ne CALCULE rien : la page lui passe un chiffre obtenu avec
   la définition exacte de son filtre de destination (voir la page). Ce
   composant ne décide que de l'affichage :
   - un chiffre > 0 → lien vers le filtre ;
   - 0 → chiffre gris, PAS de lien (rien à ouvrir) ;
   - « — » → la question n'a pas de réponse pour ce compte (pas de cégep,
     palier gratuit) : gris, pas de lien ;
   - en chargement → « … », pas de lien.

   Sous le libellé, une ligne de contexte grise (décision BP 2026-09-23) :
   ce que la tuile compte — donc ce qu'un clic ouvre. Sur une tuile « — »,
   elle dit POURQUOI il n'y a pas de chiffre (le motif) au lieu de décrire
   une action impossible. Une ligne sur ordinateur (~30 caractères max à 1280 px) :
   tronquée en dernier recours, jamais repliée.
───────────────────────────────────────────────────────────────── */

export type ValeurTuile =
  | { etat: "chiffre"; n: number }
  | { etat: "sans_objet"; motif: string }
  | { etat: "chargement" };

export interface Tuile {
  cle: string;
  libelle: string;
  valeur: ValeurTuile;
  href: string;
  /** Ligne de contexte sous le libellé : ce que la tuile compte. Courte. */
  aide: string;
  /** Couleur du chiffre quand il est actif (> 0). */
  accent: string;
}

export default function TuilesTableauDeBord({ tuiles }: { tuiles: Tuile[] }) {
  return (
    /* 4 colonnes seulement dès xl : sous 1280 px, une tuile sur 4 laisse
       ~120 px à la ligne de contexte — elle serait tronquée à mi-mot. */
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {tuiles.map((t) => <UneTuile key={t.cle} tuile={t} />)}
    </div>
  );
}

function UneTuile({ tuile }: { tuile: Tuile }) {
  const { valeur } = tuile;
  const actif = valeur.etat === "chiffre" && valeur.n > 0;
  const affiche =
    valeur.etat === "chiffre" ? valeur.n.toLocaleString("fr-CA")
    : valeur.etat === "sans_objet" ? "—"
    : "…";
  const contexte = valeur.etat === "sans_objet" ? valeur.motif : tuile.aide;

  const corps = (
    <>
      <p
        className="font-head text-[40px] leading-none font-black tabular-nums"
        style={{ color: actif ? tuile.accent : "#4a4d56" }}
      >
        {affiche}
      </p>
      <div className="mt-3 min-w-0">
        <p className={`text-[13px] font-semibold ${actif ? "text-white" : "text-[#6b7280]"}`}>
          {tuile.libelle}
        </p>
        <p className="text-[12px] text-[#6b7280] mt-1 xl:truncate" title={contexte}>
          {contexte}
        </p>
      </div>
    </>
  );

  const base = "rounded-xl border p-5 min-h-[118px] flex flex-col justify-between";

  if (!actif) {
    return (
      <div className={`${base} bg-[#1A1D24] border-[#2D3748]`} aria-disabled="true">
        {corps}
      </div>
    );
  }
  return (
    <Link
      href={tuile.href}
      className={`${base} group bg-[#1A1D24] border-[#2D3748] hover:border-white/20 hover:-translate-y-0.5 transition-all`}
    >
      {corps}
    </Link>
  );
}
