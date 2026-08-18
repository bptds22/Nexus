/* ═══════════════════════════════════════════════════════════════
   useAthleteContactable — la période de silence RSEQ, côté client.

   AUCUNE LOGIQUE DE DATES ICI, et ce n'est pas une simplification : une
   période de silence est une règle de LIGUE, versionnée, qui varie par sport
   et par promotion. Un client mobile figé dans un binaire ne peut pas la
   porter — il aurait toujours un exemplaire périmé. Le client affiche ce que
   le serveur répond, point.

   REPLI VERS « CONTACTABLE » EN CAS D'ÉCHEC. Délibéré : la règle est
   RÉGLEMENTAIRE, pas sécuritaire. Rien de confidentiel ne fuit si un
   recruteur voit un bouton actif à tort — au pire il envoie un message que
   le serveur refusera, et le trigger reste le vrai garde. À l'inverse,
   bloquer sur une coupure réseau punirait l'utilisateur pour un incident qui
   ne le regarde pas. Un verrou de sécurité se fermerait dans l'autre sens ;
   celui-ci non.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** La période telle que le serveur la rend. `null` = athlète contactable. */
export interface ActiveBlackout {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  /** null quand la période vise toutes les disciplines. */
  sport_nom: string | null;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** `2026-08-20` → « 20 août ». Parsé par composants et non via
 *  `new Date(iso)`, qui interprète une date nue en UTC et recule d'un jour
 *  à l'ouest de Greenwich — la date affichée serait fausse d'un jour. */
function jourMois(iso: string): string {
  const [, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  if (!m || !d) return iso;
  return `${d === 1 ? "1er" : d} ${MOIS[m - 1]}`;
}

/** Le lendemain de la fin — la date à laquelle le contact redevient possible.
 *  Les bornes de la période sont INCLUSES côté serveur (`between`), donc
 *  annoncer `date_fin` ferait espérer un jour trop tôt. */
function lendemain(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Message de la FICHE athlète — encart compact sous le bouton Contacter.
 *
 * « Test — contact suspendu jusqu'au 20 août inclus. »
 *
 * Une seule date, celle qui BORNE la période. La formulation précédente
 * (« suspendu à partir du 21 août ») annonçait la reprise avec le verbe de
 * la suspension : elle se lisait comme un début de blocage, soit l'inverse
 * exact du sens. On ne mentionne donc plus la date de reprise ici — « inclus »
 * lève l'ambiguïté de borne sans avoir à parler du lendemain.
 */
export function blackoutMessageFiche(b: ActiveBlackout | null): string {
  if (!b) return BLACKOUT_MESSAGE;
  return `${b.libelle} — contact suspendu jusqu'au ${jourMois(b.date_fin)} inclus.`;
}

/**
 * Message du FIL de messagerie — encart large, à la place du composeur.
 *
 * « Test — tu pourras écrire à cet athlète à partir du 21 août. »
 *
 * Ici on annonce la REPRISE, et le verbe à la deuxième personne interdit la
 * lecture inverse : « tu pourras écrire à partir du 21 » ne peut pas se
 * comprendre comme un début de blocage. La date est le LENDEMAIN de
 * `date_fin`, les bornes étant incluses côté serveur (`between`) — annoncer
 * `date_fin` ferait espérer un jour trop tôt.
 */
export function blackoutMessageFil(b: ActiveBlackout | null): string {
  if (!b) return BLACKOUT_MESSAGE;
  return `${b.libelle} — tu pourras écrire à cet athlète à partir du ${jourMois(lendemain(b.date_fin))}.`;
}

export function useAthleteContactable(athleteId: string | null | undefined) {
  const q = useQuery<ActiveBlackout | null>({
    queryKey: ["athlete-blackout", athleteId],
    enabled: !!athleteId,
    /* 60 s, plus court que le défaut global de 5 min (QueryProvider).
       Une règle de silence change rarement — mais quand elle change, l'écart
       entre l'écran et le serveur se voit : l'encart disparaît alors que
       l'envoi échoue encore, ou l'inverse. Le coût d'une revalidation est une
       RPC minuscule ; celui d'une divergence de cinq minutes est un recruteur
       qui ne comprend pas pourquoi son message part en erreur.
       Pas 0 pour autant : refetchOnMount rejouerait la requête à chaque
       montage de fiche, pour une donnée qui bouge quelques fois par saison. */
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const supabase = createClient();
      /* get_active_blackout rend AU PLUS une ligne. `maybeSingle()` traduit
         « aucune ligne » en `null` sans lever — et null vaut contactable. */
      const { data, error } = await supabase
        .rpc("get_active_blackout", { p_athlete: athleteId as string })
        .maybeSingle();
      if (error) {
        // Bruyant en console, permissif à l'écran — voir le repli ci-dessus.
        console.warn("[get_active_blackout] échec, on laisse le contact ouvert", error);
        return null;
      }
      return (data as ActiveBlackout | null) ?? null;
    },
  });

  const blackout = q.data ?? null;

  /* Pendant le chargement ET en cas d'erreur : contactable. Le bouton ne
     clignote donc jamais de « bloqué » vers « actif » — il ne se ferme que
     sur une réponse serveur explicitement positive. */
  return {
    contactable: blackout === null,
    /** La période, pour composer un message précis. Null si contactable. */
    blackout,
    /** Message prêt à afficher sur la FICHE. Le fil compose le sien
     *  avec blackoutMessageFil(blackout). */
    message: blackoutMessageFiche(blackout),
    loading: q.isLoading,
  };
}

/** Repli générique, conservé pour les cas où la période n'est pas connue
 *  (échec réseau, appel sans athlète). Ne nomme ni sport ni date : l'affirmer
 *  sans la donnée serait une déduction du client, donc un risque de mentir. */
export const BLACKOUT_MESSAGE =
  "Contact indisponible — période de restriction RSEQ en vigueur.";
