/* ═══════════════════════════════════════════════════════════════
   liensSociaux — les PROFILS de réseaux sociaux de l'athlète, et la
   normalisation de TOUS ses liens (décision BP 2026-10-18).

   ── DEUX FAMILLES ───────────────────────────────────────────────
   · Vidéos : faits saillants, Hudl, YouTube, match complet,
     entraînement — des URL libres, qu'on ASSAINIT seulement.
   · Réseaux sociaux : Instagram, Facebook, TikTok, LinkedIn (BP : pas
     Snapchat, pas X). L'athlète peut taper « @pseudo », « pseudo »,
     « instagram.com/pseudo » ou l'adresse complète : on construit
     l'URL https:// du profil.

   ── RÈGLES ──────────────────────────────────────────────────────
   · vide → null (on efface) ;
   · seulement http(s) ; http:// devient https:// ; « javascript: »,
     « data: »… sont refusés ;
   · 300 caractères au plus pour un réseau (contrainte en base,
     migration 20261018150000) ;
   · un lien d'une AUTRE plateforme dans un champ de réseau est refusé
     (« Ce lien n'est pas un lien TikTok »).
   Fonctions pures : aucune dépendance à React ni à Supabase.
═══════════════════════════════════════════════════════════════ */

export type CleReseau = "instagram" | "facebook" | "tiktok" | "linkedin";

export interface Reseau {
  cle: CleReseau;
  /** Colonne de `athletes`. */
  colonne: "instagram_url" | "facebook_url" | "tiktok_url" | "linkedin_url";
  libelle: string;
  /** Domaines reconnus (sans www.). */
  domaines: readonly string[];
  /** Pseudo seul → URL du profil. */
  versUrl: (pseudo: string) => string;
  /** Caractères admis dans un pseudo tapé seul. */
  pseudo: RegExp;
}

export const RESEAUX: readonly Reseau[] = [
  {
    cle: "instagram", colonne: "instagram_url", libelle: "Instagram",
    domaines: ["instagram.com", "instagr.am"],
    versUrl: (p) => `https://www.instagram.com/${p}`,
    pseudo: /^[A-Za-z0-9._]{1,30}$/,
  },
  {
    cle: "facebook", colonne: "facebook_url", libelle: "Facebook",
    domaines: ["facebook.com", "fb.com", "m.facebook.com"],
    versUrl: (p) => `https://www.facebook.com/${p}`,
    pseudo: /^[A-Za-z0-9.]{1,50}$/,
  },
  {
    cle: "tiktok", colonne: "tiktok_url", libelle: "TikTok",
    domaines: ["tiktok.com"],
    versUrl: (p) => `https://www.tiktok.com/@${p}`,
    pseudo: /^[A-Za-z0-9._]{1,24}$/,
  },
  {
    cle: "linkedin", colonne: "linkedin_url", libelle: "LinkedIn",
    domaines: ["linkedin.com"],
    versUrl: (p) => `https://www.linkedin.com/in/${p}`,
    pseudo: /^[A-Za-z0-9\-_]{3,100}$/,
  },
];

export const RESEAU_PAR_CLE: Record<CleReseau, Reseau> = Object.fromEntries(
  RESEAUX.map((r) => [r.cle, r]),
) as Record<CleReseau, Reseau>;

export const MAX_RESEAU = 300;
const MAX_LIEN = 2000;

export type ResultatLien = { ok: true; url: string | null } | { ok: false; erreur: string };

const SCHEMA = /^[a-z][a-z0-9+.-]*:/i;

/** Hôte sans www., ou null. */
function hoteDe(u: URL): string {
  return u.hostname.replace(/^www\./, "").toLowerCase();
}

