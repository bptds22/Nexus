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
//   → bande CTA → pfoot.
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
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Heart, MapPin, Play, Plus } from "lucide-react";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { matchDynamicRoute, SESSION_KEY_PREFIX } from "@/lib/platform/mobileRoutes";
import { openExternal } from "@/components/shared/settings";
import { createClient } from "@/lib/supabase/client";
import { loadSchoolPage } from "@/lib/queries/schoolPage/schoolPageData";
import { useSchoolTargets } from "@/lib/queries/schoolPage/useSchoolTargets";
import { deriveWallTheme } from "@/components/program-wall/theme";
import ProgramWallMobile, { WALL_CSS } from "./ProgramWallMobile";
import { matchPrograms, norm } from "./matchPrograms";
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
          .from("schools").select("id, name, city, region, langue, reseau").eq("id", schoolId!).limit(1);
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

  // S1 follow + CTA partagent UN seul état cible — source unique (identique au
  // web : useSchoolTargets, RLS « Athletes manage own targets »).
  const { inTargets, followers, toggle: toggleTargets } = useSchoolTargets(school.id, content.followersCount ?? 86);
  /* Le ♥ de l'aperçu et le CTA de la bande partagent le MÊME état cible : ils
     partagent donc aussi le même retour haptique, posé une seule fois ici. */
  const toggleTargetsTap = React.useCallback(() => { void tap(); toggleTargets(); }, [toggleTargets]);
  // Sections masquées par l'école → la page les SAUTE (aucun trou).
  const hidden = content.hiddenSections ?? [];

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
    // --tabzone : conditionné à IS_CAPACITOR, PAS à la largeur de viewport.
    // MobileTabBar fait `if (!IS_CAPACITOR) return null` → en mobile-web il n'y
    // a AUCUN tab bar et réserver 88px y creuserait un vide. 88px = la constante
    // du nav réel (bulle 64px + bottom 10px + marge).
    "--tabzone": IS_CAPACITOR ? "calc(env(safe-area-inset-bottom) + 88px)" : "env(safe-area-inset-bottom)",
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
    <main className="ppm" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: WALL_CSS + PPM_CSS }} />

      {/* ═══ LE MUR (aucune menubar d'ancres) + liseré rouge 3px ═══ */}
      <ProgramWallMobile
        school={school}
        theme={theme}
        division={school.division?.trim() || topDivision(content.sports)}
      />
      <div className="liser" />

      <ApercuMobile
        school={school}
        stats={content.stats}
        inTargets={inTargets}
        followers={followers}
        onToggleTargets={toggleTargetsTap}
      />

      <SportsMobile sports={content.sports} router={router} />

      {!hidden.includes("campus") && <CampusMobile content={content} />}

      {!hidden.includes("about") && <AproposMobile title={content.sellTitle} sellText={content.sellText} />}

      {!hidden.includes("programs") && (
        <AcademiqueMobile
          programs={content.programsList}
          viewerProgrammeVise={content.viewerProgrammeVise}
          schoolName={school.schoolName}
        />
      )}

      {!hidden.includes("parcours") && <ParcoursMobile school={school} content={content} />}

      {!hidden.includes("news") && <NewsMobile news={content.news} />}

      <CtaMobile
        ctaTitle={content.ctaTitle}
        notifyName={content.ctaNotifyName}
        inTargets={inTargets}
        onToggleTargets={toggleTargetsTap}
      />

      <div className="pfoot">Propulsé par Nexus</div>
      {/* Rien n'est coupé par le tab bar flottant. */}
      <div className="tabspacer" aria-hidden />
    </main>
  );
}

/* ── #apercu — StatRows ──────────────────────────────────────────────────── */

