/* ═══════════════════════════════════════════════════════════════
   useFicheAthleteDonnees — LE chargement de la fiche athlète (recruteur,
   aperçu athlète, partenaire), sorti tel quel d'AthleteRecruiterProfileBody
   (lot C0, décision BP 2026-09-24) pour que le panneau latéral du pipeline
   (lot C1) lise EXACTEMENT les mêmes données, par le même chemin.

   Rien n'a changé dans la logique : même requête directe (recruteur /
   aperçu), même RPC partner_athlete_profile (partenaire), même RPC
   d'identité (recruiter_athlete_cards), mêmes masquages. Les commentaires
   d'origine suivent le code. Le jour où la lecture directe de `athletes`
   par un recruteur sera fermée (fuite 1), c'est ICI, une seule fois, qu'il
   faudra passer par une RPC.
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchRecruiterAthleteCards, type RecruiterAthleteCard } from "@/lib/queries/shared/recruiterAthleteCards";
import { mockAthleteProfileFull } from "@/lib/mock/athleteProfileRecruiter";
import type { AthleteProfileRecruiterView, GlobalRecruitmentStatus } from "@/lib/types/models";
import { badgesDepuisRaw } from "@/lib/queries/shared/athleteBadges";
import { loadAthleteReferent } from "@/lib/queries/recruiter/athleteReferent";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import type { TeamDetail } from "@/components/shared/athlete/TeamDetailsBlock";
import { parseTeamHistory } from "@/components/shared/athlete/teamHistory";
import { resolveProgrammesVisesAsync } from "@/lib/queries/shared/useCegepPrograms";
import type { AthleteProfileViewerMode } from "@/components/shared/AthleteRecruiterProfileBody";

/** Les 61 colonnes de public.partner_athlete_profile, telles que la RPC les
 *  RETOURNE (verifie contre son RETURNS TABLE). Toute colonne absente d'ici
 *  n'existe pas cote partenaire — et c'est le seul endroit ou le verifier.
 *
 *  Le CADRE qui decide de cette liste est ecrit dans le commentaire de la
 *  fonction en base (`comment on function partner_athlete_profile`) : chiffres
 *  sur grille structuree oui, texte nominatif libre jamais, statut de
 *  recrutement masque parce que commercialement sensible. Ne pas le
 *  re-deviner ici. */
type PartnerRpcRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  age: number | null;
  genre: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  /** `coalesce(evaluation retenue, athletes.cote_globale_entraineur)` depuis
   *  la migration 20260904130334 — la MEME preseance que la fiche recruteur,
   *  decidee cote serveur. Ce n'est plus la colonne denormalisee nue. */
  cote_globale: Numerique;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  bio: string | null;
  sport_nom: string | null;
  position_nom: string | null;
  position_abbr: string | null;
  school_name: string | null;
  school_region: string | null;
  school_city: string | null;
  school_type: string | null;
  is_civil: boolean | null;
  team_name: string | null;
  league_name: string | null;
  distinctions: unknown;
  video_faits_saillants_url: string | null;
  hudl_url: string | null;
  youtube_url: string | null;
  /** Les badges VIVANTS, deja tries (honneur > universel > sport, puis
   *  `ordre`) et deja filtres sur `retire_le is null` par la RPC. Forme
   *  projetee : {code, libelle, famille, contexte, attribue_le}. */
  badges: PartnerRpcBadge[] | null;

  /* ── Lot 3 — completion ─────────────────────────────────────────────── */
  profile_completion: number | null;

  /* ── Lot 4 — mesures ────────────────────────────────────────────────── */
  envergure: string | null;
  taille_mains: string | null;
  main_dominante: string | null;
  pied_dominant: string | null;

  /* ── Lot 6 — tests athletiques ──────────────────────────────────────── */
  test_40_verges: string | null;
  saut_vertical: string | null;
  saut_longueur: string | null;
  developpe_couche: string | null;
  navette_agilite: string | null;
  sprint_100m: string | null;

  /* ── Lot 5 — videos secondaires ─────────────────────────────────────── */
  video_match_complet_url: string | null;
  video_entrainement_url: string | null;

  /* ── Lot 7 — parcours d'equipes (JSONB brut, parseTeamHistory s'en
     charge : il accepte deja tableau, chaine ou n'importe quoi) ────────── */
  parcours_equipes: unknown;

  /* ── Lots 2 et 6bis — l'evaluation RETENUE par le serveur ──────────────
     `eval_id` est le MARQUEUR D'EXISTENCE. `updated_at` est nullable sur
     evaluations, et chaque trait peut valoir null legitimement : seul l'id
     distingue « aucune evaluation » de « une evaluation vide ». Sans lui,
     l'adaptateur fabriquerait 14 zeros et la fiche afficherait une grille
     complete a 0/5 — une affirmation fausse, pas une absence. */
  eval_id: string | null;
  eval_grille_id: string | null;
  eval_cote_globale: Numerique;
  vitesse_explosivite: Numerique;
  force_puissance: Numerique;
  endurance_cardio: Numerique;
  agilite_coordination: Numerique;
  vision_du_jeu: Numerique;
  sens_tactique: Numerique;
  leadership: Numerique;
  discipline: Numerique;
  coachabilite: Numerique;
  intelligence_jeu: Numerique;
  competitivite: Numerique;
  esprit_equipe: Numerique;
  resilience: Numerique;
  attitude_mentalite: Numerique;
};

/** Un `numeric` PostgreSQL tel qu'il ARRIVE. PostgREST le rend tantot en
 *  nombre JSON, tantot en chaine ("3.80") — le piege est deja documente
 *  dans app/partenaire/athletes/[id]/PageClient.tsx et dans
 *  partnerFilters.sortPartnerRows. On ne parie pas : `nombre()` tranche. */
type Numerique = number | string | null;

/** Coercion unique pour tout `numeric` venu de la RPC. `null` reste `null` —
 *  un trait non note ne devient PAS 0 ici (c'est la moyenne des traits qui
 *  ecarte les non-notes, et un 0 injecte fausserait cette moyenne). */
