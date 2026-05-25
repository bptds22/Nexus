/**
 * Recruiter reference data — single source of truth for the static
 * reference lists used by the recruiter parametres dropdowns
 * (Sport selector + Régions cibles multi-select).
 *
 * These are CONFIGURATION, not mock/fixture data — they're the
 * canonical lists rendered to users in production. They moved here
 * from lib/mock/recruiterSettings.ts so the import path matches
 * the semantic role (mirrors lib/config/pricing.ts, civilVocab.ts,
 * etc.).
 *
 * Known adjacent drift (NOT consolidated here — flagged for a
 * separate pass) : QC_REGIONS is also defined as an inline `const`
 * in app/admin/athletes/[id]/page.tsx and app/coach/reputation/
 * page.tsx — those local copies should be migrated to read from
 * here so a Quebec region rename or addition only needs one edit.
 */

export const RSEQ_SPORTS = [
  "Athlétisme", "Badminton", "Baseball", "Basketball", "Cheerleading",
  "Cross-country", "Danse", "Flag football", "Escrime", "Football",
  "Futsal", "Golf", "Gymnastique", "Hockey", "Judo", "Karaté", "Natation",
  "Rugby", "Ski alpin", "Ski de fond", "Soccer", "Softball", "Tennis",
  "Tennis de table", "Ultimate frisbee", "Volleyball", "Water-polo",
];

export const QC_REGIONS = [
  "Bas-Saint-Laurent", "Saguenay–Lac-Saint-Jean", "Capitale-Nationale",
  "Mauricie", "Estrie", "Montréal", "Outaouais", "Abitibi-Témiscamingue",
  "Côte-Nord", "Nord-du-Québec", "Gaspésie–Îles-de-la-Madeleine",
  "Chaudière-Appalaches", "Laval", "Lanaudière", "Laurentides",
  "Montérégie", "Centre-du-Québec",
];
