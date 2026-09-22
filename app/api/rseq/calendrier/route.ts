import {
  RSEQ_GENERATE_CALENDAR,
  TYPE_XLSX,
  estGuid,
  nomFichierCalendrier,
  ressembleAXlsx,
} from "@/lib/calendar/rseqCalendrier";

/* ═══════════════════════════════════════════════════════════════
   GET /api/rseq/calendrier?leagueId=<guid>[&ligue=<slug>]

   Re-sert le calendrier de ligue RSEQ avec le BON type
   (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet) : le
   RSEQ répond text/html, et Chrome Android affiche alors le binaire au lieu
   de le télécharger. Détail et garde-fous : lib/calendar/rseqCalendrier.ts.

   · leagueId : GUID strict, sinon 400. La route ne contacte QUE l'adresse
     RSEQ fixe — aucune URL n'entre par la requête.
   · ligue : facultatif, sert au nom du fichier, réduit à [a-z0-9-].
   · Le RSEQ en panne, lent (20 s) ou qui répond autre chose qu'un classeur
     → 502 avec une page lisible, jamais un corps RSEQ relayé tel quel.

   Pas de session exigée : le fichier est public chez le RSEQ, la carte de
   match le montre déjà à qui voit le match. Web seulement (masquée au build
   mobile, scripts/build-mobile.mjs) — l'app l'appelle en URL absolue.
═══════════════════════════════════════════════════════════════ */

export const dynamic = "force-dynamic";

const DELAI_MS = 20_000;
/** Un calendrier de ligue fait ~130 ko ; au-delà de 15 Mo, ce n'en est pas un. */
const TAILLE_MAX = 15 * 1024 * 1024;

const ENTETES_RSEQ = {
  "User-Agent": "Mozilla/5.0 (compatible; Nexus/1.0; calendrier de ligue pour nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};

function pageErreur(statut: number, message: string): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendrier RSEQ</title></head><body style="margin:0;background:#111317;color:#EDEFF3;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center"><p style="max-width:420px;font-size:16px;line-height:1.5">${message}</p></body></html>`;
  return new Response(html, {
    status: statut,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const leagueId = params.get("leagueId");
  if (!estGuid(leagueId)) {
    return pageErreur(400, "Ce lien de calendrier n'est pas valide.");
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${RSEQ_GENERATE_CALENDAR}${leagueId}`, {
      headers: ENTETES_RSEQ,
      signal: AbortSignal.timeout(DELAI_MS),
      cache: "no-store",
    });
  } catch {
    return pageErreur(502, "Le site du RSEQ ne répond pas pour le moment. Réessaie dans quelques minutes.");
  }

  if (!reponse.ok) {
    return pageErreur(502, "Le RSEQ n'a pas pu fournir ce calendrier. Réessaie dans quelques minutes.");
  }
  const annonce = Number(reponse.headers.get("content-length") ?? "0");
  if (annonce > TAILLE_MAX) {
    return pageErreur(502, "Le RSEQ a renvoyé un fichier inattendu.");
  }

  const octets = new Uint8Array(await reponse.arrayBuffer());
  if (octets.byteLength > TAILLE_MAX || !ressembleAXlsx(octets)) {
    return pageErreur(502, "Le RSEQ a renvoyé un fichier inattendu.");
  }

  return new Response(octets, {
    status: 200,
    headers: {
      "Content-Type": TYPE_XLSX,
      "Content-Disposition": `attachment; filename="${nomFichierCalendrier(leagueId, params.get("ligue"))}"`,
      "Content-Length": String(octets.byteLength),
      "X-Content-Type-Options": "nosniff",
      // Un calendrier bouge (reports, lieux) : 10 min au CDN, pas plus.
      "Cache-Control": "public, max-age=0, s-maxage=600",
    },
  });
}
