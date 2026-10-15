/* Suggestion de correction d'un courriel mal écrit, à l'inscription (D1, 2026-10-15).

   Le courriel n'est pas confirmé à l'inscription (choix assumé : la confirmation
   casserait la liaison Google, voir app/auth/callback/route.ts). Une adresse en
   « gmail.con » ouvre donc un compte qui marche… jusqu'au mot de passe oublié :
   le jeune ne reçoit rien et se réinscrit. Deux des quatre doublons relevés en
   prod le 2026-10-15 avaient cette origine (gmail.con, icloud.con).

   On SUGGÈRE, on ne corrige jamais en silence : « mail.com » ou un domaine
   d'école est une vraie adresse. Module PUR, partagé web / mobile. */

/** Domaines connus : jamais corrigés, et cibles des corrections. */
const DOMAINES_CONNUS = [
  "gmail.com", "hotmail.com", "hotmail.ca", "hotmail.fr", "outlook.com", "outlook.fr",
  "live.com", "live.ca", "msn.com", "icloud.com", "me.com", "mac.com", "yahoo.com", "yahoo.ca",
  "yahoo.fr", "ymail.com", "videotron.ca", "sympatico.ca", "bell.net", "cgocable.ca",
  "globetrotter.net", "protonmail.com", "proton.me", "aol.com", "gmx.com", "mail.com",
];

/** Fautes de terminaison courantes : la dernière partie du domaine. */
const TERMINAISONS_FAUTIVES: Record<string, string> = {
  con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", cpm: "com", comm: "com",
  coom: "com", cim: "com", om: "com", co: "com", cm: "com",
};

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length][b.length];
}

/** Le domaine connu le plus proche (distance ≤ 2, une seule meilleure cible), ou null. */
function domaineProche(domaine: string): string | null {
  let meilleur: string | null = null;
  let dMin = Infinity;
  let egalite = false;
  for (const connu of DOMAINES_CONNUS) {
    const dist = distance(domaine, connu);
    if (dist < dMin) { dMin = dist; meilleur = connu; egalite = false; }
    else if (dist === dMin) egalite = true;
  }
  // Un domaine court tolère moins : « me.co » n'est pas assez loin de tout pour deviner.
  const tolerance = domaine.length >= 8 ? 2 : 1;
  return meilleur && dMin > 0 && dMin <= tolerance && !egalite ? meilleur : null;
}

/** Rend l'adresse corrigée à proposer, ou null si rien à suggérer. */
export function suggestionCourriel(saisie: string): string | null {
  const courriel = saisie.trim();
  const at = courriel.lastIndexOf("@");
  if (at <= 0 || at === courriel.length - 1) return null;
  const local = courriel.slice(0, at);
  const domaine = courriel.slice(at + 1).toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domaine) || !domaine.includes(".")) return null;
  if (DOMAINES_CONNUS.includes(domaine)) return null;

  // 1. Terminaison fautive sur un domaine connu (gmail.con, icloud.cmo).
  const morceaux = domaine.split(".");
  const fin = morceaux[morceaux.length - 1];
  const corrigeeFin = TERMINAISONS_FAUTIVES[fin];
  if (corrigeeFin) {
    const candidat = [...morceaux.slice(0, -1), corrigeeFin].join(".");
    if (DOMAINES_CONNUS.includes(candidat)) return `${local}@${candidat}`;
    const proche = domaineProche(candidat);
    if (proche) return `${local}@${proche}`;
  }

  // 2. Domaine connu mal tapé (gmial.com, hotmial.com, outlok.com).
  const proche = domaineProche(domaine);
  return proche ? `${local}@${proche}` : null;
}
