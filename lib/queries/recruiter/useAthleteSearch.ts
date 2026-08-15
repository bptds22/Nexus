/* ═══════════════════════════════════════════════════════════════
   useAthleteSearch — TanStack hook (iter 5.3b, bascule RPC Lot A)

   Hook principal de la page Recherche, web ET mobile (les deux
   surfaces montent CE hook — un seul point de bascule).

   ── CE QUI A CHANGÉ (Lot A) ───────────────────────────────────
   La requête n'attaque plus `athletes` en direct. Elle appelle
   `recruiter_search_athletes`, qui projette les colonnes et
   applique le masquage Loi 25 côté serveur.

   Trois conséquences qui gouvernent tout ce fichier :

   1. PLUS DE PLAFOND. `p_limit: null` = LIMIT ALL, pour tous les
      tiers. Le cap Free de 10 lignes est mort — il n'était pas une
      règle de confidentialité, juste une friction commerciale, et
      il faussait les filtres client (on filtrait 10 lignes au lieu
      de la base). Voir 20260812100000.

   2. L'IDENTITÉ EST UNE DÉCISION SERVEUR, PAS UN TEST CLIENT.
      La RPC renvoie `identity_visible` PAR LIGNE et met first_name,
      last_name, photo_url et numero_jersey à NULL quand il est
      faux. Le client n'a plus rien à décider : les champs
      n'arrivent tout simplement pas. Deux critères indépendants
      mènent au masquage — Loi 25 (mineur sans consentement
      parental) et tier FREE — et le client ne peut exprimer NI
      l'un NI l'autre : le premier dépend de `date_naissance` et
      de `consentement_parental`, deux colonnes qui ne sont jamais
      projetées aux recruteurs.

      D'où la disparition de `isFreeRecruiter` des filtres : il
      servait à construire un `identityCols` côté client, c'est-à-
      dire à demander poliment au serveur de ne pas envoyer les
      noms. Ça tenait tant que personne ne rejouait la requête à la
      main. Ce n'est plus un choix du client.

   3. LE TRI ET LA RECHERCHE PAR NOM SONT AUSSI ARBITRÉS SERVEUR.
      La RPC neutralise `p_search` pour les Free et rabat
      `name_asc` sur `rating_desc` — sinon l'ORDRE trahirait le nom
      qu'on vient de masquer. On envoie donc les deux TELS QUELS et
      on laisse le serveur trancher. Ne pas ré-implémenter ces deux
      gardes ici : deux copies d'une règle de confidentialité, ça
      diverge.

   ── CE QUI N'A PAS CHANGÉ ─────────────────────────────────────
   `placeholderData: keepPreviousData` → pendant un refetch sur
   changement de filtre, l'ancienne grille reste affichée.

   ⚠️ NE PAS inclure favorites/favCounts dans queryKey ni dans la
   transformation : ils sont composés dans le useMemo `filtered` de
   la page. Évite un refetch complet à chaque toggle de favori.

   orgType / position / region / genre d'équipe restent appliqués
   client-side dans le useMemo `filtered` de la page (même raison de
   stabilité du cache). Maintenant que le plafond est tombé, ces
   filtres résiduels travaillent sur la base ENTIÈRE, plus sur une
   fenêtre de 10 lignes — l'ancienne « LIMITATION for Free users »
   n'existe plus.
═══════════════════════════════════════════════════════════════ */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { createClient } from "@/lib/supabase/client";
import { parseDistinctions } from "@/lib/config/badges";

