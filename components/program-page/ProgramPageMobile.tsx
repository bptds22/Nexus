"use client";

// components/program-page/ProgramPageMobile.tsx
//
// Rendu NATIF (bundle Capacitor) de la page école /college/[schoolId].
//
// LOT B — ce fichier ne rend PLUS <ProgramPage> (le layout WEB DESKTOP dans une
// WebView de 390px). Il rend le layout MOBILE de
// docs/reference/page-ecole-mobile-v3.html :
//   • LE MUR en tête (ProgramWallMobile, grille portrait 5×8, CSS/SVG),
//   • liseré rouge 3px,
//   • puis directement le contenu. AUCUNE menubar d'ancres, AUCUN ticker :
//     la nav par ancres est la cause du scroll bloqué en WebView.
// Ordre des sections = celui du web, sans exception :
//   #apercu → #sports → #campus → #apropos → #académique → #parcours → #news
//   → bande CTA.
//
// La COUCHE DE CHARGEMENT ci-dessous est inchangée (RLS déjà vérifiée sous JWT
// athlète) : createClient() côté client (clé anon) → RLS appliquée, comme les
// écrans *Mobile*. La version web (SSR service-role) reste dans
// app/college/[schoolId]/page.tsx et n'est pas touchée.
//
// RLS : toutes les tables lues ici sont en lecture publique/authentifiée pour un
// athlète (diag : schools/school_page_content/school_campus_cards/school_programs/
// school_news = read true ; teams CEGEP readable ; count_* = SECURITY DEFINER).
// La page école ne dépend d'AUCUNE table restreinte → rien à vider.

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, MapPin, Play, Plus } from "lucide-react";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { matchDynamicRoute, SESSION_KEY_PREFIX } from "@/lib/platform/mobileRoutes";
import { openExternal } from "@/components/shared/settings";
import { createClient } from "@/lib/supabase/client";
import { loadSchoolPage } from "@/lib/queries/schoolPage/schoolPageData";
import { useSchoolTargets } from "@/lib/queries/schoolPage/useSchoolTargets";
import { deriveWallTheme } from "@/components/program-wall/theme";
import ProgramWallMobile, { WALL_CSS } from "./ProgramWallMobile";
import { matchPrograms, norm } from "./matchPrograms";
// Décision YouTube partagée avec VideoEmbed, pas rejouée : sous capacitor://
// l'iframe YouTube est refusée (origin non reconnue → « lecture intégrée
// désactivée »). Sur device on n'iframe donc PAS — vignette cliquable qui ouvre
// le navigateur in-app (SFSafariViewController = vrai contexte https).
import { getYouTubeId, openVideoExternal } from "@/components/ui/VideoEmbed";
import dynamic from "next/dynamic";
// Leaflet touche `window` à l'import → jamais au SSR (même garde que la recherche).
const MapPane = dynamic(() => import("@/components/cegep-search/MapPane"), { ssr: false });
import {
  dbToProgramPage, degradedProgramPage,
  type SchoolRow, type TeamRowForGrid,
} from "@/lib/queries/schoolPage/dbToProgramPage";
import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import { languageLabel, type ProgramPageContent, type Sport, type SportTeam } from "./content";

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
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,500;1,700&family=Outfit:wght@400;500;600;700;800&display=swap"
    />
  </>
);

type Loaded =
  | { state: "loading" }
  | { state: "error" }
  | { state: "notfound" }
  | { state: "ready"; school: SchoolProgramIdentity; content: ProgramPageContent };

function CenteredMobile({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ background: "#111317", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
      {children}
    </main>
  );
}

