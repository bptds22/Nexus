// lib/queries/schoolPage/dbToProgramPage.ts
//
// Adaptateur DB → props des vrais composants (ProgramWall via ProgramPage).
// Inverse de pageBridge/wallBridge. Tolérant aux NULL : une école à peine
// configurée (ville seedée seulement) rend une page valide avec défauts —
// LA PAGE NE CASSE JAMAIS. content NULL total → l'appelant utilise le fixture.

import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { ProgramPageContent, Sport } from "@/components/program-page/content";
import type { SchoolPageState } from "./schoolPageData";

const PROV_CODE: Record<string, string> = { Québec: "QC", Ontario: "ON", Canada: "CA" };
const nn = (v: string | null | undefined, fb: string) => (v && v.trim() ? v : fb);

/** Colonnes RÉELLES de public.schools consommées par la page.
 *  `langue` (FR | EN | BILINGUE | null) et `reseau` (PUBLIC | PRIVE | null)
 *  alimentent la fiche campus — avant, elles étaient écrites en dur (« FR » /
 *  « PRIVÉ »), ce qui affichait « PRIVÉ » sur 54 des 69 cégeps. */
export interface SchoolRow {
  id: string;
  name: string;
  city: string | null;
  region: string | null;
  langue: string | null;
  reseau: string | null;
  lat: number | null;
  lng: number | null;
  /** nominatim (bâtiment trouvé par son nom) · manuel (corrigé à la main) ·
   *  approx (repli centre-ville / point voisin). */
  geo_source: string | null;
}

/** Une équipe telle que lue dans public.teams (+ le nom de son sport). */
export interface TeamRowForGrid {
  id: string;
  sport: string;
  division: string | null;
  gender: string | null;
}

/** `teams.gender` est en toutes lettres ; « L'affiche » attend le code court
 *  qu'utilisent les fixtures. Valeur inconnue ou nulle → « Mixte », jamais un
 *  genre deviné.
 *
 *  Exporté : `dbToTeamPage` s'en sert pour dériver le titre d'une équipe dont
 *  `teams.name` porte le nom de l'école. Une seule règle de normalisation pour
 *  les deux adaptateurs — pas de copie qui puisse dériver. */
export function genreCourt(gender: string | null): string {
  const g = (gender ?? "").trim().toLowerCase();
  if (g.startsWith("mascul")) return "M";
  if (g.startsWith("fémin") || g.startsWith("femin")) return "F";
  return "Mixte";
}

/** Coordonnée à ÉPINGLER sur la vignette carte — ou null.
 *
 *  `approx` est REFUSÉ : la migration qui l'a introduit le définit comme « repli
 *  ville / point voisin du campus », pas comme le bâtiment. Poser un pin
 *  « le campus est ici » sur un centre-ville, c'est afficher un point faux avec
 *  l'aplomb d'un point juste. Ces écoles retombent sur le bouton « Ouvrir dans
 *  Plans », qui lance une RECHERCHE par nom — donc juste, même sans coordonnée.
 *  Elles repasseront à la carte le jour où leurs vraies adresses seront saisies
 *  (backlog noté dans 20260728150110_schools_geo_source_approx.sql). */
function pinDeSchool(s: SchoolRow): { lat: number; lng: number } | null {
  if (s.lat == null || s.lng == null) return null;
  const src = (s.geo_source ?? "").trim().toLowerCase();
  if (src !== "nominatim" && src !== "manuel") return null;
  return { lat: s.lat, lng: s.lng };
}

/** `schools.langue` → la valeur du contrat page. Toute valeur hors des trois
 *  connues (ou absente) rend null : la tuile LANGUE disparaît plutôt que
 *  d'affirmer une langue. Vérifié en base : FR 53 · EN 9 · BILINGUE 3 · null 4. */
export function langueDeSchool(v: string | null): ProgramPageContent["language"] {
  const s = (v ?? "").trim().toUpperCase();
  return s === "FR" || s === "EN" || s === "BILINGUE" ? s : null;
}

