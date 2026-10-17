"use client";

// components/carte-mobile/CarteMobile.tsx
//
// COQUILLE MOBILE D'UNE CARTE — sortie telle quelle de RechercheMobile
// (« Trouve ton cégep », la carte cégep des joueurs) pour servir aussi la carte
// des matchs (recruteur et partenaire). Même librairie (MapPane, Leaflet), mêmes
// marqueurs, même comportement ; seule la source des données change.
//
// Modèle d'interaction = Google Maps : deux écrans MUTUELLEMENT EXCLUSIFS
// (liste XOR carte) et UNE sheet à trois modes ('list' | 'filter' | 'preview')
// qui sert tour à tour de panneau de filtre et d'aperçu.
//
// L'état vit dans `useCarteMobile` (l'écran appelant le lit : clé du filtre
// ouvert, élément en aperçu) ; le rendu dans `<CarteMobile>`, qui reçoit les
// en-têtes, la liste, les points et le contenu de la sheet. Le CSS de la
// coquille est scopé `.rm` ; l'appelant ajoute le sien par `css`.
//
// Zones sûres : le chrome réserve la safe-area HAUTE (le kicker ne passe jamais
// sous l'heure), la sheet et la liste réservent --tabzone en bas. --tabzone est
// dérivé du VRAI tab bar (app/_components/mobile/MobileTabBar.tsx : bulle
// flottante 64px + bottom 10px, soit la constante 88px déjà servie par
// app/athlete/layout.tsx) et vaut 0 hors Capacitor, où le tab bar ne rend PAS.

import * as React from "react";
import dynamic from "next/dynamic";
import { Info, Map as MapIcon, List } from "lucide-react";
import type { MapFocus, MapPoint } from "@/components/cegep-search/MapPane";
import { tap } from "@/lib/haptics";
import { triggerHaptic } from "@/lib/haptics";
import { ZONE_ONGLETS } from "@/lib/mobile/zoneOnglets";

// Leaflet touche `window` à l'import → jamais au SSR (même garde que le web).
const MapPane = dynamic(() => import("@/components/cegep-search/MapPane"), { ssr: false });

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export type ModeFeuille = "list" | "filter" | "preview";

/** Durée du glissement de la sheet (entrée ET sortie). Doit rester ALIGNÉE sur
 *  la transition CSS `.rm .sheet` : c'est ce délai qui décide du démontage. */
const SHEET_MS = 280;

