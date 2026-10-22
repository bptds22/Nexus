/* lib/parcours/calendrier.ts — la ligne du temps de « Mon parcours ».

   SOURCE UNIQUE pour le web (app/athlete/mon-parcours/page.tsx) et le mobile
   (components/shared/MonParcoursMobile.tsx). Les deux copies portaient chacune
   leur STEPS et leur libellé de saison ; elles lisent désormais ce fichier.

   ── POURQUOI CE FICHIER EXISTE (2026-10-22) ───────────────────────────────
   L'étape courante venait UNIQUEMENT de parcours_readiness.current_phase,
   avec "entrainement" par défaut. Un athlète qui n'avait jamais touché la
   ligne restait sur « Entraînement d'été » toute l'année — deux l'ont signalé
   en octobre. Et le libellé de saison suivait l'année CIVILE (getFullYear) :
   en janvier 2027, il aurait affiché 2027-2028 en pleine saison 2026-2027.

   ── LA RÈGLE (décision BP, 2026-10-22) ────────────────────────────────────
   1. Par défaut, l'étape se DÉDUIT de la date du jour et du calendrier du sport.
   2. Le choix manuel de l'athlète l'emporte, mais SEULEMENT s'il a été posé
      dans la saison courante : `phase_saison` (même JSONB, pas de migration)
      doit valoir saisonCourante(). Un choix d'une autre saison est ignoré —
      sinon un « signature » du printemps resterait collé à l'automne suivant.
   2b. Choix ANCIEN, sans `phase_saison` (les 72 posés avant ce correctif) :
      traité comme posé en SAISON_DES_CHOIX_ANCIENS (2026-2027). Dans cette
      saison, gardé seulement s'il est égal ou plus avancé que l'étape
      calculée — il ne fait jamais reculer l'athlète ; à partir du
      1er juillet 2027, ignoré comme tout choix d'une autre saison
      (décision BP, 2026-10-22).
   3. La saison bascule le 1er JUILLET : saisonCourante() de saisonEnCours.ts,
      la même que les pages cégep. PAS getCurrentSeason() (1er août). */

import { saisonCourante } from "@/lib/queries/schoolPage/saisonEnCours";

export type Phase = "entrainement" | "camps" | "saison" | "signature";
export type Calendrier = "AUTOMNE" | "HIVER";

export const ETAPES: { label: string; phase: Phase }[] = [
  { label: "Entraînement d'été", phase: "entrainement" },
  { label: "Camps & essais", phase: "camps" },
  { label: "Saison Sec 5", phase: "saison" },
  { label: "Fenêtre de signature", phase: "signature" },
];

/** Mois (1 = janvier … 12 = décembre) couverts par chaque étape. Chaque
 *  calendrier couvre les 12 mois exactement une fois — vérifié par les tests. */
export const CALENDRIERS: Record<Calendrier, Record<Phase, number[]>> = {
  AUTOMNE: {
    entrainement: [7],
    camps: [8],
    saison: [9, 10, 11],
    signature: [12, 1, 2, 3, 4, 5, 6],
  },
  HIVER: {
    entrainement: [7, 8],
    camps: [9, 10],
    saison: [11, 12, 1, 2, 3],
    signature: [4, 5, 6],
  },
};

/** Sport → calendrier, par `sports.nom` normalisé (minuscules, sans accents).
 *  Un sport absent d'ici retombe sur AUTOMNE. */
const CALENDRIER_PAR_SPORT: Record<string, Calendrier> = {
  "football": "AUTOMNE",
  "soccer": "AUTOMNE",
  "flag football": "AUTOMNE",
  "basketball": "HIVER",
  "volleyball": "HIVER",
  "hockey": "HIVER",
  "futsal": "HIVER",
  "soccer interieur": "HIVER",
};

const CALENDRIER_PAR_DEFAUT: Calendrier = "AUTOMNE";

function normaliser(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

export function calendrierDuSport(nomSport: string | null | undefined): Calendrier {
  if (!nomSport) return CALENDRIER_PAR_DEFAUT;
  return CALENDRIER_PAR_SPORT[normaliser(nomSport)] ?? CALENDRIER_PAR_DEFAUT;
}

export function phaseParDate(calendrier: Calendrier, d: Date = new Date()): Phase {
  const mois = d.getMonth() + 1;
  const cal = CALENDRIERS[calendrier];
  return ETAPES.find((e) => cal[e.phase].includes(mois))?.phase ?? "entrainement";
}

/** Le sous-ensemble de parcours_readiness que lit la ligne du temps. */
export type ChoixPhase = { current_phase?: string; phase_saison?: string };

function estPhase(v: unknown): v is Phase {
  return ETAPES.some((e) => e.phase === v);
}

/** La saison attribuée aux choix posés avant l'existence de `phase_saison`. */
const SAISON_DES_CHOIX_ANCIENS = "2026-2027";

/** Rang dans ETAPES : entrainement < camps < saison < signature. */
function rang(p: Phase): number {
  return ETAPES.findIndex((e) => e.phase === p);
}

export function phaseCourante(
  readiness: ChoixPhase | null | undefined,
  nomSport: string | null | undefined,
  d: Date = new Date(),
): Phase {
  const calculee = phaseParDate(calendrierDuSport(nomSport), d);
  const choix = readiness?.current_phase;
  if (!estPhase(choix)) return calculee;
  const saison = saisonCourante(d);
  if (readiness?.phase_saison === undefined) {
    if (saison !== SAISON_DES_CHOIX_ANCIENS) return calculee;
    return rang(choix) >= rang(calculee) ? choix : calculee;
  }
  return readiness.phase_saison === saison ? choix : calculee;
}

/** Les clés à fusionner dans parcours_readiness quand l'athlète touche une
 *  étape : la phase ET la saison où il l'a posée. */
export function choixPhase(phase: Phase, d: Date = new Date()): Required<ChoixPhase> {
  return { current_phase: phase, phase_saison: saisonCourante(d) };
}

/** « Saison 2026-2027 » — bascule le 1er juillet. */
export function libelleSaison(d: Date = new Date()): string {
  return `Saison ${saisonCourante(d)}`;
}
