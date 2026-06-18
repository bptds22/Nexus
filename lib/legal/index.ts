import { Capacitor } from '@capacitor/core';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const LEGAL_BUCKET = 'legal-documents';

export const LEGAL_DOCUMENTS = {
  confidentialite: {
    title: 'Politique de confidentialité',
    url: `${SUPABASE_URL}/storage/v1/object/public/${LEGAL_BUCKET}/confidentialite.pdf`,
  },
  conditions: {
    title: "Conditions d'utilisation",
    url: `${SUPABASE_URL}/storage/v1/object/public/${LEGAL_BUCKET}/conditions.pdf`,
  },
  collecteDonnees: {
    title: 'Avis de collecte des données personnelles',
    url: `${SUPABASE_URL}/storage/v1/object/public/${LEGAL_BUCKET}/collecte-donnees.pdf`,
  },
} as const;

export type LegalDocKey = keyof typeof LEGAL_DOCUMENTS;

/**
 * Ouvre un document légal :
 * - Sur mobile (Capacitor) : in-app browser via @capacitor/browser
 * - Sur web : nouvel onglet
 */
export async function openLegalDocument(key: LegalDocKey): Promise<void> {
  const doc = LEGAL_DOCUMENTS[key];

  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: doc.url, presentationStyle: 'popover' });
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  }
}
