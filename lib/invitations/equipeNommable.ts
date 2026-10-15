/* ═══════════════════════════════════════════════════════════════
   Règle RSEQ (décision BP du 2026-10-15) — ce qu'un écran destiné à un
   athlète peut dire d'une équipe qui l'invite.

   Une équipe n'est NOMMÉE (nom, école, détails) que si c'est une équipe
   secondaire ou civile — le monde du jeune. Une équipe ou une école
   collégiale, ou de type inconnu, ne l'est jamais : pas de nom, pas d'école,
   pas de sport, rien qui permette de deviner le cégep. Aucun écran ne nomme
   non plus le coach.

   Miroir de la base : notify_team_invitation_email ne transmet le nom de
   l'équipe au courriel que pour ces deux mêmes types.
═══════════════════════════════════════════════════════════════ */

/** Types d'établissement dont l'équipe peut être nommée à l'athlète. */
export const TYPES_NOMMABLES = ["SECONDAIRE", "LIGUE_CIVILE"] as const;

/** Vrai seulement pour une équipe secondaire ou civile. Inconnu → faux. */
export function equipeNommable(typeEcole: unknown): boolean {
  return typeof typeEcole === "string"
    && (TYPES_NOMMABLES as readonly string[]).includes(typeEcole.trim().toUpperCase());
}

/** Titre de la carte d'invitation.
 *  Nommable : « Invitation de {Équipe} — {École} » (l'école est omise si absente).
 *  Sinon : « Invitation à rejoindre une équipe », sans aucun nom. */
export function titreInvitation(o: { typeEcole: unknown; equipe: string | null | undefined; ecole: string | null | undefined }): string {
  const equipe = (o.equipe ?? "").trim();
  if (!equipeNommable(o.typeEcole) || !equipe) return "Invitation à rejoindre une équipe";
  const ecole = (o.ecole ?? "").trim();
  return `Invitation de ${equipe}${ecole ? ` — ${ecole}` : ""}`;
}
