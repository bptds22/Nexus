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
// LE TERRAIN est un PLAN 2D, partagé verbatim avec le web : le tracé remplit le
// cadre et les plaques se posent dessus dans le MÊME repère en pourcentages. La
// bascule rotateX(44deg) a été retirée — elle tassait le terrain sur le dernier
// tiers pendant que les plaques restaient hautes.
// Les coordonnées left/top viennent de SPORT_CONFIGS via
// resolveFacette() — jamais réinventées. Le décor lui-même est rendu par
// <TerrainStageMobile> — composant PROPRE au natif, distinct du <TerrainStage>
// du web. Le web garde sa photo en perspective, qui marche à sa largeur ; le
// mobile a son plan 2D dessiné. Voir l'en-tête de TerrainStageMobile.tsx.
//
// La COUCHE DE CHARGEMENT ci-dessous est inchangée : createClient() côté client
// (clé anon) → RLS appliquée, comme les écrans *Mobile*. La version web (SSR
// service-role) reste dans app/college/[schoolId]/[teamId]/page.tsx.

import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { matchDynamicRoute, SESSION_KEY_PREFIX } from "@/lib/platform/mobileRoutes";
import { createClient } from "@/lib/supabase/client";
import SocialIcons from "@/components/marketing/SocialIcons";
import StarRating from "@/components/ui/StarRating";
import TerrainStageMobile from "./TerrainStageMobile";
import { useSchoolTargets } from "@/lib/queries/schoolPage/useSchoolTargets";
import { accentOnShell, deriveWallTheme } from "@/components/program-wall/theme";
import { loadTeamPage } from "@/lib/queries/teamPage/teamPageData";
import { sportKeyFromNom, defaultNeeds, mergeNeeds, toTeamNeeds, type PositionRow } from "@/lib/queries/teamPage/sportSlots";
import {
  buildTeamData, resolveHeadCoachName,
  type GameRow, type CommitRow, type TeamRow, type SchoolIdentity,
} from "@/lib/queries/teamPage/dbToTeamPage";
import {
  SPORT_CONFIGS, resolveFacette, countNoYear, matchState, parseEventDate, isPast, todayISO, coachPhotoStyle, PITCH, PITCH_LINE, PITCH_INK,
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
  // Les DEUX encres planchérées du mur, dérivées des mêmes trois couleurs
  // d'école. Aucun second plancher n'est introduit : deriveWallTheme applique
  // pickAccentOn/pickNeutralOn, exactement ce que le mur utilise déjà.
  //   · onC1     — ce qui se lit SUR un aplat de primaire (crème si lisible,
  //                sinon l'encre foncée de l'école) → glyphe des pastilles soc.
  //   · c1OnCream — la primaire écrite SUR le crème (repli variante profonde)
  //                → le monogramme sur sa plaque claire.
  const wall = deriveWallTheme(team.teamColor, team.teamColorDark, team.teamColorNeutral);
  const [or_, og, ob] = hexToRgb(wall.onC1);

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
    // Encres planchérées du hero — voir wall ci-dessus. Le filet à 38 % sert de
    // liseré aux pastilles sociales : il est CLAIR quand la primaire est foncée
    // et FONCÉ quand elle est claire, donc la pastille se détache aussi bien sur
    // une photo noire que sur une photo blanche.
    "--on-c1": wall.onC1,
    "--on-c1-38": `rgba(${or_},${og},${ob},0.38)`,
    "--c1-cream": wall.c1OnCream,
    // Surface du terrain dessiné. Volontairement DISTINCTE de --cream : le crème
    // est la couleur claire de l'ÉCOLE (rose #E8C7CD pour 60 collèges, blanc pur
    // pour CNDF), et un terrain rose ou d'un blanc clinique n'est pas un terrain.
    // --pitch est un papier neutre sur lequel la couleur d'école vient TRACER.
    // Une seule valeur, un seul endroit : rien n'est écrit en dur dans le SVG.
    "--pitch": PITCH,
    // Le terrain est NEUTRE : il ne prend plus les couleurs de l'école. Le reste
    // de la page les porte déjà. Voir le bloc palette de content.ts.
    "--pitch-line": PITCH_LINE,
    "--pitch-ink": PITCH_INK,
    // ── L'ÉCHELLE DES BESOINS — vocabulaire PLATEFORME ────────────────────
    // L'école possède le TERRAIN, la plateforme possède l'ÉCHELLE : ces trois
    // valeurs ne suivent JAMAIS la couleur du collège. Démonstration chiffrée
    // en tête de TerrainStageMobile.tsx. Le quatrième niveau (complet) est éteint et
    // réutilise --plaque-off-mut.
    // Les quatre états se distinguent par la COULEUR, jamais par l'effacement :
    // rouge = urgent · ambre = élevé · blanc = moyen · gris = fermé.
    "--lvl-pri": "#E63946",  // urgent  — rouge Nexus, seul état à fond plein
    "--lvl-hi": "#F59E0B",   // élevé   — ambre
    "--lvl-mid": "#E6E9EF",  // moyen   — blanc
    "--lvl-full": "#6B7280", // complet — gris, NET et non translucide
    // Corps commun aux trois états non urgents. Une plaque est un OBJET posé
    // sur le terrain : elle doit avoir un fond opaque, plus clair que l'ardoise
    // (1,47:1) et distinct des lignes du terrain (2,18:1), sinon celles-ci la
    // traversent et elle cesse d'exister.
    "--plaque-corps": "#333A46",
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

      <HeroMobile team={team} />
      <CalendrierMobile team={team} />
      <PresentationMobile team={team} />
      {!(team.hiddenSections ?? []).includes("besoins") && (
        <BesoinsMobile team={team} cible={cible} onToggleCible={toggleCible} />
      )}
      <EngageesMobile team={team} />
      {/* Rien n'est coupé par le tab bar flottant. */}
      <div className="tabspacer" aria-hidden />
      <PiluleCibles cible={cible} onToggle={toggleCible} />
    </main>
  );
}

