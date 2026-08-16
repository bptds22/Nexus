// lib/queries/teamPage/dbToTeamPage.ts
//
// DB → props <TeamPage>. Jumeau de schoolPage/dbToProgramPage. Ce qui est AUTO
// (identité école, calendrier RSEQ, roster, engagements) et ce qui est MANUEL
// (team_page_content / pennants / camps / besoins) se rejoignent ICI, jamais
// dans les composants. Aucune donnée inventée : un champ vide reste vide.

import type { SocialLink, SocialPlatform } from "@/components/marketing/SocialIcons";
import type {
  TeamData, TeamEvent, TeamContent, Commit, Pennant, TeamNeed, ConnectedAthlete,
} from "@/components/team-page/content";
import type { SportKey } from "./sportSlots";
import { genreCourt, libelleSportGenre } from "../schoolPage/dbToProgramPage";

/** Titre affiché d'une équipe.
 *
 *  `teams.name` porte le nom de l'ÉTABLISSEMENT pour toutes les équipes issues
 *  du pont RSEQ (« André-Grasset » sur les 7 équipes de Grasset) : tel quel, le
 *  hero d'une équipe de basketball annonce « André-Grasset ». Quand le nom de
 *  l'équipe est celui de son école, on dérive donc « {sport} {genre} » des
 *  colonnes réelles — même normalisation du genre que « L'affiche »
 *  (`genreCourt`), inconnu → mixte, jamais deviné.
 *
 *  Sinon `teams.name` GAGNE : un coach qui a saisi un vrai nom d'équipe n'est
 *  jamais écrasé. Le saut de ligne suit la convention des fixtures
 *  (« Football\nmasculin ») — le hero est dessiné pour deux lignes. */
export function titreEquipe(
  teamName: string,
  _schoolName: string,
  sportNom: string,
  gender: string | null,
): string {
  // Délègue à la règle UNIQUE (libelleSportGenre), la même que « L'affiche » de
  // la page école. Le séparateur est un saut de ligne : le hero est dessiné
  // pour deux lignes.
  //
  // POURQUOI LA GARDE A DISPARU. Cette fonction ne dérivait QUE si le nom
  // d'équipe égalait celui de l'école ; sinon elle rendait `teams.name`. Or ce
  // champ vient du RSEQ et porte le nom de l'ÉTABLISSEMENT dans tous les cas —
  // il ne le porte simplement pas toujours à l'identique : tronqué
  // (« Notre-Dame » pour Campus Notre-Dame-de-Foy), abrégé (« Abitibi-Témisc. »,
  // « Ch.-St-Lambert ») ou numéroté (« Chicoutimi 2 »). La comparaison faisait
  // donc ressortir un nom d'école en titre de page équipe dès qu'elle échouait,
  // ce qui n'est jamais l'information attendue : le kicker au-dessus porte déjà
  // l'école. « L'affiche », elle, dérivait sans condition depuis le début — deux
  // règles pour la même question, et la page équipe avait la mauvaise.
  //
  // Conséquence mesurée : 40 groupes (école, sport, genre) comptent plus d'une
  // équipe, soit 83 équipes qui partagent désormais leur titre. Elles restent
  // distinguées par la DIVISION, que le hero affiche en pastille juste sous le
  // titre — « Basketball masculin » + « D2 ». C'est déjà ainsi que L'affiche les
  // sépare.
  //
  // `_schoolName` n'est plus lu. Le paramètre est conservé pour ne pas toucher
  // aux appelants, dont le loader SSR du web.
  return libelleSportGenre(sportNom, gender, "\n", teamName);
}

