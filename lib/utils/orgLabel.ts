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