export interface AthleteSearchFilters {
  search: string;           // déjà débouncé en amont
  sport: string;            // valeur du dropdown (peut être vide)
  promotion: string;        // string parce qu'on parse en int dans la query
  verifiedOnly: boolean;
  withVideoOnly: boolean;
  minRating: string;        // string parce qu'on parse en float
  filterOuvertDemenager: boolean;
  filterOuvertPrive: boolean;
  filterOuvertAnglophone: boolean;
  filterNewOnly: boolean;
  minGpa: string;           // string parce qu'on parse en float
  sortBy: string;
  sportId: string | null;
  /**
   * Tier courant — N'EST PAS ENVOYÉ AU SERVEUR et ne décide de rien.
   *
   * Il n'existe que pour ENTRER DANS LA queryKey. La RPC renvoie un
   * contenu différent selon le tier de l'appelant (identité masquée
   * ou non) : sans ce champ, un recruteur qui passe à Pro en cours
   * de session lirait la réponse Free encore en cache, identité
   * verrouillée, jusqu'à expiration du staleTime.
   *
   * Ce n'est donc pas un test d'identité côté client — c'est la
   * portée du cache. Le masquage, lui, est déjà tranché serveur.
   */
  tier: string;
}

/** Une ligne d'évaluation telle que projetée dans l'agrégat `evaluations`
 *  de la RPC. `updated_at` est indispensable : selectBestEvaluation trie
 *  dessus et retombe sur un ordre non déterministe s'il manque. */
/* `type` et non `interface` : selectBestEvaluation prend un
   `readonly EvalRow[]` avec EvalRow = Record<string, unknown>. TypeScript
   n'accorde d'index signature implicite qu'aux alias de type, jamais aux
   interfaces — une interface ici forcerait un cast au point d'appel. */
type SearchEvalRow = {
  cote_globale: number | null;
  distinctions: unknown;
  updated_at: string | null;
};

/**
 * Miroir exact du RETURNS TABLE de recruiter_search_athletes
 * (20260812100000).
 *
 * Les quatre champs d'identité sont nullable PAR CONTRAT, pas par
 * accident : le serveur les met à NULL quand `identity_visible` est
 * faux. Les typer `string` mentirait au compilateur.
 */
interface RpcSearchRow {
  id: string;
  identity_visible: boolean;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  /** Âge dérivé. `date_naissance` n'est JAMAIS projetée aux recruteurs. */
  age: number | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale: number | null;
  profile_completion: number | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  moyenne_generale: number | null;
  mentions_academiques: unknown;
  recruitment_status: string | null;
  statut_recrutement_override: string | null;
  open_to_offers: boolean | null;
  a_une_video: boolean | null;
  context: string | null;
  created_at: string | null;
  sport_nom: string | null;
  position_nom: string | null;
  position_abbr: string | null;
  school_id: string | null;
  school_name: string | null;
  school_region: string | null;
  school_type: string | null;
  committed_school_name: string | null;
  evaluations: SearchEvalRow[] | null;
  team_gender: string | null;
}