/* ── TeamHero ────────────────────────────────────────────────────────────── */

function HeroMobile({ team }: { team: TeamData }) {
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
        <div className="soc"><SocialIcons links={team.socials} size={19} /></div>
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
        {/* Le bouton de cible a QUITTÉ le hero : la pilule flottante porte la
            même action et reste visible partout. Deux contrôles pour la même
            chose sur un écran suggèrent deux actions — c'est l'arbitrage déjà
            rendu pour .hf-btn sur la page école. */}
      </div>
    </div>
  );
}

/* ── LA PILULE DE CIBLE ───────────────────────────────────────────────────
   Portalée dans <body>, ancrée sur --barre-zone, état actif vert.

   `createPortal` est structurel : `.tpm` est le conteneur de défilement, un
   `position:fixed` posé dedans s'y ancrerait au lieu du viewport.

   SANS BANDE. L'enveloppe ne porte plus ni aplat, ni backdrop-filter, ni filet :
   la pilule flotte seule et le contenu défile derrière elle, à nu. Elle reste
   lisible par elle-même — son aplat est OPAQUE et son libellé est blanc dessus
   (#E63946 → 4,3:1 ; #22C55E → 2,3:1, inchangé par cette modification).
   Ce qui est perdu, c'est la SÉPARATION : la page équipe fait défiler du crème
   sous la pilule (tuiles « extérieur » du calendrier, plaques du terrain,
   bannières du palmarès), et le halo coloré de la pilule s'y voit mal.
   La page école (ProgramPageMobile) porte le MÊME réglage : l'athlète enchaîne
   les deux écrans, les deux pilules doivent se lire comme un seul composant.

   `pointer-events` : l'enveloppe fait toute la largeur et n'a plus rien de
   visible. Sans `pointer-events-none` elle avalerait les taps sur le contenu
   dans ses gouttières px-3/py-2.5 ; le bouton les rétablit pour lui-même.

   LIBELLÉ — « Ajouter le COLLÈGE à mes cibles », et non « cette équipe » :
   l'action écrit sur athlete_targets(school_id). Cibler depuis une page équipe
   cible le cégep, pas l'équipe. Le libellé doit dire ce que le geste fait. */