export interface TeamRow {
  id: string; name: string; division: string | null; gender: string | null;
  season: string | null; school_id: string; sport_id: string;
}
export interface SchoolIdentity {
  name: string;
  nickname: string;
  initiales: string;
  logoUrl: string | null;
  colorPrimary: string;
  colorDark: string;
  colorLight: string;
  wallWords: string[];
}
export interface GameRow {
  game_date: string | null; game_time: string | null; venue: string | null;
  home_team_id: string | null; visitor_team_id: string | null;
  home_name_raw: string | null; visitor_name_raw: string | null;
  home_score: number | null; visitor_score: number | null; is_played: boolean | null;
}
export interface CommitRow {
  athlete_id: string | null; prenom: string | null; nom: string | null;
  position_nom: string | null; etoiles: number | null;
  ecole_provenance: string | null; promo: number | null; visible_public: boolean;
}

/** Nom affiché de l'entraîneur-chef, dans l'ordre arbitré :
 *  1. compte DÉSIGNÉ (headcoach_user_id) — le nom vient de `users`, donc il
 *     suit les corrections faites sur le compte ;
 *  2. nom MANUEL (headcoach_name) — le coach n'a pas de compte Nexus ;
 *  3. staff de l'équipe (team_coaches.head_coach) — comportement historique.
 *  Aucune des trois → chaîne vide : le nom n'est pas rendu (photo et bio, si
 *  elles existent, le sont quand même). */
export function resolveHeadCoachName(o: {
  designatedName?: string | null;
  manualName?: string | null;
  staffName?: string | null;
}): string {
  return (o.designatedName?.trim() || o.manualName?.trim() || o.staffName?.trim() || "");
}

/** Accent clair de l'équipe : la primaire éclaircie. L'école ne stocke que 3
 *  teintes — la 4e est CALCULÉE (mock S1 : « rien à configurer »). Mélange vers
 *  le blanc à 38 % : assez clair pour les accents, sans virer au rose. */
