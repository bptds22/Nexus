/**
 * Translate Supabase auth error messages from English to French.
 * Falls back to the original message if no mapping is found.
 * Used by both /auth and /auth/pro signup + login flows.
 */
export function translateAuthError(message: string): string {
  const lowered = message.toLowerCase();
  // Anti-énumération (item #36) : ne JAMAIS confirmer qu'un email existe déjà.
  // Message neutre — même sortie qu'un signup légitime en attente de confirmation.
  if (lowered.includes("user already registered") || lowered.includes("already exists")) {
    return "Vérifie ton email pour compléter ton inscription.";
  }
  // Réutilisation de l'ancien mot de passe (GoTrue: code `same_password`, 422).
  // Motif volontairement court : il survit à la ponctuation finale et à une
  // reformulation mineure côté serveur. Sans cette entrée, la chaîne ressortait
  // EN ANGLAIS, telle quelle — aucun des autres motifs ne la reconnaissait.
  if (lowered.includes("different from the old")) {
    return "Ton nouveau mot de passe doit être différent de l'ancien.";
  }
  // Politique de complexité (`password_required_characters` du projet). Le
  // message de GoTrue énumère les jeux de caractères exigés en clair
  // (« …at least one character of each: abcdefghij…, 0123456789. »), ce qui
  // est illisible. On reste GÉNÉRIQUE ici : la politique réellement configurée
  // vit dans le dashboard Auth et n'est lisible ni depuis le code ni depuis la
  // base — annoncer « une lettre, un chiffre et un symbole » serait affirmer
  // une règle qu'on ne peut pas vérifier.
  if (lowered.includes("at least one character of each")) {
    return "Ton mot de passe doit être plus varié — mélange majuscules, minuscules, chiffres et symboles.";
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
  // Temporisation courte de GoTrue : « For security purposes, you can only
  // request this after N seconds. » Ni « rate limit » ni « too many » n'y
  // figurent — elle échappait donc aux deux motifs ci-dessus et ressortait
  // en anglais, ou pire : sur /auth/reinitialiser elle tombait dans le repli
  // et annonçait un lien expiré. C'est une attente de QUELQUES SECONDES,
  // d'où une formulation distincte de celle du plafond ci-dessus.
  if (lowered.includes("for security purposes")) {
    return "Trop de tentatives rapprochées. Attends quelques secondes et réessaie.";
  }
  if (lowered.includes("network") || lowered.includes("fetch")) {
    return "Erreur de connexion. Vérifie ta connexion internet et réessaie.";
  }
  if (lowered.includes("email not confirmed")) {
    return "Tu dois confirmer ton email avant de te connecter. Vérifie ta boîte de réception.";
  }
  return message;
}