/** `schools.reseau` → la valeur du contrat page. La DB stocke PRIVE (sans
 *  accent) ; l'affichage veut PRIVÉ. Inconnu/absent → null, tuile absente.
 *  Vérifié en base : PUBLIC 54 · PRIVE 10 · null 5. */
export function reseauDeSchool(v: string | null): ProgramPageContent["schoolType"] {
  const s = (v ?? "").trim().toUpperCase();
  return s === "PUBLIC" ? "PUBLIC" : s === "PRIVE" || s === "PRIVÉ" ? "PRIVÉ" : null;
}

/** Initiales dérivées du nom canonique (2 premiers mots, préfixe de type
 *  retiré) — « Cégep de Saint-Jérôme » → « SJ ». Sert quand l'école n'a jamais
 *  ouvert l'éditeur : c'est une dérivation, pas une invention. */
function initialesDuNom(nom: string): string {
  return nom
    .replace(/^(Cégep|Collège|Campus|Centre)\s+(de\s+|du\s+|d'|des\s+)?/i, "")
    .split(/[\s-]+/).filter(Boolean).slice(0, 2)
    .map((m) => m[0]).join("").toUpperCase();
}

/** Groupe les équipes d'une école par sport et construit « L'affiche ».
 *  Le libellé d'une équipe est DÉRIVÉ (sport + genre) : `teams.name` porte le
 *  nom de l'établissement, il ne distingue pas les équipes entre elles.
 *  Chaque équipe pointe vers sa route publique `/college/<école>/<équipe>`. */
export function sportsFromTeams(schoolId: string, teams: TeamRowForGrid[]): Sport[] {
  const parSport = new Map<string, Sport>();
  for (const t of teams) {
    const sport = (t.sport ?? "").trim();
    if (!sport) continue; // sport_id orphelin → l'équipe n'est pas affichable
    const court = genreCourt(t.gender);
    const mot = court === "M" ? "masculin" : court === "F" ? "féminin" : "mixte";
    const entry = parSport.get(sport) ?? { nom: sport, equipes: [] };
    entry.equipes.push({
      nom: `${sport} ${mot}`,
      division: t.division && t.division.trim() ? t.division : null,
      genre: court,
      url: `/college/${schoolId}/${t.id}`,
    });
    parSport.set(sport, entry);
  }
  for (const s of parSport.values()) {
    s.equipes.sort((a, b) =>
      (a.division ?? "").localeCompare(b.division ?? "", "fr") || a.nom.localeCompare(b.nom, "fr"));
  }
  return [...parSport.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/** Construit {school, content} pour <ProgramPage>. `assetUrl` transforme un
 *  logo_path storage en URL publique (null → monogramme). */
export function dbToProgramPage(
  school: SchoolRow,
  c: Partial<SchoolPageState>,
  cards: { titre: string; legende: string; image_path: string | null }[],
  programs: { name: string; is_displayed: boolean }[],
  news: { titre: string; url: string }[],
  recrutedCount: number,
  followersCount: number,
  assetUrl: (path: string | null | undefined, bucket: "school-logos" | "campus-photos") => string | null,
  /** Équipes réelles de l'école. Absent / vide → « L'affiche » ne se rend pas
   *  (SportsGrid s'efface), comme avant l'arrivée de ce paramètre. */
  teams: TeamRowForGrid[] = [],
): { school: SchoolProgramIdentity; content: ProgramPageContent } {
  const code = PROV_CODE[nn(c.province, "Québec")] ?? "QC";
  const words = (c.wall_words ?? []).filter(Boolean);
  const identity: SchoolProgramIdentity = {
    id: school.id,
    schoolName: school.name,
    mascot: nn(c.nickname, school.name.split(" ").pop() || "—"),
    colorPrimary: nn(c.color_primary, "#A6192E"),
    colorDarker: nn(c.color_dark, "#5A0E1B"),
    colorNeutral: nn(c.color_light, "#E8C7CD"),
    // claire custom en DB (≠ défaut #E8C7CD) → glyphes tuiles claires assombris (#3)
    lightDefined: !!(c.color_light && c.color_light.trim() && c.color_light.trim().toLowerCase() !== "#e8c7cd"),

    logoUrl: assetUrl(c.logo_path, "school-logos"),
    city: nn(c.ville, (school.city || "").toUpperCase()),
    regionTag: `${nn(c.quartier, (school.region || "").toUpperCase())} · ${code}`,
    areaCode: nn(c.code_regional, code),
    initials: nn(c.initiales, "—"),
    slogan: c.slogan?.trim() ? c.slogan : null,
    nickname: null,
    customWords: { eliteWord: words[0], boldWord: words[1], allezWord: words[2], ensembleWord: words[3] },
    league: "RSEQ",
    province: code,
    division: "",
    tagline: c.tagline?.trim() ? c.tagline : undefined,
    railWordOverride: c.rail_word?.trim() ? c.rail_word : undefined,
    deviseWords: (c.devise_1 || c.devise_2) ? { first: nn(c.devise_1, ""), second: nn(c.devise_2, "") } : undefined,
    arrowPhrase: (c.arrow_avant || c.arrow_apres) ? { before: nn(c.arrow_avant, ""), after: nn(c.arrow_apres, "") } : undefined,
  };

  const displayed = programs.filter((p) => p.is_displayed).map((p) => p.name);
  const enc = (c.encadrement ?? []).filter(Boolean);
  const cityTitle = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "");
  const num = (v: number | null | undefined): number | undefined => (v == null ? undefined : v);

  const affiche = sportsFromTeams(school.id, teams);
  // « Le nombre d'équipes et la région sont AUTO » (libellé de l'éditeur, §6) :
  // le compte vient donc des équipes RÉELLES, jamais d'une constante. Il compte
  // ce que « L'affiche » montre — une équipe au sport orphelin n'est ni listée
  // ni comptée, les deux chiffres ne peuvent pas diverger.
  const nbEquipes = affiche.reduce((n, s) => n + s.equipes.length, 0);

  const content: ProgramPageContent = {
    ticker: [{ text: nn(c.ticker_text, nn(c.slogan, school.name)) }],
    // §5 : le NOMBRE d'athlètes va dans la VALEUR (athletes), pas dans le label.
    // Label fixe. 0/absent → StatRows n'affiche pas la rangée (jamais « 0+ »).
    stats: { teams: nbEquipes, teamsLabel: "ÉQUIPES", athletes: Number(c.nb_athletes) || 0, athletesLabel: "ÉTUDIANTS-ATHLÈTES", region: cityTitle(nn(c.ville, school.city || "")) },
    sports: affiche,
    // FICHE CAMPUS — valeurs RÉELLES de public.schools, plus aucune constante.
    // Une valeur absente rend `null` : la tuile n'est PAS rendue, jamais une
    // langue ni un réseau devinés. La RÉGION est bien `schools.region` (peuplée
    // sur 69/69 cégeps) et non plus une recopie de la ville.
    language: langueDeSchool(school.langue),
    schoolType: reseauDeSchool(school.reseau),
    region: school.region?.trim() ? school.region : null,
    address: "", mapQuery: `${school.name}, ${school.city || "Québec"}`,
    mapPin: pinDeSchool(school),
    housing: { type: "none" }, facts: [], videoUrl: c.campus_video_url?.trim() ? c.campus_video_url! : null,
    campusCards: [
      ...cards.filter((cd) => cd.titre).map((cd) => ({ type: "photo" as const, image: assetUrl(cd.image_path, "campus-photos"), titre: cd.titre, legende: cd.legende })),
      ...(c.campus_video_url?.trim() ? [{ type: "video" as const, youtubeUrl: c.campus_video_url! }] : []),
    ],
    sellTitle: nn(c.about_title, "À propos"),
    sellText: nn(c.sell_text, ""),
    featuredPrograms: [],
    programsList: displayed,
    route: {
      stop1: { sl: "AUJOURD'HUI · SECONDAIRE", h4: "Ton profil Nexus", p: "Stats, vidéos, bulletins — tout ce que les coachs veulent voir." },
      stop2: { sl: `2027–2029 · ${(nn(c.nickname, school.name)).toUpperCase()}`, h4: "Tu portes les couleurs",
        p: `${nn(c.niveau, "Collégial")}, ${nn(c.nb_athletes, "—")} étudiants-athlètes, ${enc.length ? enc.join(" · ") : "encadrement sport-études"}.` },
      stop3: { sl: "ENSUITE · U SPORTS", h4: "Tu montes encore",
        stats: [
          { count: recrutedCount, label: "RECRUTÉS" },
          { count: num(c.stat_usports), label: "EN U SPORTS" },
          { count: num(c.stat_usa), label: "AUX ÉTATS-UNIS" },
          { count: num(c.stat_diplomation), suffix: "%", label: "DIPLOMATION" },
        ],
      },
    },
    universities: (c.universities ?? []).filter(Boolean),
    nexusStripText: `Des athlètes du secondaire ont rejoint ${school.name} grâce à leur profil Nexus — vus, évalués, recrutés.`,
    nexusRecruitedCount: recrutedCount,
    followersCount,
    news: news.filter((n) => n.titre).map((n) => ({ source: domainOf(n.url), titre: n.titre, url: n.url || "#" })),
    ctaTitle: "Prêt à porter les couleurs ?", ctaNotifyName: nn(c.nickname, school.name),
    hiddenSections: (c.hidden_sections ?? []).filter(Boolean),
  };
  return { school: identity, content };
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace("www.", "").toUpperCase(); } catch { return "—"; }
}

/** Sections dont le contenu vient EXCLUSIVEMENT de l'éditeur : une école qui ne
 *  l'a jamais ouvert n'a rien à y mettre. AboutSell, AcademicPlanche et
 *  ParcoursRoute ne s'effacent pas d'elles-mêmes (contrairement à SportsGrid et
 *  NewsSection) → on les masque par le mécanisme existant.
 *  « campus » N'Y EST PLUS : ses trois tuiles lisent désormais public.schools
 *  (langue / reseau / region), une source RÉELLE qui existe même sans éditeur.
 *  Chaque tuile s'efface d'elle-même si sa colonne est nulle, et la fiche
 *  entière disparaît si les trois le sont — plus besoin de masquer la section. */
const SECTIONS_SANS_SOURCE = ["about", "programs", "parcours", "news"];

/** Page d'une école RÉELLE mais jamais configurée (aucune ligne
 *  school_page_content). Tout ce qui s'affiche vient de `schools` et de
 *  `teams` — nom, ville, région, équipes, compte d'équipes. Le reste est
 *  absent, jamais emprunté à une autre école.
 *
 *  Implémentée en réutilisant `dbToProgramPage` avec un contenu VIDE : chaque
 *  champ y passe déjà par `nn(c.x, repli)`, donc les replis sont exactement
 *  ceux d'une école « à peine configurée ». Aucune logique parallèle qui
 *  pourrait diverger. */
export function degradedProgramPage(
  school: SchoolRow,
  teams: TeamRowForGrid[],
): { school: SchoolProgramIdentity; content: ProgramPageContent } {
  const { school: identity, content } = dbToProgramPage(
    school, {}, [], [], [], 0, 0, () => null, teams,
  );
  return {
    school: {
      ...identity,
      // `nn(c.initiales, "—")` donnerait un tiret, et areaCode retomberait sur
      // le code de province. Les deux se dérivent du vrai nom.
      initials: initialesDuNom(school.name) || identity.initials,
      areaCode: null, // resolveWall retombe alors sur les initiales
    },
    content: { ...content, hiddenSections: SECTIONS_SANS_SOURCE },
  };
}
