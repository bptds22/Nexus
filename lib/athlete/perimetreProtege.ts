/* ═══════════════════════════════════════════════════════════════
   perimetreProtege — les colonnes que l'athlète ne peut PAS changer,
   et comment ne pas les envoyer pour rien.

   ── POURQUOI CE MODULE EXISTE ───────────────────────────────────
   La migration `20260909191744_edition_directe_athlete` a posé en base
   le trigger `trg_athlete_self_edit_perimeter`. Quand l'écrivain est
   l'athlète LUI-MÊME (`auth.uid() = OLD.user_id`), il lève un
   `RAISE EXCEPTION` dès qu'une des colonnes ci-dessous CHANGE de valeur.
   PostgREST rend ça en HTTP 400 ; côté écran, « Échec de sauvegarde ».

   Or l'onboarding athlète envoie un `UPDATE` COMPLET : il repose
   `user_id`, `school_id`, `coach_id`, `status`, `verified` à chaque
   soumission, même quand rien n'a bougé. Sur une fiche réclamée (le
   trigger `link_athlete_on_signup` rattache l'orphelin de même courriel
   à l'inscription), le chemin devient un UPDATE — et la finalisation
   échouait alors que l'athlète n'avait RIEN touché d'interdit.

   ── CE QUE FAIT CE MODULE, ET CE QU'IL NE FAIT PAS ──────────────
   Il retire du patch les colonnes protégées dont la valeur est DÉJÀ
   celle de la base. C'est tout. Il ne contourne pas la garde : si
   l'athlète change réellement d'école, la colonne part et le trigger
   refuse — c'est le comportement voulu tant que la décision produit
   n'est pas écrite EN BASE (volet 5 de la migration D6 : pendant
   l'onboarding, `onboarding_complete = false`, école et coach
   redeviennent le choix de l'athlète).

   ── MIROIR, PAS RÉÉCRITURE ──────────────────────────────────────
   `COLONNES_PROTEGEES` recopie la liste du trigger. Si la liste change
   en base sans changer ici, le client réenverra une colonne devenue
   interdite et l'écran remontrera un 400 — bruyant, donc visible. Le
   défaut inverse (une colonne retirée du trigger et pas d'ici) ne fait
   qu'omettre une écriture qui n'aurait rien changé.
═══════════════════════════════════════════════════════════════ */

/** Miroir de `enforce_athlete_self_edit_perimeter()`. Ordre repris du SQL
 *  pour que la lecture croisée reste immédiate. */
export const COLONNES_PROTEGEES: readonly string[] = Object.freeze([
  "user_id",
  "coach_id",
  "school_id",
  "status",
  "verified",
  "verified_at",
  "verified_by",
  "verification_method",
  "cote_globale_entraineur",
  "profile_completion",
  "is_showcase",
  "consentement_parental",
  "consentement_parental_date",
  "partner_visibility_opt_in",
  "partner_visibility_opted_in_at",
  "partner_visibility_parental_consent",
  "recruitment_status",
  "recruitment_status_changed_by",
  "recruitment_status_changed_at",
  "committed_school_id",
  /* Protégée APRÈS l'onboarding seulement (migration 20260921173234) : le
     trigger la laisse passer tant que users.onboarding_complete n'est pas
     vrai. L'élagage ne retire qu'une valeur INCHANGÉE — une vraie saisie
     pendant l'onboarding part toujours, et le trigger l'accepte. */
  "date_naissance",
]);

/** Les colonnes protégées qui portent un HORODATAGE. Elles se comparent par
 *  instant, jamais par texte : la base rend « 2026-09-11 18:40:20.248+00 »
 *  là où le signup a stashé « 2026-09-11T18:40:20.248Z ». Même moment, deux
 *  écritures — une comparaison de chaînes conclurait « ça a changé » et
 *  renverrait la colonne au trigger, donc un 400 pour rien. */
const COLONNES_HORODATEES: readonly string[] = Object.freeze([
  "verified_at",
  "consentement_parental_date",
  "partner_visibility_opted_in_at",
  "recruitment_status_changed_at",
]);

/** Instantané des colonnes protégées telles qu'elles sont EN BASE.
 *  À prendre au moment où la fiche est chargée, et nulle part ailleurs :
 *  c'est la valeur de référence contre laquelle le patch se compare. */
export function instantaneProtege(ligne: Record<string, unknown>): Record<string, unknown> {
  const vu: Record<string, unknown> = {};
  for (const col of COLONNES_PROTEGEES) vu[col] = ligne[col] ?? null;
  return vu;
}

/** `undefined` et la chaîne vide valent `null` : c'est ce que la base stocke
 *  quand l'écran n'a rien, et les confondre évite un faux « ça a changé ». */
function normaliser(v: unknown): unknown {
  return v === undefined || v === "" ? null : v;
}

function memeValeur(col: string, patch: unknown, base: unknown): boolean {
  const a = normaliser(patch);
  const b = normaliser(base);
  if (a === null || b === null) return a === b;
  if (COLONNES_HORODATEES.includes(col) && typeof a === "string" && typeof b === "string") {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta === tb;
  }
  return a === b;
}

/**
 * Rend le patch débarrassé des colonnes protégées qui n'ont pas bougé.
 *
 * @param patch    le record complet que l'écran voulait écrire
 * @param instantane l'instantané pris au chargement, ou `null` quand la fiche
 *   n'a pas été chargée (chemin INSERT). Sans référence on ne retire RIEN :
 *   le trigger est `BEFORE UPDATE` seul, un INSERT n'est pas concerné, et
 *   amputer un INSERT poserait des colonnes au défaut DB en silence.
 */
export function elaguerProtegees(
  patch: Record<string, unknown>,
  instantane: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!instantane) return patch;
  const sortie: Record<string, unknown> = {};
  for (const [col, valeur] of Object.entries(patch)) {
    if (!COLONNES_PROTEGEES.includes(col)) { sortie[col] = valeur; continue; }
    if (!memeValeur(col, valeur, instantane[col])) sortie[col] = valeur;
  }
  return sortie;
}

/**
 * Sérialise une erreur Supabase/PostgREST en UNE chaîne lisible.
 *
 * POURQUOI : le pont console de Capacitor n'inspecte pas les objets — il les
 * passe à `String()`. `console.error("…:", error)` atterrit donc dans le
 * logcat en « [object Object] », et l'erreur réelle est perdue. Il a fallu
 * remonter jusqu'aux logs Supabase pour lire un message que le client avait
 * déjà en main.
 *
 * À utiliser partout où une erreur part vers `console.*` dans du code qui
 * tourne aussi en WebView.
 */
export function erreurLisible(e: unknown): string {
  if (e === null || e === undefined) return "(aucune erreur)";
  if (typeof e === "string") return e;
  if (e instanceof Error && !("code" in e)) return `${e.name}: ${e.message}`;
  const o = e as Record<string, unknown>;
  const morceaux = (["code", "message", "details", "hint"] as const)
    .filter((k) => o[k] !== null && o[k] !== undefined && o[k] !== "")
    .map((k) => `${k}=${String(o[k])}`);
  return morceaux.length > 0 ? morceaux.join(" | ") : JSON.stringify(e);
}