/** Les gestionnaires tactiles du glissé, à poser sur l'en-tête de la sheet. */
export interface PriseFeuille {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export interface CarteMobileEtat<K extends string> {
  view: "liste" | "carte";
  open: boolean;
  mode: ModeFeuille;
  /** Le filtre ouvert dans la sheet (mode 'filter'). */
  cle: K | null;
  /** L'élément en aperçu (mode 'preview'). */
  courant: string | null;
  showFilter: (k: K) => void;
  showPreview: (id: string) => void;
  closeSheet: () => void;
  basculer: () => void;
  prise: PriseFeuille;
  /** Interne à <CarteMobile> : géométrie et animation de la sheet. */
  interne: {
    sheetMounted: boolean; sheetIn: boolean; dragY: number | null; openH: number; tall: boolean;
    headH: number; headRef: React.RefObject<HTMLDivElement | null>; sheetRef: React.RefObject<HTMLDivElement | null>;
    attrOpen: boolean; setAttrOpen: React.Dispatch<React.SetStateAction<boolean>>; resizeToken: number;
  };
}

export function useCarteMobile<K extends string>(): CarteMobileEtat<K> {
  // ── écrans / sheet ──
  const [view, setView] = React.useState<"liste" | "carte">("liste");
  const [open, setOpen] = React.useState(false);
  /* Montage/sortie de la sheet — voir le bloc ANIMATION plus bas. `open` est
     l'intention (ouverte/fermée) ; `sheetMounted` est la présence dans le DOM
     (elle survit à la fermeture le temps de la sortie) ; `sheetIn` est l'état
     VISUEL (posée / hors écran), basculé une frame après le montage pour qu'il
     y ait un état de départ à animer. */
  const [sheetMounted, setSheetMounted] = React.useState(false);
  const [sheetIn, setSheetIn] = React.useState(false);
  /* Crédit de la carte replié derrière ⓘ (obligation ODbL/CARTO : masqué
     visuellement, jamais retiré du DOM). */
  const [attrOpen, setAttrOpen] = React.useState(false);
  const [mode, setMode] = React.useState<ModeFeuille>("list");
  const [cle, setCle] = React.useState<K | null>(null);
  const [courant, setCourant] = React.useState<string | null>(null);

  // ── mesures réelles (correction 6 : rien n'est constant) ──
  const headRef = React.useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = React.useState(0);
  const [vh, setVh] = React.useState(0);
  /* Décalage du GLISSÉ, en px vers le bas (0 = posée). Le drag déplace la sheet
     en `transform`, plus en `height` : c'est la même propriété que l'entrée et
     la sortie, donc relâcher un glissé enchaîne sans saut. */
  const [dragY, setDragY] = React.useState<number | null>(null);
  const [resizeToken, setResizeToken] = React.useState(0);

  /* ── hauteur du viewport : les snaps en dépendent, jamais une constante ── */
  React.useEffect(() => {
    const read = () => setVh(window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  /* ── hauteur RÉELLE du chrome : la liste part de là (correction 6) ── */
  React.useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el);
    setHeadH(el.offsetHeight);
    return () => ro.disconnect();
  }, [view]);

  /* ── ANIMATION DE LA SHEET ────────────────────────────────────────────────
     CAUSE du « surgissement » d'avant : la sheet est DÉMONTÉE au repos (Lot C).
     Au montage il n'existe donc aucun état de départ à interpoler — le
     navigateur peint directement l'état final, et `.sheet.hidden` (posée par la
     classe) n'était jamais rendue puisque l'élément n'existait pas encore. La
     transition portait en plus sur `height`, réglée en style inline : une
     hauteur qui apparaît ne s'anime pas davantage.

     CORRECTIF : on découple présence et apparence, en DEUX effets.
     A) présence — `open` monte la sheet ; à la fermeture le démontage attend la
        fin du glissement, et c'est là seulement qu'on vide mode/cle/courant
        (sinon on verrait une sheet VIDE partir vers le bas).
     B) apparence — une fois la sheet RÉELLEMENT dans le DOM (effet séparé, donc
        après le commit du montage), on force la lecture du style de départ puis
        on bascule `sheetIn` à la frame suivante.
     Les deux effets doivent rester SÉPARÉS : programmer le rAF depuis l'effet A
     le planifie avant que le montage soit peint — le navigateur fusionne alors
     début et fin dans la même frame et n'anime rien. C'est exactement le bug
     mesuré (transform inline déjà à translateY(0) à la première frame). ── */
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // A — présence
  React.useEffect(() => {
    if (open) { setSheetMounted(true); return; }
    setSheetIn(false);
    const t = window.setTimeout(() => {
      setSheetMounted(false);
      setMode("list"); setCle(null); setCourant(null);
    }, SHEET_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // B — apparence
  React.useEffect(() => {
    if (!sheetMounted || !open) return;
    const el = sheetRef.current;
    if (!el) return;
    void el.offsetHeight; // vide le style de départ (translateY(100%)) dans le moteur
    const r = requestAnimationFrame(() => setSheetIn(true));
    return () => cancelAnimationFrame(r);
  }, [sheetMounted, open]);

  /* ── correction 5 : la sheet passe AU-DESSUS du tab bar, et dès qu'elle
     dépasse peek le tab bar s'efface. On ne touche pas MobileTabBar (portalé
     sur document.body) : on marque le body et une règle scopée l'escamote. ── */
  /* Adossé au MONTAGE, pas à `open` : pendant la sortie la sheet est encore là,
     et le tab bar ne doit pas réapparaître dessous à mi-glissement. */
  const tall = sheetMounted;
  React.useEffect(() => {
    document.body.classList.toggle("nx-rm-sheet-tall", tall);
  }, [tall]);
  // Filet de démontage, deps [] : la classe vit sur <body>, hors de l'arbre du
  // composant. Quoi qu'il arrive en amont, quitter cet écran ne doit JAMAIS
  // laisser le tab bar masqué dans le reste de l'app.
  React.useEffect(() => () => {
    document.body.classList.remove("nx-rm-sheet-tall");
  }, []);

  /* ── UNE seule hauteur ouverte : 76% du viewport. Snaps peek/mid/full
     SUPPRIMÉS. La sheet n'existe QUE pour un filtre ou un aperçu — ouverte à
     76% ou fermée, rien entre les deux. ── */
  const openH = React.useMemo(() => Math.round((vh || 800) * 0.76), [vh]);

  /* ── navigation de la sheet ── */
  const showFilter = React.useCallback((k: K) => {
    void tap(); // haptique : ouverture du sheet filtre
    setAttrOpen(false);
    setMode("filter"); setCle(k); setCourant(null);
    setOpen(true);
  }, []);

  const showPreview = React.useCallback((id: string) => {
    void tap(); // haptique : tap d'un pin OU d'une carte résultat + ouverture sheet
    setAttrOpen(false);
    setCourant(id); setMode("preview"); setCle(null);
    setOpen(true);
  }, []);

  /* Ne vide PLUS mode/cle/courant ici : la sheet reste à l'écran le temps de
     sortir, elle doit donc garder son contenu. Le nettoyage se fait à la fin de
     l'animation (effet ANIMATION DE LA SHEET). */
  const closeSheet = React.useCallback(() => {
    void tap(); // haptique : fermeture du sheet
    setOpen(false);
  }, []);

  /* ── bascule liste ↔ carte : jamais les deux montés. Toute sheet ouverte se
     ferme à la bascule (sans re-tap haptique inutile). ── */
  const basculer = () => {
    const next = view === "liste" ? "carte" : "liste";
    setView(next);
    setAttrOpen(false);
    setMode("list"); setCle(null); setCourant(null); setOpen(false);
    if (next === "carte") setResizeToken((t) => t + 1); // Leaflet re-mesure
  };

  React.useEffect(() => {
    if (view === "carte") setResizeToken((t) => t + 1);
  }, [view, open]);

  /* ── DRAG — événements TACTILES (touchstart/move/end), PAS pointer events.
     Choix WKWebView : les pointer events peuvent être préemptés par le gesture
     recognizer de la WebView (pointercancel intempestif en plein drag) ; les
     touch events + touch-action:none donnent un contrôle déterministe. La zone
     de saisie est TOUTE l'en-tête (.shHead), pas la poignée de 40px. Un touch
     démarrant sur un bouton/lien/champ ne lance PAS de drag. Seuil de
     fermeture : glissé de plus de 25% de la hauteur ouverte vers le bas.
     Le glissé déplace la sheet en `transform` (comme l'entrée et la sortie) :
     relâcher enchaîne donc sur la même propriété, sans saut. En deçà du seuil
     elle revient se poser toute seule. ── */
  const dragRef = React.useRef<{ y0: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button, a, .heart, input")) return;
    dragRef.current = { y0: e.touches[0].clientY };
    setDragY(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.touches[0].clientY - d.y0; // > 0 si on descend
    setDragY(Math.max(0, Math.min(openH, dy)));
  };
  const onTouchEnd = () => {
    const y = dragY;
    dragRef.current = null;
    setDragY(null);
    if (y == null) return;
    if (y > openH * 0.25) closeSheet(); // glissé bas → fermeture
  };

  return {
    view, open, mode, cle, courant, showFilter, showPreview, closeSheet, basculer,
    prise: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
    interne: { sheetMounted, sheetIn, dragY, openH, tall, headH, headRef, sheetRef, attrOpen, setAttrOpen, resizeToken },
  };
}

/** Racine nue de la coquille, pour un message plein écran (erreur de chargement). */
export function CarteMobileMessage({ css = "", className, children }: { css?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={"rm" + (className ? ` ${className}` : "")} style={rootVars}>
      <style dangerouslySetInnerHTML={{ __html: CSS_COQUILLE + css }} />
      <div className="rm-err">{children}</div>
    </div>
  );
}

export default function CarteMobile<K extends string>({
  etat, css = "", className, enTeteListe, enTeteCarte, liste, points, selectedId, focus = null, onSelectPoint, ariaLabel, feuille,
}: {
  etat: CarteMobileEtat<K>;
  /** CSS propre à l'écran, scopé `.rm`, ajouté après celui de la coquille. */
  css?: string;
  className?: string;
  /** Contenu de l'en-tête de l'écran liste (chrome plein + ligne de compte). */
  enTeteListe: React.ReactNode;
  /** Contenu de l'en-tête flottant de l'écran carte. */
  enTeteCarte: React.ReactNode;
  liste: React.ReactNode;
  points: MapPoint[];
  selectedId: string | null;
  focus?: MapFocus | null;
  onSelectPoint: (id: string) => void;
  ariaLabel?: string;
  /** Contenu de la sheet (sous la poignée), choisi par l'appelant selon etat.mode. */
  feuille: React.ReactNode;
}) {
  const { view, open, closeSheet, basculer } = etat;
  const { sheetMounted, sheetIn, dragY, openH, tall, headH, headRef, sheetRef, attrOpen, setAttrOpen, resizeToken } = etat.interne;

  /* ── géométrie : tout ce qui flotte réserve --tabzone ── */
  // La sheet est à bottom:0 (jamais coupée par le tab bar) → le toggle
  // liste/carte flotte juste au-dessus du tab bar, sans offset de sheet.
  const flotteBottom = `calc(var(--tabzone) + 14px)`;

  return (
    <div className={"rm" + (className ? ` ${className}` : "")} style={rootVars}>
      <style dangerouslySetInnerHTML={{ __html: CSS_COQUILLE + css }} />

      {/* ═══ ÉCRAN LISTE ═══ */}
      {view === "liste" && (
        <section className="screen">
          <div className="head" ref={headRef}>{enTeteListe}</div>
          <div className="listscroll" style={{ top: headH }}>
            {liste}
            <div className="pad" />
          </div>
        </section>
      )}

      {/* ═══ ÉCRAN CARTE ═══ */}
      {view === "carte" && (
        <section className="screen">
          <div className="maphost">
            <MapPane
              points={points}
              selectedId={selectedId}
              hoveredId={null}
              focus={focus}
              onSelect={onSelectPoint}
              zoomControl={false}
              attributionCompact
              resizeToken={resizeToken}
              className="rm-map"
              ariaLabel={ariaLabel}
            />
          </div>
          <div className="head" ref={headRef}>{enTeteCarte}</div>

          {/* ═══ ATTRIBUTION — obligation de licence (ODbL pour OSM, conditions
                 MapTiler). Elle n'est PAS supprimée : le contrôle Leaflet reste
                 dans le DOM (attributionControl:true, cf. MapPane) et n'est que
                 masqué visuellement ; le crédit reste accessible ici, replié
                 derrière un ⓘ — pattern Google Maps. Liens cliquables.
                 Doit rester synchronisé avec ATTRIBUTION dans MapPane.tsx. ═══ */}
          {attrOpen && (
            <div className="attrcatch" onClick={() => { void triggerHaptic("Light"); setAttrOpen(false); }} />
          )}
          <div className={"attrzone" + (open ? " hide" : "")} style={{ bottom: flotteBottom }}>
            {attrOpen && (
              <div className="attrpill" role="note">
                ©{" "}
                <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">
                  MapTiler
                </a>{" "}
                ©{" "}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                  OpenStreetMap contributors
                </a>
              </div>
            )}
            <button
              className={"attrbtn" + (attrOpen ? " on" : "")}
              onClick={() => { void tap(); setAttrOpen((a) => !a); }}
              aria-label="Crédits de la carte"
              aria-expanded={attrOpen}
            >
              <Info size={14} aria-hidden />
            </button>
          </div>
        </section>
      )}

      {/* ═══ TOGGLE LISTE ↔ CARTE ═══ */}
      <button
        className={"vtoggle" + (open ? " hide" : "")}
        style={{ bottom: flotteBottom }}
        onClick={() => { void triggerHaptic("Light"); basculer(); }}
        data-testid="bascule-vue"
      >
        {view === "liste" ? <MapIcon size={16} aria-hidden /> : <List size={16} aria-hidden />}
        <span>{view === "liste" ? "Carte" : "Liste"}</span>
      </button>

      {/* ═══ BACKDROP — tap hors du sheet = fermeture, DANS LES DEUX VUES
             (avant : liste seulement → en carte on ne pouvait pas fermer au
             tap, ce qui cassait le réflexe iOS). ═══ */}
      {/* Le fondu suit le glissement : piloté par `sheetIn`, pas par `open` —
          les deux partent et reviennent ensemble. */}
      <div
        className={"backdrop" + (open && sheetIn ? " on" : "")}
        onClick={closeSheet}
      />

      {/* ═══ SHEET — monté UNIQUEMENT quand ouvert (ou en cours de drag) :
             DÉMONTÉ au repos → aucune bande arrondie résiduelle (le shadow +
             border-radius d'une sheet fermée dépassait). Une seule hauteur
             (76%), pour FILTRE ou APERÇU. À bottom:0, jamais coupée par le tab
             bar. Fermeture : glisser bas (drag TACTILE sur toute l'en-tête), tap
             hors du sheet (backdrop, carte comprise) ou ✕. En-tête inerte. ═══ */}
      {sheetMounted && (
      <div
        ref={sheetRef}
        className={"sheet" + (tall ? " tall" : " low") + (dragY != null ? " dragging" : "")}
        style={{
          height: openH,
          // UNE seule propriété animée, du montage au démontage : translateY.
          // Hors écran tant que `sheetIn` est faux (état de DÉPART peint au
          // montage), posée ensuite, suivie au doigt pendant un glissé.
          transform: dragY != null
            ? `translateY(${dragY}px)`
            : (open && sheetIn ? "translateY(0)" : "translateY(100%)"),
        }}
      >
        <div className="grab" {...etat.prise}><i /></div>
        {feuille}
      </div>
      )}
    </div>
  );
}

/* ── variables de racine ────────────────────────────────────────────────────
   --tabzone : conditionné à IS_CAPACITOR, PAS à la largeur de viewport.
   MobileTabBar fait `if (!IS_CAPACITOR) return null` → en mobile-web il n'y a
   AUCUN tab bar, et réserver 88px y creuserait un vide de 88px (correction 6).
   88px = la constante déjà servie par app/athlete/layout.tsx L393, elle-même
   dérivée du nav réel (min-h 64px + bottom 10px + marge). */
const rootVars = {
  "--tabzone": IS_CAPACITOR ? ZONE_ONGLETS : "env(safe-area-inset-bottom)",
} as React.CSSProperties;

/* ── CSS de la coquille, scopé `.rm` — injecté comme sur les pages école/équipe ── */
const CSS_COQUILLE = `
.rm{--bg:#111317;--card:#1A1D24;--red:#E63946;--green:#22C55E;
  --soft:#C9CED8;--mut:#9BA3B0;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);
  --glass:rgba(26,29,36,.94);
  position:fixed;inset:0;z-index:20;background:var(--bg);overflow:hidden;
  font-family:var(--font-outfit),system-ui,sans-serif;color:#fff;
  -webkit-tap-highlight-color:transparent}
.rm *{box-sizing:border-box}
.rm button{font-family:inherit}
.rm-err{padding:calc(env(safe-area-inset-top) + 40px) 24px;color:#9BA3B0;font-size:14px}

/* correction 5 — la sheet dépasse peek → le tab bar réel s'efface.
   MobileTabBar est portalé sur document.body : on le vise par son aria-label,
   sans jamais le modifier ni le dupliquer. */
body.nx-rm-sheet-tall nav[aria-label="Navigation principale"]{
  opacity:0;transform:translateY(14px);pointer-events:none;transition:opacity .22s,transform .22s}

/* ══ CHROME — correction 1 : la safe-area HAUTE est réservée ══ */
.rm .head{position:absolute;left:0;right:0;top:0;z-index:40}
.rm .chrome{padding:0 16px}
.rm .chrome.solid{background:var(--bg);padding-top:calc(env(safe-area-inset-top) + 8px)}
.rm .chrome.float{padding-top:calc(env(safe-area-inset-top) + 8px);pointer-events:none;
  background:linear-gradient(180deg,rgba(17,19,23,.94) 0%,rgba(17,19,23,.62) 58%,rgba(17,19,23,0) 100%)}
.rm .chrome.float>*{pointer-events:auto}
.rm .titlerow{margin-bottom:11px}
.rm .kicker{font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.28em;color:var(--red);margin-bottom:2px}
.rm .titlerow h1{font-family:var(--font-anton),sans-serif;font-size:26px;line-height:1;text-transform:uppercase;letter-spacing:.005em}

.rm .searchrow{position:relative;margin-bottom:9px}
.rm .searchrow>svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);stroke:var(--mut);pointer-events:none}
.rm .searchrow input{width:100%;height:46px;background:var(--card);border:1px solid var(--line2);border-radius:23px;
  padding:0 40px;color:#fff;font-size:15px;font-weight:500;outline:none;font-family:inherit}
.rm .searchrow input::placeholder{color:var(--mut)}
.rm .searchrow input::-webkit-search-cancel-button{display:none}
.rm .searchrow .clr{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:24px;height:24px;
  border:0;background:transparent;display:grid;place-items:center;color:var(--mut);cursor:pointer}
.rm .float .searchrow input{background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  box-shadow:0 6px 20px rgba(0,0,0,.5)}

/* correction 4 — UNE seule rangée, scroll horizontal */
.rm .chips{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px 11px}
.rm .chips::-webkit-scrollbar{display:none}
.rm .chip{flex:0 0 auto;height:36px;padding:0 13px;border-radius:18px;background:var(--card);border:1px solid var(--line);
  color:var(--soft);font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
/* Compteur carte : pastille glass NON cliquable, même famille que les pilules. */
.rm .mapcount{align-self:flex-start;height:30px;padding:0 12px;border-radius:15px;display:inline-flex;
  align-items:center;font-size:12px;font-weight:600;color:var(--soft);white-space:nowrap;
  background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--line2);pointer-events:none}
.rm .float .chip{background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-color:var(--line2);box-shadow:0 4px 14px rgba(0,0,0,.45)}
.rm .chip svg{stroke:var(--mut);flex:0 0 auto;transition:transform .2s}
.rm .chip .n{min-width:18px;height:18px;padding:0 5px;border-radius:5px;background:var(--red);color:#fff;
  font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.04em;display:grid;place-items:center}
.rm .chip.has{border-color:rgba(230,57,70,.6);color:#fff}
.rm .chip.live{background:rgba(230,57,70,.18);border-color:var(--red);color:#fff}
.rm .chip.live svg{transform:rotate(180deg);stroke:#fff}
/* DÉSACTIVÉE : grisée, non tapable. */
.rm .chip.off{opacity:.45;color:var(--mut);border-color:var(--line);cursor:not-allowed}
.rm .chip.off svg{stroke:var(--mut)}

.rm .countline{background:var(--bg);border-bottom:1px solid var(--line);border-top:1px solid var(--line);
  padding:11px 16px;font-size:14px;color:var(--mut)}
.rm .countline b{color:#fff;font-weight:700}

/* ══ ÉCRANS — liste XOR carte (correction 3 : jamais les deux montés) ══ */
.rm .screen{position:absolute;inset:0}
.rm .listscroll{position:absolute;left:0;right:0;bottom:0;overflow-y:auto;scrollbar-width:none;padding:10px 16px 0}
.rm .listscroll::-webkit-scrollbar{display:none}
/* correction 6 — espaceur de fin = la zone du tab bar, jamais un vide arbitraire */
/* +88 : réserve la hauteur de la pastille flottante « Carte » (vtoggle) pour
   qu'elle ne recouvre plus le texte de la dernière carte résultat. */
.rm .listscroll .pad{height:calc(var(--tabzone) + 88px)}
/* Fond sombre posé sur TOUTES les couches carte (pas seulement le conteneur
   Leaflet) : au pan/zoom et pendant le momentum WKWebView, un pane de tuiles ou
   le fond WebView (#111317, grisâtre) transparaissait entre les tuiles. Avec
   #0B0D10 sur maphost + rm-map, aucune couche ne peut virer au gris. */
.rm .maphost{position:absolute;inset:0;background:#0B0D10}
.rm .rm-map{position:absolute;inset:0;z-index:1;background:#0B0D10}
.rm .leaflet-pane,.rm .leaflet-tile-pane{background:#0B0D10}
.rm .leaflet-container{background:#0B0D10;font-family:inherit}
.rm .cs-tile-dark .leaflet-tile{filter:brightness(.88) contrast(1.18) saturate(1.05)}
/* Racine du marqueur : AUCUN transform (Leaflet y met translate3d pour la
   position — un transform CSS ici fait dériver le pin au zoom). Mobile = pins
   fixes 20px, pas de scale de sélection : rien à animer. */
.rm .pin-cible-wrap .pd{display:block;transform-origin:center}
/* sélection = anneau blanc SEUL. Aucun changement de taille : la famille de
   pins reste stricte à 20px. (Le scale(1.55) du web est une dette, pas un
   modèle — ne pas le recopier ici.) */
.rm .pin-rich{filter:drop-shadow(0 0 4px rgba(230,57,70,.9));animation:rmpulse 2.4s ease-in-out infinite}
@keyframes rmpulse{0%,100%{filter:drop-shadow(0 0 3px rgba(230,57,70,.65))}50%{filter:drop-shadow(0 0 9px rgba(230,57,70,1))}}
@media(prefers-reduced-motion:reduce){.rm .pin-rich{animation:none}}
/* ══ ATTRIBUTION ══
   Le crédit reste une OBLIGATION de licence (ODbL pour OSM, conditions CARTO) :
   le contrôle Leaflet n'est ni désactivé (attributionControl:true) ni retiré du
   DOM — il est seulement masqué VISUELLEMENT, par la technique « visually
   hidden » standard (1×1px, clip-path), donc toujours lu par un lecteur
   d'écran. Le crédit visible pour l'humain, lui, vit dans la pastille ⓘ
   ci-dessous, liens compris. Feuille scopée .rm : le web (CegepSearch) ne voit
   rien d'ici et garde son bandeau. */
.rm .cs-attr-compact .leaflet-control-attribution{position:absolute;width:1px;height:1px;
  margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
/* Zone ⓘ — même famille glass que le toggle liste/carte, coin bas-droit,
   au-dessus de --tabzone. S'efface quand la sheet monte, comme le toggle. */
.rm .attrzone{position:absolute;right:14px;z-index:46;display:flex;flex-direction:column;
  align-items:flex-end;gap:8px;transition:bottom .3s cubic-bezier(.32,.72,0,1),opacity .18s}
.rm .attrzone.hide{opacity:0;pointer-events:none}
.rm .attrbtn{width:26px;height:26px;border-radius:13px;flex:0 0 auto;
  background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--line2);display:grid;place-items:center;cursor:pointer;
  color:var(--soft);box-shadow:0 6px 18px rgba(0,0,0,.5)}
.rm .attrbtn.on{color:#fff;border-color:rgba(255,255,255,.34)}
.rm .attrbtn svg{stroke:currentColor;fill:none}
.rm .attrpill{max-width:78vw;padding:7px 11px;border-radius:13px;
  background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--line2);box-shadow:0 8px 26px rgba(0,0,0,.6);
  font-size:12px;line-height:1.5;color:var(--mut);white-space:nowrap}
.rm .attrpill a{color:var(--soft);text-decoration:underline}
/* Capteur plein écran : un tap AILLEURS replie la pastille (réflexe iOS).
   Sous la zone ⓘ (46) pour que le ⓘ lui-même reste cliquable = re-tap. */
.rm .attrcatch{position:absolute;inset:0;z-index:45}


/* ══ CARTE RÉSULTAT (partagée liste ↔ sheet) ══ */
.rm .row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);
  border-radius:16px;padding:12px;margin-bottom:9px;cursor:pointer}
.rm .row.sel{border-color:var(--red);background:rgba(230,57,70,.09)}
.rm .rowmid{flex:1;min-width:0}
.rm .rowname{font-size:16px;font-weight:700;line-height:1.2;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rm .rowmeta{font-size:13.5px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rm .rowright{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px}
.rm .heart{width:40px;height:40px;border-radius:20px;border:1px solid var(--line2);background:transparent;
  display:grid;place-items:center;cursor:pointer;color:var(--mut);flex:0 0 auto}
.rm .heart.on{border-color:rgba(230,57,70,.55);color:var(--red)}
.rm .heart:disabled{opacity:.5}
.rm .empty{text-align:center;padding:40px 20px;color:var(--mut);font-size:14px}
.rm .empty b{display:block;font-family:var(--font-anton),sans-serif;font-size:17px;color:var(--soft);
  margin-bottom:7px;text-transform:uppercase}

/* ══ TOGGLE FLOTTANT liste ↔ carte ══ */
.rm .vtoggle{position:absolute;left:50%;transform:translateX(-50%);height:42px;padding:0 18px;border-radius:21px;
  background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line2);
  display:flex;align-items:center;gap:8px;cursor:pointer;z-index:46;box-shadow:0 8px 26px rgba(0,0,0,.6);
  font-size:14px;font-weight:600;color:#fff;white-space:nowrap;
  transition:bottom .3s cubic-bezier(.32,.72,0,1),opacity .18s}
.rm .vtoggle svg{stroke:#fff}
.rm .vtoggle.hide{opacity:0;pointer-events:none}

/* ══ SHEET — correction 5 : z-index AU-DESSUS du tab bar (40) ══ */
.rm .backdrop{position:absolute;inset:0;background:rgba(0,0,0,.62);opacity:0;pointer-events:none;
  transition:opacity .22s;z-index:52}
.rm .backdrop.on{opacity:1;pointer-events:auto}
/* La sheet glisse depuis le bas et repart de même : UNE seule propriété animée,
   translateY, portée en style inline. La hauteur n'est plus animée — une
   hauteur qui apparaît au montage n'a pas d'état de départ, c'était la cause du
   surgissement. 280ms, courbe maison (cf. SHEET_MS côté TS : les deux doivent
   rester alignés, c'est ce délai qui décide du démontage). */
.rm .sheet{position:absolute;left:0;right:0;background:var(--card);border-top:1px solid var(--line2);
  border-radius:20px 20px 0 0;z-index:60;display:flex;flex-direction:column;box-shadow:0 -16px 48px rgba(0,0,0,.7);
  will-change:transform;transition:transform .28s cubic-bezier(.32,.72,0,1)}
/* à peek la sheet s'arrête AU-DESSUS du tab bar ; dès qu'elle dépasse, bottom:0 */
.rm .sheet.low{bottom:var(--tabzone)}
.rm .sheet.tall{bottom:0}
/* pendant le glissé la sheet SUIT le doigt : aucune interpolation */
.rm .sheet.dragging{transition:none}
@media(prefers-reduced-motion:reduce){.rm .sheet{transition:none}.rm .backdrop{transition:none}}
.rm .grab{flex:0 0 auto;padding:10px 0 6px;display:grid;place-items:center;cursor:grab;touch-action:none}
.rm .grab i{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.24);display:block}
/* Toute l'en-tête est la zone de drag (pas la poignée seule) → touch-action:none
   pour que la WebView ne préempte pas le geste ; cursor:grab en repli desktop. */
.rm .shHead{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:0 16px 12px;border-bottom:1px solid var(--line);touch-action:none;cursor:grab}
.rm .shHead .kick{flex:1;font-family:var(--font-bebas),sans-serif;font-size:15px;letter-spacing:.12em;color:#fff;min-width:0}
.rm .shHead .sub{font-size:13px;color:var(--mut);font-weight:500;white-space:nowrap}
.rm .txtbtn{border:0;background:transparent;font-size:13.5px;font-weight:600;cursor:pointer;padding:5px 2px;white-space:nowrap}
.rm .txtbtn.red{color:var(--red)}
.rm .txtbtn.soft{color:var(--soft)}
.rm .iconbtn{width:34px;height:34px;border-radius:17px;border:1px solid var(--line2);background:rgba(255,255,255,.05);
  display:grid;place-items:center;cursor:pointer;flex:0 0 auto;color:var(--soft)}
.rm .shBody{flex:1;overflow-y:auto;scrollbar-width:none}
.rm .shBody::-webkit-scrollbar{display:none}
/* correction 5 — le pied réserve TOUJOURS la safe-area basse */
.rm .shFoot{flex:0 0 auto;padding:11px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--line);
  background:var(--card);display:flex;flex-direction:column;gap:8px}
.rm .footnote{font-size:12.5px;color:var(--mut);text-align:center;line-height:1.45}

.rm .optwrap{padding:10px 16px 4px}
.rm .kicker2{font-family:var(--font-bebas),sans-serif;font-size:13px;letter-spacing:.15em;color:var(--mut);margin-bottom:8px}
.rm .selgroup{margin-bottom:12px}
.rm .selitem{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:6px 12px;
  background:rgba(230,57,70,.10);border:1px solid rgba(230,57,70,.34);border-radius:11px;margin-bottom:6px;
  font-size:14px;font-weight:500}
.rm .selitem button{border:0;background:transparent;cursor:pointer;width:28px;height:28px;display:grid;place-items:center;
  color:var(--soft);flex:0 0 auto}
.rm .dsearch{position:relative;margin-bottom:10px}
.rm .dsearch>svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);stroke:var(--mut);pointer-events:none}
.rm .dsearch input{width:100%;height:40px;background:rgba(255,255,255,.04);border:1px solid var(--line2);
  border-radius:10px;padding:0 34px;color:#fff;font-size:14px;outline:none;font-family:inherit}
.rm .dsearch input::placeholder{color:var(--mut)}
.rm .dsearch .clr{position:absolute;right:9px;top:50%;transform:translateY(-50%);border:0;background:transparent;
  color:var(--mut);cursor:pointer;display:grid;place-items:center}
.rm .opt{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:50px;padding:8px 0;
  border-bottom:1px solid var(--line);cursor:pointer;font-size:14.5px;font-weight:500;color:var(--soft)}
.rm .opt:last-child{border-bottom:0}
.rm .box{width:21px;height:21px;border-radius:6px;border:1.5px solid var(--line2);display:grid;place-items:center;flex:0 0 auto}
.rm .box svg{display:none;stroke:#fff}
.rm .opt.on{color:#fff}
.rm .opt.on .box{background:var(--red);border-color:var(--red)}
.rm .opt.on .box svg{display:block}
.rm .livesep{display:flex;align-items:center;gap:10px;padding:16px 16px 10px}
.rm .livesep .l{flex:1;height:1px;background:var(--line)}
.rm .livesep span:not(.l){font-family:var(--font-bebas),sans-serif;font-size:13px;letter-spacing:.13em;color:var(--green)}
.rm .rows{padding:2px 16px 18px}

.rm .btn{min-height:50px;border-radius:13px;border:1px solid transparent;font-size:15px;font-weight:600;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.rm .btn.primary{background:var(--red);color:#fff}
.rm .btn.primary.on{background:var(--green);color:#0B1F13}
.rm .btn.ghost{background:transparent;border-color:var(--line2);color:var(--soft)}
.rm .btn.ghost.on{border-color:rgba(230,57,70,.55);color:#fff}
.rm .btn.ghost.on svg{stroke:var(--red)}
.rm .btn:disabled{opacity:.55;cursor:default}
`;
