"use client";

// components/team-page/TeamPageMobile.tsx
//
// Rendu NATIF (bundle Capacitor) de la page équipe /college/[schoolId]/[teamId].
//
// LOT B — ce fichier ne rend PLUS <TeamPage> (le layout WEB DESKTOP dans une
// WebView de 390px). Il rend le layout MOBILE de
// docs/reference/page-equipe-mobile-v3.html, dans l'ordre :
//   TeamHero → Calendrier → Présentation → BesoinsWidget (terrain) → Déjà engagées.
//
// LE TERRAIN garde la géométrie du web, VERBATIM : .scene{perspective:840px},
// .imgwrap{rotateX(44deg); transform-origin:50% 100%}, plaques 2D À PLAT
// par-dessus. Les coordonnées left/top viennent de SPORT_CONFIGS via
// resolveFacette() — jamais réinventées. Le décor lui-même est rendu par
// <TerrainStage> (même composant que le web : photo /terrains/*.jpg, repli
// terrain dessiné) ; seule son habillage CSS est mobile.
//
// La COUCHE DE CHARGEMENT ci-dessous est inchangée : createClient() côté client
// (clé anon) → RLS appliquée, comme les écrans *Mobile*. La version web (SSR
// service-role) reste dans app/college/[schoolId]/[teamId]/page.tsx.

import * as React from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { matchDynamicRoute, SESSION_KEY_PREFIX } from "@/lib/platform/mobileRoutes";
import { createClient } from "@/lib/supabase/client";
import SocialIcons from "@/components/marketing/SocialIcons";
import StarRating from "@/components/ui/StarRating";
import TerrainStage from "./TerrainStage";
import { useSchoolTargets } from "@/lib/queries/schoolPage/useSchoolTargets";
import { accentOnShell } from "@/components/program-wall/theme";
import { loadTeamPage } from "@/lib/queries/teamPage/teamPageData";
import { sportKeyFromNom, defaultNeeds, mergeNeeds, toTeamNeeds, type PositionRow } from "@/lib/queries/teamPage/sportSlots";
import {
  buildTeamData, resolveHeadCoachName,
  type GameRow, type CommitRow, type TeamRow, type SchoolIdentity,
} from "@/lib/queries/teamPage/dbToTeamPage";
import {
  SPORT_CONFIGS, resolveFacette, countNoYear, matchState, parseEventDate, isPast, todayISO, coachPhotoStyle,
  type TeamData, type TeamEvent, type Pennant, type ConnectedAthlete, type SportConfig,
} from "@/components/team-page/content";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Fil d'Ariane posé par « L'affiche » de la page école — dit à la page équipe
 *  qu'une page école la précède dans l'historique, donc qu'il faut DÉPILER. */
const FROM_SCHOOL_KEY = "__nx_team_from_school";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Haptique légère — patron des écrans mobiles qui FONCTIONNENT (RechercheMobile,
 *  RecruteurRechercheMobile, shared/settings/utils.ts…) : import dynamique de
 *  @capacitor/haptics + try/catch, SANS garde `isNativePlatform`. La garde est
 *  inutile ici — hors device l'appel échoue et le catch l'absorbe — et c'est
 *  elle qui rend `lib/platform/haptics.ts` (0 importateur, 0 try/catch) muet.
 *  Copie locale ASSUMÉE : la consolidation des 3 systèmes est une dette notée,
 *  traitée en session dédiée sur arbre propre. */
async function tap(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* no-op */ }
}

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap"
    />
  </>
);

/** Pluriel « suffisant » pour un libellé de poste (jumeau du loader serveur). */
function pluriel(nom: string): string {
  return /[sxz]$/i.test(nom) ? nom.toLowerCase() : nom.toLowerCase() + "s";
}

/** L'ATHLÈTE CONNECTÉ (client anon) — déclenche le « match parfait ». Lit sa
 *  PROPRE ligne athletes (RLS « athletes can read own profile »). Pas connecté /
 *  pas un athlète → null, la box disparaît. Ne jette jamais. */
async function loadViewerClient(supabase: SupabaseClient): Promise<ConnectedAthlete | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await supabase
      .from("athletes")
      .select("sports:sport_id(nom), positions:position_id(nom, abreviation)")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    const row = data as unknown as {
      sports: { nom: string } | null;
      positions: { nom: string; abreviation: string | null } | null;
    } | null;
    if (!row?.sports?.nom || !row.positions?.abreviation) return null;
    return {
      sport: row.sports.nom,
      pos: row.positions.abreviation.toUpperCase(),
      pos2: null,
      posLabel: row.positions.nom,
      posLabelPlural: pluriel(row.positions.nom),
    };
  } catch {
    return null;
  }
}

type TeamLoad =
  | { configured: true; team: TeamData }
  | { configured: false; degraded: TeamData }
  | { configured: false; degraded: null };

/** Jumeau CLIENT de loadTeamPageForRender : même logique, client anon au lieu
 *  du service-role. Réutilise loadTeamPage + les transforms tels quels. */
