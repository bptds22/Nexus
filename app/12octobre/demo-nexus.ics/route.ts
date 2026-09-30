/* /12octobre/demo-nexus.ics — l'invitation de la démo du 12 octobre servie
   par URL (bouton « Apple / Outlook » du courriel et de la page de
   remerciement) : un clic l'ouvre dans Calendrier ou Outlook. Même .ics que
   la pièce jointe, sans participant (UID commun). Statique : généré au build. */

import { ics, EVENEMENT } from "@/supabase/functions/send-demo-inscription/evenement";

export const dynamic = "force-static";

export function GET() {
  return new Response(ics({ uid: EVENEMENT.uidPublic, maintenant: new Date("2026-09-30T12:00:00Z") }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=REQUEST",
      // inline : Safari iOS propose « Ajouter au calendrier » au lieu de
      // télécharger un fichier ; Outlook et Calendrier (macOS) l'ouvrent.
      "Content-Disposition": 'inline; filename="demo-nexus-12-octobre.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