export interface SearchAthleteRow {
  id: string;
  /**
   * false = le serveur a masqué l'identité (Loi 25 OU tier FREE).
   * Quand il est faux, firstName / lastName / photo / jersey sont
   * vides — pas floutés, pas tronqués : ABSENTS de la réponse.
   * Voir LockedIdentityPlaceholder.
   */
  identityVisible: boolean;
  firstName: string;
  lastName: string;
  photo: string;
  sport: string;
  position: string;
  school: string;
  region: string;
  graduationYear: number;
  niveau: "Sec. 5";
  heightDisplay: string;
  weightDisplay: string;
  isVerified: boolean;
  lastValidation: string | null;
  isFavorited: boolean;     // placeholder, overridé en page
  hasVideo: boolean;
  badges: { badgeId: string; label: string; icon: string }[];
  favorites: number;        // placeholder, overridé en page
  views: number;
  stars: number;
  heightWeight: string;
  gpa: number;
  academicBadges: string[];
  jersey: string;
  sportName: string;
  recruitmentStatus: string;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
  commitmentStatus: "aucun";
  orgType: "scolaire" | "ligue_civile" | undefined;
  /* ⚠️ ouvertDemenager / ouvertPrive / ouvertAnglophone ont été RETIRÉS ici.
     La RPC ne projette pas pret_changer_region / ouvert_cegep_prive /
     ouvert_cegep_anglophone — elle ne les expose que comme FILTRES
     (p_ouvert_*). Ces trois champs n'étaient lus nulle part : ni affichage,
     ni filtre client, seulement déclarés dans ExtendedAthlete. Les remplir
     à `false` depuis une réponse qui ne les contient pas aurait été une
     valeur inventée — un « non » indiscernable d'un vrai « non ». */
  createdAt: string;
  noTeam: boolean;
  context: string | null;
  /** teams.gender de l'équipe de l'athlète — "Masculin" | "Féminin" | "Mixte".
   *  null quand l'athlète n'est rattaché à AUCUNE équipe (team_athletes vide),
   *  ce qui est le cas de la grande majorité des athlètes aujourd'hui. Le filtre
   *  les exclut donc dès qu'un genre est sélectionné. Volontairement PAS
   *  athletes.genre : ce champ-là est à moitié vide et encodé de 2 façons.
   *
   *  Projeté par la RPC via LEFT JOIN team_athletes ⋈ teams. Le join ne
   *  multiplie aucune ligne : team_athletes.athlete_id porte un index UNIQUE.
   *
   *  ⚠️ CE N'EST PAS DE L'IDENTITÉ — c'est le genre de l'ÉQUIPE, partagé par
   *  tout un effectif. Il reste donc hors du masquage identity_visible, comme
   *  l'école ou la position, et le filtre par genre fonctionne aussi en Free. */
  teamGender: string | null;
}


const BADGE_MAP: Record<string, { label: string; icon: string }> = {
  captain: { label: "Capitaine", icon: "shield" },
  allstar: { label: "Équipe d'étoiles", icon: "star" },
  team_leader: { label: "Leader", icon: "award" },
};

/** Les 5 valeurs que la RPC sait trier. Tout le reste part en rating_desc.
 *
 *  Ce n'est pas de la prudence : l'ORDER BY de la RPC est une chaîne de CASE
 *  sur `v_sort`. Une valeur inconnue ne « retombe » pas sur un défaut, elle
 *  fait tomber TOUTES les branches à NULL et le tri se réduit à `a.id` —
 *  donc à un ordre arbitraire, sans la moindre erreur. `favorites_desc` et
 *  `plus_vus` sont des raffinements client (ils retrient sur favCounts dans
 *  le useMemo de la page) et n'ont pas d'équivalent serveur : on demande
 *  rating_desc, exactement comme le faisait le legacy. */
const RPC_SORTS = new Set(["rating_desc", "rating_asc", "grad_asc", "grad_desc", "name_asc"]);

/** Longueur minimale d'un terme de recherche envoyé au serveur.
 *  En dessous, l'ILIKE '%x%' balaie la table pour rien. Repris du legacy. */
const MIN_SEARCH_LEN = 3;

