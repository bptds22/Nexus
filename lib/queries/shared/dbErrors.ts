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