/** Texte → URL http(s) analysée, ou un refus. Ajoute https:// à « domaine.com/… ». */
function analyser(saisie: string): URL | "schema" | null {
  let s = saisie.trim();
  if (SCHEMA.test(s)) {
    if (!/^https?:\/\//i.test(s)) return "schema";
  } else if (/^[^\s/]+\.[^\s/]+/.test(s)) {
    s = `https://${s.replace(/^\/+/, "")}`;
  } else {
    return null;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "schema";
    if (!u.hostname.includes(".")) return null;
    u.protocol = "https:";
    return u;
  } catch {
    return null;
  }
}

/** Lien VIDÉO (ou tout lien libre) : assaini seulement — une URL valide n'est pas réécrite,
 *  sauf http:// → https://. « hudl.com/video/1 » reçoit https://. */
export function normaliserLien(saisie: string | null | undefined): ResultatLien {
  const s = (saisie ?? "").trim();
  if (!s) return { ok: true, url: null };
  const u = analyser(s);
  if (u === "schema") return { ok: false, erreur: "Seuls les liens web (https://) sont acceptés." };
  if (!u) return { ok: false, erreur: "Ce n'est pas un lien valide. Colle l'adresse complète (https://…)." };
  const url = /^http:\/\//i.test(s) ? u.toString() : (/^https:\/\//i.test(s) ? s : u.toString());
  if (url.length > MAX_LIEN) return { ok: false, erreur: "Lien trop long." };
  return { ok: true, url };
}

/** Profil de RÉSEAU SOCIAL : pseudo ou lien → URL https:// du profil. */
export function normaliserReseau(cle: CleReseau, saisie: string | null | undefined): ResultatLien {
  const r = RESEAU_PAR_CLE[cle];
  const s = (saisie ?? "").trim();
  if (!s) return { ok: true, url: null };

  // Pseudo seul : « @pseudo » ou « pseudo ».
  const pseudo = s.replace(/^@+/, "");
  if (!SCHEMA.test(s) && !s.includes("/") && !/\.(com|am|ca|net|org)$/i.test(pseudo) && r.pseudo.test(pseudo)) {
    return { ok: true, url: r.versUrl(pseudo) };
  }

  const u = analyser(s);
  if (u === "schema") return { ok: false, erreur: "Seuls les liens web (https://) sont acceptés." };
  if (!u) return { ok: false, erreur: `Tape ton @pseudo ${r.libelle} ou colle le lien de ton profil.` };
  const h = hoteDe(u);
  const estDuReseau = r.domaines.some((d) => h === d || h.endsWith(`.${d}`));
  if (!estDuReseau) return { ok: false, erreur: `Ce lien n'est pas un lien ${r.libelle}.` };
  if (u.pathname === "/" || u.pathname === "") {
    return { ok: false, erreur: `Ce lien mène à l'accueil de ${r.libelle}, pas à ton profil.` };
  }
  const url = u.toString().replace(/\/$/, "");
  if (url.length > MAX_RESEAU) return { ok: false, erreur: `Lien trop long (${MAX_RESEAU} caractères au plus).` };
  return { ok: true, url };
}

/** Valeur ENREGISTRÉE → href sûr, ou null (on n'affiche alors rien de cliquable).
 *  Rattrape les anciennes saisies : « nicho_hebert » dans Instagram devient le profil. */
export function lienAffichable(valeur: string | null | undefined, reseau?: CleReseau): string | null {
  if (!valeur || !valeur.trim()) return null;
  const res = reseau ? normaliserReseau(reseau, valeur) : normaliserLien(valeur);
  return res.ok ? res.url : null;
}

/** Les profils renseignés d'un athlète, dans l'ordre d'affichage, avec un href sûr. */
export function profilsSociaux(liens: Partial<Record<Reseau["colonne"], string | null | undefined>>): { cle: CleReseau; libelle: string; url: string }[] {
  return RESEAUX.flatMap((r) => {
    const url = lienAffichable(liens[r.colonne], r.cle);
    return url ? [{ cle: r.cle, libelle: r.libelle, url }] : [];
  });
}

/** À l'ENREGISTREMENT, quand l'écran n'a pas pu montrer l'erreur (assistants coach, admin) :
 *  la valeur normalisée, ou null si elle est invalide — jamais une valeur que la base refuserait. */
export function pourEnregistrerReseau(cle: CleReseau, saisie: unknown): string | null {
  const r = normaliserReseau(cle, typeof saisie === "string" ? saisie : null);
  return r.ok ? r.url : null;
}

export function pourEnregistrerLien(saisie: unknown): string | null {
  const r = normaliserLien(typeof saisie === "string" ? saisie : null);
  return r.ok ? r.url : null;
}
