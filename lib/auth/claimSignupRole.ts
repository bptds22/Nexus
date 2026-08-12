/* ═══════════════════════════════════════════════════════════════
   claimSignupRole — reclamation du role au signup OAuth.

   Le signup OAuth ne peut pas ecrire raw_user_meta_data.role : le trigger
   handle_new_auth_user defaut donc a ATHLETE. Le web corrige au retour via
   /auth/callback (service_role), mais ce route handler est EXCLU du build
   mobile output:'export' — le natif n'a aucun chemin de correction.

   La RLS interdit l'auto-attribution ("users update own" porte
   WITH CHECK user_privileged_cols_unchanged(role, ...)), donc le seul chemin
   legitime est la RPC SECURITY DEFINER claim_signup_role.

   Migration : 20260713190000_claim_signup_role.sql
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimableRole = "ATHLETE" | "COACH" | "RECRUTEUR";
export type ClaimableContext = "scolaire" | "collegial" | "ligue_civile";

/**
 * Le compte doit-il encore reclamer un role ?
 *
 * Autorite : la DB, PAS le client. On ne DEVINE jamais "compte neuf" cote
 * client (created_at ~ last_sign_in_at est une heuristique temporelle evaluee
 * sur une horloge client — un faux positif re-attribuerait le role d'un
 * utilisateur existant). La RPC evalue EXACTEMENT le meme predicat que la
 * garde en ecriture de claim_signup_role : la decision UI et la garde ne
 * peuvent donc pas diverger.
 *
 * Fail-closed : en cas d'erreur reseau/RPC on retourne false (= pas d'ecran de
 * role). Un faux negatif degrade (l'utilisateur reste sur le defaut, bug
 * actuel) ; un faux positif re-rolerait un compte existant. Le mauvais cote de
 * l'erreur est le second.
 */
export async function needsSignupRole(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("needs_signup_role");
  if (error) {
    console.error("[claimSignupRole] needs_signup_role failed:", error.message);
    return false;
  }
  return data === true;
}

export interface ClaimResult {
  ok: boolean;
  error?: string;
}

/**
 * Pose role (+ context) sur la ligne de auth.uid(). One-shot : la RPC refuse
 * si role_claimed_at est deja pose, si l'onboarding est termine, ou si une
 * fiche athlete existe. Whitelist ATHLETE|COACH|RECRUTEUR cote DB — ADMIN et
 * PARTNER sont rejetes la, pas ici.
 *
 * context : ignore par la DB pour ATHLETE (il est pose plus tard, a
 * /athlete/onboarding) et force a 'collegial' pour RECRUTEUR. Miroir exact de
 * maybeApplySignupRole (app/auth/callback/route.ts:111-122).
 */
export async function claimSignupRole(
  supabase: SupabaseClient,
  role: ClaimableRole,
  context?: ClaimableContext | null,
): Promise<ClaimResult> {
  const { error } = await supabase.rpc("claim_signup_role", {
    p_role: role,
    p_context: context ?? null,
  });
  if (error) {
    console.error("[claimSignupRole] claim_signup_role failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────────
   Stash du role — ANDROID uniquement.

   Sur Android le flow OAuth sort de l'app (Custom Tab) et revient par le
   deep-link ca.nexussports.app://auth/callback. Le role choisi a l'ecran 0
   de SignupMobile ne survit pas a cet aller-retour : signInWithOAuth ne
   porte pas de metadata, et /auth/callback (qui corrige le role sur web) est
   exclu du build output:'export'. On le depose donc ici avant d'ouvrir
   l'onglet, et OAuthDeepLinkHandler le relit au retour.

   localStorage, pas sessionStorage : Android peut detruire l'activite (donc
   la WebView, donc sessionStorage) pendant que le Custom Tab est au premier
   plan. localStorage survit a la recreation.

   TTL : un stash orphelin (utilisateur qui abandonne le consentement) ne doit
   pas etre applique a un signup ulterieur sans rapport. La garde reelle reste
   needsSignupRole() + la RPC one-shot — le TTL n'est qu'une ceinture de plus.
───────────────────────────────────────────────────────────────── */

const STASH_KEY = "nexus.signupRole";
const STASH_TTL_MS = 10 * 60 * 1000; // 10 min — duree plausible d'un consentement OAuth

interface StashedRole {
  role: ClaimableRole;
  context: ClaimableContext | null;
  at: number;
}

export function stashSignupRole(role: ClaimableRole, context?: ClaimableContext | null): void {
  try {
    const payload: StashedRole = { role, context: context ?? null, at: Date.now() };
    localStorage.setItem(STASH_KEY, JSON.stringify(payload));
  } catch { /* storage indisponible → retour au flow interstitiel */ }
}

/** Relit le stash et le CONSOMME (lecture unique). null si absent/expire/corrompu. */
export function readSignupRole(): { role: ClaimableRole; context: ClaimableContext | null } | null {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    if (!raw) return null;
    localStorage.removeItem(STASH_KEY);

    const parsed = JSON.parse(raw) as StashedRole;
    if (!parsed?.role) return null;
    if (Date.now() - parsed.at > STASH_TTL_MS) return null;

    return { role: parsed.role, context: parsed.context ?? null };
  } catch {
    return null;
  }
}

export function clearSignupRole(): void {
  try { localStorage.removeItem(STASH_KEY); } catch { /* no-op */ }
}