export default function ProgramPageMobile() {
  // useDynamicParam : sur mobile, useParams vaut "placeholder" (shell pré-généré)
  // → relit le vrai schoolId depuis sessionStorage (stashé par app/page.tsx lors
  // de la redirection errorPath). Sur web, renvoie directement le vrai id.
  const schoolId = useDynamicParam("schoolId");
  const isPlaceholder = !schoolId || schoolId === "placeholder";
  const [st, setSt] = React.useState<Loaded>({ state: "loading" });

  React.useEffect(() => {
    // Sentinelle static-export : la page pré-rendue porte schoolId="placeholder".
    // On ne charge rien tant que le vrai id n'est pas dans l'URL (runtime).
    if (isPlaceholder) return;
    let cancelled = false;
    setSt({ state: "loading" });
    (async () => {
      try {
        const supabase = createClient();
        const { data: rows } = await supabase
          .from("schools").select("id, name, city, region, langue, reseau, lat, lng, geo_source").eq("id", schoolId!).limit(1);
        const school = (rows ?? [])[0] as SchoolRow | undefined;
        if (!school) { if (!cancelled) setSt({ state: "notfound" }); return; }

        const { content, cards, programs, news } = await loadSchoolPage(supabase, school.id);
        const [{ data: rc }, { data: fc }, { data: teamRows }] = await Promise.all([
          supabase.rpc("count_recruited_by_school", { p_school_id: school.id } as unknown as undefined),
          supabase.rpc("count_followers_by_school", { p_school_id: school.id } as unknown as undefined),
          supabase.from("teams").select("id, division, gender, sports:sport_id(nom)").eq("school_id", school.id),
        ]);
        const teams: TeamRowForGrid[] = ((teamRows ?? []) as unknown as {
          id: string; division: string | null; gender: string | null; sports: { nom: string } | null;
        }[]).map((t) => ({ id: t.id, sport: t.sports?.nom ?? "", division: t.division, gender: t.gender }));

        const assetUrl = (path: string | null | undefined, bucket: "school-logos" | "campus-photos") =>
          path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

        if (!content) {
          const deg = degradedProgramPage(school, teams);
          if (!cancelled) setSt({ state: "ready", school: deg.school, content: deg.content });
          return;
        }
        const { school: identity, content: pageContent } = dbToProgramPage(
          school, content, cards, programs, news,
          (rc as number | null) ?? 0, (fc as number | null) ?? 0, assetUrl, teams,
        );
        if (!cancelled) setSt({ state: "ready", school: identity, content: pageContent });
      } catch {
        if (!cancelled) setSt({ state: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [schoolId, isPlaceholder]);

  // ÉTATS DE CHARGEMENT (nouveaux vs SSR) — jamais d'écran blanc ni de page
  // à moitié peuplée : squelette pendant le fetch, erreur lisible sinon.
  if (isPlaceholder || st.state === "loading") {
    return (
      <CenteredMobile>
        <div style={{ width: 30, height: 30, border: "3px solid #E63946", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </CenteredMobile>
    );
  }
  if (st.state === "notfound") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Collège introuvable.</p></CenteredMobile>;
  }
  if (st.state === "error") {
    return <CenteredMobile><p style={{ color: "#9CA3AF", fontFamily: "Outfit, sans-serif", fontSize: 15 }}>Impossible de charger la page. Vérifie ta connexion, puis réessaie.</p></CenteredMobile>;
  }
  return (
    <>
      {FONTS}
      <ProgramBodyMobile school={st.school} content={st.content} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE RENDU MOBILE
   ═══════════════════════════════════════════════════════════════════════════ */

/** hex → composantes, pour composer des rgba() en JS (aucun color-mix). Jumeau
 *  de celui de TeamPage.tsx, module-local là-bas comme ici. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Les cinq écrans de la page école. */
type TabKey = "apercu" | "campus" | "etudes" | "parcours" | "news";
/** Onglet à restaurer au retour d'une page équipe. Posé par « L'affiche ». */
const TAB_RETOUR_KEY = "__nx_school_tab";

const DIV_ORDER = ["D1", "D2", "D3"];

/* Helpers COPIÉS de SportsGrid.tsx (module-local là-bas, non exportés). Le
   ticket interdit de toucher au composant web ; on duplique donc ces 2 pures
   fonctions plutôt que d'y ajouter un `export` — même convention que
   RechercheMobile vis-à-vis de CegepSearch. Toute correction ici doit être
   reportée là-bas, et réciproquement. */
function divisionsOf(equipes: SportTeam[]): string[] {
  const set = new Set(equipes.map((t) => t.division).filter(Boolean) as string[]);
  return [...set].sort((a, b) => {
    const ia = DIV_ORDER.indexOf(a), ib = DIV_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}
function genreAgg(equipes: SportTeam[]): string {
  let hasM = false, hasF = false, mixteOnly = true;
  for (const t of equipes) {
    if (t.genre === "Mixte") continue;
    mixteOnly = false;
    if (t.genre === "M" || t.genre === "M&F") hasM = true;
    if (t.genre === "F" || t.genre === "M&F") hasF = true;
  }
  if (mixteOnly) return "Mixte";
  if (hasM && hasF) return "M & F";
  if (hasM) return "Masculin";
  if (hasF) return "Féminin";
  return "Mixte";
}

/** Meilleure division affichée sur le mur. `identity.division` est la valeur
 *  AUTO du contrat mur (« AUTO from teams table ») ; dbToProgramPage ne la
 *  remplit pas encore, on la relit donc des équipes RÉELLES de « L'affiche » —
 *  la même source. Aucune équipe divisionnée → null → pastille non rendue. */
function topDivision(sports: Sport[]): string | null {
  const set = new Set<string>();
  for (const s of sports) for (const e of s.equipes) if (e.division) set.add(e.division);
  for (const d of DIV_ORDER) if (set.has(d)) return d;
  return [...set].sort()[0] ?? null;
}

function ProgramBodyMobile({ school, content }: { school: SchoolProgramIdentity; content: ProgramPageContent }) {
  const router = useRouter();
  const theme = deriveWallTheme(school.colorPrimary, school.colorDarker, school.colorNeutral);
  const [tr, tg, tb] = hexToRgb(theme.red);

  // S1 follow + CTA partagent UN seul état cible — source unique (identique au
  // web : useSchoolTargets, RLS « Athletes manage own targets »).
  const { inTargets, followers, toggle: toggleTargets } = useSchoolTargets(school.id, content.followersCount ?? 86);
  /* Le ♥ de l'aperçu et le CTA de la bande partagent le MÊME état cible : ils
     partagent donc aussi le même retour haptique, posé une seule fois ici. */
  const toggleTargetsTap = React.useCallback(() => { void tap(); toggleTargets(); }, [toggleTargets]);


  /* Retour — page ÉCOLE : l'écran précédent. La chaîne d'arrivée depuis la
     recherche est un `router.replace` vers le shell placeholder (app/page.tsx),
     donc l'entrée /college/<uuid> ne reste PAS dans l'historique : back renvoie
     bien sur /athlete/recherche, pas sur un placeholder ni sur le catch-all. */
  const retour = React.useCallback(() => { void tap(); router.back(); }, [router]);
  // Sections masquées par l'école → la page les SAUTE (aucun trou).
  const hidden = content.hiddenSections ?? [];

  /* ── ONGLETS ───────────────────────────────────────────────────────────────
     Sept sections empilées faisaient un tunnel de ~4000px : aucun repère,
     aucune fin visible. Elles sont regroupées en CINQ écrans qui s'échangent.
     Ce sont bien des onglets qui REMPLACENT le contenu, pas des ancres : la
     navigation par ancres ne fonctionne pas en WebView — c'est elle qui bloquait
     le scroll dans campus, et le Lot B l'avait déjà retirée pour cette raison.

     Un onglet n'existe que s'il lui reste quelque chose à montrer. Quand il
     regroupe deux sections, il survit tant qu'UNE des deux tient. */
  const onglets = React.useMemo(() => {
    const programs = !hidden.includes("programs");
    const parcours = !hidden.includes("parcours");
    const news = !hidden.includes("news") && (content.news?.length ?? 0) > 0;
    const about = !hidden.includes("about");
    const l: { k: TabKey; label: string }[] = [];
    // L'onglet Sports a disparu : ses liens vers les pages équipe remontent en
    // TÊTE d'Aperçu. Un athlète doit les voir tout de suite, pas après un
    // détour par un onglet.
    l.push({ k: "apercu", label: "Aperçu" });                       // #sports + #apercu + CTA
    // « À propos » redescend dans Campus, EN TÊTE : il présente le lieu avant
    // qu'on le regarde. Campus survit si l'un des deux tient.
    if (about || !hidden.includes("campus")) l.push({ k: "campus", label: "Campus" });
    if (programs) l.push({ k: "etudes", label: "Études" });
    if (parcours) l.push({ k: "parcours", label: "Parcours" });
    if (news) l.push({ k: "news", label: "Actualités" });
    return l;
  }, [hidden, content.sports.length, content.news]);

  /* Retour depuis une page équipe → on retombe sur l'onglet d'où l'on est
     parti. L'onglet Sports n'existant plus, c'est APERÇU : c'est lui qui porte
     désormais « L'affiche ». La clé est posée avant de naviguer, et consommée
     une seule fois. */
  const [tab, setTab] = React.useState<TabKey>(() => {
    try {
      const v = sessionStorage.getItem(TAB_RETOUR_KEY) as TabKey | null;
      if (v) { sessionStorage.removeItem(TAB_RETOUR_KEY); return v; }
    } catch { /* no-op */ }
    return "apercu";
  });
  // Un onglet devenu indisponible (données qui changent) ne doit pas laisser un
  // écran vide : on retombe sur le premier disponible.
  const actif: TabKey = onglets.some((o) => o.k === tab) ? tab : (onglets[0]?.k ?? "apercu");

  /* ── LA RANGÉE D'ONGLETS NE BOUGE PLUS ────────────────────────────────────
     Avant : chaque changement d'onglet imposait `scrollTop = tabsrow.offsetTop
     - 52`, soit 582px. Trois onglets sur six n'avaient pas assez de contenu à
     faire défiler ; le navigateur BRIDAIT la valeur, et la rangée atterrissait
     117 à 309px plus bas que sur les trois autres. Le saut ne venait pas de
     l'animation, mais d'un scroll impossible à atteindre.

     La correction est en CSS, pas ici : `.tabpane` porte une hauteur minimale
     (voir PPM_CSS) qui garantit à CHAQUE onglet de quoi défiler jusqu'à la
     position collante. Plus de bridage → position identique partout, et le
     `position:sticky` de la rangée fait enfin son travail.

     Il reste UNE chose à faire en JS, et une seule : revenir en haut du contenu
     quand on quitte un onglet où l'on était descendu. Le clamp est
     DESCENDANT UNIQUEMENT — si on est au-dessus (le mur à l'écran), on n'y
     touche pas : l'athlète a choisi de regarder le mur.

     ⚠ Le point d'accroche NE SE LIT PAS sur la rangée elle-même : `offsetTop`
     d'un élément `position:sticky` DÉJÀ COLLÉ renvoie sa position décalée, pas
     sa position de flux (mesuré : 668 au lieu de 566). Il se lit donc sur le
     liseré, qui précède la rangée et reste statique — moins la bande du bouton
     le padding haut de la racine, dont le `top` du sticky est compté à partir
     du bord intérieur. Il n'y a plus de bande à défalquer : la rangée se colle
     à 0.

     Au PREMIER rendu on ne bouge pas : l'athlète doit voir le mur en arrivant. */
  const rootRef = React.useRef<HTMLElement>(null);
  const liserRef = React.useRef<HTMLDivElement>(null);
  const tabsWrapRef = React.useRef<HTMLDivElement>(null);
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const premierRendu = React.useRef(true);
  React.useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    const sc = rootRef.current, li = liserRef.current;
    if (!sc || !li) return;
    const cs = getComputedStyle(sc);
    const padHaut = parseFloat(cs.paddingTop) || 0;
    const cible = Math.max(0, li.offsetTop + li.offsetHeight - padHaut);
    if (sc.scrollTop > cible) sc.scrollTop = cible;
  }, [actif]);

  /* Dégradé de bord droit — à six onglets la rangée mesure 552px pour 390px de
     champ : « Actualités » est hors écran et RIEN ne l'annonce. Le dégradé
     n'apparaît que s'il reste effectivement du contenu à droite, et disparaît
     en bout de course : c'est une affordance, pas une décoration. */
  const [debordeADroite, setDebordeADroite] = React.useState(false);
  React.useEffect(() => {
    const tr = tabsRef.current;
    if (!tr) return;
    const relire = () => setDebordeADroite(tr.scrollLeft + tr.clientWidth < tr.scrollWidth - 2);
    relire();
    tr.addEventListener("scroll", relire, { passive: true });
    const ro = new ResizeObserver(relire);
    ro.observe(tr);
    return () => { tr.removeEventListener("scroll", relire); ro.disconnect(); };
  }, [onglets.length]);

  /* Auto-centrage de l'onglet actif. À six onglets, « Actualités » sort du champ
     sur 390px : sans ça, on l'active et on ne voit plus lequel est actif — la
     rangée reste figée sur les premiers. Vaut aussi pour l'onglet restauré au
     retour d'une page équipe, qui n'est pas choisi au doigt. */
  React.useEffect(() => {
    const tr = tabsRef.current;
    const btn = tr?.querySelector<HTMLElement>(".tabbtn.on");
    if (!tr || !btn) return;
    tr.scrollTo({ left: Math.max(0, btn.offsetLeft - (tr.clientWidth - btn.offsetWidth) / 2), behavior: "smooth" });
  }, [actif]);

  const rootStyle = {
    "--red": theme.red,
    "--red-deep": theme.redDeep,
    "--ink": theme.ink,
    "--char": theme.char,
    "--cream": theme.cream,
    "--kraft": theme.kraft,
    "--beige": theme.beige,
    "--pop": "cubic-bezier(0.34,1.56,0.64,1)",
    "--nx-red": "#E63946",
    // RÈGLE COULEUR — tout accent éditorial suit l'ÉCOLE. `--red-shell` = la
    // primaire rendue lisible sur la coquille sombre (accentOnShell, plancher
    // partagé) ; `--on-c1` = l'encre lisible SUR un aplat de primaire ; les
    // teintes rgba sont calculées en JS, jamais en color-mix.
    "--red-shell": theme.c1OnShell,
    "--on-c1": theme.onC1,
    // `--c1-cream` = la primaire rendue lisible SUR une surface claire. Le mur
    // web s'en sert pour tout ce qui écrit en couleur d'école sur une tuile
    // crème (rail de ville, initiales, carte slogan, surnom) ; la surcouche
    // portée en a besoin ici. Même plancher, même valeur — rien de nouveau.
    "--c1-cream": theme.c1OnCream,
    // `--on-ink` = l'encre lisible SUR la couleur foncée de l'école, choisie
    // par pickNeutralOn() avec son plancher de contraste. Le médaillon Nexus
    // s'en sert pour teinter son X.
    "--on-ink": theme.onInk,
    "--red-tint-bg": `rgba(${tr},${tg},${tb},0.16)`,
    "--red-tint-bd": `rgba(${tr},${tg},${tb},0.45)`,
    "--green": "#22C55E",
    "--p-ink": "#EDEFF3",
    "--p-soft": "#C9CCD4",
    "--p-mut": "#8A909C",
    "--p-faint": "#5A616D",
    "--p-inv": "#15171B",
    "--bg": "#111317",
    "--card": "#1A1D24",
    "--line": "#1E2129",
    "--line-card": "#262A33",
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
    <main className="ppm" style={rootStyle} ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: WALL_CSS + PPM_CSS }} />

      {/* ═══ RETOUR ═══
          Le geste natif de retour iOS n'existe PAS ici : WKWebView pose
          allowsBackForwardNavigationGestures à false par défaut et ni Capacitor
          ni le projet ne l'activent (vérifié dans CAPBridgeViewController.swift,
          qui règle bounces et allowsLinkPreview mais jamais les gestes). Sans ce
          bouton, un athlète venu de la recherche est prisonnier de la page.

          Pastille FLOTTANTE, posée SUR le mur : plus de bande pleine largeur,
          donc plus de bandeau noir au-dessus de la composition — le mur commence
          au ras de la safe-area. L'enveloppe a une hauteur NULLE et ne prend
          aucune place dans le flux ; elle sert uniquement de bloc conteneur à la
          pastille, pour que celle-ci défile AVEC le contenu.

          Elle n'est PAS collante : sur le mur, on remonte pour revenir. Une
          pastille qui suivrait le défilement se poserait sur du contenu de
          section, où elle n'a rien à faire.

          FLÈCHE SEULE, en haut à GAUCHE. La pastille suit le damier, seule
          tuile sans contenu de la rangée de tête — et depuis le miroir de cette
          rangée (damier · CANADA · QUÉBEC · NEXUS) le damier est à GAUCHE.
          Mesuré à 390px : colonne de 78px, la pastille occupe x 14-50 (x 8-56
          avec sa zone tactile), donc entièrement dans le damier. Elle ne masque
          RIEN. Le libellé reste proscrit : il déborderait sur « Québec ». */}
      <div className="backwrap">
        <button type="button" className="backbtn" onClick={retour} aria-label="Revenir à l'écran précédent">
          <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      {/* ═══ LE MUR (aucune menubar d'ancres) + liseré rouge 3px ═══ */}
      <ProgramWallMobile
        school={school}
        theme={theme}
        division={school.division?.trim() || topDivision(content.sports)}
      />
      <div className="liser" ref={liserRef} />

      {/* Rangée d'onglets — sticky SOUS le mur, défilement horizontal si les
          libellés ne tiennent pas sur 390px. */}
      {onglets.length > 1 && (
        <div className={"tabswrap" + (debordeADroite ? " more" : "")} ref={tabsWrapRef}>
          <div className="tabsrow" role="tablist" ref={tabsRef}>
            {onglets.map((o) => (
              <button
                key={o.k}
                type="button"
                role="tab"
                aria-selected={o.k === actif}
                className={"tabbtn" + (o.k === actif ? " on" : "")}
                onClick={() => { if (o.k !== actif) { void tap(); setTab(o.k); } }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Le panneau porte la hauteur minimale qui rend la rangée d'onglets
          réellement collante — voir .tabpane dans PPM_CSS. */}
      {/* `key={actif}` n'est pas décoratif : sans lui React GARDE le même nœud
          d'un onglet à l'autre (seuls les enfants changent), et une animation CSS
          posée dessus ne repartirait jamais. Le key force un nœud neuf, donc le
          fondu est rejoué à chaque changement. Rien n'est perdu au passage — le
          contenu de chaque onglet est déjà monté/démonté par les `&&` ci-dessous. */}
      <div className="tabpane" key={actif}>
        {actif === "apercu" && (
          <>
            {/* Le bloc d'identité D'ABORD — nom du collège, suivi, stats — puis
                les liens vers les pages équipe : on situe l'école avant de
                proposer ses équipes.
                La bande CTA a disparu ; l'action de cible est portée par la
                pilule flottante, visible sur les cinq onglets. */}
            <ApercuMobile school={school} stats={content.stats} followers={followers} />
            {content.sports.length > 0 && <SportsMobile sports={content.sports} router={router} school={school} />}
          </>
        )}

        {actif === "campus" && (
          <>
            {/* « À propos » EN TÊTE de Campus : le texte de présentation situe
                le lieu avant les tuiles, la carte et les photos. */}
            {!hidden.includes("about") && <AproposMobile title={content.sellTitle} sellText={content.sellText} />}
            {!hidden.includes("campus") && <CampusMobile content={content} couleurPin={theme.c1OnShell} />}
          </>
        )}

        {actif === "etudes" && !hidden.includes("programs") && (
          <AcademiqueMobile
            programs={content.programsList}
            viewerProgrammeVise={content.viewerProgrammeVise}
            schoolName={school.schoolName}
          />
        )}

        {actif === "parcours" && !hidden.includes("parcours") && <ParcoursMobile school={school} content={content} />}

        {actif === "news" && !hidden.includes("news") && <NewsMobile news={content.news} />}

      </div>

      {/* Ni le tab bar flottant ni la pilule de cible ne coupent le contenu :
          --tabzone réserve les deux (voir app/college/layout.tsx). */}
      <div className="tabspacer" aria-hidden />
      <PiluleCibles inTargets={inTargets} onToggle={toggleTargetsTap} />
    </main>
  );
}

/* ── LA PILULE DE CIBLE ───────────────────────────────────────────────────
   Portage du motif de barre d'action flottante du profil athlète
   (AthleteRecruiterProfileBodyMobile.tsx:2587 ; AthleteEditWizardMobile s'en
   déclare une copie verbatim). C'est l'action principale de la page école :
   elle est visible sur les CINQ onglets, pas seulement sur Aperçu.

   `createPortal` vers document.body n'est PAS cosmétique. Sans lui, l'élément
   `position:fixed` s'ancrerait sur le premier ancêtre qui crée un bloc
   conteneur — ici `.ppm`, le conteneur de défilement — au lieu du viewport, et
   la pilule défilerait avec la page.

   Classes Tailwind et non la feuille `.ppm` : portalée dans <body>, la pilule
   est HORS de `.ppm`, aucun style scopé ne l'atteindrait.

   Géométrie reprise telle quelle : z-30 sous la tab bar (z-40), mais
   `bottom: safe-area + 80px` la place géométriquement AU-DESSUS — le haut de
   la bulle est à safe-area + 74, soit 6px d'écart, jamais de recouvrement.

   Variante SANS masquage au défilement, comme le wizard : la version du profil
   se cache en `translateY(120px)`, ce qui suppose un écouteur de scroll et un
   re-rendu par frame. BP la veut visible en permanence.

   SANS BANDE. L'enveloppe ne porte plus ni aplat, ni backdrop-filter, ni filet :
   la pilule flotte seule et le contenu défile derrière elle, à nu. Réglage
   IDENTIQUE à celui de la page équipe (TeamPageMobile) — l'athlète enchaîne les
   deux écrans, une pilule posée sur une bande ici et nue là-bas se lirait comme
   deux composants différents.
   La pilule reste lisible par elle-même : son aplat est opaque et son libellé
   blanc dessus (#E63946 → 4,3:1 ; #22C55E → 2,3:1, inchangés). Ce qui se perd
   est la SÉPARATION quand du clair défile dessous — sur cette page, la
   mosaïque du mur (tuiles crème, plaque du logo, fanions) et les cartes campus.

   `pointer-events` : l'enveloppe fait toute la largeur et n'a plus rien de
   visible. Sans `pointer-events-none` elle avalerait les taps sur le contenu
   dans ses gouttières px-3/py-2.5 ; le bouton les rétablit pour lui-même. */
function PiluleCibles({ inTargets, onToggle }: { inTargets: boolean; onToggle: () => void }) {
  const [monte, setMonte] = React.useState(false);
  React.useEffect(() => { setMonte(true); }, []);
  if (!monte || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed left-0 right-0 z-30 px-3 py-2.5 pointer-events-none"
      style={{
        // Posée juste au-dessus de la tab bar, via la variable que
        // app/college/layout.tsx pose sur <body> d'après ce qui est
        // RÉELLEMENT monté. Sans tab bar (visiteur non connecté) elle
        // descend au ras du home indicator au lieu de flotter dans le vide.
        bottom: "var(--barre-zone, calc(env(safe-area-inset-bottom) + 80px))",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={
          "pointer-events-auto w-full flex items-center justify-center gap-2 text-white rounded-2xl px-4 py-3 " +
          "font-head font-bold text-[13px] uppercase tracking-widest " +
          (inTargets
            ? "bg-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            : "bg-[#E63946] active:bg-[#D42B22] shadow-[0_0_20px_rgba(230,57,70,0.3)]")
        }
      >
        {inTargets ? <Check size={16} strokeWidth={3} aria-hidden /> : <Plus size={16} strokeWidth={2.6} aria-hidden />}
        {inTargets ? "Ajoutée à mes cibles" : "Ajouter à mes cibles"}
      </button>
    </div>,
    document.body,
  );
}

/* ── #apercu — StatRows ──────────────────────────────────────────────────── */

function ApercuMobile({
  school, stats, followers,
}: {
  school: SchoolProgramIdentity;
  stats: ProgramPageContent["stats"];
  followers: number;
}) {
  const first = school.schoolName.split(" ")[0];
  const body = school.schoolName.slice(first.length).trim();
  return (
    <section id="apercu" style={{ paddingBottom: 0 }}>
      <div className="hd-top">
        <div className="bigid">
          <div className="l1x">{first}</div>
          <div className="l2x">{body}</div>
          <div className="pbar" />
        </div>
        <div className="hfollow">
          {/* La pastille « 1 240 vues » a été RETIRÉE — parité avec le web
              (StatRows) : c'était un nombre en dur sur une page publique.
              Aucune table ne compte les vues d'une page école ; les tables
              *_views existantes sont toutes indexées sur athlete_id. Le
              compteur followers ci-dessous vient, lui, de
              count_followers_by_school. */}
          {/* §3e — le bouton de suivi a été retiré : avec la pilule flottante
              permanente, c'était le TROISIÈME contrôle pour la même action sur
              le même écran. Le compteur ci-dessous reste : c'est de
              l'information, pas une action. */}
          <div className="hf-note"><b>{`${followers} athlètes`}</b> suivent ce collège</div>
        </div>
      </div>
      <div className="tstack">
        <div className="trow tr-ink">
          <span className="big">{stats.teams}</span>
          <span className="lab">{stats.teamsLabel}</span>
        </div>
        {/* Rangée rendue UNIQUEMENT si un nombre réel existe — jamais « 0+ ». */}
        {stats.athletes > 0 && (
          <div className="trow tr-red">
            <span className="big">{stats.athletes}+</span>
            <span className="lab">{stats.athletesLabel}</span>
            <span className="man">saisie collège</span>
          </div>
        )}
        <div className="trow tr-cream">
          <span className="big">{school.city.toUpperCase()}</span>
          <span className="lab">{stats.region}</span>
        </div>
      </div>
    </section>
  );
}

/* ── #sports — L'affiche (mène à la page équipe, en natif) ───────────────── */

function SportsMobile({ sports, router, school }: { sports: Sport[]; router: ReturnType<typeof useRouter>; school: SchoolProgramIdentity }) {
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  if (!sports || sports.length === 0) return null; // 0 sport → pas de section

  const toggle = (i: number) => {
    void tap(); // haptique : ouverture/fermeture du tiroir d'un sport multi-équipes
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // Route page équipe. En natif, /college/<école>/<équipe> n'existe pas dans le
  // static export : on passe par le REGISTRE (matchDynamicRoute) qui donne le
  // shell placeholder + la clé de stash que TeamPageMobile relit via
  // useDynamicParam. Même pattern que le CTA de la recherche cégep.
  // Une équipe sans route n'est pas cliquable.
  const goTeam = (url: string) => {
    if (!url) return; // une équipe sans route n'est pas cliquable → aucun retour
    void tap(); // haptique : rangée de sport à équipe unique, ou chip d'équipe
    // Fil d'Ariane : la page équipe saura qu'une page école la précède DANS
    // l'historique, et pourra donc DÉPILER au lieu d'empiler. Sans ça, son
    // retour pousse une nouvelle entrée et les deux pages se renvoient l'une à
    // l'autre indéfiniment (mesuré : école → équipe → retour → école → retour
    // → équipe). Voir FROM_SCHOOL_KEY côté TeamPageMobile.
    try {
      sessionStorage.setItem("__nx_team_from_school", school.id);
      sessionStorage.setItem(TAB_RETOUR_KEY, "apercu"); // Sports a fondu dans Aperçu
    } catch { /* no-op */ }
    const matched = IS_CAPACITOR ? matchDynamicRoute(url) : null;
    if (matched) {
      try { sessionStorage.setItem(`${SESSION_KEY_PREFIX}${matched.paramKey}`, matched.realId); } catch { /* no-op */ }
      router.push(matched.placeholderPath);
      return;
    }
    router.push(url);
  };

  return (
    <section id="sports">
      <div className="kick">NOS ÉQUIPES</div>
      <h2 className="sec-h">Choisis ton sport</h2>
      <div className="pbar" />
      <div className="aList">
        {sports.map((s, i) => {
          const single = s.equipes.length === 1;
          const divs = divisionsOf(s.equipes);
          const gen = genreAgg(s.equipes);
          const cnt = s.equipes.length;
          const isOpen = open.has(i);
          return (
            <article
              key={i}
              className={`aRow ${single ? "single" : "multi"}${isOpen ? " open" : ""}`}
              onClick={single ? () => goTeam(s.equipes[0].url) : () => toggle(i)}
            >
              <div className="aTop">
                <span className="aName">{s.nom}</span>
                <span className="aChev">
                  {single ? <ArrowRight size={19} aria-hidden /> : <ChevronRight size={19} aria-hidden />}
                </span>
              </div>
              <div className="aPills">
                {divs.map((d) => (
                  <span key={d} className={`pill ${d === "D1" ? "div1" : "div"}`}>{d}</span>
                ))}
                <span className="pill gen">{gen}</span>
                <span className="pill cnt">{cnt} équipe{cnt > 1 ? "s" : ""}</span>
              </div>
              {!single && (
                <div className="teams">
                  {s.equipes.map((t, j) => (
                    <div
                      key={j}
                      className="tchip"
                      onClick={(e) => { e.stopPropagation(); goTeam(t.url); }}
                    >
                      {t.nom}<small>{[t.division, t.genre].filter(Boolean).join(" · ")}</small>
                      <span className="ar"><ArrowRight size={15} aria-hidden /></span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── #campus ─────────────────────────────────────────────────────────────── */

/** `couleurPin` : la primaire de l'école planchérée pour la coquille sombre.
 *  Elle descend d'ici plutôt que d'être relue — le thème est dérivé une
 *  seule fois, dans ProgramBodyMobile. */
function CampusMobile({ content, couleurPin }: { content: ProgramPageContent; couleurPin: string }) {
  const caraRef = React.useRef<HTMLDivElement>(null);
  const scrollCara = (dir: number) => caraRef.current?.scrollBy({ left: dir * 310, behavior: "smooth" });
  const cards = content.campusCards ?? [];
  const langue = languageLabel(content.language);
  const pin = content.mapPin ?? null;
  const ouvrirPlans = React.useCallback(() => {
    void tap();
    void openExternal(`https://www.google.com/maps?q=${encodeURIComponent(content.mapQuery)}`);
  }, [content.mapQuery]);
  const nTuiles = [langue, content.schoolType, content.region].filter(Boolean).length;

  return (
    <section id="campus">
      <div className="kick">L&apos;ESSENTIEL</div>
      <h2 className="sec-h">Le campus</h2>
      <div className="pbar" />

      {/* FICHE — une tuile par donnée RÉELLE de public.schools. Colonne nulle →
          tuile absente (jamais une langue ou un réseau devinés) ; les trois
          nulles → pas de fiche du tout. Le grille se resserre sur ce qui reste. */}
      {(langue || content.schoolType || content.region) && (
        <div className="fiche" style={{ gridTemplateColumns: `repeat(${nTuiles}, 1fr)` }}>
          {langue && <div className="itile"><div className="il">LANGUE</div><div className="iv">{langue}</div></div>}
          {content.schoolType && <div className="itile hot"><div className="il">STATUT</div><div className="iv">{content.schoolType}</div></div>}
          {content.region && <div className="itile"><div className="il">RÉGION</div><div className="iv">{content.region}</div></div>}
        </div>
      )}

      {/* CARTE DU CAMPUS — VIGNETTE Leaflet (mêmes tuiles Carto sombres et même
          filtre que la carte de recherche), un pin, aucun geste : ce n'est pas
          une carte à explorer, et un scroll vertical la traverse sans être
          capturé. Le tap ouvre l'app de cartes du téléphone.
          L'iframe Google keyless est exclue en WKWebView (X-Frame-Options sur
          l'origine capacitor://) ; le WEB garde la sienne (branche SSR).
          SANS coordonnée digne de confiance (absente, ou `approx` = centre-ville)
          → aucun pin, on retombe sur le bouton seul. Jamais un point faux. */}
      {pin ? (
        <div className="mapthumb" onClick={ouvrirPlans} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ouvrirPlans(); }}
          aria-label="Ouvrir le campus dans l'application de cartes">
          <MapPane
            points={[{ id: "campus", nom: content.mapQuery, lat: pin.lat, lng: pin.lng, riche: true, cible: false }]}
            selectedId={null} hoveredId={null} focus={null} onSelect={() => ouvrirPlans()}
            zoomControl={false} attributionCompact interactive={false}
            /* Fond CLAIR (Carto voyager) : le fond sombre plus le filtre de
               rehaussement rendaient la vignette quasi noire. Zoom 12 et non
               15 : on situe la VILLE, pas la rue. Pin en couleur d'école — le
               point n'est ni une cible ni un résultat de recherche, c'est
               l'école qu'on regarde. */
            center={pin} zoom={12} className="ppm-map"
            fond="clair" couleurPin={couleurPin}
          />
          <span className="mapthumb-cta"><MapPin size={15} strokeWidth={2} aria-hidden />Ouvrir dans Plans</span>
        </div>
      ) : (
        <button type="button" className="mapbtn" onClick={ouvrirPlans}>
          <MapPin size={17} strokeWidth={1.9} aria-hidden />
          Ouvrir dans Plans
        </button>
      )}

      {cards.length > 0 && (
        <>
          <div className="cara-head">
            <div className="cara-kick">LE CAMPUS EN IMAGES</div>
            <div className="cara-nav">
              <button type="button" onClick={() => scrollCara(-1)} aria-label="Précédent"><ChevronLeft size={16} aria-hidden /></button>
              <button type="button" onClick={() => scrollCara(1)} aria-label="Suivant"><ChevronRight size={16} aria-hidden /></button>
            </div>
          </div>
          <div className="cara" ref={caraRef}>
            {cards.map((card, i) => {
              if ("type" in card && card.type === "video") {
                const vid = card.youtubeUrl ? getYouTubeId(card.youtubeUrl) : null;
                return (
                  <article
                    className="ccard"
                    key={i}
                    onClick={() => { if (card.youtubeUrl) { void tap(); void openVideoExternal(card.youtubeUrl); } }}
                  >
                    {vid ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="cimg" src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="Vidéo du campus" loading="lazy" />
                    ) : (
                      <div className="ph" />
                    )}
                    <div className="grad" />
                    <div className="cc-play"><Play size={15} fill="currentColor" aria-hidden /></div>
                    <div className="cc-cap"><div className="t">Vidéo du campus</div></div>
                  </article>
                );
              }
              return (
                <article className="ccard" key={i}>
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="cimg" src={card.image} alt={card.titre} loading="lazy" />
                  ) : (
                    <div className="ph" />
                  )}
                  <div className="grad" />
                  <div className="cc-cap">
                    <div className="t">{card.titre}</div>
                    {card.legende ? <div className="c">{card.legende}</div> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}


/* ── #apropos ────────────────────────────────────────────────────────────── */

function AproposMobile({ title, sellText }: { title: string; sellText: string }) {
  return (
    <section id="apropos">
      <div className="kick">À PROPOS</div>
      <h2 className="sec-h">{title}</h2>
      <div className="pbar" />
      {/* TODO(bloc2): sellText is coach-authored — sanitize/moderate before render */}
      {sellText ? <p className="sell" dangerouslySetInnerHTML={{ __html: sellText }} /> : null}
    </section>
  );
}

/* ── #academique ─────────────────────────────────────────────────────────── */

function AcademiqueMobile({
  programs, viewerProgrammeVise, schoolName,
}: {
  programs: string[];
  viewerProgrammeVise?: string;
  schoolName: string;
}) {
  const [q, setQ] = React.useState("");
  const nq = norm(q);
  const shown = programs.filter((p) => norm(p).includes(nq));

  const vise = viewerProgrammeVise?.trim();
  const match = vise ? matchPrograms(vise, programs) : null;
  const hasBoard = !!vise;
  const hasMatches = !!match && (match.exact !== null || match.similaires.length > 0);

  return (
    <section id="academique">
      <div className="kick">LES ÉTUDES</div>
      <h2 className="sec-h">Le diplôme d&apos;abord</h2>
      <div className="pbar" />
      <div className="planche">
        {/* Board « match parfait » — masqué sans programme visé (jamais un board vide) */}
        {hasBoard && (
          <>
            <div className="match-head">
              <div className="mh-kick">TON PROFIL VISE</div>
              <div className="mh-prog">{vise}</div>
              <div className="mh-tag">depuis ton profil</div>
            </div>
            {hasMatches ? (
              <div className="matches">
                {match!.exact && (
                  <div className="mcard exact">
                    <span className="mbadge exact"><Check size={12} strokeWidth={3} aria-hidden />Correspond à ta recherche</span>
                    <b>{match!.exact}</b>
                    <div className="d">Offert ici — correspond à ton profil visé.</div>
                  </div>
                )}
                {match!.similaires.map((p) => (
                  <div className="mcard" key={p}>
                    <span className="mbadge sim">Programme similaire</span>
                    <b>{p}</b>
                    <div className="d">Programme apparenté offert ici.</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mcard">
                <div className="d">
                  Aucun programme comme <b>« {vise} »</b> n&apos;est offert au {schoolName} pour
                  l&apos;instant. Contacte le collège pour explorer des programmes similaires.
                </div>
              </div>
            )}
            <hr className="chalkline" />
          </>
        )}

        <div className="pl-t">TOUS LES PROGRAMMES</div>
        <input
          className="psearch"
          type="text"
          placeholder="Cherche ton programme… (ex. sciences, soins, informatique)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="progs">
          {shown.map((p, i) => (
            <span className="prog" key={i}><i aria-hidden />{p}</span>
          ))}
          {shown.length === 0 && (
            <span className="prog empty">Aucun programme trouvé — contacte le collège !</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── #parcours ───────────────────────────────────────────────────────────── */

function ParcoursMobile({ school, content }: { school: SchoolProgramIdentity; content: ProgramPageContent }) {
  const kick = school.schoolName.slice(school.schoolName.split(" ")[0].length).trim().toUpperCase();
  const route = content.route;
  const slogan = school.slogan;
  // Stats = saisie manuelle : une valeur absente n'est PAS rendue, jamais un 0.
  const stats = route.stop3.stats.filter((s) => s.count != null);

  return (
    <section id="parcours">
      <div className="kick">{kick}</div>
      <h2 className="sec-h">Ton <em>parcours</em></h2>
      <div className="pbar" />

      <div className="route">
        <div className="stop">
          <div className="dot">TOI</div>
          <div className="sl">{route.stop1.sl}</div>
          <h4>{route.stop1.h4}</h4>
          <p>{route.stop1.p}</p>
        </div>
        <div className="stop">
          <div className="dot">{school.initials}</div>
          <div className="sl">{route.stop2.sl}</div>
          <h4>{route.stop2.h4}</h4>
          <p>{route.stop2.p}</p>
        </div>
        <div className="stop">
          <div className="dot" style={{ fontSize: 14 }}>U.S.</div>
          <div className="sl">{route.stop3.sl}</div>
          <h4>{route.stop3.h4}</h4>
          {stats.length > 0 && (
            <div className="nums">
              {stats.map((s, i) => (
                <span key={i}>{s.count}{s.suffix ?? ""}<small>{s.label}</small></span>
              ))}
            </div>
          )}
          {content.universities.length > 0 && (
            <div className="uni">
              {content.universities.map((u, i) => <span className="uc" key={i}>{u}</span>)}
            </div>
          )}
        </div>
        <span className="fin"><ArrowDown size={30} strokeWidth={2.6} aria-hidden /></span>
      </div>

      {slogan ? <div className="mknote">« {slogan} »</div> : null}

      <div className="nstrip">
        <div className="mk">X</div>
        <div className="t">
          <b>Recrutés via Nexus</b>
          <span>{content.nexusStripText}</span>
        </div>
        <div className="nn">{content.nexusRecruitedCount}</div>
      </div>
    </section>
  );
}

/* ── #news ───────────────────────────────────────────────────────────────── */

function NewsMobile({ news }: { news?: ProgramPageContent["news"] }) {
  if (!news || news.length === 0) return null; // 0 news → pas de section
  return (
    <section id="news">
      <div className="kick">ACTUALITÉS</div>
      <h2 className="sec-h">Ce qui bouge au collège</h2>
      <div className="pbar" />
      <div className="news-grid">
        {news.map((n, i) => (
          <article className="ncard" key={i}>
            <span className="n-src">{n.source}</span>
            <span className="n-title">{n.titre}</span>
            <a className="n-link" href={n.url} target="_blank" rel="noopener noreferrer">
              Lire l&apos;article <span className="ar"><ArrowRight size={14} aria-hidden /></span>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── bande CTA ───────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════════
   CSS scopé `.ppm` — portage verbatim du corps de page du mock v3.
   Polices : Outfit (corps), Anton (titres et KPIs), Bebas Neue (labels et
   kickers). Aucun texte d'UI sous 12px, aucun color-mix.
   ═══════════════════════════════════════════════════════════════════════════ */
const PPM_CSS = `
/* ── GABARITS DE L'EN-TÊTE COLLANT ───────────────────────────────────────────
   Ces quatre mesures étaient répétées en dur à cinq endroits, dont un en JS, et
   un commentaire demandait de les réaligner à la main. Elles sont maintenant
   déclarées ICI et nulle part ailleurs : .tabswrap{top}, .tabsrow{padding},
   .tabbtn{height} et le plancher de .tabpane les consomment.

   --bar-h a DISPARU : le bouton retour n'est plus une bande dans le flux mais
   une pastille flottante de hauteur nulle. Il n'y a donc plus rien au-dessus de
   la rangée d'onglets, qui se colle à 0. */
.ppm{--tab-h:34px;          /* pastille d'onglet */
     --tab-pad:10px;        /* respiration verticale de la rangée */
     --tab-filet:1px;       /* le border-bottom de .tabswrap */
     --row-h:calc(var(--tab-h) + var(--tab-pad) * 2 + var(--tab-filet));
     /* Marge résiduelle EXACTE : le plancher défalque maintenant tout ce qui
        contribue déjà au défilement, si bien que la marge vaut --pane-mou et
        rien d'autre, quels que soient l'écran et l'appareil. */
     --pane-mou:16px;
     /* PLANCHER MINIMAL. Pour que la rangée d'onglets atteigne sa position
        collante il faut max_scroll >= point d'accroche, soit :
          padHaut + murH + 3 + rowH + paneH + tabzone - 100dvh  >=  murH + 3
          paneH >= 100dvh - rowH - tabzone - padHaut
        Le calcul précédent était 100dvh - rowH + mou : il ignorait tabzone ET
        padHaut, qui sont pourtant DÉJÀ du contenu défilable — le spacer de tab
        bar après le panneau, et le padding de safe-area avant le mur. D'où un
        plancher trop haut de 175px sur un iPhone à encoche avec tab bar, donc
        175px de vide sous les onglets courts, pour rien.
        Il ne peut pas descendre plus bas : en dessous, la rangée se décolle et
        le saut revient. */
     --pane-min:calc(100dvh - var(--row-h) - var(--tabzone, env(safe-area-inset-bottom))
                     - env(safe-area-inset-top) - 8px + var(--pane-mou));
  background:var(--bg);color:var(--p-ink);font-family:'Outfit',sans-serif;
  min-height:100vh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;
  padding-top:calc(env(safe-area-inset-top) + 8px)}
.ppm *{box-sizing:border-box}
.ppm .tabspacer{height:var(--tabzone, env(safe-area-inset-bottom))}
.ppm .liser{height:3px;background:var(--red)}
/* ── ONGLETS — la rangée est COLLANTE sous la bande du bouton retour
   à 0 — plus rien au-dessus d'elle depuis que le bouton retour flotte. Fond
   OPAQUE : le contenu passe dessous proprement au lieu de transparaître.

   Le sticky est porté par .tabswrap, pas par .tabsrow : la rangée elle-même
   défile HORIZONTALEMENT (overflow-x), et un même élément ne peut pas être à la
   fois le conteneur de défilement et l'élément collant de son parent. Le
   dégradé de bord vit donc sur l'enveloppe, hors du flux horizontal. ── */
.ppm .tabswrap{position:sticky;top:0;z-index:26;background:var(--bg);
  border-bottom:var(--tab-filet) solid var(--line)}
.ppm .tabsrow{display:flex;gap:6px;padding:var(--tab-pad) 14px;
  overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ppm .tabsrow::-webkit-scrollbar{display:none}
/* Dégradé de bord droit — n'apparaît QUE s'il reste des onglets hors champ.
   --bg vaut #111317 ; le point transparent est écrit en rgba (aucun
   color-mix, contrainte Capacitor). */
.ppm .tabswrap::after{content:"";position:absolute;right:0;top:0;bottom:var(--tab-filet);width:56px;
  pointer-events:none;opacity:0;transition:opacity .18s ease;
  background:linear-gradient(90deg,rgba(17,19,23,0) 0%,rgba(17,19,23,.88) 58%,var(--bg) 100%)}
.ppm .tabswrap.more::after{opacity:1}

/* ── LA HAUTEUR QUI SUPPRIME LE SAUT ──────────────────────────────────────
   Pour que la rangée d'onglets vienne se coller, il faut pouvoir défiler
   jusqu'à elle. Le contenu qui la SUIT doit donc mesurer au moins la hauteur de
   fenêtre restante une fois la bande retour et la rangée déduites — c'est tout
   --pane-min, composé plus haut à partir des gabarits. Sans ce plancher, un
   onglet court bride le défilement et la rangée reste plantée au milieu de
   l'écran : c'était le cas de Sports, Études et Actualités.
   Mesuré : point d'accroche à 566px de défilement, et le plus court des six
   onglets en offre 660 — 94px de marge. Le mur ayant perdu une rangée, ces
   deux valeurs baissent d'autant, mais PAS la marge : elle vaut
   padding-haut + tabzone + --pane-mou, indépendante de la hauteur du mur.

   La colonne flex servait à pousser « Propulsé par Nexus » en bas. Le pied
   étant retiré, il ne reste que le plancher — et le vide d'un onglet court
   n'est donc plus refoulé sous quoi que ce soit : il termine le défilement. */
/* Fondu au changement d'onglet — 180ms sur la courbe du sheet de la recherche
   (cubic-bezier(.32,.72,0,1)), pour que les trois écrans que l'athlète enchaîne
   partagent le même mouvement. Rejoué par le key={actif} posé sur le panneau.
   L'animation joue aussi au premier montage : une entrée douce, pas un défaut. */
.ppm .tabpane{min-height:var(--pane-min);animation:ppm-fondu .18s cubic-bezier(.32,.72,0,1)}
@keyframes ppm-fondu{from{opacity:0}to{opacity:1}}
/* Mouvement réduit : le contenu apparaît, il ne fond pas. */
@media(prefers-reduced-motion:reduce){.ppm .tabpane{animation:none}}
.ppm .tabbtn{flex:0 0 auto;height:var(--tab-h);padding:0 15px;border-radius:17px;cursor:pointer;
  background:rgba(255,255,255,.05);border:1px solid var(--line-card);color:var(--p-mut);
  font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;white-space:nowrap}
/* L'onglet actif porte la couleur de l'école, planchérée pour rester lisible. */
.ppm .tabbtn.on{background:var(--red-tint-bg);border-color:var(--red-tint-bd);color:var(--red-shell)}
/* ── RETOUR — pastille glass, même famille que les chips de la recherche ──
   Hauteur NULLE de l'enveloppe : elle ne pousse rien vers le bas, le mur démarre
   au ras du padding de la racine (safe-area + 8px). La pastille est absolue par
   rapport à elle, donc posée SUR le mur et emportée par le défilement. */
.ppm .backwrap{position:relative;height:0;z-index:30}
.ppm .backbtn{position:absolute;top:10px;left:14px;
  pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;
  width:36px;height:36px;padding:0;border-radius:50%;cursor:pointer;
  background:rgba(26,29,36,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--line-card);box-shadow:0 6px 18px rgba(0,0,0,.55);
  font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;color:var(--p-ink)}
/* La pastille fait 36px à l'œil, mais 48×48 au doigt : les 36 visuels passent
   sous le plancher de 44pt des HIG d'Apple, et c'est la SEULE sortie de l'écran
   — WKWebView désactive le geste de retour natif. La zone déborde par un
   pseudo-élément, aucun ancêtre ne la rogne (.backwrap n'a pas d'overflow). */
.ppm .backbtn::after{content:"";position:absolute;inset:-6px;border-radius:50%}
.ppm .backbtn svg{stroke:currentColor;fill:none;position:relative}

/* Le bouton retour est STICKY : sans marge, il retombe pile sur le kicker quand
   on s'arrête en tête d'une section (mesuré : 89×18px recouverts sur 5 des 7).
   Le haut de section réserve donc la bande du bouton — 44px (son bas) + 10px de
   respiration = 54px. Le bouton n'étant PLUS collant, il ne peut plus retomber
   sur un kicker : le padding revient à ses 34px d'origine. */
.ppm section{position:relative;padding:34px 18px 30px;border-bottom:1px solid var(--line)}
/* kicker de section — couleur ÉCOLE, plancher de contraste mesuré. */
.ppm .kick{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.2em;color:var(--red-shell);margin-bottom:7px}
.ppm .sec-h{font-family:'Anton',sans-serif;font-size:27px;line-height:1.02;color:var(--p-ink);font-weight:400}
.ppm .sec-h em{font-style:normal;color:var(--red)}
.ppm .pbar{width:52px;height:4px;background:var(--red);margin:11px 0 18px}

/* --- #apercu : StatRows --- */
.ppm .hd-top{margin-bottom:20px}
.ppm .bigid .l1x{font-family:'Anton',sans-serif;font-size:31px;line-height:.96;color:var(--p-ink)}
.ppm .bigid .l2x{font-family:'Anton',sans-serif;font-size:31px;line-height:.96;color:var(--red)}
.ppm .hfollow{margin-top:16px}
.ppm .hf-note{margin-top:9px;font-size:13px;color:var(--p-mut);text-align:center}
.ppm .hf-note b{color:var(--p-soft)}
.ppm .tstack{margin:0 -18px}
.ppm .trow{display:flex;align-items:baseline;gap:11px;padding:15px 18px;position:relative}
.ppm .trow .big{font-family:'Anton',sans-serif;font-size:46px;line-height:.9}
.ppm .trow .lab{font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.13em}
.ppm .trow .man{position:absolute;right:18px;top:16px;font-family:'Bebas Neue',sans-serif;
  font-size:12px;letter-spacing:.1em;opacity:.55}
.ppm .tr-ink{background:var(--ink)}.ppm .tr-ink .big{color:var(--cream)}.ppm .tr-ink .lab{color:var(--kraft)}
.ppm .tr-red{background:var(--red)}.ppm .tr-red .big,.ppm .tr-red .lab,.ppm .tr-red .man{color:#fff}
.ppm .tr-cream{background:var(--cream)}.ppm .tr-cream .big{color:var(--ink);font-size:34px}
.ppm .tr-cream .lab{color:var(--red-deep)}

/* --- #sports : L'affiche --- */
.ppm .aRow{display:block;border-top:1px solid var(--line-card);padding:16px 0;cursor:pointer}
.ppm .aRow:last-child{border-bottom:1px solid var(--line-card)}
.ppm .aTop{display:flex;align-items:center;gap:10px}
.ppm .aName{flex:1;font-family:'Anton',sans-serif;font-size:23px;color:var(--p-ink);line-height:1}
.ppm .aChev{display:inline-flex;color:var(--red)}
.ppm .aChev svg{stroke:currentColor;fill:none;stroke-width:2.2;transition:transform .25s}
.ppm .aRow.open .aChev svg{transform:rotate(90deg)}
.ppm .aPills{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.ppm .pill{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.1em;padding:3px 8px;border-radius:5px;
  background:rgba(255,255,255,.05);border:1px solid var(--line-card);color:var(--p-mut)}
/* La pastille de division portait rgba(200,16,46) EN DUR — le rouge de Grasset :
   elle ne se recolorait pour aucun autre collège. Teintes dérivées de la
   primaire réelle, calculées en JS. */
.ppm .pill.div1{background:var(--red-tint-bg);border-color:var(--red-tint-bd);color:var(--red-shell)}
.ppm .pill.gen{color:var(--p-soft)}
.ppm .teams{display:none;margin-top:11px;gap:6px;flex-direction:column}
.ppm .aRow.open .teams{display:flex}
.ppm .tchip{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line-card);
  border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;color:var(--p-ink)}
.ppm .tchip small{flex:1;font-size:13px;font-weight:500;color:var(--p-mut)}
.ppm .tchip .ar{display:inline-flex;color:var(--red)}
.ppm .tchip .ar svg{stroke:currentColor;fill:none;stroke-width:2.2}

/* --- #campus --- */
.ppm .fiche{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:16px}
.ppm .itile{background:var(--card);border:1px solid var(--line-card);border-radius:11px;padding:11px 8px;text-align:center}
/* La pastille de statut suit la couleur de l'ÉCOLE, comme tout accent
   éditorial. Elle portait rgba(200,16,46,…) — le rouge d'André-Grasset en
   dur, qui s'affichait tel quel sur une page or et marine. Les deux teintes
   sont celles, déjà calculées en JS depuis theme.red, que porte l'onglet
   actif : une seule source, aucun color-mix. */
.ppm .itile.hot{border-color:var(--red-tint-bd);background:var(--red-tint-bg)}
.ppm .itile .il{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.13em;color:var(--p-mut);margin-bottom:5px}
.ppm .itile .iv{font-family:'Anton',sans-serif;font-size:14px;color:var(--p-ink);line-height:1.1}
.ppm .mapbtn{width:100%;height:50px;border-radius:13px;border:1px solid var(--line-card);background:var(--card);
  color:var(--p-ink);font-family:'Outfit',sans-serif;font-size:15px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}
.ppm .mapbtn svg{stroke:var(--red);fill:none}
/* ── VIGNETTE CARTE — image de situation, pas un espace à explorer ── */
.ppm .mapthumb{position:relative;height:180px;border-radius:13px;overflow:hidden;
  border:1px solid var(--line-card);background:#0B0D10;cursor:pointer}
.ppm .ppm-map{position:absolute;inset:0;background:#0B0D10}
/* Aucun geste ne doit être capté : Leaflet est déjà coupé côté options, on
   neutralise aussi la couche DOM pour que le scroll vertical passe au travers.
   Le tap est repris par le conteneur .mapthumb. */
.ppm .mapthumb .leaflet-container{pointer-events:none;background:#0B0D10;font-family:inherit}
/* Aucun filtre sur les tuiles : le fond est clair, il n'y a plus rien à
   rehausser. Le rehaussement servait à sauver un fond sombre illisible. */
.ppm .mapthumb .leaflet-control-attribution{position:absolute;width:1px;height:1px;
  margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.ppm .mapthumb-cta{position:absolute;right:10px;bottom:10px;z-index:500;
  display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;
  background:rgba(26,29,36,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--line-card);box-shadow:0 6px 18px rgba(0,0,0,.55);
  font-size:13px;font-weight:600;color:var(--p-ink)}
.ppm .mapthumb-cta svg{stroke:var(--red);fill:none}
.ppm .cara-head{display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px}
.ppm .cara-kick{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.16em;color:var(--p-mut)}
.ppm .cara-nav{display:flex;gap:6px}
.ppm .cara-nav button{width:32px;height:32px;border-radius:16px;border:1px solid var(--line-card);
  background:var(--card);color:var(--p-soft);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.ppm .cara-nav button svg{stroke:currentColor;fill:none;stroke-width:2.2}
.ppm .cara{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;margin:0 -18px;padding:0 18px;scroll-snap-type:x mandatory}
.ppm .cara::-webkit-scrollbar{display:none}
/* 260 et non 200 : mesuré, la légende ne déborde pas (41px de texte pour 260
   de tuile) et les 60px supplémentaires vont entièrement à l'image. */
.ppm .ccard{flex:0 0 auto;width:300px;height:260px;position:relative;border-radius:12px;overflow:hidden;
  border:1px solid var(--line-card);scroll-snap-align:start;cursor:pointer;background:#0C0E12}
.ppm .ccard .ph{position:absolute;inset:0;background:linear-gradient(155deg,#2A2F38,#161A20)}
.ppm .ccard .cimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ppm .ccard .grad{position:absolute;inset:0;background:linear-gradient(180deg,transparent 42%,rgba(11,12,14,.88) 100%)}
.ppm .ccard .cc-cap{position:absolute;left:12px;right:12px;bottom:11px}
.ppm .ccard .cc-cap .t{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;line-height:1.25}
.ppm .ccard .cc-cap .c{font-size:13px;color:var(--p-soft);line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ppm .ccard .cc-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px;
  border-radius:22px;background:rgba(200,16,46,.92);display:grid;place-items:center;color:#fff}

/* --- #apropos --- */
.ppm .sell{font-size:16px;line-height:1.62;color:var(--p-soft)}
.ppm .sell b{color:var(--p-ink);font-weight:700}
.ppm .sell .hl{color:var(--red);font-weight:700}

/* --- #academique --- */
.ppm .planche{background:var(--card);border:1px solid var(--line-card);border-radius:14px;padding:16px 14px}
.ppm .match-head{margin-bottom:12px}
.ppm .mh-kick{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.16em;color:var(--p-mut)}
.ppm .mh-prog{font-family:'Anton',sans-serif;font-size:19px;color:var(--p-ink);margin:4px 0 3px}
.ppm .mh-tag{font-size:12px;color:var(--p-faint)}
.ppm .mcard{background:#12151C;border:1px solid var(--line-card);border-radius:11px;padding:12px;margin-bottom:8px}
.ppm .mcard.exact{border-color:rgba(34,197,94,.38);background:rgba(34,197,94,.07)}
.ppm .mbadge{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.1em;padding:2px 8px;border-radius:5px;
  display:inline-flex;align-items:center;gap:5px;margin-bottom:7px;background:rgba(255,255,255,.06);
  border:1px solid var(--line-card);color:var(--p-mut)}
.ppm .mbadge svg{stroke:currentColor;fill:none}
.ppm .mbadge.exact{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.36);color:var(--green)}
.ppm .mcard b{font-size:15px;color:var(--p-ink)}
.ppm .mcard>b{display:block;margin-bottom:4px}
.ppm .mcard .d{font-size:13px;color:var(--p-mut);line-height:1.5}
.ppm .chalkline{border:0;border-top:1px dashed rgba(255,255,255,.16);margin:16px 0 13px}
.ppm .pl-t{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:.16em;color:var(--p-mut);margin-bottom:9px}
.ppm .psearch{width:100%;height:44px;border-radius:11px;border:1px solid var(--line-card);background:#12151C;
  color:#fff;padding:0 13px;font-family:'Outfit',sans-serif;font-size:14px;outline:none;margin-bottom:11px}
.ppm .psearch::placeholder{color:var(--p-faint)}
.ppm .progs{display:flex;flex-wrap:wrap;gap:6px}
.ppm .prog{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:500;color:var(--p-soft);
  background:rgba(255,255,255,.04);border:1px solid var(--line-card);border-radius:8px;padding:7px 10px}
.ppm .prog i{width:5px;height:5px;border-radius:50%;background:var(--red);flex:0 0 auto}
.ppm .prog.empty{color:var(--p-mut)}

/* --- #parcours --- */
.ppm .route{position:relative;padding-left:44px}
.ppm .route::before{content:'';position:absolute;left:17px;top:12px;bottom:34px;width:2px;
  background:repeating-linear-gradient(180deg,var(--red) 0 7px,transparent 7px 14px)}
.ppm .stop{position:relative;margin-bottom:24px}
.ppm .stop .dot{position:absolute;left:-44px;top:0;width:36px;height:36px;border-radius:18px;background:var(--red);
  color:#fff;display:grid;place-items:center;font-family:'Anton',sans-serif;font-size:13px;letter-spacing:.02em}
.ppm .stop .sl{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.15em;color:var(--p-mut);margin-bottom:4px}
.ppm .stop h4{font-family:'Anton',sans-serif;font-size:19px;color:var(--p-ink);margin-bottom:5px;font-weight:400}
.ppm .stop p{font-size:14px;line-height:1.55;color:var(--p-soft)}
.ppm .nums{display:flex;gap:16px;margin:12px 0 10px;flex-wrap:wrap}
.ppm .nums>span{font-family:'Anton',sans-serif;font-size:27px;color:var(--red);line-height:1}
.ppm .nums small{display:block;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.11em;color:var(--p-mut);margin-top:4px}
.ppm .uni{display:flex;flex-wrap:wrap;gap:6px}
.ppm .uc{font-size:13px;font-weight:600;color:var(--p-soft);background:rgba(255,255,255,.05);
  border:1px solid var(--line-card);border-radius:7px;padding:5px 9px}
.ppm .fin{display:block;margin-left:-44px;color:var(--red)}
.ppm .fin svg{stroke:currentColor;fill:none}
.ppm .mknote{font-family:'Permanent Marker',cursive;font-size:19px;color:var(--red);
  line-height:1.35;margin:18px 0 20px;white-space:pre-line}
.ppm .nstrip{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line-card);
  border-radius:13px;padding:14px}
.ppm .nstrip .mk{width:36px;height:36px;flex:0 0 auto;border-radius:9px;background:var(--nx-red);display:grid;place-items:center;
  font-family:'Anton',sans-serif;font-size:17px;color:#fff}
.ppm .nstrip .t{flex:1;min-width:0}
.ppm .nstrip .t b{display:block;font-size:14px;color:var(--p-ink);margin-bottom:2px}
.ppm .nstrip .t span{font-size:13px;color:var(--p-mut)}
.ppm .nstrip .nn{font-family:'Anton',sans-serif;font-size:30px;color:var(--nx-red);line-height:1}

/* --- #news --- */
.ppm .news-grid{display:flex;flex-direction:column;gap:9px}
.ppm .ncard{background:var(--card);border:1px solid var(--line-card);border-radius:12px;padding:13px}
.ppm .n-src{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.13em;color:var(--red);display:block;margin-bottom:6px}
.ppm .n-title{display:block;font-size:15px;font-weight:600;color:var(--p-ink);line-height:1.4;margin-bottom:9px}
.ppm .n-link{font-size:13px;font-weight:600;color:var(--p-soft);text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.ppm .n-link .ar{display:inline-flex;color:var(--red)}
.ppm .n-link .ar svg{stroke:currentColor;fill:none;stroke-width:2.2}

`;
