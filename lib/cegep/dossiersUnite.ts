/* ═══════════════════════════════════════════════════════════════
   dossiersUnite — Mon CÉGEP compte des DOSSIERS, pas des lignes
   (lot B2, étape 3).

   Depuis le lot B1, deux collègues d'une même unité (cégep × sport) qui
   suivent le même athlète ont chacun SA ligne de processus (« lignes
   sœurs », synchronisées). cegep_pipeline_overview rend une ligne par
   recruteur : compter ses lignes compte l'athlète deux fois. Un dossier =
   un athlète dans une unité ; son étape = la plus avancée des lignes sœurs
   (elles sont synchronisées, c'est la même en régime normal).

   L'unité d'une ligne n'est pas rendue par cegep_pipeline_overview : on la
   déduit du sport de son auteur (users.sport_id) — c'est ainsi que B1 la
   pose à la création. Un recruteur sans sport forme son propre dossier
   (ses lignes sont privées, sans unité).

   Pourquoi pas unite_pipeline : Mon CÉGEP est ouvert à l'admin cégep même
   gratuit (adminBypass), alors que les lectures d'unité exigent Pro depuis
   B2-0. cegep_pipeline_overview garde le périmètre du lot 2a.
═══════════════════════════════════════════════════════════════ */

export interface LignePipelineCegep {
  recruiter_id: string;
  athlete_id: string;
  stage: string;
  created_at: string | null;
  updated_at: string | null;
  moved_at: string | null;
}

export interface DossierUnite extends LignePipelineCegep {
  /** Sport de l'unité du dossier (null : recruteur sans sport). */
  sport_id: string | null;
  /** Les recruteurs qui suivent ce dossier (ordre d'arrivée des lignes). */
  suivi_par: string[];
}

const RANG: Record<string, number> = {
  IDENTIFIE: 1, CONTACTE: 2, EN_DISCUSSION: 3, VISITE_PLANIFIEE: 4, ENGAGE: 5, LETTRE_SIGNEE: 6,
};

export function rangEtape(etape: string | null | undefined): number {
  return RANG[(etape ?? "").toUpperCase()] ?? 0;
}

/** Une ligne par (athlète, unité). La ligne gardée est la plus avancée ; à
 *  étape égale, la plus récemment déplacée. */
export function dossiersParUnite(
  lignes: readonly LignePipelineCegep[],
  sportParRecruteur: ReadonlyMap<string, string | null>,
): DossierUnite[] {
  const parCle = new Map<string, DossierUnite>();
  for (const l of lignes) {
    const sport = sportParRecruteur.get(l.recruiter_id) ?? null;
    // Sans sport : pas d'unité, le dossier est celui du recruteur seul.
    const cle = sport ? `${l.athlete_id}|${sport}` : `${l.athlete_id}|seul:${l.recruiter_id}`;
    const deja = parCle.get(cle);
    if (!deja) {
      parCle.set(cle, { ...l, sport_id: sport, suivi_par: [l.recruiter_id] });
      continue;
    }
    const suivi = deja.suivi_par.includes(l.recruiter_id) ? deja.suivi_par : [...deja.suivi_par, l.recruiter_id];
    const plusAvancee =
      rangEtape(l.stage) > rangEtape(deja.stage) ||
      (rangEtape(l.stage) === rangEtape(deja.stage) && (l.moved_at ?? "") > (deja.moved_at ?? ""));
    parCle.set(cle, plusAvancee ? { ...l, sport_id: sport, suivi_par: suivi } : { ...deja, suivi_par: suivi });
  }
  return [...parCle.values()];
}
