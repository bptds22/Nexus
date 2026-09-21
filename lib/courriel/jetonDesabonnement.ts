/* ═══════════════════════════════════════════════════════════════
   jetonDesabonnement — le lien « Ne plus recevoir ces courriels ».

   jeton = `<user_id>.<HMAC-SHA256(secret, "desabonnement:v1:" + user_id)>`
   en base64url, sans remplissage.

   POURQUOI UN JETON SIGNÉ ET PAS UN user_id NU. Un lien portant le seul
   user_id permettrait à n'importe qui de désabonner n'importe qui en
   devinant ou en recopiant un identifiant. La signature prouve que le lien
   sort d'un courriel que NOUS avons envoyé — sans exiger de connexion, ce
   que la LCAP interdit d'imposer pour se désabonner.

   Le préfixe versionné (`desabonnement:v1:`) empêche qu'une autre signature
   HMAC du même secret, pour un autre usage, soit rejouée ici.

   ⚠ JUMEAU — supabase/functions/_shared/jetonDesabonnement.ts porte la
   MÊME implémentation pour la fonction d'envoi (Deno ne peut pas importer
   d'ici). WebCrypto pur des deux côtés, aucune dépendance. Le test
   lib/courriel/__tests__/jetonDesabonnement.test.ts vérifie que les deux
   produisent le même jeton : un écart ferait signer des liens que la route
   refuserait.
═══════════════════════════════════════════════════════════════ */

const PREFIXE = "desabonnement:v1:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64url(octets: ArrayBuffer): string {
  let bin = "";
  for (const o of new Uint8Array(octets)) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function depuisBase64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    // ArrayBuffer explicite : Uint8Array<ArrayBuffer>, accepté comme
    // BufferSource par subtle.verify (TS 5.7+ refuse ArrayBufferLike).
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function cle(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  if (!secret || secret.length < 32) {
    // Un secret court se devine : on refuse de signer plutôt que de
    // distribuer des liens forgeables.
    throw new Error("DESABONNEMENT_SECRET absent ou trop court (32 caractères minimum).");
  }
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages,
  );
}

/** Signe un jeton pour ce compte. */
export async function signerJetonDesabonnement(userId: string, secret: string): Promise<string> {
  if (!UUID_RE.test(userId)) throw new Error("user_id invalide pour un jeton de désabonnement.");
  const k = await cle(secret, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(PREFIXE + userId.toLowerCase()));
  return `${userId.toLowerCase()}.${base64url(sig)}`;
}

/** Rend le user_id si le jeton est authentique, sinon null. Ne lève pas
 *  sur un jeton mal formé : c'est une entrée publique. `subtle.verify` fait
 *  la comparaison en temps constant. */
export async function verifierJetonDesabonnement(jeton: string | null | undefined, secret: string): Promise<string | null> {
  if (!jeton || jeton.length > 200) return null;
  const point = jeton.indexOf(".");
  if (point < 0) return null;
  const userId = jeton.slice(0, point).toLowerCase();
  const sig = depuisBase64url(jeton.slice(point + 1));
  if (!UUID_RE.test(userId) || !sig) return null;
  const k = await cle(secret, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", k, sig, new TextEncoder().encode(PREFIXE + userId));
  return ok ? userId : null;
}
