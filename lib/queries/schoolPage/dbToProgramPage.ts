// lib/queries/schoolPage/dbToProgramPage.ts
//
// Adaptateur DB → props des vrais composants (ProgramWall via ProgramPage).
// Inverse de pageBridge/wallBridge. Tolérant aux NULL : une école à peine
// configurée (ville seedée seulement) rend une page valide avec défauts —
// LA PAGE NE CASSE JAMAIS. content NULL total → l'appelant utilise le fixture.

import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { ProgramPageContent } from "@/components/program-page/content";
import type { SchoolPageState } from "./schoolPageData";

const PROV_CODE: Record<string, string> = { Québec: "QC", Ontario: "ON", Canada: "CA" };
const nn = (v: string | null | undefined, fb: string) => (v && v.trim() ? v : fb);

export interface SchoolRow { id: string; name: string; city: string | null; region: string | null }

/** Construit {school, content} pour <ProgramPage>. `assetUrl` transforme un
 *  logo_path storage en URL publique (null → monogramme). */
export function dbToProgramPage(
  school: SchoolRow,
  c: Partial<SchoolPageState>,
  cards: { titre: string; legende: string; image_path: string | null }[],
  programs: { name: string; is_displayed: boolean }[],
  news: { titre: string; url: string }[],
  recrutedCount: number,
  assetUrl: (path: string | null | undefined, bucket: "school-logos" | "campus-photos") => string | null,
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

  const content: ProgramPageContent = {
    ticker: [{ text: nn(c.ticker_text, nn(c.slogan, school.name)) }],
    stats: { teams: 0, teamsLabel: "ÉQUIPES", athletes: 0, athletesLabel: nn(c.nb_athletes, ""), region: cityTitle(nn(c.ville, school.city || "")) },
    sports: [],
    language: "FR", schoolType: "PRIVÉ", region: cityTitle(nn(c.ville, school.city || "")),
    address: "", mapQuery: `${school.name}, ${school.city || "Québec"}`,
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
    news: news.filter((n) => n.titre).map((n) => ({ source: domainOf(n.url), titre: n.titre, url: n.url || "#" })),
    ctaTitle: "Prêt à porter les couleurs ?", ctaNotifyName: nn(c.nickname, school.name),
  };
  return { school: identity, content };
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace("www.", "").toUpperCase(); } catch { return "—"; }
}
