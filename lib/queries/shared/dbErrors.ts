// lib/queries/shared/dbErrors.ts
// ============================================================================
// Traduction des erreurs d'écriture, PARTAGÉE par les deux éditeurs (page école
// et page équipe). Elle vivait en double dans editorContext.tsx et
// teamEditorContext.tsx ; les quatre sauvegardes « remplacement » traversent
// les deux, donc une troisième copie n'était pas tenable.
// ============================================================================

/** Marque posée par les sauvegardes qui SUPPRIMENT avant de réinsérer. Quand
 *  l'insert échoue, les lignes ne sont plus en base — mais l'éditeur les a
 *  encore en mémoire (saveAll s'arrête sans vider dirtyKeys), donc un second
 *  « Enregistrer » les rétablit. Ce que l'utilisateur ne doit surtout pas
 *  faire, c'est recharger la page : là, la perte devient définitive. */
interface ErreurApresSuppression { nexusApresSuppression?: string }

/** Enrobe l'erreur d'un INSERT survenu APRÈS un DELETE réussi.
 *  `quoi` nomme les lignes au pluriel, tel qu'affiché : « Tes cartes campus ». */
export function apresSuppression(e: unknown, quoi: string): Error {
  const err = e instanceof Error ? e : new Error(String(e));
  (err as Error & ErreurApresSuppression).nexusApresSuppression = quoi;
  return err;
}

/** Plafond par équipe / par école (_cap_rows_per_team, _cap_rows_per_school).
 *  Les deux lèvent en P0001 avec un message qui nomme la table SQL. On lit le
 *  nombre DANS le message plutôt que dans une constante client : un onglet
 *  périmé affiche ainsi le vrai plafond, pas celui qu'il croit connaître. */
const PLAFOND = /Maximum (\d+) lignes par (?:équipe|école) \(table (\w+)\)/;

/** Refus produits par le MOTEUR (Postgres, PostgREST). Toujours en anglais.
 *  Utile pour rattraper un refus RLS qui arriverait sans code SQL. */
const REFUS_MOTEUR = /row.level security|permission denied|must be owner|insufficient privilege|not authorized/i;

/** RÈGLE DU DÉPÔT — un RAISE EXCEPTION destiné à l'utilisateur commence par
 *  « NEXUS: ». Ces messages-là passent tels quels (préfixe retiré) ; tout le
 *  reste est du texte de moteur et n'atteint jamais l'écran.
 *
 *  Voir supabase/migrations/20260731200000_raise_marqueur_nexus.sql. Toute
 *  fonction future qui veut parler à l'utilisateur doit porter ce préfixe. */
const MARQUEUR = /^NEXUS:\s*/;

const NOMS: Record<string, string> = {
  team_events: "événements",
  team_pennants: "fanions",
  school_campus_cards: "cartes campus",
  school_news: "nouvelles",
};

/** Violations de contrainte CHECK (SQLSTATE 23514). Postgres renvoie un texte
 *  ANGLAIS qui nomme la table et la contrainte SQL — illisible pour un
 *  recruteur, et sans indication de ce qu'il faut corriger.
 *
 *  Ce n'est pas un détail cosmétique : c'est ce qui a fait survivre le bug de
 *  `ville`. Le pré-remplissage envoyait 27 caractères pour une colonne plafonnée
 *  à 18, la sauvegarde échouait en 23514, l'utilisateur lisait
 *  « violates check constraint "school_page_content_ville_check" », n'y
 *  comprenait rien, et s'en sortait en VIDANT le champ — ce qui explique le
 *  `ville: ''` retrouvé en base. Personne n'a jamais su ce qui n'allait pas.
 *
 *  Toute contrainte nommée ici gagne un message précis ; les autres tombent sur
 *  le générique, qui reste lisible et n'expose aucun identifiant SQL. */
const CHECK_VIOLATION = /violates check constraint "([a-z0-9_]+)"/i;

