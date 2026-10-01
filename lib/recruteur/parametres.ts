/* ═══════════════════════════════════════════════════════════════
   Mon profil et Paramètres du recruteur — les règles d'écriture,
   pures et testées (décisions BP 2026-10-01).

   · Cégep et sport ne partent JAMAIS d'un formulaire du recruteur : la
     base les refuse après l'onboarding (policy `users update own` +
     recruteur_rattachement_inchange) et un seul champ refusé fait tomber
     tout l'UPDATE. Seul l'admin plateforme les change
     (changer_rattachement_recruteur).
   · Une section n'envoie QUE ses champs.
   · Les consentements (Loi 25) se FUSIONNENT dans privacy_preferences,
     jamais écrasés, et aucune date n'est jamais fabriquée : la politique
     et la collecte datent de l'inscription et ne se touchent pas d'ici ;
     le marketing garde sa date tant qu'il reste accepté, en prend une au
     moment où on l'accepte, la perd (null) quand on le retire.
═══════════════════════════════════════════════════════════════ */

export const MESSAGE_CHANGEMENT_RATTACHEMENT = "Pour changer de cégep ou de sport, écris à info@nexussports.ca";

/* ── Mon profil ─────────────────────────────────────────────── */

export interface FormMonProfil {
  firstName: string;
  lastName: string;
  title: string;
  division: string;
  teamName: string;
  region: string;
}

/** Ce que Mon profil écrit dans `users` — ni school_id, ni sport. */
export function payloadMonProfil(f: FormMonProfil) {
  return {
    first_name: f.firstName.trim(),
    last_name: f.lastName.trim(),
    title: f.title || null,
    division: f.division || null,
    team_name: f.teamName.trim() || null,
    region: f.region.trim() || null,
  };
}

/* ── Paramètres › Compte ────────────────────────────────────── */

export function payloadCompte(f: { firstName: string; lastName: string; phone?: string | null }) {
  return {
    first_name: f.firstName.trim(),
    last_name: f.lastName.trim(),
    phone: (f.phone ?? "").trim() || null,
  };
}

/* ── Paramètres › Confidentialité ───────────────────────────── */

export type PreferencesConfidentialite = Record<string, unknown>;

/** Le consentement marketing tel que l'affiche la bascule : une DATE, pas
 *  le booléen `notification_preferences.marketing_emails`, que l'inscription
 *  ne pose pas (lu, il montrait « non accepté » à des comptes qui avaient
 *  accepté, et la sauvegarde suivante effaçait leur consentement). */
export function marketingAccepte(pp: PreferencesConfidentialite | null | undefined): boolean {
  const v = pp?.consent_marketing;
  return typeof v === "string" && v.length > 0;
}

/** Fusionne le choix marketing dans les préférences ACTUELLES (relues en base
 *  juste avant l'écriture). Toutes les autres clés restent telles quelles ;
 *  la politique et la collecte ne sont jamais posées ici. */
export function fusionnerConsentementMarketing(
  actuel: PreferencesConfidentialite | null | undefined,
  accepte: boolean,
  maintenantIso: string,
): PreferencesConfidentialite {
  const base = { ...(actuel ?? {}) };
  if (accepte) {
    if (!marketingAccepte(base)) base.consent_marketing = maintenantIso;
  } else {
    base.consent_marketing = null;
  }
  return base;
}

/* ── Erreurs ────────────────────────────────────────────────── */

/** Un message lisible, jamais le texte brut de PostgREST. */
export function messageErreurSauvegarde(err: { code?: string; message?: string } | null | undefined): string {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  if (code === "42501" || msg.includes("row-level security") || msg.includes("violates")) {
    return `Enregistrement refusé. ${MESSAGE_CHANGEMENT_RATTACHEMENT}.`;
  }
  if (msg.includes("fetch") || msg.includes("network")) {
    return "Connexion interrompue : rien n'a été enregistré. Vérifie ta connexion et réessaie.";
  }
  return "L'enregistrement n'a pas abouti. Réessaie dans un instant ; si ça persiste, écris à info@nexussports.ca.";
}

/** L'échec d'envoi d'une photo : les messages de validation d'uploadImage sont
 *  déjà rédigés pour l'usager ; une erreur de Storage (UPLOAD_FAILED) arrive
 *  brute et se remplace. */
export function messagePhoto(res: { code: string; message: string }): string {
  return res.code === "UPLOAD_FAILED"
    ? "L'envoi de la photo a échoué : rien n'a été enregistré. Réessaie dans un instant."
    : res.message;
}