export function lighten(hex: string, amount = 0.38): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** teams.season ('2025-2026') → année de départ (le moteur besoins raisonne en
 *  année d'obtention du diplôme). Illisible → année courante. */
export function seasonYear(season: string | null | undefined): number {
  const m = /(\d{4})/.exec(season ?? "");
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

// Forme stockée dans team_page_content.socials (jsonb) : [{type,url}] — aucun
// DDL, la colonne est un tableau libre. `kind` reste lu par tolérance si une
// ligne a été écrite avec l'ancienne clé.
export const SOCIAL_PLATFORMS: SocialPlatform[] = ["instagram", "facebook", "youtube", "tiktok", "x", "website"];
export function toSocialLinks(raw: { type?: string; kind?: string; url?: string }[]): SocialLink[] {
  return raw
    .map((s) => ({ platform: (s?.type ?? s?.kind ?? "") as SocialPlatform, href: s?.url ?? "" }))
    .filter((s) => s.href && SOCIAL_PLATFORMS.includes(s.platform));
}

/** Matchs RSEQ (AUTO) + camps du collège (MANUEL), fusionnés et triés par date.
 *  Les camps sont mis en évidence par la tuile `camp` du composant. */
export function buildEvents(
  teamId: string,
  games: GameRow[],
  camps: { titre: string; event_date: string; lieu: string }[],
): TeamEvent[] {
  const matches: TeamEvent[] = games
    .filter((g) => g.game_date)
    .map((g) => {
      const home = g.home_team_id === teamId;
      const played = g.is_played === true && g.home_score != null && g.visitor_score != null;
      return {
        type: "match" as const,
        date: g.game_date!,
        adversaire: (home ? g.visitor_name_raw : g.home_name_raw) ?? "À confirmer",
        domicile: home,
        heure: g.game_time ?? "",
        lieu: g.venue ?? "",
        scorePour: played ? (home ? g.home_score : g.visitor_score) : null,
        scoreContre: played ? (home ? g.visitor_score : g.home_score) : null,
      };
    });
  // Même filtre que saveCamps (titre obligatoire) : sans lui, l'aperçu de
  // l'éditeur affichait une tuile dès qu'une date était posée, alors que la
  // ligne n'aurait jamais été enregistrée.
  const campEvents: TeamEvent[] = camps
    .filter((c) => c.titre.trim() && c.event_date)
    .map((c) => ({
      type: "camp" as const,
      date: c.event_date,
      // Chacun chez soi : le titre ne se déguise plus en lieu quand le lieu
      // est vide — et ne disparaît plus quand il est rempli.
      titre: c.titre.trim(),
      domicile: true,
      heure: "",
      lieu: c.lieu || "",
    }));
  return [...matches, ...campEvents].sort((a, b) => a.date.localeCompare(b.date));
}

/** Fiches engagées — la fonction DB a DÉJÀ anonymisé les mineurs non consentis
 *  (Loi 25) : ici on ne fait que transposer. Une ligne anonyme est conservée
 *  (elle compte) mais n'est jamais nommée. */
export function buildCommits(rows: CommitRow[]): { commits: Commit[]; total: number } {
  const commits = rows.map((r) => ({
    prenom: r.prenom ?? "",
    nom: r.nom ?? "",
    ecoleProvenance: [r.position_nom, r.ecole_provenance].filter(Boolean).join(" · "),
    promo: r.promo ?? 0,
    etoiles: r.etoiles ?? 0,
    athleteId: r.athlete_id ?? undefined,
    visiblePublic: r.visible_public === true,
  }));
  return { commits, total: rows.length };
}

export interface BuildTeamDataInput {
  team: TeamRow;
  sportNom: string;
  sportKey: SportKey | null;
  school: SchoolIdentity;
  content: {
    hero_image_path: string | null; hero_focal_x: number; hero_focal_y: number; hero_zoom: number;
    record_saison: string; playoff_result: string;
    use_school_socials: boolean; socials: { type: string; url: string }[];
    presentation_text: string; championships: number | null; staff_since: number | null;
    headcoach_photo_path: string | null; headcoach_bio: string;
    headcoach_focal_x?: number; headcoach_focal_y?: number; headcoach_zoom?: number;
    hidden_sections: string[];
  } | null;
  pennants: Pennant[];
  camps: { titre: string; event_date: string; lieu: string }[];
  needs: TeamNeed[];
  games: GameRow[];
  /** Saisons SŒURS de la même équipe (même école + sport + genre), matchs
   *  compris — chacune avec l'id de sa propre ligne `teams`, puisque c'est lui
   *  qui décide domicile/extérieur. Absent → pas de sélecteur de saison. */
  seasons?: { saison: string; teamId: string; division: string | null; games: GameRow[] }[];
  roster: { pos: string; annee_fin: number | null }[];
  commitRows: CommitRow[];
  headCoachName: string;
  staff: { nom: string; role: string }[];
  heroUrl: string | null;
  coachPhotoUrl: string | null;
  /** Athlète connecté — sans lui, aucun « match parfait » n'est possible. */
  viewer?: ConnectedAthlete | null;
}

/** Assemble la TeamData finale. `hidden_sections` est appliqué ICI : la page
 *  publique ne « masque » rien en CSS, elle ne reçoit tout simplement pas la
 *  donnée (une section sans données ne se rend pas — règle du composant). */
export function buildTeamData(i: BuildTeamDataInput): TeamData {
  const hidden = new Set(i.content?.hidden_sections ?? []);
  const season = seasonYear(i.team.season);
  const { commits, total } = buildCommits(i.commitRows);

  const presentation = i.content?.presentation_text ?? "";
  const champs = i.content?.championships ?? 0;
  const since = i.content?.staff_since ?? 0;
  const hasPresentation =
    !hidden.has("presentation") &&
    (!!presentation || champs > 0 || since > 0 || i.pennants.length > 0 ||
      !!i.headCoachName || !!i.coachPhotoUrl || !!i.content?.headcoach_bio);

  const content: TeamContent | null = hasPresentation
    ? {
        presentationText: presentation,
        championships: champs,
        staffSince: since,
        // Le bloc coach existe dès qu'il y a QUELQUE CHOSE à montrer : le nom
        // vient du staff (team_coaches), la photo et la bio sont saisies dans
        // l'éditeur. Une équipe sans entraîneur-chef déclaré affiche quand même
        // la photo et la bio — sinon le collège téléverse dans le vide.
        headCoach: (i.headCoachName || i.coachPhotoUrl || i.content?.headcoach_bio)
          ? {
              nom: i.headCoachName, photoUrl: i.coachPhotoUrl, bio: i.content?.headcoach_bio ?? "",
              // 50/50 et non 50/25 : la vignette était en `cover` sans
              // `object-position`, donc centrée. Le défaut reproduit l'existant.
              focal: `${i.content?.headcoach_focal_x ?? 50}% ${i.content?.headcoach_focal_y ?? 50}%`,
              zoom: i.content?.headcoach_zoom ?? 100,
            }
          : null,
        staff: i.staff,
        palmares: i.pennants,
      }
    : null;

  return {
    id: i.team.id,
    sportNom: i.sportNom,
    division: i.team.division ?? "",
    genre: i.team.gender ?? "",
    // Sport sans layout Nexus : la clé ne résout aucun terrain et le widget
    // besoins s'efface (garde dans BesoinsWidget) — le reste de la page vit.
    sportKey: (i.sportKey ?? "__none__") as TeamData["sportKey"],
    nom: titreEquipe(i.team.name, i.school.name, i.sportNom, i.team.gender),
    nickname: i.school.nickname,
    schoolName: i.school.name,
    schoolId: i.team.school_id,
    schoolInitial: i.school.initiales || i.school.name.slice(0, 1).toUpperCase(),
    logoUrl: i.school.logoUrl,
    teamColor: i.school.colorPrimary,
    teamColorLt: lighten(i.school.colorPrimary),
    teamColorDark: i.school.colorDark,
    teamColorNeutral: i.school.colorLight,
    coachName: i.headCoachName,
    recordSaison: i.content?.record_saison ?? "",
    recordLabel: "Saison régulière",
    playoffResult: i.content?.playoff_result ?? "",
    playoffLabel: "Séries RSEQ",
    // Réseaux : héritage école (aucune colonne réseau sur schools à ce jour →
    // liste vide, jamais un lien inventé) ou réseaux propres à l'équipe.
    socials: i.content && !i.content.use_school_socials ? toSocialLinks(i.content.socials) : [],
    // Le compteur du widget besoins reste tel quel : il compte TOUT le monde,
    // y compris les recrues jamais nommées (mineurs non consentis, Loi 25).
    engagesCount: total,
    season,
    roster: i.roster,
    viewer: i.viewer ?? null,
    wallWords: i.school.wallWords,
    heroImage: i.heroUrl,
    heroFocal: `${i.content?.hero_focal_x ?? 50}% ${i.content?.hero_focal_y ?? 25}%`,
    heroZoom: i.content?.hero_zoom ?? 100,
    content,
    events: buildEvents(i.team.id, i.games, hidden.has("camps") ? [] : i.camps),
    /* Les camps ne sont rattachés qu'à la saison COURANTE : ils vivent dans
       team_events de CETTE ligne d'équipe. Les saisons passées ne rendent donc
       que leurs matchs, ce qui est exact — on n'invente pas un camp rétroactif. */
    seasons: i.seasons?.map((s) => ({
      saison: s.saison,
      teamId: s.teamId,
      division: s.division,
      events: buildEvents(
        s.teamId,
        s.games,
        s.teamId === i.team.id && !hidden.has("camps") ? i.camps : [],
      ),
    })) ?? null,
    commits: hidden.has("engagees") ? [] : commits,
    needs: i.needs,
    hiddenSections: [...hidden],
  };
}
