/* ID YouTube d'une URL collée — UNE seule décision, partagée par l'affichage
   (`components/ui/VideoEmbed.tsx`, client) et la route serveur
   `/api/video/resolve`. Les deux tenaient chacune leur copie : elles
   ignoraient toutes deux les Shorts.

   Formes reconnues :
     youtube.com/watch?v=<id>        (www., m., music.)
     youtube.com/shorts/<id>         ← lien « Partager » d'un Short
     youtube.com/live/<id>
     youtube.com/embed/<id>
     youtu.be/<id>

   Sans ID (chaîne, playlist, recherche) → null : la fiche retombe sur le
   lien simple, sans miniature. */

const FORMES_CHEMIN = ["shorts", "live", "embed"];

function estYoutube(hote: string): boolean {
  return hote === "youtube.com" || hote.endsWith(".youtube.com");
}

export function getYouTubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const hote = u.hostname.toLowerCase();
  const segments = u.pathname.split("/").filter(Boolean);

  if (hote === "youtu.be" || hote === "www.youtu.be") {
    return segments[0] ?? null;
  }
  if (!estYoutube(hote)) return null;

  const v = u.searchParams.get("v");
  if (v) return v;
  if (segments.length >= 2 && FORMES_CHEMIN.includes(segments[0])) {
    return segments[1];
  }
  return null;
}
