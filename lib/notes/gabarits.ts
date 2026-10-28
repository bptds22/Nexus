/* Gabarits courts, OPTIONNELS, pour aller plus vite (1.4.5, option C du R6).
   Un toucher insère la phrase dans la note ; rien n'est imposé, rien n'est
   envoyé seul. Courts exprès : on les complète au clavier ou à la voix. */

export const GABARITS_NOTE: readonly string[] = [
  "À suivre de près",
  "À revoir en match",
  "Rappeler après le match",
  "Parler au parent",
  "Demander une vidéo",
  "Confirmer taille et poids",
];

/** Ajoute un gabarit à la fin du texte : sur sa propre ligne si le texte n'est pas vide. */
export function insererGabarit(texte: string, gabarit: string): string {
  if (!texte.trim()) return `${gabarit} — `;
  const sep = texte.endsWith("\n") ? "" : "\n";
  return `${texte}${sep}${gabarit} — `;
}
