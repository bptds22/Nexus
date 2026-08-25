/* ═══════════════════════════════════════════════════════════════
   Shared academic option lists.

   One source of truth for the athlete-side academic chip surfaces
   (athlete onboarding step 2, athlete profile edit, mobile editor
   AcademiqueStep). Keeping these constants here prevents drift —
   adding a new "Mention" must propagate everywhere automatically.

   Conventions :
     - String literals are stored in the JSONB columns verbatim
       (matieres_fortes / mentions_academiques / regions_cegep_preferees).
       Changing one of these strings is a DATA migration, not a UI tweak.
     - Le programme CÉGEP visé N'EST PLUS ici : il vit dans les tables
       cegep_programs / cegep_program_labels depuis T2.
═══════════════════════════════════════════════════════════════ */

export const SUBJECTS: readonly string[] = [
  "Éducation physique", "Mathématiques", "Sciences", "Français",
  "Anglais", "Histoire", "Arts", "Informatique",
] as const;

export const HONORS: readonly string[] = [
  "Tableau d'honneur",
  "Bourse sportive",
  "Étudiant-athlète de l'année",
  "Mention du directeur",
] as const;

export const CEGEP_REGIONS: readonly string[] = [
  "Montréal", "Québec", "Laurentides", "Lanaudière",
  "Montérégie", "Outaouais", "Estrie", "Sherbrooke",
] as const;

/* PROGRAMME_TYPE_OPTIONS / programmeCegepArray / programmeCegepDecode
   SUPPRIMÉS EN T2. C'était le vocabulaire à DEUX valeurs — « DEC général »
   et « Programme technique » — plus un champ libre concaténé derrière
   « Technique — ». Il a produit « Technique — Technique — Génie robotique »
   et « Technique — Sciences », et 28 athlètes sur 40 avaient répondu
   « DEC général », qui n'est pas un programme.
   Le remplaçant est cegep_programs / cegep_program_labels, lu par
   lib/queries/shared/useCegepPrograms.ts et rendu par
   components/shared/ProgrammeCegepPicker.tsx. */
