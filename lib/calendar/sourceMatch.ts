/* ═══════════════════════════════════════════════════════════════
   sourceMatch — d'où vient un match, et comment le vérifier.

   Décision BP du 2026-09-17 : la source et la fraîcheur s'affichent PAR
   MATCH. Le bandeau global « Basé sur le calendrier officiel RSEQ · Mis à
   jour le X » est retiré : il était faux deux fois. Faux sur la source —
   446 matchs viennent de quatre sites civils, dont 274 à venir. Faux sur la
   date — c'était `MAX(games.updated_at)`, toutes lignes confondues, alors
   que le secondaire n'a pas bougé depuis juillet et le civil depuis août.

   ── LE LIEN RSEQ SE DÉRIVE, IL N'EST PAS STOCKÉ ─────────────────
   1 484 identifiants de ligue pour 50 115 matchs : stocker l'URL aurait
   répété la même chaîne 50 000 fois et imposé une réécriture massive le
   jour où le RSEQ change d'adresse. Le motif vit ICI, une seule fois.

   ── CE QUE LE LIEN EST, ET CE QU'IL N'EST PAS ───────────────────
   Il n'existe AUCUNE page publique par match ni par ligue au RSEQ : le site
   de diffusion est une application dont l'état vit côté client, sans route
   ni ancre (vérifié le 2026-09-17). Le seul artefact stable est le
   calendrier de la ligue servi par GenerateLeagueCalendar — le bouton
   « version imprimable » du site. Vérifié en direct, saison courante ET
   saison passée : HTTP 200, `Content-Disposition: attachment`.

   Le libellé dit « Calendrier officiel RSEQ », sans mention de format : le
   clic fait exactement ce que fait l'URL collée dans un navigateur. Ce qu'il
   ne dira JAMAIS, c'est « voir ce match » — le calendrier porte la ligue
   entière, pas la rencontre, et promettre l'inverse ferait rouler un
   recruteur sur une garantie qu'on n'a pas.

   ── LE LIEN PASSE PAR NEXUS DEPUIS LE 2026-09-22 ────────────────
   Le RSEQ sert ce .xlsx en `text/html` : Chrome Android l'affichait en texte
   brut (bug 1.4.3). Le lien pointe donc vers /api/rseq/calendrier, qui
   re-sert le même fichier avec le bon type — en URL ABSOLUE, pour que l'app
   (servie depuis https://localhost) sorte vers la production.
   Voir lib/calendar/rseqCalendrier.ts.
═══════════════════════════════════════════════════════════════ */

import { estGuid, urlCalendrierRseq } from "@/lib/calendar/rseqCalendrier";

/** Ce que la carte de match a besoin de savoir sur la provenance. */
export interface SourceMatch {
  /** 'RSEQ' | 'LFMM' | 'QMFL' | 'QBFL' | 'QMJFL' — liste fermée en base. */
  nom: string | null;
  /** Adresse de vérification. `null` quand on n'en a pas : on n'invente pas. */
  url: string | null;
  /** Libellé du lien. Dit ce qui va se passer, pas ce qu'on aimerait. */
  libelle: string | null;
  /**
   * Le clic TÉLÉCHARGE-t-il un fichier, au lieu de naviguer ?
   *
   * Vrai pour le RSEQ : la réponse de /api/rseq/calendrier porte
   * `Content-Disposition: attachment` ET le type xlsx, et une navigation qui aboutit à un téléchargement
   * n'abandonne PAS le document courant — le recruteur reste sur son
   * calendrier. C'est pourquoi ce lien ne porte PAS `target="_blank"` : il
   * ouvrirait un onglet que le navigateur devrait ensuite refermer seul, et
   * Safari laisse un onglet vide derrière lui.
   *
   * ⚠ L'attribut HTML `download` NE SERT À RIEN ICI : l'URL est absolue
   * (nexussports.ca), donc d'une AUTRE origine dans l'app et sur le domaine
   * vercel.app, où la spécification le fait ignorer. Ce qui déclenche le
   * téléchargement, ce sont les en-têtes de /api/rseq/calendrier, pas notre
   * balise. Ne pas l'ajouter en croyant « sécuriser » le comportement.
   *
   * Faux pour le civil : ces pages répondent `text/html` sans disposition —
   * c'est une vraie navigation, donc `target="_blank"` pour ne pas faire
   * perdre le calendrier.
   */
  telecharge: boolean;
  /** ISO de la dernière consultation de la source. */
  collecteLe: string | null;
}

export function sourceDuMatch(row: {
  source_nom?: string | null;
  source_url?: string | null;
  collecte_le?: string | null;
  rseq_league_id?: string | null;
  /** Nom de la ligue — seulement pour le nom du fichier téléchargé. */
  league_name?: string | null;
}): SourceMatch {
  const nom = row.source_nom ?? null;
  const collecteLe = row.collecte_le ?? null;

  if (nom === "RSEQ" && estGuid(row.rseq_league_id)) {
    return {
      nom,
      url: urlCalendrierRseq(row.rseq_league_id, row.league_name),
      libelle: "Calendrier officiel RSEQ",
      telecharge: true,
      collecteLe,
    };
  }

  /* Civil : l'URL est stockée, parce qu'elle ne se déduit de rien. */
  if (row.source_url) {
    return {
      nom,
      url: row.source_url,
      libelle: "Calendrier de la ligue",
      telecharge: false,
      collecteLe,
    };
  }

  /* Ni l'un ni l'autre : on affiche la source sans lien plutôt qu'un lien
     générique qui donnerait une garantie fausse. */
  return { nom, url: null, libelle: null, telecharge: false, collecteLe };
}

/** « relevé le 16 sept. » — court, pour une ligne de carte déjà chargée. */
export function formatCollecte(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