function ApercuMobile({
  school, stats, inTargets, followers, onToggleTargets,
}: {
  school: SchoolProgramIdentity;
  stats: ProgramPageContent["stats"];
  inTargets: boolean;
  followers: number;
  onToggleTargets: () => void;
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
          {/* « vues » : valeur du mock, reprise telle quelle du composant web
              StatRows — aucune source DB à ce jour (cf. rapport). */}
          <span className="hf-chip">
            <Eye size={14} strokeWidth={1.9} aria-hidden />1 240<span className="u">vues</span>
          </span>
          <button type="button" className={inTargets ? "hf-btn on" : "hf-btn"} onClick={onToggleTargets}>
            {inTargets ? <Check size={16} strokeWidth={3} aria-hidden /> : <Heart size={16} fill="currentColor" aria-hidden />}
            <span className="t">{inTargets ? "Dans tes cibles" : "Rajouter dans mes cibles"}</span>
          </button>
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

function SportsMobile({ sports, router }: { sports: Sport[]; router: ReturnType<typeof useRouter> }) {
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

function CampusMobile({ content }: { content: ProgramPageContent }) {
  const caraRef = React.useRef<HTMLDivElement>(null);
  const scrollCara = (dir: number) => caraRef.current?.scrollBy({ left: dir * 246, behavior: "smooth" });
  const cards = content.campusCards ?? [];
  const [playing, setPlaying] = React.useState<number | null>(null);
  const langue = languageLabel(content.language);
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

      {/* CARTE DU CAMPUS — l'iframe Google keyless ne peut pas s'afficher en
          WKWebView (X-Frame-Options sur l'origine capacitor://). Bouton natif
          → application de cartes du téléphone (pattern GestionEcoleMobile).
          Aucune clé, aucune dépendance. Le WEB garde son iframe (branche SSR). */}
      <button
        type="button"
        className="mapbtn"
        onClick={() => openExternal(`https://www.google.com/maps?q=${encodeURIComponent(content.mapQuery)}`)}
      >
        <MapPin size={17} strokeWidth={1.9} aria-hidden />
        Ouvrir dans Plans
      </button>

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
                const vid = card.youtubeUrl ? ytId(card.youtubeUrl) : null;
                if (playing === i && vid) {
                  return (
                    <article className="ccard" key={i}>
                      <iframe
                        title="Vidéo du campus"
                        src={`https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`}
                        loading="lazy"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: "inherit" }}
                      />
                    </article>
                  );
                }
                return (
                  <article className="ccard" key={i} onClick={() => vid && setPlaying(i)}>
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

/** Extrait un id YouTube d'une URL watch/share/embed (jumeau de CampusSection). */
function ytId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : url;
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

function CtaMobile({
  ctaTitle, notifyName, inTargets, onToggleTargets,
}: {
  ctaTitle: string;
  notifyName: string;
  inTargets: boolean;
  onToggleTargets: () => void;
}) {
  return (
    <section className="cta-band">
      <div className="ghost" aria-hidden>SOIS LE NEX · SOIS LE NEX · SOIS LE NEX</div>
      <h2>Montre ton intérêt pour<br /><em>{ctaTitle}</em></h2>
      <p>C&apos;est la première étape de ton recrutement. Sois le <span>NEX</span>.</p>
      <button type="button" className={inTargets ? "btn-xl on" : "btn-xl"} onClick={onToggleTargets}>
        {inTargets ? <Check size={17} strokeWidth={3} aria-hidden /> : <Plus size={17} strokeWidth={2.6} aria-hidden />}
        {inTargets ? "Ajoutée à mes cibles" : "Ajouter à mes cibles"}
      </button>
      <div className="cta-note">
        {inTargets ? (
          <>{notifyName} a été notifié · le programme est dans <b>Mon parcours → Mes cibles</b></>
        ) : (
          <>{notifyName} sera notifié de ton intérêt · retrouve tes cibles dans <b>Mon parcours</b></>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS scopé `.ppm` — portage verbatim du corps de page du mock v3.
   Polices : Outfit (corps), Anton (titres et KPIs), Bebas Neue (labels et
   kickers). Aucun texte d'UI sous 12px, aucun color-mix.
   ═══════════════════════════════════════════════════════════════════════════ */
const PPM_CSS = `
.ppm{background:var(--bg);color:var(--p-ink);font-family:'Outfit',sans-serif;
  min-height:100vh;overflow-x:hidden;-webkit-tap-highlight-color:transparent;
  padding-top:calc(env(safe-area-inset-top) + 8px)}
.ppm *{box-sizing:border-box}
.ppm .tabspacer{height:var(--tabzone)}
.ppm .liser{height:3px;background:var(--red)}

.ppm section{position:relative;padding:34px 18px 30px;border-bottom:1px solid var(--line)}
.ppm .kick{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.2em;color:var(--nx-red);margin-bottom:7px}
.ppm .sec-h{font-family:'Anton',sans-serif;font-size:27px;line-height:1.02;color:var(--p-ink);font-weight:400}
.ppm .sec-h em{font-style:normal;color:var(--red)}
.ppm .pbar{width:52px;height:4px;background:var(--red);margin:11px 0 18px}

/* --- #apercu : StatRows --- */
.ppm .hd-top{margin-bottom:20px}
.ppm .bigid .l1x{font-family:'Anton',sans-serif;font-size:31px;line-height:.96;color:var(--p-ink)}
.ppm .bigid .l2x{font-family:'Anton',sans-serif;font-size:31px;line-height:.96;color:var(--red)}
.ppm .hfollow{margin-top:16px}
.ppm .hf-chip{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--p-mut);font-weight:600}
.ppm .hf-chip svg{width:14px;height:14px;stroke:var(--p-mut);fill:none}
.ppm .hf-chip .u{color:var(--p-faint);font-weight:500}
.ppm .hf-btn{margin-top:10px;width:100%;height:48px;border-radius:12px;border:1px solid var(--line-card);
  background:var(--card);color:var(--p-ink);font-family:'Outfit',sans-serif;font-size:15px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}
.ppm .hf-btn svg{width:16px;height:16px;stroke:currentColor}
.ppm .hf-btn.on{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.42);color:#A7E9BF}
.ppm .hf-btn.on svg{stroke:var(--green)}
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
.ppm .pill.div1{background:rgba(200,16,46,.16);border-color:rgba(200,16,46,.45);color:#F0A8B2}
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
.ppm .itile.hot{border-color:rgba(200,16,46,.45);background:rgba(200,16,46,.10)}
.ppm .itile .il{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.13em;color:var(--p-mut);margin-bottom:5px}
.ppm .itile .iv{font-family:'Anton',sans-serif;font-size:14px;color:var(--p-ink);line-height:1.1}
.ppm .mapbtn{width:100%;height:50px;border-radius:13px;border:1px solid var(--line-card);background:var(--card);
  color:var(--p-ink);font-family:'Outfit',sans-serif;font-size:15px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}
.ppm .mapbtn svg{stroke:var(--red);fill:none}
.ppm .cara-head{display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px}
.ppm .cara-kick{font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:.16em;color:var(--p-mut)}
.ppm .cara-nav{display:flex;gap:6px}
.ppm .cara-nav button{width:32px;height:32px;border-radius:16px;border:1px solid var(--line-card);
  background:var(--card);color:var(--p-soft);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.ppm .cara-nav button svg{stroke:currentColor;fill:none;stroke-width:2.2}
.ppm .cara{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;margin:0 -18px;padding:0 18px;scroll-snap-type:x mandatory}
.ppm .cara::-webkit-scrollbar{display:none}
.ppm .ccard{flex:0 0 auto;width:236px;height:158px;position:relative;border-radius:12px;overflow:hidden;
  border:1px solid var(--line-card);scroll-snap-align:start;cursor:pointer;background:#0C0E12}
.ppm .ccard .ph{position:absolute;inset:0;background:linear-gradient(155deg,#2A2F38,#161A20)}
.ppm .ccard .cimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ppm .ccard .grad{position:absolute;inset:0;background:linear-gradient(180deg,transparent 42%,rgba(11,12,14,.88) 100%)}
.ppm .ccard .cc-cap{position:absolute;left:12px;right:12px;bottom:11px}
.ppm .ccard .cc-cap .t{font-size:14px;font-weight:700;color:#fff;margin-bottom:3px}
.ppm .ccard .cc-cap .c{font-size:13px;color:var(--p-soft)}
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

/* --- bande CTA --- */
.ppm .cta-band{position:relative;overflow:hidden;text-align:center;padding:38px 18px 40px;border-bottom:0}
.ppm .cta-band .ghost{position:absolute;left:-2%;top:12%;font-family:'Anton',sans-serif;
  font-size:70px;color:rgba(255,255,255,.032);white-space:nowrap;pointer-events:none;line-height:1}
.ppm .cta-band h2{position:relative;font-family:'Anton',sans-serif;font-size:26px;line-height:1.08;color:var(--p-ink);font-weight:400}
.ppm .cta-band h2 em{font-style:normal;color:var(--red)}
.ppm .cta-band p{position:relative;font-size:15px;color:var(--p-soft);margin:11px 0 18px;line-height:1.55}
.ppm .cta-band p span{color:var(--nx-red);font-weight:800}
.ppm .btn-xl{position:relative;width:100%;height:54px;border-radius:13px;border:0;background:var(--nx-red);color:#fff;
  font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:9px}
.ppm .btn-xl svg{stroke:currentColor;fill:none}
.ppm .btn-xl.on{background:var(--green);box-shadow:0 14px 34px rgba(34,197,94,.3)}
.ppm .cta-note{position:relative;font-size:14px;color:var(--p-mut);margin-top:14px;line-height:1.5}
.ppm .cta-note b{color:var(--p-soft)}
.ppm .pfoot{text-align:center;font-size:12px;color:var(--p-faint);padding:18px 18px 30px}
`;
