/**
 * Adresse de recours — SOURCE UNIQUE.
 *
 * Une seule boîte reçoit tout ce qu'un utilisateur bloqué nous écrit :
 * inscription en impasse, lien d'invitation expiré, compte désactivé, fil de
 * messagerie sans réponse, demande d'ajout d'établissement. C'est aussi
 * l'expéditeur de tous les courriels transactionnels
 * (`supabase/functions/_shared/emailLayout.ts`), donc répondre au message
 * qu'on a sous les yeux mène exactement au même endroit.
 *
 * ── POURQUOI UNE CONSTANTE (2026-09-16) ───────────────────────────────────
 * L'adresse était répétée en littéral dans six fichiers, et elle avait DÉJÀ
 * divergé : quatre surfaces disaient `info@`, trois disaient `support@`, et
 * deux fichiers s'étaient chacun fabriqué leur propre constante locale
 * (`COURRIEL_SUPPORT`, `NEXUS_CONTACT_EMAIL`) avec des valeurs différentes.
 * Personne n'avait décidé de cette divergence : elle s'est installée un
 * littéral à la fois.
 *
 * Aggravant, et c'est ce que la constante ferme vraiment : chaque site écrit
 * l'adresse DEUX fois — une fois dans le `href="mailto:…"`, une fois en texte
 * visible. Rien n'empêchait un lien d'afficher une adresse et d'en ouvrir une
 * autre.
 *
 * ⚠ NE PAS Y RANGER `confidentialite@nexussports.ca`.
 * C'est l'adresse du RPRP au sens de la Loi 25, publiée dans la politique de
 * confidentialité, les conditions et les pages de collecte. Elle doit rester
 * DISTINCTE et séparément joignable — une demande d'accès ou de rectification
 * n'est pas une demande de support, et fusionner les deux boîtes ferait perdre
 * la traçabilité d'une obligation légale.
 */

/** La boîte de recours utilisateur. Affichée en clair ET utilisée en mailto. */
export const COURRIEL_SUPPORT = "info@nexussports.ca";

/** `href` prêt à poser. Évite un `mailto:` recopié à la main sur chaque site. */
export const MAILTO_SUPPORT = `mailto:${COURRIEL_SUPPORT}`;