async function loadTeamDataClient(supabase: SupabaseClient, teamId: string): Promise<TeamLoad> {
  const { data: teamRow } = await supabase
    .from("teams").select("id, name, division, gender, season, school_id, sport_id")
    .eq("id", teamId).maybeSingle();
  const team = teamRow as TeamRow | null;
  if (!team) return { configured: false, degraded: null };

  const page = await loadTeamPage(supabase, team.id);

  const [sport, school, schoolPage, positions, games, roster, coaches, commits, viewer] = await Promise.all([
    supabase.from("sports").select("nom").eq("id", team.sport_id).maybeSingle(),
    supabase.from("schools").select("name").eq("id", team.school_id).maybeSingle(),
    supabase.from("school_page_content")
      .select("nickname, initiales, logo_path, color_primary, color_dark, color_light, wall_words")
      .eq("school_id", team.school_id).maybeSingle(),
    supabase.from("positions").select("id, nom, abreviation").eq("sport_id", team.sport_id),
    supabase.from("games")
      .select("game_date, game_time, venue, home_team_id, visitor_team_id, home_name_raw, visitor_name_raw, home_score, visitor_score, is_played")
      .or(`home_team_id.eq.${team.id},visitor_team_id.eq.${team.id}`)
      .eq("season", team.season ?? "")
      .order("game_date"),
    // ═══════════════════════════════════════════════════════════════════════
    // RLS: team_coaches exclut CEGEP, team_athletes limité au membre.
    // Vide aujourd'hui (0 staff, 0 roster CÉGEP). Le jour où un collège en
    // saisit, ces sections seront vides SANS erreur pour l'athlète.
    // Correctif = policy de lecture (DDL), décision séparée.
    // ═══════════════════════════════════════════════════════════════════════
    supabase.from("team_athletes")
      .select("athletes!inner(annee_diplomation, positions:position_id(abreviation))")
      .eq("team_id", team.id),                                                   // ROSTER
    supabase.from("team_coaches").select("role, users:coach_id(first_name, last_name)").eq("team_id", team.id), // STAFF
    supabase.rpc("list_team_commits", { p_team_id: team.id } as unknown as undefined),
    loadViewerClient(supabase),
  ]);

  const sportNom = (sport.data as { nom: string } | null)?.nom ?? "";
  const sportKey = sportKeyFromNom(sportNom);
  const sp = (schoolPage.data ?? null) as Record<string, unknown> | null;
  const schoolName = (school.data as { name: string } | null)?.name ?? "Mon collège";

  const identity: SchoolIdentity = {
    name: schoolName,
    nickname: (sp?.nickname as string) || schoolName || "",
    initiales: (sp?.initiales as string) || "",
    logoUrl: sp?.logo_path
      ? supabase.storage.from("school-logos").getPublicUrl(sp.logo_path as string).data.publicUrl
      : null,
    colorPrimary: (sp?.color_primary as string) || "#A6192E",
    colorDark: (sp?.color_dark as string) || "#5A0E1B",
    colorLight: (sp?.color_light as string) || "#E8C7CD",
    wallWords: Array.isArray(sp?.wall_words) ? (sp!.wall_words as string[]).filter(Boolean) : [],
  };

  const posRows = (positions.data ?? []) as PositionRow[];
  const needs = page.needs.length && sportKey
    ? toTeamNeeds(mergeNeeds(defaultNeeds(sportKey, posRows), page.needs), posRows)
    : [];

  const rosterRows = (roster.data ?? []).map((r) => {
    const a = (r as unknown as { athletes: { annee_diplomation: number | null; positions: { abreviation: string | null } | null } }).athletes;
    return { pos: (a?.positions?.abreviation ?? "").toUpperCase(), annee_fin: a?.annee_diplomation ?? null };
  });

  const coachRows = (coaches.data ?? []) as unknown as { role: string | null; users: { first_name: string | null; last_name: string | null } | null }[];
  const nameOf = (u: { first_name: string | null; last_name: string | null } | null) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
  const headRow = coachRows.find((c) => /chef|head|principal/i.test(c.role ?? "")) ?? coachRows[0];

  let designatedName: string | null = null;
  if (page.content?.headcoach_user_id) {
    const { data: du } = await supabase
      .from("users").select("first_name, last_name")
      .eq("id", page.content.headcoach_user_id).maybeSingle();
    designatedName = nameOf((du ?? null) as { first_name: string | null; last_name: string | null } | null) || null;
  }
  const headCoachName = resolveHeadCoachName({
    designatedName,
    manualName: page.content?.headcoach_name ?? "",
    staffName: nameOf(headRow?.users ?? null),
  });

  const staff = coachRows
    .filter((c) => c !== headRow && nameOf(c.users))
    .map((c) => ({ nom: nameOf(c.users), role: c.role ?? "Entraîneur" }));

  const asset = (path: string | null) =>
    path ? supabase.storage.from("campus-photos").getPublicUrl(path).data.publicUrl : null;

  const pennants: Pennant[] = page.pennants.map((p) => ({ titre: p.titre, annee: p.annee ?? 0, type: p.type }));

  const built = buildTeamData({
    team, sportNom, sportKey, school: identity,
    content: page.content, pennants, camps: page.camps, needs,
    games: (games.data ?? []) as GameRow[],
    roster: rosterRows,
    commitRows: (commits.data ?? []) as CommitRow[],
    headCoachName, staff,
    heroUrl: asset(page.content?.hero_image_path ?? null),
    coachPhotoUrl: asset(page.content?.headcoach_photo_path ?? null),
    viewer,
  });

  if (!page.content) return { configured: false, degraded: built };
  return { configured: true, team: built };
}

type Loaded =
  | { state: "loading" }
  | { state: "error" }
  | { state: "notfound" }
  | { state: "ready"; team: TeamData };

function CenteredMobile({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ background: "#111317", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
      {children}
    </main>
  );
}