const CONTRAINTES: Record<string, string> = {
  // Plafond miroir de MAX_VILLE (lib/queries/schoolPage/schoolPageData.ts).
  school_page_content_ville_check:
    "Le nom de ville dépasse 18 caractères — raccourcis-le (par exemple « ST-AUGUSTIN »).",
  school_page_content_nickname_check: "Le surnom dépasse 14 caractères — raccourcis-le.",
  school_page_content_slogan_check: "Le slogan dépasse 40 caractères — raccourcis-le.",
  school_page_content_tagline_check: "L'accroche dépasse 20 caractères — raccourcis-la.",
  school_page_content_initiales_check: "Les initiales dépassent 3 caractères.",
  school_page_content_rail_word_check: "Le mot du rail dépasse 12 caractères — raccourcis-le.",
  school_page_content_quartier_check: "Le quartier dépasse 18 caractères — raccourcis-le.",
  school_page_content_code_regional_check: "L'indicatif régional dépasse 4 caractères.",
  school_page_content_about_title_check: "Le titre « À propos » dépasse 40 caractères.",
  school_page_content_sell_text_check: "Ton texte de présentation dépasse 280 caractères.",
  school_page_content_ticker_text_check: "Le bandeau défilant dépasse 60 caractères.",
  school_page_content_nb_athletes_check: "Le nombre d'athlètes dépasse 6 caractères.",
  school_page_content_niveau_check: "Le niveau dépasse 30 caractères — raccourcis-le.",
  school_page_content_wall_words_check: "Le mur accepte au maximum 4 mots.",
  school_page_content_stat_diplomation_check: "Le taux de diplomation doit être compris entre 0 et 100.",
  // Collections migrées vers les RPC transactionnelles (replace_school_news,
  // replace_team_pennants, replace_team_events). Sans ces entrées, `annee` et
  // `type` seraient annoncés comme des dépassements de longueur — ce qu'ils ne
  // sont pas.
  school_news_titre_check: "Le titre de la nouvelle dépasse 80 caractères — raccourcis-le.",
  team_pennants_titre_check: "Le titre du fanion dépasse 30 caractères — raccourcis-le.",
  team_pennants_annee_check: "L'année du fanion doit être comprise entre 1900 et 2100.",
  team_pennants_type_check: "Type de fanion inconnu — choisis championnat, coupe ou bannière.",
  team_events_titre_check: "Le titre de l'événement dépasse 40 caractères — raccourcis-le.",
  team_events_lieu_check: "Le lieu de l'événement dépasse 40 caractères — raccourcis-le.",
};

/** Traduit une erreur RLS/permission ou de plafond en message actionnable, et
 *  ajoute l'avertissement « ne recharge pas » quand des lignes ont déjà été
 *  supprimées. Sinon renvoie l'erreur telle quelle. */
export function friendlyDbError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string; statusCode?: string })?.code;
  const status = (e as { statusCode?: string })?.statusCode;
  const quoi = (e as ErreurApresSuppression)?.nexusApresSuppression;

  // ORDRE IMPORTANT. Le plafond passe AVANT le marqueur : ses messages portent
  // eux aussi « NEXUS: », mais ils nomment la table SQL et doivent être
  // réécrits, pas laissés passer. Le marqueur vient ensuite, le refus de droits
  // en dernier — sinon un 42501 de nos fonctions serait avalé par le générique.
  let clair: string;
  const plafond = PLAFOND.exec(msg);
  if (plafond) {
    clair = `Maximum ${plafond[1]} ${NOMS[plafond[2]] ?? "éléments"} — retires-en un avant d'en ajouter un autre.`;
  } else if (MARQUEUR.test(msg)) {
    clair = msg.replace(MARQUEUR, "");
  } else if (code === "23514" || CHECK_VIOLATION.test(msg)) {
    // Contrainte CHECK : message précis si on connaît la contrainte, sinon un
    // générique qui reste actionnable — mais JAMAIS le texte Postgres brut,
    // qui nomme la table et l'identifiant SQL.
    const nom = CHECK_VIOLATION.exec(msg)?.[1] ?? "";
    clair = CONTRAINTES[nom]
      ?? "Un des champs dépasse la longueur permise — raccourcis-le puis réessaie.";
  } else if (code === "42501" || status === "403" || REFUS_MOTEUR.test(msg)) {
    clair = "Ta session a expiré — reconnecte-toi pour enregistrer.";
  } else {
    clair = msg;
  }

  if (!quoi) return e instanceof Error && clair === msg ? e : new Error(clair);
  // Formulation sans pronom sujet : `quoi` peut être masculin (« Tes fanions »)
  // comme féminin (« Tes cartes campus »). « les rétablir » marche pour les deux.
  return new Error(
    `${clair}\n\n${quoi} ne sont plus en ligne — mais rien n'est perdu tant que cet écran reste ouvert : ` +
    "clique de nouveau sur « Enregistrer » pour les rétablir. Ne recharge pas la page avant d'avoir réussi.",
  );
}
