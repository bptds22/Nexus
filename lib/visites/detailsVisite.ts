/* ═══════════════════════════════════════════════════════════════
   Détails d'une visite planifiée — les règles, pures (web et appli).

   Retour d'un coach (BP 2026-10-18) : le calendrier montre la visite, mais
   pas qui s'en occupe, où, ni si c'est sur Zoom. Migration
   20261018120000_visites_details : la base garde, à côté de la visite,
     · le format     — en personne / Zoom / téléphone ;
     · l'adresse     — en personne ; le lien https:// — Zoom ;
     · le responsable — un recruteur de l'unité OU un nom tapé (coach hors
                        Nexus), jamais les deux ;
     · une note courte (500 caractères).
   Lecture : visites_details_unite() ; écriture : visite_details_enregistrer().
   Sans la migration (fonction absente), le calendrier reste comme avant.
═══════════════════════════════════════════════════════════════ */

export type FormatVisite = "EN_PERSONNE" | "ZOOM" | "TELEPHONE";

export const FORMATS_VISITE: { valeur: FormatVisite; libelle: string }[] = [
  { valeur: "EN_PERSONNE", libelle: "En personne" },
  { valeur: "ZOOM", libelle: "Zoom" },
  { valeur: "TELEPHONE", libelle: "Téléphone" },
];

export const LIBELLE_FORMAT: Record<FormatVisite, string> = {
  EN_PERSONNE: "En personne",
  ZOOM: "Zoom",
  TELEPHONE: "Téléphone",
};

export const MAX_ADRESSE = 300;
export const MAX_LIEN = 500;
export const MAX_RESPONSABLE = 120;
export const MAX_NOTE = 500;

/** Une ligne de visites_details_unite(). */
export interface DetailsVisite {
  athlete_id: string | null;
  carte_id: string | null;
  format: FormatVisite;
  adresse: string | null;
  lien: string | null;
  responsable_id: string | null;
  /** Nom résolu par la base : le recruteur Nexus, sinon le nom tapé. */
  responsable_nom: string | null;
  note: string | null;
  modifie_par: string | null;
  modifie_le: string | null;
}

/** Clé d'une visite du calendrier : une carte prospect porte son id de carte. */
export function cleVisite(id: string, prospect?: boolean): string {
  return `${prospect ? "carte" : "athlete"}:${id}`;
}

/** Les lignes lues, indexées par visite (cleVisite). */
export function indexerDetails(lignes: readonly DetailsVisite[]): Map<string, DetailsVisite> {
  const m = new Map<string, DetailsVisite>();
  for (const l of lignes) {
    if (l.carte_id) m.set(cleVisite(l.carte_id, true), l);
    else if (l.athlete_id) m.set(cleVisite(l.athlete_id, false), l);
  }
  return m;
}

/** Ce que la fenêtre édite. Responsable : un id Nexus OU un nom libre. */
export interface BrouillonVisite {
  format: FormatVisite;
  adresse: string;
  lien: string;
  responsableId: string | null;
  responsableNom: string;
  note: string;
}

export function brouillonDepuis(d: DetailsVisite | null | undefined): BrouillonVisite {
  return {
    format: d?.format ?? "EN_PERSONNE",
    adresse: d?.adresse ?? "",
    lien: d?.lien ?? "",
    responsableId: d?.responsable_id ?? null,
    // Le nom résolu d'un recruteur Nexus n'est pas un « nom tapé ».
    responsableNom: d?.responsable_id ? "" : d?.responsable_nom ?? "",
    note: d?.note ?? "",
  };
}

/** Paramètres de visite_details_enregistrer(), prêts à envoyer. */
export interface ParametresEnregistrement {
  p_athlete_id: string | null;
  p_carte_id: string | null;
  p_format: FormatVisite;
  p_adresse: string | null;
  p_lien: string | null;
  p_responsable_id: string | null;
  p_responsable_nom: string | null;
  p_note: string | null;
}

const net = (v: string | null | undefined) => (v ?? "").trim();

/** Mêmes règles que la base, vérifiées AVANT l'envoi. Le champ qui ne
 *  correspond pas au format (adresse pour Zoom, lien en personne) n'est pas
 *  envoyé : on ne garde pas une adresse cachée. */
export function validerVisite(
  b: BrouillonVisite,
  cible: { id: string; prospect?: boolean },
): { ok: true; params: ParametresEnregistrement } | { ok: false; erreur: string } {
  if (!FORMATS_VISITE.some((f) => f.valeur === b.format)) return { ok: false, erreur: "Choisis un format de visite." };
  const adresse = b.format === "EN_PERSONNE" ? net(b.adresse) : "";
  const lien = b.format === "ZOOM" ? net(b.lien) : "";
  const nom = net(b.responsableNom);
  if (adresse.length > MAX_ADRESSE) return { ok: false, erreur: `L'adresse fait ${MAX_ADRESSE} caractères au plus.` };
  if (lien && !/^https:\/\//i.test(lien)) return { ok: false, erreur: "Le lien Zoom doit commencer par https://" };
  if (lien.length > MAX_LIEN) return { ok: false, erreur: `Le lien fait ${MAX_LIEN} caractères au plus.` };
  if (b.responsableId && nom) return { ok: false, erreur: "Choisis un responsable sur Nexus OU tape un nom, pas les deux." };
  if (nom.length > MAX_RESPONSABLE) return { ok: false, erreur: `Le nom fait ${MAX_RESPONSABLE} caractères au plus.` };
  if (net(b.note).length > MAX_NOTE) return { ok: false, erreur: `La note fait ${MAX_NOTE} caractères au plus.` };
  return {
    ok: true,
    params: {
      p_athlete_id: cible.prospect ? null : cible.id,
      p_carte_id: cible.prospect ? cible.id : null,
      p_format: b.format,
      p_adresse: adresse || null,
      p_lien: lien || null,
      p_responsable_id: b.responsableId || null,
      p_responsable_nom: nom || null,
      p_note: net(b.note) || null,
    },
  };
}

/** Une ligne courte sous le nom, sur la carte du calendrier :
 *  « Zoom · Marc Tremblay », « En personne · 175 rue Principale ». */
export function resumeVisite(d: DetailsVisite | null | undefined): string {
  if (!d) return "";
  const lieu = d.format === "EN_PERSONNE" ? net(d.adresse) : "";
  return [LIBELLE_FORMAT[d.format], net(d.responsable_nom), lieu].filter(Boolean).join(" · ");
}

/** L'adresse dans une carte (Google Maps ouvre aussi Apple Plans sur iPhone). */
export function lienCarteAdresse(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse.trim())}`;
}

/** La migration n'est pas appliquée (fonction inconnue de PostgREST) : on se
 *  tait, le calendrier reste comme avant. */
export function fonctionAbsente(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  return e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? "");
}