export function useAthleteSearch(filters: AthleteSearchFilters) {
  return useQuery<SearchAthleteRow[]>({
    queryKey: ["athletes", filters],
    queryFn: async (): Promise<SearchAthleteRow[]> => {
      const supabase = createClient();

      // `%` et `_` sont les jokers d'ILIKE. La RPC interpole le terme dans
      // '%' || v_search || '%' sans clause ESCAPE, donc un `%` tapé par
      // l'utilisateur élargirait la recherche au lieu de la restreindre.
      // Aucun enjeu d'injection ici (paramètre lié), juste de justesse.
      const raw = filters.search.trim().replace(/[%_]/g, "");
      const search = raw.length >= MIN_SEARCH_LEN ? raw : null;

      const { data, error } = await supabase.rpc("recruiter_search_athletes", {
        p_search: search,
        p_sport_id: filters.sportId,
        p_promotion: filters.promotion ? parseInt(filters.promotion) : null,
        p_verified_only: filters.verifiedOnly,
        p_with_video_only: filters.withVideoOnly,
        p_min_gpa: filters.minGpa ? parseFloat(filters.minGpa) : null,
        p_min_rating: filters.minRating ? parseFloat(filters.minRating) : null,
        p_ouvert_demenager: filters.filterOuvertDemenager,
        p_ouvert_prive: filters.filterOuvertPrive,
        p_ouvert_anglophone: filters.filterOuvertAnglophone,
        p_new_only: filters.filterNewOnly,
        p_sort_by: RPC_SORTS.has(filters.sortBy) ? filters.sortBy : "rating_desc",
        // Explicite, pas omis : le DEFAULT de la fonction est déjà NULL, mais
        // le dire ici documente l'intention (« aucun plafond, aucun tier »)
        // là où on la lit.
        p_limit: null,
      });

      if (error) throw error;
      if (!data) return [];

      return (data as RpcSearchRow[]).map((a): SearchAthleteRow => {
        const evalRel = selectBestEvaluation(a.evaluations ?? []);
        // #56 — parseDistinctions gère string[] (legacy) ET {badge,detail} (objet,
        // 10 rows en prod), filtre les badges inconnus.
        const distinctions = parseDistinctions((evalRel as Record<string, unknown> | null)?.distinctions);
        return {
          id: a.id,
          identityVisible: a.identity_visible,
          // `?? ""` et pas `|| "Athlète"` : une chaîne vide dit « rien à
          // afficher » aux appelants, qui rendent alors le placeholder
          // verrouillé. Un libellé de repli inventé ici masquerait la
          // distinction entre « masqué » et « prénom manquant en base ».
          firstName: a.first_name ?? "",
          lastName: a.last_name ?? "",
          photo: a.photo_url ?? "",
          sport: (a.sport_nom ?? "").toLowerCase().replace(/ /g, "_"),
          position: a.position_abbr ?? "",
          school: a.school_name ?? "",
          region: a.school_region ?? "",
          graduationYear: a.annee_diplomation ?? 0,
          niveau: "Sec. 5" as const,
          heightDisplay: "",
          weightDisplay: "",
          isVerified: !!a.verified,
          lastValidation: a.last_profile_validation ?? null,
          isFavorited: false, // composé en page
          hasVideo: !!a.a_une_video,
          badges: distinctions
            .filter((d) => !!BADGE_MAP[d.badge])
            .map((d) => ({ badgeId: d.badge, label: BADGE_MAP[d.badge].label, icon: BADGE_MAP[d.badge].icon })),
          favorites: 0, // composé en page
          views: 0,
          stars: a.cote_globale ?? 0,
          heightWeight: (() => {
            const parts: string[] = [];
            if (a.taille_pieds) parts.push(`${a.taille_pieds}'${a.taille_pouces || 0}"`);
            if (a.poids_lbs) parts.push(`${a.poids_lbs} lbs`);
            return parts.join(" · ");
          })(),
          gpa: a.moyenne_generale ?? 0,
          academicBadges: (a.mentions_academiques as string[]) || [],
          // Vide quand l'identité est masquée : le serveur l'a mis à NULL.
          // Les cartes testent `a.jersey &&` — le dossard disparaît donc
          // tout seul, sans garde supplémentaire.
          jersey: a.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
          sportName: a.sport_nom ?? "",
          recruitmentStatus: a.recruitment_status ?? "OUVERT",
          committedSchoolName: a.committed_school_name ?? null,
          openToOffers: a.open_to_offers ?? null,
          commitmentStatus: "aucun",
          orgType: (!a.school_id
            ? undefined
            : a.school_type === "LIGUE_CIVILE"
              ? "ligue_civile"
              : "scolaire") as "scolaire" | "ligue_civile" | undefined,
          createdAt: a.created_at ?? "",
          noTeam: !a.school_id,
          context: a.context ?? null,
          teamGender: a.team_gender ?? null,
        };
      });
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}