export default function TeamPageMobile() {
  // useDynamicParam : sur mobile, useParams vaut "placeholder" → relit le vrai
  // teamId depuis sessionStorage (stashé par app/page.tsx, ou par « L'affiche »
  // de ProgramPageMobile). Web : vrai id direct.
  const teamId = useDynamicParam("teamId");
  const isPlaceholder = !teamId || teamId === "placeholder";
  const [st, setSt] = React.useState<Loaded>({ state: "loading" });

  React.useEffect(() => {
    if (isPlaceholder) return;
    let cancelled = false;
    setSt({ state: "loading" });
    (async () => {
      try {
        if (!UUID.test(teamId!)) { if (!cancelled) setSt({ state: "notfound" }); return; }
        const res = await loadTeamDataClient(createClient(), teamId!);
        if (cancelled) return;
        if (res.configured) setSt({ state: "ready", team: res.team });
        else if (res.degraded) setSt({ state: "ready", team: res.degraded });
        else setSt({ state: "notfound" });
      } catch {
        if (!cancelled) setSt({ state: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [teamId, isPlaceholder]);

  // ÉTATS DE CHARGEMENT (nouveaux vs SSR) — jamais d'écran blanc ni de page à
  // moitié peuplée : squelette pendant le fetch, erreur lisible sinon.
  if (isPlaceholder || st.state === "loading") {
    return (
      <CenteredMobile>
        <div style={{ width: 30, height: 30, border: "3px solid #E63946", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </CenteredMobile>
    );
  }
  if (st.state === "notfound") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Équipe introuvable.</p></CenteredMobile>;
  }
  if (st.state === "error") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Impossible de charger la page. Vérifie ta connexion, puis réessaie.</p></CenteredMobile>;
  }
  return (
    <>
      {FONTS}
      <TeamBodyMobile team={st.team} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE RENDU MOBILE
   ═══════════════════════════════════════════════════════════════════════════ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function TeamBodyMobile({ team }: { team: TeamData }) {
  const [r, g, b] = hexToRgb(team.teamColor);
  const [lr, lg, lb] = hexToRgb(team.teamColorLt);

  // Cibles — un seul état partagé hero ⇄ box besoins. La cible est au niveau
  // ÉCOLE (arbitrage D-1) : depuis une page équipe on cible le CÉGEP, via le
  // MÊME hook que la page école. Sans schoolId, rien n'est résolu ni écrit.
  const targets = useSchoolTargets(team.schoolId ?? "", 0);
  const [localCible, setLocalCible] = React.useState(false);
  const wired = !!team.schoolId;
  const cible = wired ? targets.inTargets : localCible;
  const toggleCible = React.useCallback(() => {
    if (wired) targets.toggle();
    else setLocalCible((c) => !c);
  }, [wired, targets]);

  const router = useRouter();
  /* Retour — destination TOUJOURS la page école de CETTE équipe, par deux
     chemins selon d'où l'on vient :

     · venu de la page école (fil d'Ariane posé par « L'affiche ») → on DÉPILE.
       Empiler ici créerait une boucle : le retour de l'école, lui, dépile, et
       les deux pages se renverraient l'une à l'autre. Mesuré avant correction.
     · arrivé par un lien direct (notification, partage) → aucune école derrière,
       on POUSSE la page école. Le chemin reste prévisible au lieu de sortir de
       l'app. En static export ça passe par le registre : /college/<uuid>
       n'existe pas, il faut le shell placeholder + le stash. */
  const retour = React.useCallback(() => {
    void tap();
    let vientDeLEcole = false;
    try {
      vientDeLEcole = sessionStorage.getItem(FROM_SCHOOL_KEY) === team.schoolId;
      if (vientDeLEcole) sessionStorage.removeItem(FROM_SCHOOL_KEY);
    } catch { /* no-op */ }
    if (vientDeLEcole) { router.back(); return; }

    const url = team.schoolId ? `/college/${team.schoolId}` : null;
    if (!url) { router.back(); return; } // fixtures sans schoolId : repli
    const matched = IS_CAPACITOR ? matchDynamicRoute(url) : null;
    if (matched) {
      try { sessionStorage.setItem(`${SESSION_KEY_PREFIX}${matched.paramKey}`, matched.realId); } catch { /* no-op */ }
      router.push(matched.placeholderPath);
      return;
    }
    router.push(url);
  }, [router, team.schoolId]);

  const rootStyle = {
    "--red": team.teamColor,
    "--red-lt": team.teamColorLt,
    "--ink": team.teamColorDark,
    "--cream": team.teamColorNeutral,
    "--bg": "#111317",
    "--card": "#1A1D24",
    "--card-deep": "#12151C",
    "--line": "#1E2129",
    "--line-card": "#262A33",
    "--gold-ink": "#8F6A15",
    "--plaque-off": "#20262F",
    "--plaque-off-ink": "#5C6575",
    "--plaque-off-mut": "#4C5462",
    "--p-ink": "#EDEFF3",
    "--p-soft": "#C9CCD4",
    "--p-mut": "#8A909C",
    "--p-inv": "#15171B",
    "--p-mut-inv": "#6B7280",
    "--nx-red": "#E63946",
    "--nx-red-deep": "#B32330",
    // Primaire rendue lisible sur la coquille sombre — plancher partagé avec la
    // page école (accentOnShell). Les kickers vivent sur #111317.
    "--red-shell": accentOnShell(team.teamColor),
    "--green": "#22C55E",
    "--pop": "cubic-bezier(0.34,1.56,0.64,1)",
    // Teintes rgba calculées en JS → aucun color-mix.
    "--red-tint-bg": `rgba(${r},${g},${b},0.15)`,
    "--red-tint-bd": `rgba(${r},${g},${b},0.38)`,
    "--red-lt-55": `rgba(${lr},${lg},${lb},0.55)`,
    "--hero-focal": team.heroFocal ?? "50% 25%",
    "--hero-zoom": String(Math.max(100, team.heroZoom ?? 100) / 100),
    // --tabzone n'est PLUS posée ici. Elle était conditionnée à IS_CAPACITOR,
    // donc réservait 88px même là où AUCUNE tab bar n'est montée — d'où le vide
    // en bas de /college. C'est app/college/layout.tsx qui la pose maintenant
    // sur <body>, d'après ce qui est RÉELLEMENT rendu (session valide ou non) ;
    // on l'hérite, avec repli sur la seule safe-area au point d'usage.
    // APP-SHELL : sous .is-capacitor, <html>/<body> sont position:fixed +
    // overflow:hidden (globals.css §« App-shell scroll lock »). Le conteneur
    // scroll borné unique est le <main> de l'écran — sans ça la page est
    // TRONQUÉE au premier viewport et le scroll est mort. Même réglage que
    // app/athlete/layout.tsx. Hors Capacitor : scroll de document normal.
    ...(IS_CAPACITOR
      ? {
          height: "100dvh",
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }
      : null),
  } as React.CSSProperties;

  return (
    <main className="tpm" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: TPM_CSS }} />

      {/* ═══ RETOUR ═══
          Destination EXPLICITE : la page école de CETTE équipe, pas router.back().
          Arrivé par un lien direct (notification, partage), l'historique n'a pas
          de page école derrière — un back sortirait de l'app ou remonterait sur
          un écran sans rapport. Le chemin reste donc prévisible dans les deux cas.
          Passe par le REGISTRE (matchDynamicRoute) : en static export
          /college/<uuid> n'existe pas, il faut le shell placeholder + le stash. */}
      <div className="backbar">
        <button type="button" className="backbtn" onClick={retour} aria-label="Revenir à la page du collège">
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />{team.schoolName || "Le collège"}
        </button>
      </div>

      <HeroMobile team={team} cible={cible} onToggleCible={toggleCible} />
      <CalendrierMobile team={team} />
      <PresentationMobile team={team} />
      {!(team.hiddenSections ?? []).includes("besoins") && (
        <BesoinsMobile team={team} cible={cible} onToggleCible={toggleCible} />
      )}
      <EngageesMobile team={team} />
      {/* Rien n'est coupé par le tab bar flottant. */}
      <div className="tabspacer" aria-hidden />
    </main>
  );
}

/* ── TeamHero ────────────────────────────────────────────────────────────── */

function HeroMobile({ team, cible, onToggleCible }: { team: TeamData; cible: boolean; onToggleCible: () => void }) {
  const [imgOk, setImgOk] = React.useState(true);
  const hasPhoto = !!team.heroImage && imgOk;
  const nameLines = team.nom.split("\n");

  return (
    <div className="hero">
      <div className="hero-fallback" />
      {team.heroImage && imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-bg" src={team.heroImage} alt="" onError={() => setImgOk(false)} />
      )}
      {!hasPhoto && <div className="hero-ph" />}
      <div className="hero-fade" />
      <div className="accent" />
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="logo-img" src={team.logoUrl} alt={team.schoolName} />
      ) : (
        <div className="logo">{team.schoolInitial}</div>
      )}
      {team.socials.length > 0 && (
        <div className="soc"><SocialIcons links={team.socials} size={21} /></div>
      )}

      <div className="pnl">
        <div className="eyebrow">
          {team.nickname ? `${team.nickname.toUpperCase()} · ` : ""}{team.schoolName.toUpperCase()}
        </div>
        <div className="name">
          {nameLines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < nameLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        <div className="meta">
          {team.division ? <span className="chip solid">{team.division}</span> : null}
          {team.genre ? <span className="chip out">{team.genre}</span> : null}
        </div>
        <div className="stats">
          {team.recordSaison ? (
            <div className="stat"><div className="v">{team.recordSaison}</div><div className="l">{team.recordLabel}</div></div>
          ) : null}
          {team.playoffResult ? (
            <div className="stat"><div className="v">{team.playoffResult}</div><div className="l">{team.playoffLabel}</div></div>
          ) : null}
          {team.coachName ? (
            <div className="stat pers"><div className="v">{team.coachName}</div><div className="l">Entraîneur-chef</div></div>
          ) : null}
        </div>
        <CiblesBtn cible={cible} onToggle={onToggleCible} />
      </div>
    </div>
  );
}

/* Le ♥ du hero et celui de la box besoins sont le MÊME bouton (même état cible) :
   le retour haptique est donc posé une seule fois, ici. */
function CiblesBtn({ cible, onToggle, small }: { cible: boolean; onToggle: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      className={`cibles${small ? " sm" : ""}${cible ? " on" : ""}`}
      onClick={() => { void tap(); onToggle(); }}
    >
      <Heart size={small ? 15 : 17} fill="currentColor" aria-hidden />
      <span className="t">{cible ? "Dans tes cibles" : "Rajouter à mes cibles"}</span>
    </button>
  );
}

/* ── Calendrier ──────────────────────────────────────────────────────────── */

function CalendrierMobile({ team }: { team: TeamData }) {
  const events = team.events ?? [];
  const caraRef = React.useRef<HTMLDivElement>(null);
  const today = todayISO();
  const firstUpcoming = events.findIndex((e) => !isPast(e, today));

  // Défaut : positionner la rangée sur le 1ᵉʳ événement à venir.
  React.useEffect(() => {
    const el = caraRef.current;
    if (!el || firstUpcoming <= 0) return;
    const card = el.children[firstUpcoming] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: Math.max(0, card.offsetLeft - 8), behavior: "auto" });
  }, [firstUpcoming, team.id]);

  if (events.length === 0) return null; // pas d'événement → pas de section

  const season = `${team.season}-${String((team.season + 1) % 100).padStart(2, "0")}`;
  const scroll = (dir: number) => caraRef.current?.scrollBy({ left: dir * 181, behavior: "smooth" });

  return (
    <section className="cal">
      <div className="cal-head">
        <div>
          <div className="kick">SAISON {season}</div>
          <h2>Le calendrier</h2>
          <div className="pbar" />
        </div>
        <div className="cara-nav">
          <button type="button" onClick={() => scroll(-1)} aria-label="Précédent"><ChevronLeft size={16} aria-hidden /></button>
          <button type="button" onClick={() => scroll(1)} aria-label="Suivant"><ChevronRight size={16} aria-hidden /></button>
        </div>
      </div>
      <div className="cal-row" ref={caraRef}>
        {events.map((e, i) => <EventCard key={i} e={e} today={today} />)}
      </div>
    </section>
  );
}

function EventCard({ e, today }: { e: TeamEvent; today: string }) {
  const d = parseEventDate(e.date);

  if (e.type === "camp") {
    // Même arbitrage que sur le web : l'intitulé du collège d'abord, le libellé
    // générique en repli. Voir .tpm .ev-tag pour la coupe à deux lignes.
    const label = e.titre?.trim() || "Camp de sélection";
    return (
      <article className="ev camp">
        <span className="ev-tag" title={label}>{label}</span>
        <div className="ev-date"><span className="d">{d.day}</span><span className="m">{d.mon}</span></div>
        {e.lieu ? <div className="ev-meta">{e.lieu}</div> : null}
      </article>
    );
  }

  const past = isPast(e, today);
  const hasScore = e.scorePour != null && e.scoreContre != null;
  const win = hasScore && e.scorePour! > e.scoreContre!;
  const loss = hasScore && e.scorePour! < e.scoreContre!;
  const meta = [e.heure, e.lieu].filter(Boolean).join(" · ");
  return (
    <article className={`ev ${e.domicile ? "home" : "away"}${past ? " past" : ""}`}>
      <div className="ev-date"><span className="d">{d.day}</span><span className="m">{d.mon}</span></div>
      <div className="ev-vs">{e.domicile ? "vs " : "à "}{e.adversaire}</div>
      {hasScore ? (
        <div className={`ev-score${win ? " w" : loss ? " l" : ""}`}>{e.scorePour}–{e.scoreContre}</div>
      ) : meta ? (
        <div className="ev-meta">{meta}</div>
      ) : null}
    </article>
  );
}

/* ── Présentation ────────────────────────────────────────────────────────── */

function PresentationMobile({ team }: { team: TeamData }) {
  const c = team.content;
  if (!c) return null; // pas de contenu → pas de section
  const hc = c.headCoach;
  const hasStats = c.championships > 0 || c.staffSince > 0;

  return (
    <section className="present">
      <div className="p-cols">
        <div className="p-left">
          <div className="p-head">
            <div className="kick">L&apos;ÉQUIPE</div>
            <h2>Plus qu&apos;une <em>équipe</em></h2>
            <div className="pbar" />
          </div>
          {c.presentationText ? <p className="lead">{c.presentationText}</p> : null}
          {hasStats && (
            <div className="stats p-stats">
              {c.championships > 0 && (
                <div className="stat"><div className="v">{c.championships}</div><div className="l">Championnats</div></div>
              )}
              {c.staffSince > 0 && (
                <div className="stat"><div className="v">Depuis {c.staffSince}</div><div className="l">Staff en place</div></div>
              )}
            </div>
          )}
          {c.palmares.length > 0 && (
            <>
              <div className="pen-string" />
              <div className="pen-row" aria-label="Palmarès">
                {c.palmares.map((p, i) => (
                  <div key={i} className={`pennant ${p.type}`}>
                    <div className="pen-t">{p.titre.toUpperCase()}</div>
                    {p.annee > 0 ? <div className="pen-y">{p.annee}</div> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-right">
          {hc && (
            <div className="coach">
              <div className="cphoto">
                {hc.photoUrl ? (
                  // Même cadrage que sur le web, alors que le cadre diffère
                  // (portrait 88×106 ici, 16:10 là-bas) : c'est tout l'intérêt
                  // de stocker un point focal plutôt qu'un recadrage figé.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hc.photoUrl} alt="" style={coachPhotoStyle(hc)} />
                ) : (
                  <span className="cph-tag">Photo</span>
                )}
              </div>
              <div className="cinfo">
                {hc.nom ? <div className="cname">{hc.nom}</div> : null}
                <div className="crole">ENTRAÎNEUR-CHEF</div>
                {hc.bio ? <p className="cbio">{hc.bio}</p> : null}
              </div>
            </div>
          )}
          {c.staff.length > 0 && (
            <div className="sList">
              {c.staff.map((s, i) => (
                <div key={i} className="sRow">
                  <span className="sName">{s.nom}</span>
                  <span className="sRole">{s.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── BesoinsWidget — LE TERRAIN ──────────────────────────────────────────── */

/* ── JEU DE POSITIONS PORTRAIT — football et flag SEULEMENT ────────────────
   SPORT_CONFIGS est partagé avec la page WEB : on n'y touche pas. Cette table
   ne fait que REMPLACER les left/top au rendu mobile, et uniquement pour les
   deux sports dont la géométrie est incompatible avec le portrait.

   Pourquoi ces deux-là et pas les autres : mesuré à 390px sur les 7 sports et
   leurs 10 facettes. Hockey, soccer et volleyball n'ont AUCUN chevauchement ;
   basketball et baseball en ont de petits (278 à 804px²) sur des postes
   voisins par nature. Football et flag concentrent les pires (900 à 1148px²)
   parce qu'ils alignent leurs postes sur une LIGNE DE MÊLÉE : des ancrages
   séparés de 6 à 22 % qui font 40-60px en paysage et 18-26px en portrait,
   alors qu'une plaque en fait 96.

   Règle de non-collision, vérifiée contre les 16 chevauchements mesurés :
   deux plaques se touchent si |Δleft| < 27 % ET |Δtop| < 21 % — soit 96px de
   large sur 354, et 90px de haut sur 430. Chaque paire ci-dessous respecte
   l'une des deux conditions au moins. L'ordre sémantique est conservé : la
   ligne devant, le porteur au fond, les ailiers écartés. */
const PORTRAIT: Record<string, Record<string, Record<string, { left: number; top: number }>>> = {
  football: {
    offense:      { WR: { left: 14, top: 30 }, OL: { left: 55, top: 26 }, QB: { left: 30, top: 55 }, RB: { left: 68, top: 78 } },
    defense:      { S:  { left: 70, top: 16 }, DB: { left: 16, top: 30 }, LB: { left: 46, top: 44 }, DL: { left: 52, top: 72 } },
    specialistes: { RET:{ left: 50, top: 14 }, LS: { left: 20, top: 42 }, K:  { left: 74, top: 62 }, P:  { left: 36, top: 84 } },
  },
  flag: {
    offense: { WR: { left: 16, top: 28 }, C:  { left: 58, top: 24 }, QB: { left: 32, top: 54 }, RB: { left: 70, top: 78 } },
    defense: { DB: { left: 18, top: 24 }, S:  { left: 74, top: 24 }, RU: { left: 46, top: 52 }, LB: { left: 24, top: 80 } },
  },
};

/** Applique le jeu portrait si le sport en a un. Un slot dont l'acronyme a été
 *  renommé par le coach ne matche plus la table et garde sa position paysage —
 *  c'est volontaire : mieux vaut une plaque mal placée qu'une plaque déplacée
 *  au hasard. */
function enPortrait<T extends { acro: string; left: number; top: number }>(
  sportKey: string | null, facetteKey: string, plaques: T[], groups: readonly { acro: string; label: string }[],
): T[] {
  const jeu = (sportKey && PORTRAIT[sportKey]?.[facetteKey]) || null;
  if (!jeu) return plaques;
  return plaques.map((p, i) => {
    // l'acronyme rendu peut être une saisie du coach : on retombe sur celui du
    // layout, à la même position dans l'ordre des groupes.
    const cle = jeu[p.acro] ? p.acro : (groups[i]?.acro ?? p.acro);
    const pos = jeu[cle];
    return pos ? { ...p, left: pos.left, top: pos.top } : p;
  });
}

function BesoinsMobile({ team, cible, onToggleCible }: { team: TeamData; cible: boolean; onToggleCible: () => void }) {
  const cfg: SportConfig | undefined = SPORT_CONFIGS[team.sportKey];
  const [fi, setFi] = React.useState(0);
  // Sport sans terrain Nexus (athlétisme, natation…) : aucune plaque à montrer →
  // la section s'efface au lieu de casser la page.
  if (!cfg) return null;
  const hasToggle = cfg.facettes.length > 1;
  const facette = cfg.facettes[fi];

  // Besoins SAISIS prioritaires ; aucune ligne → moteur dérivé du roster.
  // Coordonnées left/top = SPORT_CONFIGS, jamais réinventées.
  const { plaques: plaquesPaysage } = resolveFacette(team, facette.groups, team.season);
  // Le jeu portrait ne s'applique qu'au football et au flag — voir PORTRAIT.
  const plaques = enPortrait(team.sportKey, facette.key, plaquesPaysage, facette.groups);
  const noYear = countNoYear(team.roster);
  const ms = matchState(team, team.season);
  const nextYear = team.season + 1;
  const nommees = (team.commits ?? []).some((c) => c.visiblePublic);

  return (
    <section className="widget">
      <div className="top">
        <div>
          <div className="kick">RECRUTEMENT · RENTRÉE {nextYear}</div>
          <div className="h2">On cherche <em>du monde</em></div>
          <div className="pbar" />
        </div>
        {team.engagesCount > 0 && (
          nommees ? (
            <button
              type="button"
              className="commit"
              onClick={() => document.getElementById("deja-engagees")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Check size={13} strokeWidth={3} aria-hidden />
              {team.engagesCount} recrue{team.engagesCount > 1 ? "s" : ""} déjà engagée{team.engagesCount > 1 ? "s" : ""}
            </button>
          ) : (
            <div className="commit">
              <Check size={13} strokeWidth={3} aria-hidden />
              {team.engagesCount} recrue{team.engagesCount > 1 ? "s" : ""} déjà engagée{team.engagesCount > 1 ? "s" : ""}
            </div>
          )
        )}
      </div>

      {hasToggle && (
        <div className="toggle">
          {cfg.facettes.map((f, i) => (
            <button
              key={f.key}
              type="button"
              className={i === fi ? "on" : ""}
              onClick={() => { void tap(); setFi(i); }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Décor incliné (.scene / .imgwrap), plaques 2D À PLAT par-dessus.
          Le retour au tap d'une plaque passe par une DÉLÉGATION sur ce conteneur
          plutôt que par un handler dans TerrainStage : ce composant est partagé
          avec la page équipe WEB, qui ne doit pas bouger. Le conteneur est un
          simple bloc, sans style : `.tpm .stage` reste un sélecteur descendant. */}
      <div onClick={(e) => { if ((e.target as HTMLElement).closest(".tk")) void tap(); }}>
        <TerrainStage
          asset={cfg.asset}
          perspective={cfg.perspective}
          court={cfg.court}
          sportKey={team.sportKey}
          plaques={plaques}
        />
      </div>

      {noYear > 0 && (
        <div className="noyear">
          {noYear} joueur{noYear > 1 ? "s" : ""} sans année de fin — à compléter dans l&apos;éditeur.
        </div>
      )}

      {/* UNE seule box, jamais une rangée de cards. */}
      {ms?.kind === "match" && (
        <div className={`needbox match${ms.level ? " nb-" + ms.level : ""}`}>
          <div className="nb-l"><b>Match parfait</b> — {ms.posLabel} est un besoin ici.</div>
          <div className="nb-s">
            {ms.pitch
              ? ms.pitch
              : ms.departures > 0
                ? `${ms.departures} des ${ms.effectif} ${ms.posLabelPlural} graduent l'an prochain.`
                : `Le staff recrute à ce poste pour la rentrée ${nextYear}.`}
          </div>
        </div>
      )}
      {ms?.kind === "none" && (
        <div className="needbox none">
          <div className="nb-l">
            Pas d&apos;ouverture à ton poste pour l&apos;instant — mais montre ton intérêt :
            les coachs voient qui les suit.
          </div>
          <CiblesBtn cible={cible} onToggle={onToggleCible} small />
        </div>
      )}
    </section>
  );
}

/* ── Déjà engagées ───────────────────────────────────────────────────────── */

function EngageesMobile({ team }: { team: TeamData }) {
  // R2 : consentement — seules les recrues visiblePublic sont NOMMÉES. Aucune photo.
  const commits = (team.commits ?? []).filter((c) => c.visiblePublic);
  if (commits.length === 0) return null;
  const feminin = team.genre === "Féminin";

  return (
    <section id="deja-engagees" className="engaged">
      <div className="p-head">
        <div className="kick">RENTRÉE {team.season + 1}</div>
        <h2>{feminin ? "Elles" : "Ils"} ont déjà dit <em>oui</em></h2>
        <div className="pbar" />
      </div>
      <div className="sList eList">
        {commits.map((c, i) => (
          <div key={i} className="sRow eRow">
            <div className="e-id">
              <div className="sName">{[c.prenom, c.nom].filter(Boolean).join(" ")}</div>
              {c.ecoleProvenance ? <div className="e-school">{c.ecoleProvenance}</div> : null}
            </div>
            <div className="e-meta">
              {c.promo > 0 ? <span className="e-promo">PROMOTION {c.promo}</span> : <span />}
              <StarRating rating={c.etoiles} size="sm" showNumber={false} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS scopé `.tpm` — portage verbatim du mock v3.
   Polices : Outfit (corps), Anton (titres et KPIs), Bebas Neue (labels et
   kickers). Aucun texte d'UI sous 12px, aucun color-mix.
   ═══════════════════════════════════════════════════════════════════════════ */
const TPM_CSS = `
.tpm{background:var(--bg);color:var(--p-ink);font-family:'Outfit',sans-serif;
  min-height:100vh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;
  padding-top:calc(env(safe-area-inset-top) + 8px);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.tpm *{box-sizing:border-box}
.tpm .tabspacer{height:var(--tabzone, env(safe-area-inset-bottom))}
/* ── RETOUR — même pastille glass que la page école ── */
.tpm .backbar{position:sticky;top:0;z-index:30;height:52px;display:flex;align-items:center;
  padding:0 14px;pointer-events:none}
.tpm .backbtn{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;height:36px;
  max-width:76%;padding:0 14px 0 11px;border-radius:18px;cursor:pointer;
  background:rgba(26,29,36,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--line-card);box-shadow:0 6px 18px rgba(0,0,0,.55);
  font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;color:var(--p-ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tpm .backbtn svg{stroke:currentColor;fill:none;flex:0 0 auto}

/* Le bouton retour est STICKY : sans marge, il retombe pile sur le kicker quand
   on s'arrête en tête d'une section (mesuré : 89×18px recouverts sur 5 des 7).
   Le haut de section réserve donc la bande du bouton — 44px (son bas) + 10px de
   respiration = 54px. À garder ALIGNÉ sur .backbar/.backbtn si l'un des deux
   change de gabarit. */
.tpm section{position:relative;padding:54px 18px 32px;border-bottom:1px solid var(--line)}
/* kicker de section — couleur ÉQUIPE, plancher de contraste mesuré. */
.tpm .kick{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.2em;color:var(--red-shell);margin-bottom:7px}
.tpm .h2,.tpm h2{font-family:'Anton',sans-serif;font-size:26px;line-height:1.04;color:var(--p-ink);font-weight:400}
.tpm .h2 em,.tpm h2 em{font-style:normal;color:var(--red-lt)}
.tpm .pbar{width:52px;height:4px;background:var(--red);margin:11px 0 18px}

/* ── TeamHero — full-bleed, .pnl en bas ── */
.tpm .hero{position:relative;min-height:430px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
.tpm .hero-fallback{position:absolute;inset:0;
  background:linear-gradient(160deg,var(--red) 0%,var(--ink) 58%,#0B0C0E 100%)}
.tpm .hero-bg{position:absolute;left:0;top:0;width:100%;height:270px;object-fit:cover;
  object-position:var(--hero-focal);transform:scale(var(--hero-zoom));transform-origin:var(--hero-focal)}
.tpm .hero-ph{position:absolute;left:0;top:0;width:100%;height:270px;
  background:linear-gradient(150deg,#2A2F38,#14171E)}
.tpm .hero-fade{position:absolute;left:0;right:0;top:120px;height:180px;
  background:linear-gradient(180deg,transparent,#0B0C0E)}
.tpm .accent{position:absolute;left:0;right:0;top:266px;height:4px;
  background:linear-gradient(90deg,var(--red) 0 46%,#fff 46% 100%)}
.tpm .logo{position:absolute;left:18px;top:18px;width:52px;height:52px;border-radius:12px;background:var(--cream);
  display:grid;place-items:center;font-family:'Anton',sans-serif;font-size:19px;color:var(--red);z-index:4}
.tpm .logo-img{position:absolute;left:18px;top:18px;width:56px;height:56px;object-fit:contain;z-index:4;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,.55))}
.tpm .soc{position:absolute;right:18px;top:26px;display:flex;gap:14px;z-index:4}
.tpm .soc svg{width:21px;height:21px;opacity:.85}
.tpm .pnl{position:relative;margin-top:270px;padding:22px 18px 26px}
.tpm .eyebrow{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.16em;color:var(--red-lt);margin-bottom:8px}
.tpm .name{font-family:'Anton',sans-serif;font-size:44px;line-height:.92;color:var(--p-ink);text-transform:uppercase}
.tpm .meta{display:flex;gap:7px;margin-top:13px;flex-wrap:wrap}
.tpm .chip{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.11em;padding:4px 11px;border-radius:6px}
.tpm .chip.solid{background:var(--red);color:#fff}
.tpm .chip.out{border:1px solid var(--line-card);color:var(--p-soft)}
.tpm .stats{display:flex;gap:20px;margin-top:20px;flex-wrap:wrap}
.tpm .stat .v{font-family:'Anton',sans-serif;font-size:25px;color:var(--p-ink);line-height:1}
.tpm .stat.pers .v{font-family:'Outfit',sans-serif;font-weight:700;font-size:17px;line-height:1.15}
.tpm .stat .l{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.12em;color:var(--p-mut);margin-top:5px}
.tpm .cibles{margin-top:22px;width:100%;height:50px;border-radius:12px;border:1px solid var(--line-card);
  background:var(--card);color:var(--p-ink);font-family:'Outfit',sans-serif;font-size:15px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}
.tpm .cibles svg{width:17px;height:17px;stroke:currentColor}
.tpm .cibles.on{background:var(--nx-red-deep);border-color:var(--nx-red-deep);color:#fff}
.tpm .cibles.sm{height:44px;font-size:14px;margin-top:14px;width:100%}
.tpm .cibles.sm svg{width:15px;height:15px}

/* ── Calendrier ── */
.tpm .cal-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.tpm .cara-nav{display:flex;gap:6px;padding-bottom:18px}
.tpm .cara-nav button{width:32px;height:32px;border-radius:16px;border:1px solid var(--line-card);
  background:var(--card);color:var(--p-soft);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.tpm .cara-nav button svg{stroke:currentColor;fill:none;stroke-width:2.2}
.tpm .cal-row{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;margin:0 -18px;padding:0 18px;
  scroll-snap-type:x mandatory}
.tpm .cal-row::-webkit-scrollbar{display:none}
.tpm .ev{flex:0 0 auto;width:172px;border-radius:13px;padding:13px;scroll-snap-align:start;
  border:1px solid var(--line-card);position:relative}
.tpm .ev-date{display:flex;align-items:baseline;gap:5px;margin-bottom:9px}
.tpm .ev-date .d{font-family:'Anton',sans-serif;font-size:26px;line-height:1}
.tpm .ev-date .m{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.11em}
.tpm .ev-vs{font-size:14px;font-weight:600;margin-bottom:5px;line-height:1.3}
.tpm .ev-meta{font-size:13px}
.tpm .ev-score{font-family:'Anton',sans-serif;font-size:19px;margin-top:3px}
.tpm .ev-score.w{color:var(--green)}.tpm .ev-score.l{color:var(--nx-red)}
/* DOMICILE = tuile foncée */
.tpm .ev.home{background:var(--ink);border-color:rgba(255,255,255,.12)}
.tpm .ev.home .ev-date .d,.tpm .ev.home .ev-vs{color:#fff}
.tpm .ev.home .ev-date .m,.tpm .ev.home .ev-meta{color:var(--cream)}
/* EXTÉRIEUR = tuile claire */
.tpm .ev.away{background:var(--cream);border-color:rgba(0,0,0,.14)}
.tpm .ev.away .ev-date .d,.tpm .ev.away .ev-vs{color:var(--p-inv)}
.tpm .ev.away .ev-date .m,.tpm .ev.away .ev-meta{color:var(--p-mut-inv)}
/* camp = couleur primaire */
.tpm .ev.camp{background:var(--red);border-color:var(--red)}
.tpm .ev.camp *{color:#fff}
/* Intitulé libre (≤40 car.) sur une tuile de 172px : deux lignes max, ellipse
   au-delà. Bebas est condensé, donc ~2 lignes suffisent aux 40 caractères. */
.tpm .ev-tag{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.12em;margin-bottom:8px;
  line-height:1.22;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.tpm .ev.past{opacity:.55}

/* ── Présentation ── */
.tpm .p-cols{display:grid;grid-template-columns:1fr;gap:34px}
.tpm .lead{font-size:15.5px;line-height:1.6;color:var(--p-soft);margin-bottom:18px}
.tpm .p-stats{display:flex;gap:22px;margin-bottom:20px}
.tpm .p-stats .stat .v{font-size:28px;color:var(--red-lt)}
.tpm .pen-string{height:2px;background:repeating-linear-gradient(90deg,var(--line-card) 0 6px,transparent 6px 11px);margin-bottom:0}
.tpm .pen-row{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;padding-top:0}
.tpm .pen-row::-webkit-scrollbar{display:none}
.tpm .pennant{flex:0 0 auto;width:88px;padding:12px 6px 26px;text-align:center;
  clip-path:polygon(0 0,100% 0,100% 74%,50% 100%,0 74%)}
.tpm .pennant.championnat{background:var(--red)}
.tpm .pennant.coupe{background:var(--ink)}
.tpm .pennant.banniere{background:transparent;border:2px solid var(--cream);clip-path:none;padding-bottom:12px}
.tpm .pen-t{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.09em;color:#fff;line-height:1.25}
.tpm .pennant.banniere .pen-t{color:var(--cream)}
.tpm .pen-y{font-family:'Anton',sans-serif;font-size:16px;color:#fff;margin-top:5px}
.tpm .pennant.banniere .pen-y{color:var(--cream)}
.tpm .coach{display:flex;gap:13px;align-items:flex-start;margin-bottom:16px}
.tpm .cphoto{flex:0 0 auto;width:88px;height:106px;border-radius:10px;background:linear-gradient(160deg,#262B34,#14171E);
  border:1px solid var(--line-card);display:grid;place-items:center;overflow:hidden}
.tpm .cphoto img{width:100%;height:100%;object-fit:cover}
.tpm .cph-tag{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.14em;color:var(--p-mut)}
.tpm .cinfo{flex:1;min-width:0}
.tpm .cname{font-family:'Anton',sans-serif;font-size:19px;color:var(--p-ink);line-height:1.05}
.tpm .crole{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.13em;color:var(--red-lt);margin:5px 0 8px}
.tpm .cbio{font-size:13.5px;line-height:1.5;color:var(--p-mut)}
.tpm .sList{display:flex;flex-direction:column}
.tpm .sRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;
  border-bottom:1px solid var(--line)}
.tpm .sRow:last-child{border-bottom:0}
.tpm .sName{font-size:14.5px;font-weight:600;color:var(--p-ink)}
.tpm .sRole{font-size:13px;color:var(--p-mut);white-space:nowrap}

/* ── BesoinsWidget ── */
.tpm .top{display:flex;flex-direction:column;gap:14px}
.tpm .commit{align-self:flex-start;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.34);
  border-radius:9px;padding:8px 12px;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.1em;
  color:var(--green);cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.tpm .commit svg{stroke:currentColor;fill:none}
.tpm .toggle{display:flex;gap:6px;margin:16px 0 14px;background:var(--card);border:1px solid var(--line-card);
  border-radius:11px;padding:4px}
.tpm .toggle button{flex:1;height:36px;border:0;background:transparent;border-radius:8px;cursor:pointer;
  font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;color:var(--p-mut)}
.tpm .toggle button.on{background:var(--red);color:#fff}

/* LE TERRAIN — géométrie du web VERBATIM : décor incliné, plaques 2D à plat. */
/* 430px, la hauteur du WEB. La scène est dimensionnée en POURCENTAGES du
   conteneur (inset -26%/-20%, imgwrap 76%) tandis que les plaques sont en
   PIXELS fixes : sur 390px de large au lieu de 800, le terrain rétrécit d'un
   facteur ~2 et les plaques de ~1,4, si bien qu'elles occupaient 40 % de plus
   de la surface et se chevauchaient. Rendre au terrain la hauteur du web rend
   aux plaques leur place relative. */
.tpm .stage{position:relative;height:430px;overflow:hidden;z-index:1;
  border:1px solid var(--line-card);border-radius:14px;background:#0B1410}
.tpm .scene{position:absolute;inset:-26% -20% -4% -20%;perspective:840px;overflow:hidden}
.tpm .scene .imgwrap{position:absolute;left:50%;bottom:-14%;width:76%;
  transform:translateX(-50%) rotateX(44deg);transform-origin:50% 100%}
.tpm .scene.flat .imgwrap{left:50%;top:4%;bottom:auto;width:62%;transform:translateX(-50%)}
.tpm .scene .imgwrap img,.tpm .scene .imgwrap svg{width:100%;height:auto;display:block}
.tpm .scene img{filter:saturate(.66) brightness(.92) contrast(1.05)}
.tpm .scene img.baseball{filter:saturate(.92) brightness(1.28) contrast(1.14);
  transform:scale(1.34) translateY(2%);transform-origin:50% 42%}
.tpm .scene .imgwrap .ph{display:block;width:100%;aspect-ratio:16/9;
  background:radial-gradient(130% 100% at 50% 24%, #444d5e, #262d3a 72%)}
.tpm .scene .imgwrap .court{display:block;width:100%;aspect-ratio:16/9}
.tpm .scene .tint{position:absolute;inset:0;
  background:linear-gradient(180deg, rgba(17,19,23,.35), rgba(17,19,23,.08) 45%, rgba(17,19,23,.4))}
/* voiles desktop non portés (le mock n'en a pas) */
.tpm .stage>.fade,.tpm .stage>.glow{display:none}
.tpm .tokens{position:absolute;inset:0}
/* la plaque : 2D, à plat, jamais transformée */
.tpm .tk{position:absolute;transform:translate(-50%,-50%)}
/* Padding 9/14 et rapport acronyme/nom du web : l'acronyme porte la plaque à
   distance, le nom en toutes lettres se lit dessous. Le mobile serrait les deux
   à 15/12 dans 6px de padding — d'où des plaques denses et illisibles. */
.tpm .tk .pl{min-width:66px;padding:9px 14px;border-radius:9px;text-align:center;background:var(--cream);
  border:1px solid rgba(0,0,0,.22);box-shadow:0 8px 18px -6px rgba(0,0,0,.7)}
.tpm .tk .pa{font-family:'Anton',sans-serif;font-size:19px;line-height:1;color:var(--p-inv)}
/* Le nom se REPLIE au lieu de tenir sur une ligne : « LIGNE OFFENSIVE » faisait
   134px de plaque, et les ancrages étant en POURCENTAGES du terrain, deux
   plaques voisines se chevauchaient de 80px sur 354px de large. Replié, il tient
   en 96px. C'est le seul levier qui ne touche pas aux positions, partagées avec
   la page web. */
.tpm .tk .pl{max-width:96px}
.tpm .tk .po{font-family:'Outfit',sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;
  text-transform:uppercase;color:var(--p-mut-inv);margin-top:4px;white-space:normal;line-height:1.15}
.tpm .tk .pn{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.08em;margin-top:4px;display:block;
  color:var(--p-mut-inv)}
/* états de besoin — Complet / Besoin moyen / Besoin élevé / Urgent */
.tpm .tk.full .pl{background:var(--plaque-off);border-color:rgba(255,255,255,.08)}
.tpm .tk.full .pa{color:var(--plaque-off-ink)}
.tpm .tk.full .po,.tpm .tk.full .pn{color:var(--plaque-off-mut)}
.tpm .tk.mid .pn{color:var(--gold-ink)}
.tpm .tk.hi .pl{box-shadow:0 0 0 3px var(--red-lt-55),0 5px 14px rgba(0,0,0,.5)}
.tpm .tk.hi .pn{color:var(--red)}
.tpm .tk.pri .pl{background:var(--red);border-color:var(--ink)}
.tpm .tk.pri .pa{color:#fff}
.tpm .tk.pri .po{color:rgba(255,255,255,.82)}
.tpm .tk.pri .pn{color:#fff}
.tpm .noyear{margin-top:12px;font-size:13px;color:var(--p-mut)}

/* la box UNIQUE (jamais une rangée de cards) */
.tpm .needbox{margin-top:16px;border-radius:13px;padding:16px 18px;border:1px solid var(--line-card);background:var(--card)}
.tpm .needbox.match{background:rgba(34,197,94,.09);border-color:rgba(34,197,94,.36)}
.tpm .needbox.match.nb-pri{background:rgba(200,16,46,.11);border-color:var(--red-tint-bd)}
.tpm .needbox .nb-l{font-size:15px;color:var(--p-ink);line-height:1.45}
.tpm .needbox .nb-l b{color:var(--green)}
.tpm .needbox.nb-pri .nb-l b{color:var(--red-lt)}
.tpm .needbox .nb-s{font-size:13.5px;color:var(--p-mut);margin-top:7px;line-height:1.5}

/* ── Déjà engagées ── */
.tpm .engaged .p-head{margin-bottom:4px}
.tpm .eRow{flex-wrap:wrap;gap:10px}
.tpm .e-id{flex:1;min-width:0}
.tpm .e-school{font-size:13px;color:var(--p-mut);margin-top:3px}
.tpm .e-meta{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px}
.tpm .e-promo{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.11em;color:var(--p-mut)}
`;