function nombre(v: Numerique | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Un element du jsonb `badges` de partner_athlete_profile. Le RETURNS TABLE
 *  le declare `jsonb` ; cette forme est celle que la fonction CONSTRUIT
 *  (jsonb_build_object, cinq cles nommees). */
type PartnerRpcBadge = {
  code: string;
  libelle: string;
  famille: string | null;
  contexte: string | null;
  attribue_le: string | null;
};

/**
 * FORME EXIGEE PAR LE MAPPING EN AVAL — tous les champs que `load()` lit sur
 * `d`, sans exception. Le type existe pour UNE raison : rendre impossible la
 * panne du 19 aout 2026.
 *
 * Ce jour-la, adaptPartnerRow a remplace la requete directe sans reporter
 * `school_id`. Le mapping teste `!d.school_id` pour decider « civil » ; sur
 * `undefined` le test est VRAI, et les 47 fiches du portail partenaire ont
 * bascule en « Ligue civile » — dont 34 athletes scolaires, nom d'ecole vide.
 * Douze jours sans que rien ne le signale : sur un `Record<string, unknown>`,
 * un champ MANQUANT est indiscernable d'un champ NULL.
 *
 * Chaque champ est donc REQUIS. Une omission ne compile plus. Les absences
 * VOULUES sont ecrites `null` explicitement — une decision qu'on lit, plus un
 * oubli qu'on devine. Si le mapping se met a lire un champ de plus, l'ajouter
 * ici est le premier geste, et le compilateur le rappelle.
 */
type PartnerAdaptedRow = {
  /* ── Identite et gabarit — projetes par la RPC ─────────────────────── */
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  age: number | null;
  genre: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale_entraineur: number | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  sports: { nom: string | null } | null;
  positions: { nom: string | null; abreviation: string | null } | null;
  schools: { name: string | null; region: string | null; city: string | null; type: string | null } | null;
  /* L'evaluation retenue, dans la FORME de l'embed direct : un tableau d'une
     ligne. selectBestEvaluation le traverse sans rien savoir de sa
     provenance, et `traitRatings` puis `overallRating` se calculent par le
     MEME code que cote recruteur. `updated_at` est volontairement absent :
     le serveur a deja tranche quelle ligne gagne (meme clef, `updated_at
     desc`), et selectBestEvaluation rend le premier element quand il est
     seul. */
  evaluations: {
    distinctions: unknown;
    cote_globale: number | null;
    grille_id: string | null;
    vitesse_explosivite: number | null;
    force_puissance: number | null;
    endurance_cardio: number | null;
    agilite_coordination: number | null;
    vision_du_jeu: number | null;
    sens_tactique: number | null;
    leadership: number | null;
    discipline: number | null;
    coachabilite: number | null;
    intelligence_jeu: number | null;
    competitivite: number | null;
    esprit_equipe: number | null;
    resilience: number | null;
    attitude_mentalite: number | null;
  }[] | null;

  /* ── Badges — VOIE 2, reconstituee ─────────────────────────────────────
     `badgesDepuisRaw` lit `raw.athlete_badges` dans la forme de l'EMBED
     PostgREST. La RPC projette la meme information sous un autre nom et une
     autre forme ; l'adaptateur la RENDONNE ici, fidele a sa vocation. Sans
     ce champ, `d.athlete_badges` etait `undefined` et le partenaire voyait
     zero badge sur une fiche qui en porte trois — alors que la RPC les
     livrait deja dans la meme reponse. */
  athlete_badges: {
    contexte: string | null;
    created_at: string | null;
    retire_le: null;
    badges: { code: string; libelle: string };
  }[];

  /* ── Le contexte, DECIDE PAR LE SERVEUR ────────────────────────────────
     `is_civil` est la reponse de la RPC — (school_id IS NULL OR type =
     'LIGUE_CIVILE') — calculee la ou `school_id` existe vraiment. Le front la
     PREFERE a sa propre regle plutot que de la recalculer sur des champs qu'il
     n'a pas. `school_id` reste `null` : le partenaire n'a aucun besoin de
     l'identifiant, seulement du verdict. */
  is_civil: boolean | null;
  school_id: null;
  team_name: string | null;
  league_name: string | null;

  /* ── Medias projetes ───────────────────────────────────────────────── */
  video_faits_saillants_url: string | null;
  hudl_url: string | null;
  youtube_url: string | null;

  /* ── ABSENCES VOULUES ──────────────────────────────────────────────────
     Loi 25 et perimetre partenaire. `date_naissance` en particulier ne
     franchit JAMAIS la frontiere : c'est elle qui decide du masquage, et l'age
     arrive deja derive du serveur. */
  date_naissance: null;
  user_id: null;
  coach_id: null;
  users: null;

  /* Bloc academique — remplace a l'ecran par un substitut assume
     (« Reserve aux recruteurs et coaches »), pas par du vide. */
  moyenne_generale: null;
  mentions_academiques: null;
  matieres_fortes: null;
  programme_cegep_vise: null;
  regions_cegep_preferees: null;
  ouvert_cegep_prive: null;
  ouvert_cegep_anglophone: null;
  pret_changer_region: null;

  /* LOT 7 — le parcours d'equipes ENTRE dans le perimetre (arbitrage BP,
     2026-09-03) : historique sportif public — quelles equipes, quelles
     saisons, quelle ligue — sans un seul nom de personne. Meme nature verte
     que les badges et les mesures. La RPC le projette depuis la migration
     20260904130334 ; ce n'etait PAS une garde front seule. */
  parcours_equipes: unknown;

  /* `team_athletes` reste absent : c'est la jointure COMPLETE vers teams
     (id, division, saison, ecole du club), que la RPC ne projette pas. Elle
     n'alimente que TeamDetailsBlock, masque pour le partenaire — rouvrir ce
     bloc suppose de l'AJOUTER a la RPC, pas de le deviner ici.
     `position_id` : lib/evaluations/grilles.ts resout la grille client-side
     par (sport, position) nommes — c'est documente la-bas. Le partenaire a
     desormais `grille_id` sur l'evaluation, qui a la preseance. */
  team_athletes: null;
  committed_school: null;
  position_id: null;

  /* ── LOTS 3 a 6 — ce que la RPC projette DESORMAIS ─────────────────────
     Ces champs etaient les « absences subies » du 19 aout : la RPC ne les
     rendait pas, et les deux surfaces qui les affichaient avec un defaut
     FAUX (completude figee a 0 %) etaient masquees plutot que menteuses. La
     migration 20260904130334 les AJOUTE — c'etait la seule facon de les
     rouvrir, et c'est faite. */
  profile_completion: number | null;
  envergure: string | null;
  taille_mains: string | null;
  main_dominante: string | null;
  pied_dominant: string | null;
  test_40_verges: string | null;
  saut_vertical: string | null;
  saut_longueur: string | null;
  navette_agilite: string | null;
  sprint_100m: string | null;
  developpe_couche: string | null;
  video_match_complet_url: string | null;
  video_entrainement_url: string | null;

  /* ── ABSENCES QUI RESTENT, ET POURQUOI ─────────────────────────────────
     STATUT DE RECRUTEMENT — masque par DECISION COMMERCIALE (arbitrage BP,
     2026-09-03), pas par vie privee : savoir qu'un athlete est « engage »
     ou « en discussion » avant tout le monde a une valeur que le partenaire
     n'achete pas. Le badge retombait sur son defaut « OUVERT » — faux pour
     13 fiches sur 48. Il reste masque a l'ecran ET absent de la RPC, ou un
     garde-fou SQL refuse son retour silencieux.

     INSTAGRAM — hors lot. Ce n'est pas une video de sport, c'est le compte
     personnel d'un mineur. L'ouvrir se decide, ne se deduit pas. */
  recruitment_status: null;
  statut_recrutement_override: null;
  open_to_offers: null;
  instagram_url: null;
};

/**
 * Redonne a une ligne de public.partner_athlete_profile la FORME que produisait
 * la requete directe sur `athletes`, pour que le mapping en aval soit inchange.
 *
 * Le type de retour EST le contrat : voir PartnerAdaptedRow ci-dessus. Ce qui
 * vaut `null` l'est par decision, et le compilateur refuse desormais qu'un
 * champ disparaisse en silence.
 *
 * L'ecran partenaire masque le bloc academique et le nom de l'entraineur. Il
 * n'est PLUS force en mode « simple » (2026-09-03) : le bascule
 * Simplifie/Detaille lui est rendu, parce que les sections qu'il ouvre —
 * mesures, tests, medias, les 14 traits — sont desormais alimentees. Les
 * forcer vides aurait produit des coquilles ; c'est la RPC qui a bouge, pas
 * le masquage.
 *
 * `age` est fourni DERIVE — date_naissance ne franchit jamais la frontiere.
 */
function adaptPartnerRow(r: PartnerRpcRow): PartnerAdaptedRow {
  return {
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    photo_url: r.photo_url,
    numero_jersey: r.numero_jersey,
    // Age DERIVE cote serveur — pas de date_naissance a reconstituer.
    age: r.age,
    genre: r.genre,
    annee_diplomation: r.annee_diplomation,
    verified: r.verified,
    last_profile_validation: r.last_profile_validation,
    /* Deja `coalesce(evaluation, colonne)` cote serveur (lot 2). Le front
       n'a plus rien a arbitrer : il lit la meme preseance que le recruteur,
       et la carte partageable de PageClient lit la meme valeur. */
    cote_globale_entraineur: nombre(r.cote_globale),
    taille_pieds: r.taille_pieds,
    taille_pouces: r.taille_pouces,
    poids_lbs: r.poids_lbs,
    sports: r.sport_nom ? { nom: r.sport_nom } : null,
    positions: r.position_nom ? { nom: r.position_nom, abreviation: r.position_abbr } : null,
    schools: r.school_name
      ? { name: r.school_name, region: r.school_region, city: r.school_city, type: r.school_type }
      : null,
    /* L'EVALUATION RETENUE — un tableau d'un element, la forme que
       selectBestEvaluation attend.

       Le predicat est `eval_id`, PAS `distinctions` comme avant : une
       evaluation sans distinction rendait `null`, donc `traitRatings` null,
       donc aucune note a l'ecran alors que le coach en avait saisi 14. Seul
       l'id dit « il y a une evaluation ».

       `rapport_entraineur` n'est PAS ici et n'y sera pas : le texte libre
       d'un adulte sur un mineur ne franchit pas cette frontiere. C'est la
       seule colonne de l'embed recruteur volontairement absente — d'ou
       `coachReport` vide, et le bloc « Rapport de l'entraineur » qui se
       reduit a la cote et aux etoiles. */
    evaluations: r.eval_id
      ? [{
          distinctions: r.distinctions,
          cote_globale: nombre(r.eval_cote_globale),
          grille_id: r.eval_grille_id,
          vitesse_explosivite: nombre(r.vitesse_explosivite),
          force_puissance: nombre(r.force_puissance),
          endurance_cardio: nombre(r.endurance_cardio),
          agilite_coordination: nombre(r.agilite_coordination),
          vision_du_jeu: nombre(r.vision_du_jeu),
          sens_tactique: nombre(r.sens_tactique),
          leadership: nombre(r.leadership),
          discipline: nombre(r.discipline),
          coachabilite: nombre(r.coachabilite),
          intelligence_jeu: nombre(r.intelligence_jeu),
          competitivite: nombre(r.competitivite),
          esprit_equipe: nombre(r.esprit_equipe),
          resilience: nombre(r.resilience),
          attitude_mentalite: nombre(r.attitude_mentalite),
        }]
      : null,

    /* VOIE 2 — on redonne aux badges la forme de l'embed `athlete_badges`,
       la seule que `badgesDepuisRaw` sache lire. La correspondance est
       terme a terme et documentee dans athleteBadges.ts :
         contexte    <- ab.contexte
         created_at  <- ab.created_at, projete sous le nom `attribue_le`
         retire_le   <- toujours null : la RPC filtre `retire_le is null`,
                        elle ne rend QUE des badges vivants. Le `null` n'est
                        donc pas une supposition, c'est le contrat d'amont.
       L'ordre du serveur (honneur > universel > sport, puis `ordre`) est
       conserve : `.map` ne reordonne rien, donc MAX_BADGES_AFFICHES tronque
       les MOINS importants. L'embed recruteur, lui, n'a PAS de ORDER BY —
       le partenaire est ici mieux servi, pas moins. */
    athlete_badges: (Array.isArray(r.badges) ? r.badges : []).map((b) => ({
      contexte: b.contexte ?? null,
      created_at: b.attribue_le ?? null,
      retire_le: null as null,
      badges: { code: b.code, libelle: b.libelle },
    })),

    /* Le verdict du serveur, transmis tel quel — plus aucun recalcul. */
    is_civil: r.is_civil,
    school_id: null,
    team_name: r.team_name,
    league_name: r.league_name,

    video_faits_saillants_url: r.video_faits_saillants_url,
    hudl_url: r.hudl_url,
    youtube_url: r.youtube_url,

    /* Absences voulues — Loi 25 et perimetre partenaire. */
    date_naissance: null,
    user_id: null,
    coach_id: null,
    users: null,
    moyenne_generale: null,
    mentions_academiques: null,
    matieres_fortes: null,
    programme_cegep_vise: null,
    regions_cegep_preferees: null,
    ouvert_cegep_prive: null,
    ouvert_cegep_anglophone: null,
    pret_changer_region: null,
    team_athletes: null,
    committed_school: null,
    position_id: null,

    /* Lot 7 — historique sportif, projete par la RPC. */
    parcours_equipes: r.parcours_equipes,

    /* Lots 3 a 6 — projetes par la RPC depuis le 2026-09-04. */
    profile_completion: r.profile_completion,
    envergure: r.envergure,
    taille_mains: r.taille_mains,
    main_dominante: r.main_dominante,
    pied_dominant: r.pied_dominant,
    test_40_verges: r.test_40_verges,
    saut_vertical: r.saut_vertical,
    saut_longueur: r.saut_longueur,
    navette_agilite: r.navette_agilite,
    sprint_100m: r.sprint_100m,
    developpe_couche: r.developpe_couche,
    video_match_complet_url: r.video_match_complet_url,
    video_entrainement_url: r.video_entrainement_url,

    /* Absences qui restent : statut de recrutement (commercialement
       sensible) et Instagram (hors lot). Voir le type ci-dessus. */
    recruitment_status: null,
    statut_recrutement_override: null,
    open_to_offers: null,
    instagram_url: null,
  };
}

export interface CivilTeamInfo {
  teamName: string;
  leagueName: string;
  ageGroup: string | null;
  division: string | null;
  coaches: string[];
}

export interface SourceGrille {
  grilleId: string | null; positionId: string | null;
  sportNom: string | null; positionNom: string | null;
}

export interface FicheAthleteDonnees {
  a: AthleteProfileRecruiterView | null;
  /** La fiche patche `a` (compteur de favoris) : le setter reste exposé. */
  setA: Dispatch<SetStateAction<AthleteProfileRecruiterView | null>>;
  loadingAthlete: boolean;
  grilleSrc: SourceGrille;
  recruitmentStatus: GlobalRecruitmentStatus;
  committedSchoolName: string;
  openToOffers: boolean | null;
  coachId: string | null;
  affiliation: "school" | "civil_with_team" | "civil_no_team";
  civilTeamInfo: CivilTeamInfo | null;
  teamDetails: TeamDetail[];
  athleteUserId: string | null;
}

export function useFicheAthleteDonnees({ id, viewerMode, tierLoading, isFreeRecruiter }: {
  id: string;
  viewerMode: AthleteProfileViewerMode;
  /** Le chargement attend que le palier soit connu (comme avant). */
  tierLoading: boolean;
  /** Présent dans les dépendances d'origine : la fiche se recharge quand le
   *  palier bascule. Conservé tel quel. */
  isFreeRecruiter: boolean;
}): FicheAthleteDonnees {
  const isPartner = viewerMode === "partner";
  // #52 — init à null (plus de mock comme valeur initiale) : aucun faux
  // athlète n'est rendu avant l'arrivée des vraies données. Le gate
  // loadingAthlete plus bas court-circuite le rendu tant que a est null.
  const [a, setA] = useState<AthleteProfileRecruiterView | null>(null);
  const [loadingAthlete, setLoadingAthlete] = useState(true);
  const [grilleSrc, setGrilleSrc] = useState<{
    grilleId: string | null; positionId: string | null;
    sportNom: string | null; positionNom: string | null;
  }>({ grilleId: null, positionId: null, sportNom: null, positionNom: null });
  const [recruitmentStatus, setRecruitmentStatus] = useState<GlobalRecruitmentStatus>("OUVERT");
  const [committedSchoolName, setCommittedSchoolName] = useState("");
  const [openToOffers, setOpenToOffers] = useState<boolean | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);

  // Civil-context affiliation state. Post-Phase 6.1 unified model :
  // 'school' = athlete anchored to a SECONDAIRE/CEGEP school,
  // 'civil_with_team' = anchored to a LIGUE_CIVILE school AND in
  // team_athletes for at least one team, 'civil_no_team' = anchored
  // to a LIGUE_CIVILE school without a team OR orphan (school_id
  // NULL — "Continuer sans équipe" path). Drives the section-level
  // swap between "École" and "Équipe civile".
  const [affiliation, setAffiliation] = useState<"school" | "civil_with_team" | "civil_no_team">("school");
  const [civilTeamInfo, setCivilTeamInfo] = useState<{
    teamName: string;
    leagueName: string;
    ageGroup: string | null;
    division: string | null;
    coaches: string[];
  } | null>(null);
  // Generalized list of teams for the bottom-of-Sportif TeamDetailsBlock —
  // populated for ALL athletes (école + civil) from the team_athletes →
  // teams join. Replaces the civil-only InfoRows that lived just below
  // the affiliation summary in the "École / Équipe civile" section.
  const [teamDetails, setTeamDetails] = useState<TeamDetail[]>([]);

  useEffect(() => {
    if (tierLoading) return;
    const supabase = createClient();
    /* Temps 1 — TOUT sauf l'identité.
       first_name, last_name, photo_url, numero_jersey et date_naissance ont
       quitté ce select : ils arrivent du temps 2, par la RPC.

       Ce qui était là avant — `isFreeRecruiter ? "" : "first_name, last_name,"`
       — était un masquage décidé CÔTÉ CLIENT, et il ne couvrait que le nom.
       La photo et le dossard partaient en clair pour tout le monde, et la
       règle Loi 25 (mineur sans consentement parental) n'était appliquée
       nulle part : elle dépend de date_naissance et consentement_parental,
       que le client n'a aucun droit de lire pour en tirer une décision. */
    /* Colonnes d'identite ajoutees au TEMPS 1 quand l'appelant n'est pas
       recruteur : la RPC recruiter_athlete_cards lui est fermee (42501), et
       il n'en a pas besoin — l'athlete lit sa propre ligne, le partenaire lit
       une ligne deja filtree par is_partner_eligible_athlete.

       date_naissance UNIQUEMENT pour l'athlete lui-meme. Un partenaire n'a
       pas a recevoir la date de naissance d'un mineur : la RPC ne la projette
       jamais non plus, elle en derive l'age cote serveur. */
    const identityCols =
      viewerMode === "preview"
        ? "first_name, last_name, photo_url, numero_jersey, date_naissance,"
        : viewerMode === "partner"
        ? "first_name, last_name, photo_url, numero_jersey,"
        : "";

    /* REQUETE DIRECTE — chemin RECRUTEUR et APERCU ATHLETE uniquement.
       Le partenaire ne passe plus par ici depuis le 2026-08-19 (point 5a du
       chantier RLS partenaire) : voir `source` juste apres. */
    const directQuery = supabase
      .from("athletes")
      .select(`
        id,
        user_id,
        ${identityCols}
        verified,
        profile_completion,
        last_profile_validation,
        annee_diplomation,
        genre,
        video_faits_saillants_url,
        hudl_url,
        youtube_url,
        instagram_url,
        video_match_complet_url,
        video_entrainement_url,
        moyenne_generale,
        matieres_fortes,
        mentions_academiques,
        programme_cegep_vise, programmes_vises,
        athlete_badges(contexte, created_at, retire_le, badges(code, libelle)),
        ouvert_cegep_prive,
        ouvert_cegep_anglophone,
        pret_changer_region,
        regions_cegep_preferees,
        taille_pieds,
        taille_pouces,
        poids_lbs,
        envergure,
        taille_mains,
        main_dominante,
        pied_dominant,
        test_40_verges,
        saut_vertical,
        saut_longueur,
        developpe_couche,
        navette_agilite,
        sprint_100m,
        bio,
        cote_globale_entraineur,
        consentement_parental,
        statut_recrutement_override,
        notes_coach,
        ouvert_entraineur_cegep,
        coach_id,
        recruitment_status,
        committed_school_id,
        open_to_offers,
        parcours_equipes,
        school_id,
        position_id,
        sports!athletes_sport_id_fkey(nom),
        positions!athletes_position_id_fkey(nom, abreviation),
        schools!school_id(name, region, city, type),
        committed_school:schools!committed_school_id(name),
        team_athletes(
          teams!team_id(
            id, name, league, age_group, division, gender, season, is_active,
            sport_id, sports!sport_id(nom),
            schools!school_id(id, name, type)
          )
        ),
        evaluations(
          vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination,
          vision_du_jeu, sens_tactique,
          leadership, discipline, coachabilite, intelligence_jeu,
          competitivite, esprit_equipe, resilience, attitude_mentalite,
          cote_globale, rapport_entraineur, distinctions, updated_at, grille_id
        ),
        users!athletes_coach_id_fkey(first_name, last_name)
      ` as unknown as "*")
      .eq("id", id)
      .single();

    /* AIGUILLAGE DE SOURCE.

       Pour un PARTENAIRE, la lecture passe par public.partner_athlete_profile :
       61 colonnes depuis le 2026-09-04 (30 auparavant), gate interne
       (is_approved_partner ET is_partner_eligible_athlete), et AUCUNE des
       colonnes interdites. La requete directe ci-dessus laissait encore passer
       moyenne_generale, programme_cegep_vise, regions_cegep_preferees,
       notes_coach et l'embed evaluations a 18 colonnes — dont
       rapport_entraineur, du texte libre ecrit par un adulte sur un mineur.

       CE QUE L'ELARGISSEMENT NE TOUCHE PAS. La RPC projette maintenant les
       chiffres — cote, 14 traits, mesures, tests, completion — et
       l'historique sportif. Elle ne projette toujours PAS une ligne de prose
       ecrite sur un mineur, ni le statut de recrutement. Le cadre complet est
       dans le commentaire de la fonction en base ; un garde-fou SQL refuse a
       l'application le retour silencieux de l'une de ces colonnes.

       L'adaptateur redonne a la ligne la FORME que le mapping ci-dessous
       attend. Les champs qui restent absents le sont PAR DECISION, une par
       une, ecrites sur le type PartnerAdaptedRow. */
    const source: PromiseLike<{ data: unknown; error: unknown }> = isPartner
      ? supabase
          .rpc("partner_athlete_profile", { p_athlete_id: id })
          .maybeSingle()
          .then((r) => ({
            data: r.data ? adaptPartnerRow(r.data as PartnerRpcRow) : null,
            error: r.error,
          }))
      : (directQuery as unknown as PromiseLike<{ data: unknown; error: unknown }>);

    const load = Promise.resolve(source).then(async ({ data, error }) => {
        if (error || !data) { setLoadingAthlete(false); return; }

        const d = data as Record<string, unknown>;

        /* Temps 2 — l'identité, projetée par le serveur.
           `?? null` explicite : la RPC ne rend AUCUNE ligne pour un athlète
           inactif ou supprimé, et un `undefined` interpolé écrirait
           "undefined" à l'écran. Même piège que usePipelineCards:72. */
        /* La RPC est RECRUTEUR-ONLY. L'appeler en preview (athlete) ou en
           partner rendait 42501 ; le helper leve, la chaine n'avait pas de
           catch, et setLoadingAthlete(false) n'etait jamais atteint — page
           bloquee en chargement. Meme garde que le corps mobile (l.950).

           Le try/catch protege AUSSI la fiche recruteur : avant, n'importe
           quel echec de cette RPC gelait la page. Desormais on degrade vers
           l'identite masquee, ce qui est le repli sur : on n'affiche jamais
           une identite qu'on n'a pas pu autoriser. */
        let card: RecruiterAthleteCard | null = null;
        if (viewerMode === "recruiter") {
          try {
            card = (await fetchRecruiterAthleteCards(supabase, [id])).get(id) ?? null;
          } catch (e) {
            console.warn("[recruiter_athlete_cards] echec — identite masquee", e);
            card = null;
          }
        }
        /* Hors recruteur, il n'y a pas de palier a appliquer : l'athlete voit
           son profil tel qu'un abonne le verrait (c'est l'objet de l'apercu),
           et le partenaire retrouve le comportement d'avant 794c6fd. */
        const identityVisible = viewerMode === "recruiter" ? (card?.identity_visible ?? false) : true;

        setAthleteUserId((d.user_id as string | null) ?? null);
        const evals = d.evaluations as Record<string, unknown>[] | null;
        // Pick by rule (détaillée > simple, then most recent updated_at) —
        // NOT evaluations[0] (unordered, often a non-owning coach's row).
        const eval0 = selectBestEvaluation(evals);

        // Extract global recruitment fields
        const recruitmentStatusRaw = (d.recruitment_status as string) || "OUVERT";
        const committedSchoolRel = d.committed_school as { name: string } | null;
        const committedSchoolNameVal = committedSchoolRel?.name || "";
        const openToOffersVal = d.open_to_offers as boolean | null;
        setRecruitmentStatus(recruitmentStatusRaw as GlobalRecruitmentStatus);
        setCommittedSchoolName(committedSchoolNameVal);
        setOpenToOffers(openToOffersVal ?? null);
        const coach = d.users as { first_name: string; last_name: string } | null;
        /* Lot F3 — résolution du référent (équipe → directeur → propriétaire).
           Lecture séparée : les RPC recruteur ne projettent pas coach_id, et
           fn_resolve_team_referent n'existe pas encore en base (vague 2). */
        const referentName =
          (await loadAthleteReferent(supabase, d.id as string)).name ?? "";
        const sportRel = Array.isArray(d.sports) ? d.sports[0] : d.sports;
        const posRel = Array.isArray(d.positions) ? d.positions[0] : d.positions;
        const sport = sportRel as { nom: string } | null;
        const pos = posRel as { nom: string; abreviation: string } | null;

        setGrilleSrc({
          grilleId:    (eval0?.grille_id as string | null) ?? null,
          positionId:  (d.position_id as string | null) ?? null,
          sportNom:    sport?.nom ?? null,
          positionNom: pos?.nom ?? null,
        });

        // School info
        const schoolRel = Array.isArray(d.schools) ? d.schools[0] : d.schools;
        const school = schoolRel as { name: string; region: string; city: string; type: string } | null;

        /* LE CONTEXTE, DERIVE UNE SEULE FOIS.

           `d.is_civil` est le verdict du SERVEUR (partner_athlete_profile le
           calcule sur le vrai `school_id`). Quand il est la, il gagne.

           Le `??` n'est pas une coquetterie : sur le chemin RECRUTEUR la RPC
           n'existe pas, `d.is_civil` vaut `undefined`, et la regle locale
           s'applique inchangee — elle est alimentee par un `school_id`
           reellement selectionne. Sur le chemin PARTENAIRE, cette meme regle
           lisait `undefined` et rendait TOUT LE MONDE civil (le bug du
           19 aout). On cesse de recalculer ce que le serveur a deja tranche.

           Un `||` serait faux ici : `is_civil = false` est une reponse, pas
           une absence de reponse. */
        const serverCivil = d.is_civil as boolean | null | undefined;
        const civil = serverCivil ?? (!d.school_id || school?.type === "LIGUE_CIVILE");

        // Age from birth date
        /* L'âge vient de la RPC, DÉRIVÉ côté serveur. date_naissance n'est
           jamais projetée à un recruteur — c'est elle qui décide du masquage
           Loi 25, la livrer permettrait de recalculer ce que le masquage
           protège. */
        /* `d.age` : chemin PARTENAIRE, ou l'age arrive deja derive de la RPC.
           Sans cette branche il serait null — `card` n'est peuple que pour un
           recruteur, et date_naissance n'est jamais projetee a un partenaire. */
        const age = card?.age
          ?? (d.age as number | null)
          ?? (d.date_naissance
              ? Math.floor((Date.now() - new Date(d.date_naissance as string).getTime()) / 31_557_600_000)
              : null);

        // Programme CÉGEP
        // T2 — la nouvelle colonne d'abord, l'ancienne en repli jusqu'a T3.
        const progArr = await resolveProgrammesVisesAsync(
          supabase, (d as Record<string, unknown>).programmes_vises, d.programme_cegep_vise);

        const heightFt = d.taille_pieds as number | null;
        const heightIn = d.taille_pouces as number | null;
        const heightDisplay = heightFt ? `${heightFt}'${heightIn || 0}"` : null;
        const weightDisplay = d.poids_lbs ? `${d.poids_lbs} lbs` : null;

        const traitRatings = eval0 ? {
          speed: (eval0.vitesse_explosivite as number) || 0,
          power: (eval0.force_puissance as number) || 0,
          endurance: (eval0.endurance_cardio as number) || 0,
          agility: (eval0.agilite_coordination as number) || 0,
          gameVision: (eval0.vision_du_jeu as number) || 0,
          tactics: (eval0.sens_tactique as number) || 0,
          leadership: (eval0.leadership as number) || 0,
          discipline: (eval0.discipline as number) || 0,
          coachability: (eval0.coachabilite as number) || 0,
          gameIQ: (eval0.intelligence_jeu as number) || 0,
          competitiveness: (eval0.competitivite as number) || 0,
          teamwork: (eval0.esprit_equipe as number) || 0,
          resilience: (eval0.resilience as number) || 0,
          attitude: (eval0.attitude_mentalite as number) || 0,
        } : null;

        const mapped: AthleteProfileRecruiterView = {
          ...mockAthleteProfileFull,
          id: d.id as string,
          // Identité : RIEN ne vient plus de `d`. Sous masquage le serveur
          // rend ces quatre champs à NULL, et `?? ""` garde le contrat
          // `string` du type sans jamais produire "null".
          identityVisible,
          firstName: card?.first_name ?? (d.first_name as string) ?? "",
          lastName: card?.last_name ?? (d.last_name as string) ?? "",
          photoUrl: card?.photo_url ?? (d.photo_url as string) ?? "",
          isVerified: d.verified as boolean,
          lastValidation: (d.last_profile_validation as string) || null,
          /* Complétion : valeur SERVEUR, plus de recalcul client.
             calculateCompletion() pondère photo_url, date_naissance (3) et
             numero_jersey (3) — trois colonnes qui ne sont plus dans le
             select. Le recalculer ici sous-estimerait tout profil vu par un
             recruteur, d'un score d'autant plus faux que le profil est
             complet. La RPC porte la valeur calculée sur la ligne entière. */
          profileCompleteness: card?.profile_completion ?? (d.profile_completion as number) ?? 0,
          jerseyNumber: card?.numero_jersey ?? (d.numero_jersey as string) ?? "",
          graduationYear: (d.annee_diplomation as number) || 0,
          highlightVideoUrl: (d.video_faits_saillants_url as string) || "",
          hudlUrl: (d.hudl_url as string) || "",
          youtubeUrl: (d.youtube_url as string) || "",
          instagramUrl: (d.instagram_url as string) || "",
          fullGameUrl: (d.video_match_complet_url as string) || "",
          practiceVideoUrl: (d.video_entrainement_url as string) || "",
          gpa: (d.moyenne_generale as number) || undefined,
          strongSubjects: (d.matieres_fortes as string[]) || [],
          academicHonors: (d.mentions_academiques as string[]) || [],
          program: progArr.length > 0 ? progArr.join(", ") : "",
          targetCegepProgram: progArr,
          wantsDEC: progArr.some(p => p.toLowerCase().includes("dec") || p.toLowerCase().includes("général")),
          openToPrivate: (d.ouvert_cegep_prive as boolean) || false,
          openToAnglophone: (d.ouvert_cegep_anglophone as boolean) || false,
          openToRelocate: (d.pret_changer_region as boolean) || false,
          preferredRegions: (d.regions_cegep_preferees as string[]) || [],
          heightDisplay: heightDisplay || "",
          weightDisplay: weightDisplay || "",
          wingspan: (d.envergure as string) || "",
          handSize: (d.taille_mains as string) || "",
          dominantHand: (d.main_dominante as "Droite" | "Gauche" | "Ambidextre") || undefined,
          dominantFoot: (d.pied_dominant as "Gauche" | "Droit" | "Les deux") || undefined,
          fortyYard: (d.test_40_verges as string) || "",
          verticalJump: (d.saut_vertical as string) || "",
          broadJump: (d.saut_longueur as string) || "",
          benchPress: (d.developpe_couche as string) || "",
          shuttleAgility: (d.navette_agilite as string) || "",
          sprint100m: (d.sprint_100m as string) || "",
          primarySport: sport?.nom || "",
          primaryPosition: pos?.abreviation ? `${pos.nom} (${pos.abreviation})` : pos?.nom || "",
          teamHistory: parseTeamHistory(d.parcours_equipes),
          // Phase 1 audit (post-Phase 6.1): schoolName overload split
          // into isCivil / schoolName / teamName / leagueName. Canonical
          // civil rule = no school_id OR school.type === 'LIGUE_CIVILE'.
          isCivil: civil,
          schoolName: civil ? "" : (school?.name || ""),
          teamName: (() => {
            if (!civil) return undefined;
            /* Chemin partenaire : la RPC projette `team_name`. L'adaptateur ne
               fournit pas `team_athletes` — sans cette branche, un athlete
               civil affichait « Equipe civile : — ». */
            const fromRpc = d.team_name as string | null | undefined;
            if (fromRpc) return fromRpc;
            const taRel = d.team_athletes as unknown;
            const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
            const firstTa = taArr[0] as Record<string, unknown> | null;
            const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
            return (teamRel as { name?: string } | null)?.name;
          })(),
          leagueName: (() => {
            if (!civil) return undefined;
            const fromRpcTeam = d.team_name as string | null | undefined;
            if (fromRpcTeam) return undefined;
            const fromRpcLeague = d.league_name as string | null | undefined;
            if (fromRpcLeague) return fromRpcLeague;
            const taRel = d.team_athletes as unknown;
            const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
            const firstTa = taArr[0] as Record<string, unknown> | null;
            const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
            const hasTeam = !!(teamRel as { name?: string } | null)?.name;
            return hasTeam ? undefined : "Ligue Civile";
          })(),
          region: school?.region || "",
          city: school?.city || "",
          age: age || 0,
          gender: (d.genre as "M" | "F" | "Autre") || "M",
          commitmentStatus: (d.statut_recrutement_override as string) || "ouvert",
          coachReport: (eval0?.rapport_entraineur as string) || "",
          /* Lot F3 — le RÉFÉRENT résolu, pas le propriétaire brut. coach_id est
             NULL pour 43 des 53 athlètes en équipe : lire le champ tel quel
             affichait une carte de réputation sans nom dans 81 % des cas.
             Repli sur le propriétaire quand la résolution ne donne rien. */
          coachName: referentName || (coach ? `${coach.first_name} ${coach.last_name}` : ""),
          coachSchool: school?.name || "",
          coachReputation: undefined,
          overallRating: (eval0?.cote_globale as number) ?? (d.cote_globale_entraineur as number) ?? 0,
          traitRatings: traitRatings as AthleteProfileRecruiterView["traitRatings"],
          /* VOIE 2 — ce chargeur alimente LES MÊMES points de rendu que
             mapToRecruiterView. Le laisser sur la colonne dérivée faisait
             afficher 3 badges sur 7 selon le chemin emprunté. */
          distinctions: badgesDepuisRaw(d as Record<string, unknown>),
          favoriteCount: 0,
          viewsThisMonth: 0,
        };

        setA(mapped);
        setCoachId((d.coach_id as string) || null);

        // Affiliation discriminator + civil-team info population.
        // Post-Phase 6.1 unified model :
        //   - school_id NULL                              → 'civil_no_team' (orphan)
        //   - school_id NOT NULL, schools.type SECONDAIRE/CEGEP → 'school'
        //   - school_id NOT NULL, schools.type LIGUE_CIVILE     →
        //       'civil_with_team' if there's a team_athletes row,
        //       'civil_no_team'   otherwise
        const schoolId = d.school_id as string | null;
        /* CHEMIN PARTENAIRE — `school_id` vaut null PAR DECISION (l'identifiant
           n'a rien a faire chez un partenaire, seul le verdict compte). Le
           discriminant ci-dessous en deduisait donc « civil_no_team » pour
           TOUT LE MONDE : un athlete scolaire s'affichait sous l'en-tete
           « Equipe civile » avec la phrase « pas encore rattache a une
           equipe ». Faux, et invisible tant que le mode detaille etait force
           a « simple » — ce bloc ne se rendait jamais. Le retrait du forcage
           l'aurait rendu visible sur les 48 fiches.

           On repart des deux seules informations d'affiliation que la RPC
           projette : le verdict `is_civil` et `team_name`. L'InfoRow du bloc
           « school » sait deja se retitrer en « Equipe civile » via
           `a.isCivil` — un athlete civil rattache y est donc correctement
           rendu, sans branche supplementaire. */
        if (serverCivil !== undefined && serverCivil !== null) {
          const teamRpc = (d.team_name as string | null) ?? null;
          if (!civil || teamRpc) {
            setAffiliation("school");
          } else {
            setAffiliation("civil_no_team");
          }
          setCivilTeamInfo(null);
        } else if (!schoolId) {
          setAffiliation("civil_no_team");
          setCivilTeamInfo(null);
        } else if (school?.type !== "LIGUE_CIVILE") {
          setAffiliation("school");
          setCivilTeamInfo(null);
        } else {
          // Civil athlete (LIGUE_CIVILE school anchor). Pull team
          // membership and coaches from the unified team_athletes /
          // team_coaches tables.
          const taRel = d.team_athletes as unknown;
          const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
          const firstTa = taArr[0] as Record<string, unknown> | null;
          const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
          const lt = teamRel as Record<string, unknown> | null;

          if (!lt) {
            setAffiliation("civil_no_team");
            setCivilTeamInfo(null);
          } else {
            setAffiliation("civil_with_team");
            const teamId = lt.id as string | undefined;
            // Coaches list — query team_coaches → users for this
            // specific team. PostgREST embed doesn't traverse all
            // the way in one shot.
            let coachNames: string[] = [];
            if (teamId) {
              const { data: coachRows } = await supabase
                .from("team_coaches")
                .select("users!coach_id(first_name, last_name)")
                .eq("team_id", teamId);
              coachNames = (coachRows ?? [])
                .map((row) => {
                  const u = (row as Record<string, unknown>).users;
                  const userObj = (Array.isArray(u) ? u[0] : u) as { first_name?: string; last_name?: string } | null;
                  if (!userObj) return "";
                  return `${userObj.first_name ?? ""} ${userObj.last_name ?? ""}`.trim();
                })
                .filter((s) => s.length > 0);
            }
            setCivilTeamInfo({
              teamName: (lt.name as string) ?? "",
              // In the unified model, the LIGUE_CIVILE school IS the
              // league — its name is the league name.
              leagueName: school?.name ?? "",
              ageGroup: (lt.age_group as string) ?? null,
              division: (lt.division as string) ?? null,
              coaches: coachNames,
            });
          }
        }

        // Populate teamDetails for the bottom-of-Sportif block. Flat-map
        // every team_athletes row → its team join → TeamDetail. Civil-aware
        // via teams.schools.type === 'LIGUE_CIVILE'. Active filter +
        // sort happen INSIDE TeamDetailsBlock so both bodies share the
        // ordering logic.
        {
          const taRel = d.team_athletes as unknown;
          const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
          const mapped: TeamDetail[] = [];
          for (const taRow of taArr) {
            const teamRel = (taRow as Record<string, unknown>)?.teams;
            const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as Record<string, unknown> | null;
            if (!team) continue;
            const sportRel = team.sports;
            const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
            const teamSchoolRel = team.schools;
            const teamSchool = (Array.isArray(teamSchoolRel) ? teamSchoolRel[0] : teamSchoolRel) as { name?: string; type?: string } | null;
            const teamIsCivil = teamSchool?.type === "LIGUE_CIVILE";
            mapped.push({
              id: (team.id as string) ?? "",
              name: (team.name as string) ?? "",
              sportName: sport?.nom ?? "",
              league: (team.league as string | null) ?? null,
              ageGroup: (team.age_group as string | null) ?? null,
              division: (team.division as string | null) ?? null,
              gender: (team.gender as string | null) ?? null,
              season: (team.season as string | null) ?? null,
              isActive: (team.is_active as boolean | null) !== false,
              isCivil: teamIsCivil,
              clubName: teamIsCivil ? (teamSchool?.name ?? null) : null,
            });
          }
          setTeamDetails(mapped);
        }

        setLoadingAthlete(false);
      });

    /* Filet de securite : toute exception levee DANS le .then (mapping,
       jointure inattendue, RPC) laisserait sinon loadingAthlete a true et la
       page en chargement perpetuel. Le builder Supabase rend un
       PromiseLike<void>, qui n'a pas de .catch — d'ou Promise.resolve().
       On sort du chargement quoi qu'il arrive : une fiche incomplete vaut
       mieux qu'un ecran fige. */
    void Promise.resolve(load).catch((e: unknown) => {
      console.error("[AthleteRecruiterProfileBody] chargement echoue", e);
      setLoadingAthlete(false);
    });
  }, [id, isFreeRecruiter, isPartner, tierLoading, viewerMode]);

  return {
    a, setA, loadingAthlete, grilleSrc, recruitmentStatus, committedSchoolName,
    openToOffers, coachId, affiliation, civilTeamInfo, teamDetails, athleteUserId,
  };
}
