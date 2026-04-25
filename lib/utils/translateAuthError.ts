/**
 * Translate Supabase auth error messages from English to French.
 * Falls back to the original message if no mapping is found.
 * Used by both /auth and /auth/pro signup + login flows.
 */
export function translateAuthError(message: string): string {
  const lowered = message.toLowerCase();
  if (lowered.includes("user already registered") || lowered.includes("already exists")) {
    return "Cet email est déjà utilisé. Connecte-toi ou utilise un autre email.";
  }
  if (lowered.includes("password") && lowered.includes("6 characters")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (lowered.includes("invalid email") || lowered.includes("email address")) {
    return "Adresse email invalide.";
  }
  if (lowered.includes("invalid login credentials") || lowered.includes("invalid credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (lowered.includes("rate limit") || lowered.includes("too many")) {
    return "Trop de tentatives. Attends quelques minutes avant de réessayer.";
  }
  if (lowered.includes("network") || lowered.includes("fetch")) {
    return "Erreur de connexion. Vérifie ta connexion internet et réessaie.";
  }
  if (lowered.includes("email not confirmed")) {
    return "Tu dois confirmer ton email avant de te connecter. Vérifie ta boîte de réception.";
  }
  return message;
}