function PiluleCibles({ cible, onToggle }: { cible: boolean; onToggle: () => void }) {
  const [monte, setMonte] = React.useState(false);
  React.useEffect(() => { setMonte(true); }, []);
  if (!monte || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed left-0 right-0 z-30 px-3 py-2.5 pointer-events-none"
      style={{ bottom: "var(--barre-zone, calc(env(safe-area-inset-bottom) + 80px))" }}
    >
      <button
        type="button"
        onClick={() => { void tap(); onToggle(); }}
        className={
          "pointer-events-auto w-full flex items-center justify-center gap-2 text-white rounded-2xl px-4 py-3 " +
          "font-head font-bold text-[13px] uppercase tracking-widest " +
          (cible
            ? "bg-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            : "bg-[#E63946] active:bg-[#D42B22] shadow-[0_0_20px_rgba(230,57,70,0.3)]")
        }
      >
        <Heart size={16} fill="currentColor" aria-hidden />
        {cible ? "Collège dans tes cibles" : "Ajouter le collège à mes cibles"}
      </button>
    </div>,
    document.body,
  );
}

/* Le ♥ de la box besoins garde son bouton : le retour haptique est posé ici. */
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
  // `bout` = on a atteint la fin du défilement. Il pilote le retrait du masque
  // de bord : estomper la dernière tuile alors que rien ne suit dirait le
  // contraire de ce que l'effet signifie. Marge de 2px pour absorber les
  // arrondis sous-pixel du défilement tactile.
  const [bout, setBout] = React.useState(false);
  const onScroll = React.useCallback(() => {
    const el = caraRef.current;
    if (el) setBout(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);
  const today = todayISO();
  const firstUpcoming = events.findIndex((e) => !isPast(e, today));

  // Défaut : positionner la rangée sur le 1ᵉʳ événement à venir.
  React.useEffect(() => {
    const el = caraRef.current;
    if (!el || firstUpcoming <= 0) return;
    const card = el.children[firstUpcoming] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: Math.max(0, card.offsetLeft - 8), behavior: "auto" });
  }, [firstUpcoming, team.id]);

  // Cas d'une saison courte : les tuiles tiennent dans le cadre, il n'y a rien
  // à annoncer. Sans cette mesure au montage, le masque estompait la dernière
  // tuile d'un calendrier pourtant entièrement visible.
  React.useEffect(() => { onScroll(); }, [onScroll, team.id]);

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
      <div className={"cal-row" + (bout ? " bout" : "")} ref={caraRef} onScroll={onScroll}>
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

/* ── LES POSITIONS DE PLAQUE — LES 7 SPORTS ────────────────────────────────

   ╔═══════════════════════════════════════════════════════════════════════╗
   ║  LE SENS EST PARTAGÉ. LE PLACEMENT EST UNE CONTRAINTE D'ÉCRAN.        ║
   ╚═══════════════════════════════════════════════════════════════════════╝

   Web et mobile placent les plaques DIFFÉREMMENT, et c'est voulu. Ne pas
   « aligner » : leurs contraintes sont opposées.
     · le WEB dispose de plus de mille pixels de large. Son seuil de
       non-collision tombe autour de 13 %, si bien qu'il peut respecter le
       placement RÉEL des postes — les left/top de SPORT_CONFIGS, tels quels.
     · le MOBILE n'a que 354px. Une plaque y occupe 31,6 % de la largeur : la
       trame 3 × 3 ci-dessous est la seule qui tienne sans chevauchement.
   Imposer la trame au web lui ferait perdre son placement réel sans rien
   donner au mobile. Imposer le placement réel au mobile y ramènerait les
   chevauchements. Les deux ont raison chez eux.

   CE QUI RESTE PARTAGÉ, et qui ne doit JAMAIS diverger : les quatre états, les
   couleurs de l'échelle de plateforme, et les libellés (LEVEL_LABEL). Un
   athlète qui passe du téléphone au navigateur doit lire le même système —
   « urgent » y veut dire la même chose, s'y écrit pareil et s'y colore pareil.
   Seule la GÉOMÉTRIE s'adapte à la place disponible.

   SPORT_CONFIGS reste donc la source du web et n'est pas touchée ; cette table
   ne fait que REMPLACER les left/top au rendu mobile.

   POURQUOI ELLE COUVRE MAINTENANT LES 7 SPORTS. Elle n'existait que pour
   football et flag, et une mesure des 12 sports-facettes a montré que
   basketball (3), volleyball (3) et soccer (1) chevauchaient depuis toujours —
   la perspective en masquait la moitié, le passage à plat les a exposés. Puis
   le plancher typographique de 15,6px a fait grandir la plaque, ce qui
   invalidait aussi les positions de football et flag. Tout est donc re-solvé
   d'un coup, contre les seuils courants.

   RÈGLE DE NON-COLLISION. Deux plaques se touchent si |Δleft| < 31,6 % ET
   |Δtop| < 23,3 % — soit 112px de large sur 354, et 100px de haut sur 430.
   Chaque paire ci-dessous respecte au moins l'une des deux conditions.

   LA TRAME. Trois colonnes (17 / 50 / 83, écart 33 %) et TROIS rangées
   (16 / 50 / 84, écart 34 %). Quatre rangées auraient tenu sur le papier — 24 %
   d'écart passe tout juste les 23,3 % — mais la capture montrait deux plaques
   BORD À BORD, sans un pixel d'intervalle : le seuil dit « ne se recouvrent
   pas », il ne dit pas « respirent ». À 34 %, l'intervalle vaut 46px.
   Les centres restent dans [16,84] × [13,87] : le cadre a `overflow:hidden`,
   une plaque qui déborde est ROGNÉE, pas simplement à cheval.
   Les écarts à la trame (l'avant-champ du baseball, le gardien de soccer) sont
   vérifiés un à un.

   L'ORDRE SÉMANTIQUE PRIME. Plus haut = plus loin dans le terrain : la ligne
   devant, le porteur au fond, les ailiers écartés, le gardien au fond de sa
   zone. */
const PORTRAIT: Record<string, Record<string, Record<string, { left: number; top: number }>>> = {
  football: {
    offense:      { WR: { left: 17, top: 16 }, OL: { left: 50, top: 16 }, QB: { left: 50, top: 50 }, RB: { left: 83, top: 84 } },
    defense:      { S:  { left: 83, top: 16 }, DB: { left: 17, top: 16 }, LB: { left: 50, top: 50 }, DL: { left: 50, top: 84 } },
    specialistes: { RET:{ left: 50, top: 16 }, LS: { left: 17, top: 50 }, K:  { left: 83, top: 50 }, P:  { left: 50, top: 84 } },
  },
  flag: {
    offense: { WR: { left: 17, top: 16 }, C:  { left: 50, top: 16 }, QB: { left: 50, top: 50 }, RB: { left: 83, top: 84 } },
    defense: { DB: { left: 17, top: 16 }, S:  { left: 83, top: 16 }, RU: { left: 50, top: 50 }, LB: { left: 17, top: 84 } },
  },
  // Panier en HAUT : le pivot dessous, le meneur au sommet de la raquette.
  basketball: {
    main: { C: { left: 50, top: 16 }, PF: { left: 17, top: 50 }, SF: { left: 83, top: 50 },
            SG: { left: 17, top: 84 }, PG: { left: 50, top: 84 } },
  },
  // But adverse en haut : trio devant, défense derrière, gardien au fond.
  hockey: {
    main: { AG: { left: 17, top: 16 }, C: { left: 50, top: 16 }, AD: { left: 83, top: 16 },
            DG: { left: 17, top: 50 }, DD: { left: 83, top: 50 }, G: { left: 50, top: 84 } },
  },
  // Quatre lignes dans une colonne de trois rangées : impossible sans écart.
  // Le GARDIEN sort donc de la colonne — ce qu'il fait aussi sur le terrain.
  // top:86 et non 88 : à 88 le bas de la plaque arrivait à 99,6 % et le coin
  // arrondi de la carte (rayon 16px) la rognait. Vu à la capture.
  soccer: {
    main: { ATT: { left: 50, top: 15 }, MIL: { left: 50, top: 42 },
            DEF: { left: 50, top: 69 }, GK: { left: 17, top: 86 } },
  },
  // Filet en haut : la ligne avant sur une rangée, passeur et libéro derrière.
  volleyball: {
    main: { OH: { left: 17, top: 16 }, MB: { left: 50, top: 16 }, OPP: { left: 83, top: 16 },
            L: { left: 17, top: 50 }, P: { left: 83, top: 50 } },
  },
  // Hors trame, vérifié à la main : SS et 2B à 40 % d'écart, ce qui les garde de
  // part et d'autre du deuxième but. LF et RF descendent à 26 pour rester sous
  // la clôture, dont le sommet est à 7.
  baseball: {
    batterie:   { P: { left: 50, top: 50 }, C: { left: 50, top: 84 } },
    avantchamp: { SS: { left: 30, top: 42 }, "2B": { left: 70, top: 42 },
                  "3B": { left: 17, top: 76 }, "1B": { left: 83, top: 76 } },
    champext:   { LF: { left: 17, top: 26 }, CF: { left: 50, top: 16 }, RF: { left: 83, top: 26 } },
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

      {/* Décor à plat (.scene / .imgwrap), plaques posées dessus.
          Le retour au tap d'une plaque passe par une DÉLÉGATION sur ce conteneur
          plutôt que par un handler dans TerrainStageMobile : le composant reste
          purement présentationnel. `.tpm .stage` demeure un sélecteur descendant,
          la classe ajoutée ici ne s'interpose pas.

          `key={facette.key}` : le fondu des plaques au changement de facette est
          une animation CSS, et une animation ne rejoue que sur un nœud NEUF. Le
          décor, lui, ne clignote pas — le tracé ne dépend que du sport, donc le
          SVG remonté est rigoureusement identique. */}
      <div
        className="stagewrap"
        key={facette.key}
        onClick={(e) => { if ((e.target as HTMLElement).closest(".tk")) void tap(); }}
      >
        <TerrainStageMobile
          sportKey={team.sportKey}
          plaques={plaques}
          watermark={team.nickname || team.schoolName}
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
/* ── ÉCHELLE TYPOGRAPHIQUE — hero et calendrier à +25 % ────────────────────
   Seuls les CORPS bougent. Graisses, couleurs, letter-spacing et line-height
   sont laissés tels quels, donc la page garde sa couleur et son rythme.

   Les kickers et les h2 grossissent pour TOUTES les sections, pas seulement le
   calendrier : .kick et .h2/h2 sont les en-têtes communs des cinq sections.
   Ne grossir que le calendrier aurait donné « Le calendrier » à 32,5px suivi de
   « Plus qu'une équipe » et « On cherche du monde » restés à 26 — une page qui
   se dégonfle en descendant. L'échelle est celle des en-têtes, pas d'une section.

   Débordement vérifié à 390px sur les pires chaînes en base : aucun de ces
   blocs n'a de white-space:nowrap, donc tout se replie et rien ne sort. Le
   coût est VERTICAL. Détail dans chaque règle. */
/* kicker de section — couleur ÉQUIPE, plancher de contraste mesuré.
   15px : « RECRUTEMENT · RENTRÉE 2027 », la plus longue, fait ~242px sur 354. */
.tpm .kick{font-family:'Bebas Neue',sans-serif;font-size:15.6px;letter-spacing:.2em;color:var(--red-shell);margin-bottom:7px}
.tpm .h2,.tpm h2{font-family:'Anton',sans-serif;font-size:32.5px;line-height:1.04;color:var(--p-ink);font-weight:400}
.tpm .h2 em,.tpm h2 em{font-style:normal;color:var(--red-lt)}
.tpm .pbar{width:52px;height:4px;background:var(--red);margin:11px 0 18px}

/* ── TeamHero — full-bleed, .pnl en bas ── */
.tpm .hero{position:relative;min-height:430px;overflow:hidden;background:var(--bg);display:flex;flex-direction:column}
.tpm .hero-fallback{position:absolute;inset:0;
  background:linear-gradient(160deg,var(--red) 0%,var(--ink) 58%,#0B0C0E 100%)}
/* La photo monte à 380px et le bloc d'info se pose DESSUS par le bas — plus de
   bandeau opaque séparé. Le dégradé remonte de la base de la photo vers le
   contenu, exactement le principe de .hero-fade du mur : le texte devient
   lisible par le fondu, pas par un aplat posé dessous. */
.tpm .hero-bg{position:absolute;left:0;top:0;width:100%;height:380px;object-fit:cover;
  object-position:var(--hero-focal);transform:scale(var(--hero-zoom));transform-origin:var(--hero-focal)}
.tpm .hero-ph{position:absolute;left:0;top:0;width:100%;height:380px;
  background:linear-gradient(150deg,#2A2F38,#14171E)}
/* FONDU PORTÉ DU WEB (.tp .hero-fade, breakpoint ≤980px). Trois écarts avec la
   version mobile d'origine, tous corrigés ici :
     · le web couvre TOUT le hero (inset:0) ; le mobile n'en fondait qu'une
       bande de 250px à partir de 140 — au-dessus, la photo restait crue et
       tranchait net sur le fond de page ;
     · le web tient un aplat à 95 % en bas, pas un opaque total : le bas de
       photo reste perceptible sous le texte au lieu d'être coupé ;
     · le web ajoute un SECOND dégradé, horizontal, qui assombrit le bord
       gauche à 35 % — c'est lui qui pose le logo et le kicker sur une base
       lisible quelle que soit la photo.
   Les arrêts sont repris tels quels : 0/34/68 % en vertical, 0→60 % en
   horizontal. */
.tpm .hero-fade{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(0deg, rgba(17,19,23,.95) 0%, rgba(17,19,23,.55) 34%, transparent 68%),
             linear-gradient(90deg, rgba(17,19,23,.35), transparent 60%)}
/* Le filet d'accent finit le hero au lieu de marquer une frontière photo/panneau
   qui n'existe plus. */
.tpm .accent{position:absolute;left:0;right:0;top:auto;bottom:0;height:4px;
  background:linear-gradient(90deg,var(--red) 0 46%,#fff 46% 100%)}
/* ── LOGO ET ICÔNES SOCIALES — PLAQUES OPAQUES ─────────────────────────────
   Le hero pose ces éléments sur une PHOTO ARBITRAIRE, déposée par le coach. Ni
   l'ombre portée du logo ni l'opacité .85 des icônes ne tiennent cette promesse :
   une ombre ne sépare que d'un fond clair, et une icône nue à 85 % disparaît
   dans n'importe quel aplat de sa propre valeur. Les icônes n'avaient d'ailleurs
   NI fond NI ombre — c'était le vrai trou.
   La seule solution qui tienne sur photo blanche COMME sur photo noire est une
   plaque OPAQUE : ce qui est écrit dessus ne dépend plus du tout de la photo.
   Restait à choisir l'encre — c'est le plancher du mur qui la donne, sans qu'un
   second plancher soit introduit ici. */
/* Le logo et son repli monogramme partagent la MÊME plaque : même gabarit, même
   rayon, même liseré. La plaque est crème (l'écusson d'école est dessiné pour
   du clair), et c'est ce crème qui la détache d'une photo noire — 13,5:1 pour
   le crème rouge #E8C7CD des 60 écoles, 21:1 pour le blanc de CNDF.
   Sur une photo BLANCHE le crème ne peut rien : 1,56:1 pour #E8C7CD, et
   exactement 1,00:1 pour CNDF, dont la couleur claire est littéralement
   #ffffff — la plaque y est invisible. C'est donc le RELIEF qui doit porter, et
   pas une ombre douce seule : liseré interne à 28 %, ombre de CONTACT courte
   (2/6px) qui dessine l'arête, puis ombre portée large. */
.tpm .logo,
.tpm .logo-img{position:absolute;left:18px;top:18px;width:56px;height:56px;border-radius:13px;z-index:4;
  background:var(--cream);
  box-shadow:0 2px 6px rgba(0,0,0,.38),0 8px 20px rgba(0,0,0,.5),inset 0 0 0 1px rgba(0,0,0,.28)}
/* --c1-cream et non --red : la primaire n'est gardée que si elle se lit sur le
   crème, sinon c'est sa variante profonde. Une école à primaire pâle avait un
   monogramme quasi invisible sur sa propre plaque. */
.tpm .logo{display:grid;place-items:center;font-family:'Anton',sans-serif;font-size:19px;color:var(--c1-cream)}
.tpm .logo-img{object-fit:contain;padding:7px}
.tpm .soc{position:absolute;right:18px;top:26px;display:flex;gap:9px;z-index:4}
/* La pastille : halo OPAQUE en couleur d'équipe, glyphe à --on-c1. Le glyphe est
   donc l'encre foncée de l'école sur une primaire claire (le « icône sombre »
   attendu) et bascule sur le crème sur une primaire foncée, où une icône sombre
   serait illisible. Une seule règle couvre les deux cas.
   Mesuré sur les DEUX jeux de couleurs en production, qui sont justement les
   deux extrêmes :
     · #A6192E (60 écoles, primaire foncée) → glyphe crème, 4,82:1 sur le halo ;
       halo 7,50:1 sur photo blanche, 2,80:1 sur photo noire.
     · #d0a62d (CNDF, primaire claire)      → glyphe #10131A, 8,12:1 sur le halo ;
       halo 9,17:1 sur photo noire, 2,29:1 sur photo blanche.
   Là où le halo faiblit, le liseré à 38 % est de la valeur OPPOSÉE — crème sur
   la primaire foncée (le cas photo noire), encre sur la primaire claire (le cas
   photo blanche). Les deux extrêmes sont donc couverts par construction, pas
   par chance.
   Spécificité (0,2,1) : elle passe DEVANT le .nx-social-icon:hover de
   globals.css (0,2,0). Volontaire — au doigt le hover reste collé après le tap, et la
   couleur de marque qu'il applique (rose IG, bleu FB…) n'a aucun contraste
   garanti sur le halo. */
.tpm .soc .nx-social-icon{position:relative;width:36px;height:36px;border-radius:18px;
  display:grid;place-items:center;background:var(--red);color:var(--on-c1);
  box-shadow:0 4px 12px rgba(0,0,0,.5),inset 0 0 0 1px var(--on-c1-38)}
/* 36px à l'œil, 44px au doigt — le plancher des HIG, atteint par un
   pseudo-élément comme la pastille de retour de la page école. */
.tpm .soc .nx-social-icon::after{content:"";position:absolute;inset:-4px;border-radius:50%}
.tpm .soc svg{width:19px;height:19px;opacity:1}
/* 250 et non 380 : le panneau chevauche les 130 derniers pixels de la photo. */
.tpm .pnl{position:relative;z-index:3;margin-top:250px;padding:22px 18px 30px}
/* 15px : nickname + nom d'école font au pire ~52 caractères (« Centre d'études
   collégiales de la Matapédie »), soit ~452px — le bloc se replie sur deux
   lignes, comme il le faisait déjà à 12px (364px pour 354 disponibles). */
.tpm .eyebrow{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:.16em;color:var(--red-lt);margin-bottom:8px}
/* 55px : le nom le plus long en base est « Séminaire de Sherbrooke ». Anton se
   replie aux espaces et le mot le plus long, « SHERBROOKE », fait ~260px sur
   354. Aucun nom d'équipe ne forme un mot indivisible plus large. */
.tpm .name{font-family:'Anton',sans-serif;font-size:55px;line-height:.92;color:var(--p-ink);text-transform:uppercase}
.tpm .meta{display:flex;gap:7px;margin-top:13px;flex-wrap:wrap}
/* Padding proportionnel : 4/11 → 5/14. .meta est en flex-wrap, les deux chips
   passent à la ligne plutôt que de déborder. */
.tpm .chip{font-family:'Bebas Neue',sans-serif;font-size:16.25px;letter-spacing:.11em;padding:5px 14px;border-radius:6px}
.tpm .chip.solid{background:var(--red);color:#fff}
.tpm .chip.out{border:1px solid var(--line-card);color:var(--p-soft)}
.tpm .stats{display:flex;gap:20px;margin-top:20px;flex-wrap:wrap}
.tpm .stat .v{font-family:'Anton',sans-serif;font-size:25px;color:var(--p-ink);line-height:1}
/* Le nom du coach à +30 % (17 → 22). Le plus long en base, « Bruno-Philippe
   Desfosses Simard », se replie aux espaces ET au trait d'union : le plus large
   segment indivisible fait ~175px sur 354. */
.tpm .stat.pers .v{font-family:'Outfit',sans-serif;font-weight:700;font-size:22px;line-height:1.15}
.tpm .stat .l{font-family:'Bebas Neue',sans-serif;font-size:15.6px;letter-spacing:.12em;color:var(--p-mut);margin-top:5px}
/* ENTRAÎNEUR-CHEF à +25 % (12 → 15), et LUI SEUL. .stat .l est partagé avec
   les libellés de fiche (Record, Résultat) et ceux de la présentation
   (Championnats, Staff en place), qui ne sont pas au ticket — la règle est donc
   portée par .pers, qui n'existe que sur la vignette du coach. */
.tpm .stat.pers .l{font-size:15.6px}
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
/* DÉGRADÉ DE BORD DROIT — les tuiles s'estompent vers la sortie du cadre, ce
   qui dit qu'il y en a d'autres. Porté du web.
   Un mask-image sur le conteneur de défilement plutôt qu'un voile posé
   par-dessus : le voile aurait dû être opaque, donc teinté du fond, et il
   aurait tranché sur les tuiles claires « extérieur ». Le masque fond la tuile
   elle-même, quelle que soit sa couleur.
   56px de fondu sur une tuile de 172 : les deux tiers de la tuile partiellement
   visible restent pleinement lisibles.
   La classe .bout retire le masque quand on a atteint la fin — sinon la
   DERNIÈRE tuile resterait estompée alors qu'il n'y a plus rien après, ce qui
   dirait exactement le contraire de ce que l'effet doit dire. */
.tpm .cal-row{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;margin:0 -18px;padding:0 18px;
  scroll-snap-type:x mandatory;
  -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 56px),transparent 100%);
  mask-image:linear-gradient(90deg,#000 calc(100% - 56px),transparent 100%)}
.tpm .cal-row.bout{-webkit-mask-image:none;mask-image:none}
@media(prefers-reduced-motion:reduce){.tpm .cal-row{transition:none}}
.tpm .cal-row::-webkit-scrollbar{display:none}
.tpm .ev{flex:0 0 auto;width:172px;border-radius:13px;padding:13px;scroll-snap-align:start;
  border:1px solid var(--line-card);position:relative}
.tpm .ev-date{display:flex;align-items:baseline;gap:5px;margin-bottom:9px}
/* Date à +25 %, jour et mois ensemble : ~71px dans les 146px utiles d'une tuile
   de 172. .ev-vs (l'adversaire) et .ev-score ne sont pas au ticket et restent. */
.tpm .ev-date .d{font-family:'Anton',sans-serif;font-size:32.5px;line-height:1}
.tpm .ev-date .m{font-family:'Bebas Neue',sans-serif;font-size:16.25px;letter-spacing:.11em}
/* L'adversaire à +25 % lui aussi : sous une date à 32,5px, 14px décrochait.
   overflow-wrap:anywhere répare un débordement PRÉEXISTANT que ce grossissement
   aggravait. Les noms scrapés du RSEQ contiennent des suites d'acronymes séparées
   par des virgules — « CDL,MONT,PTM,PSG,CGC,ABE », 24 caractères — et la virgule
   n'est pas un point de coupe en CSS. Ce bloc faisait déjà ~185px dans les 146px
   utiles d'une tuile, débordant sur la voisine ; il en ferait ~230 à 17,5px.
   Même remède que .ev-tag, qui porte déjà cette propriété pour la même raison.
   Les vrais mots longs (« Drummondville », « Internationale ») tiennent sans
   coupe : ~134px au pire. */
.tpm .ev-vs{font-size:17.5px;font-weight:600;margin-bottom:5px;line-height:1.3;overflow-wrap:anywhere}
/* Détails (heure · lieu) à +20 %. « 19:00 · Stade Telus » frôle les 146px utiles
   et se replie sur deux lignes ; les tuiles étant en flex, elles s'égalisent en
   hauteur, la rangée grandit sans qu'aucune tuile ne déborde. */
.tpm .ev-meta{font-size:15.6px}
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
/* Les stats et les fanions flottaient loin l'un de l'autre : ils décrivent le
   même palmarès, ils se suivent maintenant. */
.tpm .p-stats{display:flex;gap:22px;margin-bottom:12px}
.tpm .p-stats .stat .v{font-size:28px;color:var(--red-lt)}
.tpm .pen-string{height:2px;background:repeating-linear-gradient(90deg,var(--line-card) 0 6px,transparent 6px 11px);margin:0 0 10px}
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
.tpm .coach{display:flex;gap:15px;align-items:flex-start;margin-bottom:14px}
/* 132×168 et non 88×106 : à la taille d'une vignette, le point focal stocké
   (headcoach_focal_x/y, headcoach_zoom) ne servait à rien — il n'y avait pas
   assez de surface pour que le cadrage se voie. */
.tpm .cphoto{flex:0 0 auto;width:132px;height:168px;border-radius:12px;background:linear-gradient(160deg,#262B34,#14171E);
  border:1px solid var(--line-card);display:grid;place-items:center;overflow:hidden}
.tpm .cphoto img{width:100%;height:100%;object-fit:cover}
.tpm .cph-tag{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.14em;color:var(--p-mut)}
.tpm .cinfo{flex:1;min-width:0}
.tpm .cname{font-family:'Anton',sans-serif;font-size:19px;color:var(--p-ink);line-height:1.05}
.tpm .crole{font-family:'Bebas Neue',sans-serif;font-size:15.6px;letter-spacing:.13em;color:var(--red-lt);margin:5px 0 8px}
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
/* 430px de haut, 354 de large. Ce rapport ne bouge PAS avec le passage à plat :
   les seuils de non-collision mesurés (96/354 = 27,1 % et 90/430 = 20,9 %) n'ont
   de sens que si les deux dimensions restent fixes. Détail en tête de
   TerrainStageMobile. */
/* ── LE TERRAIN — SURFACE CRÈME, TRACÉ AUX COULEURS DE L'ÉCOLE ─────────────
   La photo a disparu du MOBILE (voir TerrainStageMobile) : plus de filtre de
   luminance, plus de
   recadrage baseball, plus de voile .tint qui n'existait que pour rendre une
   photo lisible sous des plaques claires.

   ⚠ LE CADRE REVIENT, et il annule le bord-à-bord du lot précédent. Une surface
   crème posée à nu et pleine largeur sur un fond #111317 devient une bande
   éclatante qui coupe la page en deux ; le crème a besoin d'un bord pour se lire
   comme un objet. Retour donc à la largeur du bloc de texte, rayon 16px et ombre
   douce, comme le demande le ticket.
   Conséquence sur les plaques : le seuil horizontal de non-collision se resserre
   de 24,6 % (390px) à 27,1 % (354px). Revérifié — les 30 paires des 5 facettes
   de football et flag passent encore, marge du pire cas ×1,11 (DB↔LB en
   défense). Zéro chevauchement, aucune plaque rognée. */
/* Filet de bord INDISPENSABLE : l'ardoise du terrain (#1A1D24) ne fait que
   1,10:1 contre le fond de page (#111317). Sans lui, la carte n'a pas de
   contour — elle ne se lit plus comme un objet posé mais comme une tache. */
.tpm .stage{position:relative;height:430px;overflow:hidden;z-index:1;
  background:var(--pitch);border-radius:16px;border:1px solid var(--line-card);
  box-shadow:0 10px 30px -12px rgba(0,0,0,.7)}
/* PLAN 2D. La perspective (perspective:840px + rotateX(44deg) sur .imgwrap)
   a été retirée : elle tassait le tracé sur le dernier tiers du cadre alors que
   les plaques, non transformées, restaient réparties sur toute la hauteur — des
   plaques flottant au-dessus d'un terrain écrasé. La scène couvre maintenant
   exactement le .stage et le SVG la remplit, si bien que le viewBox en
   centièmes partage le repère des plaques. */
.tpm .scene{position:absolute;inset:0;overflow:hidden}
.tpm .scene .imgwrap{position:absolute;inset:0}
.tpm .scene .imgwrap svg,.tpm .scene .imgwrap .court{display:block;width:100%;height:100%}
/* vector-effect posé en CSS et non sur le <g> : Chrome ne l'hérite PAS d'un
   groupe, si bien que l'étirement du viewBox (100×100 → 354×430) multipliait
   l'épaisseur des traits HORIZONTAUX par 4,3 et celle des VERTICAUX par 3,54 —
   des lignes de but quatre fois plus grasses que les lignes de touche. Mesuré à
   la capture. En CSS, la règle atteint chaque forme. */
.tpm .scene .court *{vector-effect:non-scaling-stroke}
.tpm .tokens{position:absolute;inset:0}
/* Fondu au changement de facette — même courbe que le sheet de la recherche.
   Seules les PLAQUES fondent : d'une facette à l'autre le décor est identique
   (même sport, même tracé), le faire clignoter serait du bruit pur. Rejoué par
   le key sur .stagewrap. */
.tpm .stagewrap .tokens{animation:tpm-fondu .18s cubic-bezier(.32,.72,0,1)}
@keyframes tpm-fondu{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.tpm .stagewrap .tokens{animation:none}}
/* ── PLANCHER TYPOGRAPHIQUE : 15,6px ───────────────────────────────────────
   Référence = le sous-titre d'une tuile de calendrier (.ev-meta, « heure · lieu »).
   Tout ce qui passait dessous y remonte : libellés de plaque (.po, .pn),
   légende, libellés de stat du hero ET de la présentation, rôle de
   l'entraîneur, kickers de section. Ce qui était déjà au-dessus ne bouge pas —
   acronymes de plaque (19px), valeurs de stat, noms.
   CONSÉQUENCE MESURÉE : la plaque grandit. Sa largeur maximale passe de 96 à
   112px (« OFFENSIVE » fait 87px à 15,6px et ne tenait plus dans 96 moins le
   padding), sa hauteur d'environ 90 à 100px. Les seuils de non-collision
   suivent — 112/354 = 31,6 % et 100/430 = 23,3 % — et c'est ce qui a rendu
   nécessaire la refonte complète de la table PORTRAIT ci-dessus. */
/* la plaque : 2D, à plat, jamais transformée */
.tpm .tk{position:absolute;transform:translate(-50%,-50%)}
/* Padding 9/14 et rapport acronyme/nom du web : l'acronyme porte la plaque à
   distance, le nom en toutes lettres se lit dessous.
   Le nom se REPLIE au lieu de tenir sur une ligne : « LIGNE OFFENSIVE » faisait
   134px de plaque, et les ancrages étant en POURCENTAGES du terrain, deux
   plaques voisines se chevauchaient de 80px sur 354px de large. Replié, il tient
   en 96px — c'est le seul levier qui ne touche pas aux positions. */
/* ENCRE INVERSÉE. La plaque repose sur l'ardoise, plus sur du papier pâle :
   l'acronyme en --p-inv (#15171B) tombait à 1,06:1, strictement invisible.
   Toute la rampe de texte passe donc du côté clair. */
.tpm .tk .pl{min-width:66px;max-width:112px;padding:9px 10px;border-radius:9px;text-align:center;
  background:var(--plaque-corps);border:1.5px solid var(--lvl-mid);box-shadow:0 8px 18px -6px rgba(0,0,0,.6)}
.tpm .tk .pa{font-family:'Anton',sans-serif;font-size:19px;line-height:1;color:var(--p-ink)}
.tpm .tk .po{font-family:'Outfit',sans-serif;font-weight:700;font-size:15.6px;letter-spacing:.04em;
  text-transform:uppercase;color:var(--p-soft);margin-top:4px;white-space:normal;line-height:1.15}
.tpm .tk .pn{font-family:'Bebas Neue',sans-serif;font-size:15.6px;letter-spacing:.08em;margin-top:4px;display:block;
  color:var(--p-mut)}

/* ── LES QUATRE ÉTATS — ÉCHELLE DE PLATEFORME ───────────────────────────────
   L'ÉCOLE POSSÈDE LE TERRAIN. LA PLATEFORME POSSÈDE L'ÉCHELLE.
   Le terrain au-dessus (papier, tracé, verges, filigrane) est aux couleurs du
   collège. Ces quatre plaques et la légende ne le sont PAS, et ne doivent
   jamais le devenir : elles servent à comparer deux collèges, et une unité de
   comparaison ne change pas d'un collège à l'autre.
   Mesuré avant d'être tranché : teintée par l'école, l'échelle perdait toujours
   une distinction — aplat urgent à 2,03:1 sur le papier pour une primaire
   claire, bordures élevé/moyen à 1,85:1 pour une primaire foncée. Les deux
   défauts sont anti-corrélés, aucune couleur ne les évite tous les deux.
   Démonstration complète en tête de TerrainStageMobile.tsx.
   Lecture sous deutéranopie, vérifiée : ÉLEVÉ et MOYEN restent séparés à
   4,41:1 par leurs anneaux (c'est le meilleur couple testé — assombrir l'ambre
   le rapprochait du gris ardoise). URGENT, lui, ne tient PAS par son aplat
   (1,68:1 sur le papier une fois la teinte retirée) : il tient par l'inversion
   d'encre, seul état à porter du texte CLAIR sur un bloc plein. C'est cette
   inversion qui est l'identité d'« urgent », pas le rouge.
   L'anneau ambre ne fait que 1,91:1 sur le crème : il est doublé d'un halo, le
   même dispositif que portait l'échelle web d'origine. Le rgba est écrit en
   clair — c'est la même constante que --lvl-hi, pas une couleur d'école.
   ⛔ Ne jamais écrire --red, --c1-cream ou --ink dans ce bloc. */
.tpm .tk.pri .pl{background:var(--lvl-pri);border-color:var(--lvl-pri);
  box-shadow:0 10px 22px -6px rgba(0,0,0,.6)}
.tpm .tk.pri .pa,.tpm .tk.pri .pn{color:#fff}
.tpm .tk.pri .po{color:rgba(255,255,255,.85)}
.tpm .tk.hi .pl{border-color:var(--lvl-hi);border-width:2px;
  box-shadow:0 0 12px -3px rgba(245,158,11,.45),0 8px 18px -6px rgba(0,0,0,.6)}
.tpm .tk.hi .pn{color:var(--lvl-hi)}
.tpm .tk.mid .pl{border-color:var(--lvl-mid)}
.tpm .tk.mid .pn{color:var(--lvl-mid)}
/* COMPLET — VISIBLE et NEUTRE, pas invisible.
   Il était à fond transparent, bordure et texte en blanc à basse opacité : les
   lignes du terrain le traversaient et sa bordure composite (#4c4f54) ne se
   séparait de celle de « besoin moyen » (#5C6575) que par 1,40:1 — les deux
   états se ressemblaient. Ce qui le distingue n'est pas l'effacement mais
   l'ABSENCE DE COULEUR : il garde le corps commun et prend le gris là où les
   autres prennent rouge, ambre ou blanc. Bordure nette, jamais translucide.
   Mesuré : bordure 3,02:1 sur le corps, et 3,98:1 contre celle de « moyen ». */
.tpm .tk.full .pl{border-color:var(--lvl-full)}
.tpm .tk.full .pa{color:var(--p-soft)}
.tpm .tk.full .po{color:#9AA2AE}
.tpm .tk.full .pn{color:#A8AEB9}

/* ── LA LÉGENDE ────────────────────────────────────────────────────────────
   Sous le terrain, hors de la carte crème : elle explique l'échelle, elle n'est
   pas du terrain. Chaque pastille reprend EXACTEMENT le traitement de la plaque
   correspondante, sinon la légende ment. */
.tpm .tlegend{display:flex;flex-wrap:wrap;gap:8px 16px;margin:14px 0 0;padding:0;list-style:none}
.tpm .tlegend li{display:inline-flex;align-items:center;gap:7px;
  font-family:'Bebas Neue',sans-serif;font-size:15.6px;letter-spacing:.08em;color:var(--p-mut)}
.tpm .tlegend .lg-dot{width:13px;height:13px;border-radius:4px;flex:0 0 auto;
  background:var(--plaque-corps);border:1.5px solid var(--lvl-mid)}
.tpm .tlegend li.pri .lg-dot{background:var(--lvl-pri);border-color:var(--lvl-pri)}
.tpm .tlegend li.hi .lg-dot{border-color:var(--lvl-hi);border-width:2px}
.tpm .tlegend li.full .lg-dot{border-color:var(--lvl-full)}
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
