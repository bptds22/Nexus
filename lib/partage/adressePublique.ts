/* adressePublique — l'origine des liens qu'on ENVOIE ou qu'on OUVRE hors de l'appli.

   Dans l'appli, `window.location.origin` est l'adresse locale de la WebView
   (capacitor://localhost, http://localhost) : un lien bâti dessus ne mène
   nulle part chez celui qui le reçoit. La base est donc NEXT_PUBLIC_APP_URL,
   que scripts/build-mobile.mjs inline avec le domaine déployé — la même
   variable que les liens de /claim et le paiement mobile.
   Web : NEXT_PUBLIC_APP_URL aussi s'il est posé, sinon l'origine courante. */

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
export const DOMAINE_PUBLIC = "https://nexussports.ca";

export function adressePublique(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (env) return env;
  if (IS_CAPACITOR || typeof window === "undefined") return DOMAINE_PUBLIC;
  return window.location.origin;
}
