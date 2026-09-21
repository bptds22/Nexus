/* ═══════════════════════════════════════════════════════════════
   partagerLien — la cascade de partage, en un seul endroit.

     1. partage NATIF (@capacitor/share) — dans l'app : la feuille iOS /
        Android ;
     2. navigator.share — Safari iOS, Chrome Android, Edge / Chrome bureau ;
     3. COPIE du lien dans le presse-papier (décision BP 2026-09-21 : oui, en
        dernier recours) — navigator.clipboard, puis textarea + execCommand
        pour une origine non sécurisée (http sur une adresse LAN, où
        navigator.clipboard est `undefined`).

   Même ordre que la cascade déjà utilisée par le partage de profil
   (AthleteRecruiterProfileBodyMobile). Une ANNULATION par l'utilisateur
   (AbortError, feuille fermée) n'est PAS un échec : on ne retombe pas sur la
   copie, qui surprendrait quelqu'un qui vient de fermer la feuille.

   L'URL n'est JAMAIS rendue à l'écran par ce module : le jeton qu'elle porte
   ne doit pas s'afficher (décision BP).
═══════════════════════════════════════════════════════════════ */

export type IssuePartage = "partage" | "copie" | "annule" | "echec";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

function estAnnulation(e: unknown): boolean {
  const nom = (e as { name?: string } | null)?.name ?? "";
  const msg = (e as { message?: string } | null)?.message ?? "";
  return nom === "AbortError" || /cancel|annul|abort/i.test(msg);
}

async function copier(url: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch { /* on tente le repli */ }
  try {
    const z = document.createElement("textarea");
    z.value = url;
    z.setAttribute("readonly", "");
    z.style.position = "fixed";
    z.style.opacity = "0";
    document.body.appendChild(z);
    z.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(z);
    return ok;
  } catch {
    return false;
  }
}

export async function partagerLien(opts: { url: string; titre: string; texte: string }): Promise<IssuePartage> {
  const { url, titre, texte } = opts;

  if (IS_CAPACITOR) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: titre, text: texte, url, dialogTitle: titre });
      return "partage";
    } catch (e) {
      if (estAnnulation(e)) return "annule";
      /* plugin absent ou refusé : on continue la cascade */
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: titre, text: texte, url });
      return "partage";
    } catch (e) {
      if (estAnnulation(e)) return "annule";
      /* NotAllowedError, etc. : on retombe sur la copie */
    }
  }

  return (await copier(url)) ? "copie" : "echec";
}
