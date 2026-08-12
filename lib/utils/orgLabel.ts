/**
 * Phase 6.2 — Helper centralisé pour la terminologie organisationnelle.
 *
 * Le modèle DB unifié (schools avec type discriminator) signifie qu'une
 * "school" peut être SECONDAIRE, CEGEP, ou LIGUE_CIVILE. L'UI doit
 * parler le langage du contexte de l'utilisateur :
 *
 * - Coach école : "Mon école", "Sélectionne ton école"
 * - Coach civil : "Ma ligue", "Sélectionne ta ligue"
 * - Recruteur (cross-context) : "Établissement" (générique)
 *
 * Ce helper centralise tous les labels pour éviter les ternaires inline.
 */

export type SchoolType = 'SECONDAIRE' | 'CEGEP' | 'LIGUE_CIVILE';

export type Audience = 'self' | 'recruiter' | 'admin';

/**
 * Retourne le mot court correspondant au type d'organisation.
 *
 * @example
 *   orgLabel('LIGUE_CIVILE', 'self')      → 'ligue'
 *   orgLabel('SECONDAIRE', 'self')        → 'école'
 *   orgLabel('CEGEP', 'self')             → 'cégep'
 *   orgLabel(anyType, 'recruiter')        → 'établissement'
 */
export function orgLabel(type: SchoolType | null | undefined, audience: Audience = 'self'): string {
  if (audience === 'recruiter') return 'établissement';
  if (audience === 'admin') return 'établissement';

  switch (type) {
    case 'LIGUE_CIVILE':
      return 'ligue';
    case 'CEGEP':
      return 'cégep';
    case 'SECONDAIRE':
      return 'école';
    default:
      return 'établissement';
  }
}

/**
 * Possessif : "Mon école" / "Ma ligue" / "Mon cégep".
 *
 * @example
 *   orgLabelPossessive('LIGUE_CIVILE') → 'Ma ligue'
 *   orgLabelPossessive('SECONDAIRE')   → 'Mon école'
 *   orgLabelPossessive('CEGEP')        → 'Mon cégep'
 */
export function orgLabelPossessive(type: SchoolType | null | undefined): string {
  switch (type) {
    case 'LIGUE_CIVILE':
      return 'Ma ligue';
    case 'CEGEP':
      return 'Mon cégep';
    case 'SECONDAIRE':
      return 'Mon école';
    default:
      return 'Mon établissement';
  }
}

/**
 * Placeholder pour un input de search/select.
 *
 * @example
 *   orgPlaceholder('LIGUE_CIVILE') → 'Sélectionne ta ligue'
 *   orgPlaceholder('SECONDAIRE')   → 'Sélectionne ton école'
 */
export function orgPlaceholder(type: SchoolType | null | undefined): string {
  switch (type) {
    case 'LIGUE_CIVILE':
      return 'Sélectionne ta ligue';
    case 'CEGEP':
      return 'Sélectionne ton cégep';
    case 'SECONDAIRE':
      return 'Sélectionne ton école';
    default:
      return 'Sélectionne ton établissement';
  }
}

/* ─────────────────────────────────────────────────────────────────
   Nom d'ENTITÉ de l'organisation (chantier #4 — décision BP).

   ⚠️ Distinct de orgLabel() : orgLabel('LIGUE_CIVILE') reste 'ligue'
   (vocabulaire d'ONBOARDING — « Sélectionne ta ligue »). Ici, hors
   onboarding, un club LIGUE_CIVILE est une CORPORATION qui se nomme
   « club », JAMAIS « école ». Ne PAS remplacer orgLabel par orgNoun
   dans les surfaces d'onboarding.
   ───────────────────────────────────────────────────────────────── */

/**
 * Nom nu de l'organisation.
 *
 * @example
 *   orgNoun('LIGUE_CIVILE') → 'club'
 *   orgNoun('SECONDAIRE')   → 'école'
 *   orgNoun('CEGEP')        → 'cégep'
 *   orgNoun(null)           → 'établissement'
 */
export function orgNoun(type: SchoolType | null | undefined): string {
  switch (type) {
    case 'LIGUE_CIVILE':
      return 'club';
    case 'CEGEP':
      return 'cégep';
    case 'SECONDAIRE':
      return 'école';
    default:
      return 'établissement';
  }
}

/**
 * Possessif contracté avec « ton » (invariable en genre ici) — pour les
 * tournures « de ton … » / « à ton … ».
 *
 * @example
 *   `de ${orgNounPossessif('LIGUE_CIVILE')}` → 'de ton club'
 *   `à ${orgNounPossessif('SECONDAIRE')}`    → 'à ton école'
 */
export function orgNounPossessif(type: SchoolType | null | undefined): string {
  return `ton ${orgNoun(type)}`;
}

/**
 * Génitif contracté « de + article » — respecte l'élision (« de l'école »
 * vs « du club »). Pour les libellés impersonnels « … de l'école ».
 *
 * @example
 *   `Athlètes ${orgNounDe('LIGUE_CIVILE')}` → 'Athlètes du club'
 *   `Athlètes ${orgNounDe('SECONDAIRE')}`   → "Athlètes de l'école"
 */
export function orgNounDe(type: SchoolType | null | undefined): string {
  switch (type) {
    case 'LIGUE_CIVILE':
      return 'du club';
    case 'CEGEP':
      return 'du cégep';
    case 'SECONDAIRE':
      return "de l'école";
    default:
      return "de l'établissement";
  }
}

/**
 * Démonstratif accordé en genre — « ce club » / « cette école » /
 * « ce cégep » / « cet établissement ». Pour « à cette école ».
 *
 * @example
 *   `à ${orgNounCe('LIGUE_CIVILE')}` → 'à ce club'
 *   `à ${orgNounCe('SECONDAIRE')}`   → 'à cette école'
 */
export function orgNounCe(type: SchoolType | null | undefined): string {
  switch (type) {
    case 'LIGUE_CIVILE':
      return 'ce club';
    case 'CEGEP':
      return 'ce cégep';
    case 'SECONDAIRE':
      return 'cette école';
    default:
      return 'cet établissement';
  }
}

/**
 * Convertit un users.context en SchoolType pour les queries filtrées.
 *
 * @example
 *   contextToSchoolTypes('ligue_civile') → ['LIGUE_CIVILE']
 *   contextToSchoolTypes('scolaire')     → ['SECONDAIRE']
 *   contextToSchoolTypes('collegial')    → ['CEGEP']
 *
 * Utilisé dans le picker du wizard pour filtrer schools.type selon le
 * context du coach.
 */
export function contextToSchoolTypes(context: string | null | undefined): SchoolType[] {
  switch (context) {
    case 'ligue_civile':
      return ['LIGUE_CIVILE'];
    case 'scolaire':
      return ['SECONDAIRE'];
    case 'collegial':
      return ['CEGEP'];
    default:
      return ['SECONDAIRE', 'CEGEP', 'LIGUE_CIVILE'];
  }
}

/**
 * Helper inverse : un schools.type est-il du civil ?
 * Utile pour les bool flags dans le code (`isCivil` derivation).
 */
export function isCivilType(type: SchoolType | null | undefined): boolean {
  return type === 'LIGUE_CIVILE';
}
