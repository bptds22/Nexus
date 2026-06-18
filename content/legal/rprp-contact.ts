/* ═══════════════════════════════════════════════════════════════
   content/legal/rprp-contact.ts — iter 7.50-a-bis (legal-1)

   Coordonnées RPRP (Responsable de la Protection des Renseignements
   Personnels). Deux variantes existent dans les pages d'origine —
   on les exporte séparément pour byte-identical rendering.

   ⚠️ Données figées par BP : ne JAMAIS modifier sans accord.
═══════════════════════════════════════════════════════════════ */

type ContactRow = { label: string; value: string; href?: string };

/** Version utilisée par app/confidentialite/page.tsx : Nom + Titre
    séparés (5 lignes). */
export const RPRP_CONTACT_ROWS_FULL: ContactRow[] = [
  { label: "Nom", value: "Bruno-Philippe Taillon Desfossés Simard" },
  { label: "Titre", value: "Responsable de la protection des renseignements personnels" },
  { label: "Courriel", value: "confidentialite@nexussports.ca", href: "mailto:confidentialite@nexussports.ca" },
  { label: "Téléphone", value: "438-498-0494", href: "tel:4384980494" },
  { label: "Adresse", value: "856, rue Basile-Routhier, Repentigny (Québec) J6A 7Y4" },
];

/** Version utilisée par app/conditions/page.tsx : "RPRP" combiné
    (4 lignes, sans le titre détaillé). */
export const RPRP_CONTACT_ROWS_COMPACT: ContactRow[] = [
  { label: "RPRP", value: "Bruno-Philippe Taillon Desfossés Simard" },
  { label: "Courriel", value: "confidentialite@nexussports.ca", href: "mailto:confidentialite@nexussports.ca" },
  { label: "Téléphone", value: "438-498-0494", href: "tel:4384980494" },
  { label: "Adresse", value: "856, rue Basile-Routhier, Repentigny (Québec) J6A 7Y4" },
];
