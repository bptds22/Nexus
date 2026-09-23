"use client";

/* ─────────────────────────────────────────────────────────────────
   LOT 2 — « N athlètes ciblent ton cégep »

   Décision BP : cibler un cégep le lui fait savoir. Ce bloc est la
   surface où il l'apprend.

   TROIS RÈGLES QUI NE SE NÉGOCIENT PAS :

   1. « TON CÉGEP », JAMAIS « TOI ». La cible se pose sur
      l'établissement, pas sur une personne. Deux cégeps en prod ont
      deux recruteurs (Campus Notre-Dame-de-Foy, Saint-Hyacinthe) : ils
      voient la MÊME liste, entière, sans attribution. Le pipeline, lui,
      reste individuel (`recruiter_pipeline_select : recruiter_id =
      auth.uid()`) — ne pas laisser le libellé suggérer le contraire.

   2. AUCUN NOM NE VIENT DU CIBLAGE. `useCiblesSurMonCegep` ne rend que
      des ids. Les noms viennent de `useAthletesByIds`, donc de
      `recruiter_athlete_cards`, qui seule applique
      `athlete_identity_ok()`. Un mineur non consentant s'affiche par
      `displayFullName` en « Identité réservée » — exactement comme dans
      la recherche, sans mécanique parallèle à maintenir.

   3. PAS DE CÉGEP → PAS DE BLOC. 8 recruteurs sur 25 n'ont pas de
      `school_id`. Un bloc « 0 athlète te cible » leur mentirait : zéro
      ne distingue pas « personne ne te cible » de « on ne sait pas de
      quel cégep tu parles ». Même règle que la garde
      `monCegepAUnCatalogue` du filtre « Programme offert chez nous » :
      masqué, jamais affiché-mais-vide.
───────────────────────────────────────────────────────────────── */

import * as React from "react";
import Link from "next/link";
import { useCiblesSurMonCegep } from "@/lib/queries/recruiter/useCiblesSurMonCegep";
import { useAthletesByIds } from "@/lib/queries/shared/useAthletesByIds";
import { displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";
import { CLES_FILTRES } from "@/lib/recherche/filtres-url";

/** « depuis le 14 septembre » — date longue sans l'année quand c'est
 *  l'année courante, comme le reste des dates du tableau de bord. */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  const memeAnnee = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
}

/** LOT 5 — la recherche filtrée sur « Te ciblent ». Clé d'URL lue dans
 *  CLES_FILTRES, jamais recopiée à la main. */
const LIEN_FILTRE_ME_CIBLENT = `/recruteur/recherche?${CLES_FILTRES.meCiblent}=true`;

const APERCU_MAX = 4;

export default function CiblesSurMonCegep() {
  const { data: cibles = [], isLoading, aUnCegepRattache } = useCiblesSurMonCegep();

  // Les plus récents seulement : la RPC trie déjà created_at desc.
  const recents = React.useMemo(() => cibles.slice(0, APERCU_MAX), [cibles]);
  const idsRecents = React.useMemo(() => recents.map((c) => c.athleteId), [recents]);
  const { data: cartes = [] } = useAthletesByIds(idsRecents);

  const carteParId = React.useMemo(
    () => new Map(cartes.map((c) => [c.id, c])),
    [cartes],
  );

  // Règle 3 — aucun cégep rattaché : le bloc n'existe pas.
  if (!aUnCegepRattache) return null;
  // Rien à annoncer : on ne pose pas un encart vide dans une page déjà dense.
  if (isLoading || cibles.length === 0) return null;

  const n = cibles.length;

  return (
    <div className="rounded-xl bg-[#22C55E]/[0.08] border-l-4 border-l-[#22C55E] px-6 py-5">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-[#22C55E]/20 flex items-center justify-center shrink-0">
          {/* cible — le même glyphe que le bouton côté athlète */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white">
            {n} athlète{n > 1 ? "s" : ""} cible{n > 1 ? "nt" : ""} ton cégep
          </p>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">
            {/* « ton cégep » et non « toi » — cf. règle 1 en tête de fichier. */}
            Ils ont choisi ton établissement dans leur parcours.
          </p>
        </div>

        {/* LOT 5 — le compte devient l'entrée du filtre « Te ciblent ». */}
        <Link
          href={LIEN_FILTRE_ME_CIBLENT}
          className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-[#22C55E] text-white text-[12px] font-black shrink-0 hover:bg-[#16A34A] transition-colors"
        >
          {n > 1 ? `Voir les ${n} →` : "Le voir →"}
        </Link>
      </div>

      {/* Les plus récents — nom résolu par recruiter_athlete_cards, donc
          « Identité réservée » pour un profil masqué. */}
      <ul className="mt-4 space-y-1.5">
        {recents.map((cible) => {
          const carte = carteParId.get(cible.athleteId);
          return (
            <li key={cible.athleteId}>
              <Link
                href={`/recruteur/athletes/${cible.athleteId}`}
                className="group flex items-baseline gap-2 rounded-lg px-3 py-2 bg-[#13151a]/60 hover:bg-[#13151a] transition-colors"
              >
                <span className="text-[14px] font-semibold text-white truncate">
                  {displayFullName(carte)}
                </span>
                <span className="text-[12px] text-[#6b7280] shrink-0">
                  depuis le {dateCourte(cible.targetedAt)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {n > APERCU_MAX && (
        <p className="text-[12px] text-[#6b7280] mt-2.5 px-3">
          et {n - APERCU_MAX} autre{n - APERCU_MAX > 1 ? "s" : ""} —{" "}
          <Link href={LIEN_FILTRE_ME_CIBLENT} className="text-[#22C55E] font-semibold hover:underline">
            les voir dans la recherche →
          </Link>
        </p>
      )}
    </div>
  );
}
