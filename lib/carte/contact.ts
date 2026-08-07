/* ═══════════════════════════════════════════════════════════════
   lib/carte/contact.ts — modèle de la carte de contact scannable ("2B").

   Une carte = un objet Contact. Pour créer une carte par membre d'équipe
   plus tard, dupliquer la const et créer app/carte/<slug>/page.tsx qui rend
   depuis son propre Contact. Le rendu (app/carte/page.tsx) ne lit que ce
   modèle — aucune valeur en dur dans le JSX.
═══════════════════════════════════════════════════════════════ */

export type SocialKind = "instagram" | "tiktok" | "youtube" | "facebook";

export interface Social {
  kind: SocialKind;
  url: string;
}

export interface Contact {
  /** Nom d'affichage, rendu en deux lignes via `nameLines` (Anton italic). */
  name: string;
  /** Découpage exact du nom pour le bloc display (ex. ["Bruno-", "Philippe."]). */
  nameLines: [string, string];
  title: string;
  org: string;
  /** Affiché tel quel dans le stat block (espaces fines conservées). */
  phoneDisplay: string;
  /** Format E.164 pour le lien tel: (sans espaces). */
  phoneHref: string;
  email: string;
  /** Hôte affiché dans le stat block (sans protocole). */
  websiteDisplay: string;
  websiteHref: string;
  /** Sous-titre "lead" sous l'eyebrow. */
  headline: string;
  socials: Social[];
  /** Chemin du .vcf hébergé (statique) — chemin primaire fiable iOS/Android. */
  vcardHref: string;
  /** Nom de fichier proposé au téléchargement. */
  vcardDownloadName: string;
  /** URL App Store (fiche réelle). */
  appStore: string;
  /** URL Google Play — optionnel : masqué tant que non publié sur Play. */
  playStore?: string;
}

export const BRUNO: Contact = {
  name: "Bruno-Philippe Desfosses",
  nameLines: ["Bruno-", "Philippe."],
  title: "Cofondateur",
  org: "Nexus",
  phoneDisplay: "+1 438 498 0494",
  phoneHref: "+14384980494",
  email: "bpdesfosses@nexussports.ca",
  websiteDisplay: "nexussports.ca",
  websiteHref: "https://nexussports.ca",
  headline:
    "Le réseau qui relie les athlètes du Québec aux programmes sport-études.",
  socials: [
    { kind: "instagram", url: "https://www.instagram.com/nexussportsca/" },
    { kind: "tiktok", url: "https://www.tiktok.com/@nexussports.ca" },
    { kind: "youtube", url: "https://www.youtube.com/@nexussportsca" },
    { kind: "facebook", url: "https://www.facebook.com/nexussportsca" },
  ],
  vcardHref: "/carte/bruno-philippe-desfosses.vcf",
  vcardDownloadName: "Bruno-Philippe.vcf",
  appStore: "https://apps.apple.com/ca/app/nexus/id6785596805",
  // Fiche Play en ligne → badge réaffiché (app/carte/page.tsx:219 le rend
  // sous condition, aucun autre changement requis). Source de vérité partagée
  // par le reste de l'app : lib/config/appStores.ts.
  playStore: "https://play.google.com/store/apps/details?id=ca.nexussports.app",
};
