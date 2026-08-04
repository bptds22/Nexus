"use client";

// components/cegep-search/RechercheMobile.tsx
//
// Jumeau MOBILE de « Trouve ton cégep » (le web vit dans CegepSearch.tsx).
// MÊME couche data, à l'identique : loadSearchData + scoreCegep. Zéro requête
// nouvelle, zéro fixture — le tableau SCHOOLS du mock v4 ne survit pas ici.
//
// Modèle d'interaction = Google Maps : deux écrans MUTUELLEMENT EXCLUSIFS
// (liste XOR carte) et UNE sheet à trois modes ('list' | 'filter' | 'preview')
// qui sert tour à tour de résultats, de panneau de filtre et d'aperçu.
//
// Zones sûres : le chrome réserve la safe-area HAUTE (le kicker ne passe jamais
// sous l'heure), la sheet et la liste réservent --tabzone en bas. --tabzone est
// dérivé du VRAI tab bar (app/_components/mobile/MobileTabBar.tsx : bulle
// flottante 64px + bottom 10px, soit la constante 88px déjà servie par
// app/athlete/layout.tsx) et vaut 0 hors Capacitor, où le tab bar ne rend PAS.

import * as React from "react";
import dynamic from "next/dynamic";
import { Heart, Search, X, Check, ChevronDown, ArrowRight, Sparkles, Info, Map as MapIcon, List } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadSearchData, type SearchData, type CegepRow } from "@/lib/queries/cegepSearch/searchData";
import { norm, regionCentroid, scoreCegep } from "@/lib/queries/cegepSearch/scoring";
import Link from "next/link";
import type { MapFocus } from "./MapPane";
import { tap } from "@/lib/haptics";
import { triggerHaptic } from "@/lib/haptics";

// Leaflet touche `window` à l'import → jamais au SSR (même garde que le web).
const MapPane = dynamic(() => import("./MapPane"), { ssr: false });

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── Helpers COPIÉS de CegepSearch.tsx (module-local là-bas, non exportés).
   Le ticket interdit de toucher au fichier web (R6) ; on duplique donc ces
   4 pures fonctions plutôt que d'y ajouter un `export`. Même convention que
   MobileTabBar, qui duplique meetsRequiredTier/LockIcon pour la même raison.
   Toute correction ici doit être reportée là-bas, et réciproquement. ── */
const LANGUES = [{ v: "FR", label: "Français" }, { v: "EN", label: "Anglais" }, { v: "BILINGUE", label: "Bilingue" }];
const RESEAUX = [{ v: "PUBLIC", label: "Public" }, { v: "PRIVE", label: "Privé" }];
const libLangue = (l: string | null) => (l === "EN" ? "ANG" : l === "BILINGUE" ? "BIL" : l === "FR" ? "FR" : "");
const libReseau = (r: string | null) => (r === "PRIVE" ? "Privé" : r === "PUBLIC" ? "Public" : "");
const initialesDe = (nom: string) =>
  nom.replace(/^(Cégep|Collège|Campus|Centre)\s+(de\s+|du\s+|d'|des\s+)?/i, "")
    .split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase();

/* ── L'ÉCUSSON — logo déposé, sinon monogramme ─────────────────────────────
   La source est décidée une seule fois, en amont (searchData.ts, logoDeLEcole) :
   UNIQUEMENT le logo que le coach a déposé. L'image RSEQ scrapée n'est pas un
   repli — 50 des 61 cégeps en ont une, et les brancher ferait apparaître 50
   logos de tiers sur des cartes qui n'en ont jamais montré. Ici on ne fait que
   RENDRE, avec le repli — le monogramme.

   `onError` n'est pas décoratif : le logo est servi par le storage Supabase,
   qui peut 404 (fichier remplacé, bucket réorganisé) ou être coupé hors réseau.
   Une image morte laisse un cadre vide ; le monogramme, lui, est exactement ce
   que la carte montrait avant. Le rendu dégrade donc toujours vers l'état
   connu, jamais vers un trou.

   Le même composant sert la carte de résultat ET l'en-tête d'aperçu de la
   sheet : `.rm .pvHead .crest` ne fait que redimensionner, la structure ne
   diverge pas. */
function Crest({ c }: { c: CegepRow }) {
  const [imageKo, setImageKo] = React.useState(false);
  // Les cartes sont recyclées d'un rendu à l'autre : sans ça, une école dont le
  // logo a échoué contaminerait la suivante qui réutilise le même nœud.
  React.useEffect(() => { setImageKo(false); }, [c.logoUrl]);

  if (c.logoUrl && !imageKo) {
    return (
      <div className="crest logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.logoUrl} alt="" onError={() => setImageKo(true)} />
      </div>
    );
  }
  return (
    <div className="crest" style={c.riche && c.couleur ? { background: c.couleur } : undefined}>
      {initialesDe(c.name)}
    </div>
  );
}

type Mode = "list" | "filter" | "preview";

/** Durée du glissement de la sheet (entrée ET sortie). Doit rester ALIGNÉE sur
 *  la transition CSS `.rm .sheet` : c'est ce délai qui décide du démontage. */
const SHEET_MS = 280;

/** Haptique légère — pattern PROUVÉ des écrans mobiles (RecruteurRechercheMobile
 *  etc.) : import dynamique + try/catch, SANS guard `isNativePlatform` (qui
 *  no-oppait en silence si false) et SANS `void` qui avalait l'erreur. Sur web,
 *  Haptics.impact no-op proprement (le catch couvre tout). */
type FKey = "sport" | "programme" | "region" | "langue" | "type";

/** Ordre des pilles imposé par le ticket : Pour moi · Sport · Programme ·
 *  Région · Langue · Type · Tout effacer. */
const FKEYS: { k: FKey; label: string }[] = [
  { k: "sport", label: "Sport" },
  { k: "programme", label: "Programme" },
  { k: "region", label: "Région" },
  { k: "langue", label: "Langue" },
  { k: "type", label: "Type" },
];

const toggleIn = (list: string[], v: string): string[] =>
  (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function RechercheMobile() {
  const supabase = React.useMemo(() => createClient(), []);
  const [data, setData] = React.useState<SearchData | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // ── filtres (mêmes états que le web, mêmes sémantiques) ──
  const [q, setQ] = React.useState("");
  const [sports, setSports] = React.useState<string[]>([]);
  const [progs, setProgs] = React.useState<string[]>([]);
  const [regions, setRegions] = React.useState<string[]>([]);
  const [langues, setLangues] = React.useState<string[]>([]);
  const [reseaux, setReseaux] = React.useState<string[]>([]);
  const [pourMoi, setPourMoi] = React.useState(false);
  const [progQ, setProgQ] = React.useState("");

  // ── cibles ──
  const [cibles, setCibles] = React.useState<Set<string>>(new Set());
  const [busyCible, setBusyCible] = React.useState<string | null>(null);

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
  const [mode, setMode] = React.useState<Mode>("list");
  const [fkey, setFkey] = React.useState<FKey | null>(null);
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [accEquipes, setAccEquipes] = React.useState(false);
  const [accProgs, setAccProgs] = React.useState(false);

  // ── mesures réelles (correction 6 : rien n'est constant) ──
  const headRef = React.useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = React.useState(0);
  const [vh, setVh] = React.useState(0);
  /* Décalage du GLISSÉ, en px vers le bas (0 = posée). Le drag déplace la sheet
     en `transform`, plus en `height` : c'est la même propriété que l'entrée et
     la sortie, donc relâcher un glissé enchaîne sans saut. */
  const [dragY, setDragY] = React.useState<number | null>(null);

  // ── carte ──
  // focus reste null : l'auto-recadrage vivait dans le FAB « localisation »
  // retiré (P2). MapPane accepte focus=null sans rien faire.
  const [focus] = React.useState<MapFocus | null>(null);
  const [resizeToken, setResizeToken] = React.useState(0);

  /* ── chargement : identique au web (données + cibles de l'athlète) ── */
  React.useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const d = await loadSearchData(supabase);
        if (annule) return;
        setData(d);
        if (d.viewer) {
          const { data: rows } = await supabase.from("athlete_targets")
            .select("school_id").eq("athlete_id", d.viewer.athleteId);
          if (!annule) setCibles(new Set(((rows ?? []) as { school_id: string }[]).map((r) => r.school_id)));
        }
      } catch (e) {
        if (!annule) setErr(e instanceof Error ? e.message : "Chargement impossible");
      }
    })();
    return () => { annule = true; };
  }, [supabase]);

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
        fin du glissement, et c'est là seulement qu'on vide mode/fkey/currentId
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
      setMode("list"); setFkey(null); setCurrentId(null);
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

  /* ── origine du calcul de distance : barycentre de région, comme le web.
     C'est ce qui rend la distance approximative — d'où le tilde partout. ── */
  const origine = React.useMemo(() => {
    if (!data) return { lat: null, lng: null };
    const r = regions[0] ?? data.viewer?.regionOrigine ?? null;
    return r ? regionCentroid(data.cegeps, r) : { lat: null, lng: null };
  }, [data, regions]);

  /* ── résultats : filtre + score + tri, copie conforme du web ── */
  const resultats = React.useMemo(() => {
    if (!data) return [];
    const nq = norm(q);
    return data.cegeps
      .filter((c) => {
        if (nq && !norm(`${c.name} ${c.city} ${c.region} ${c.programmes.join(" ")}`).includes(nq)) return false;
        if (sports.length && !sports.some((s) => c.sports.includes(s))) return false;
        if (regions.length && !regions.includes(c.region)) return false;
        if (langues.length && (!c.langue || !langues.includes(c.langue))) return false;
        if (reseaux.length && (!c.reseau || !reseaux.includes(c.reseau))) return false;
        if (progs.length) {
          const offerts = c.programmes.map(norm);
          if (!progs.some((p) => offerts.includes(norm(p)))) return false;
        }
        if (pourMoi) {
          const v = data.viewer;
          if (!v) return false;
          // Programme = ÉLIMINATOIRE : si l'athlète a déclaré des programmes et
          // qu'aucun n'est offert, le collège est exclu — on ne peut pas y
          // étudier. Poste = BONUS de TRI seulement (il pèse déjà 3 dans
          // scoreCegep → il fait remonter, il n'ouvre pas la porte à lui seul) :
          // PAS dans ce filtre. Langue/réseau : cases « ouvert à », jamais un
          // refus → pas de filtre. Distance exclue (barycentre régional).
          if (v.programmesVises.length > 0) {
            const offerts = c.programmes.map(norm);
            if (!v.programmesVises.some((p) => offerts.some((o) => o.includes(norm(p)) || norm(p).includes(o)))) return false;
          }
        }
        return true;
      })
      .map((c) => ({
        c,
        fit: scoreCegep(c, {
          viewer: data.viewer, postesEnDemande: data.postesEnDemande,
          origine, languesChoisies: langues,
        }),
      }))
      .sort((a, b) => (b.fit.score - a.fit.score) || a.c.name.localeCompare(b.c.name, "fr"));
  }, [data, q, sports, regions, langues, reseaux, progs, pourMoi, origine]);


  const points = React.useMemo(
    () => resultats.filter((r) => r.c.lat != null && r.c.lng != null).map((r) => ({
      id: r.c.id, nom: r.c.name, lat: r.c.lat as number, lng: r.c.lng as number,
      riche: r.c.riche, cible: cibles.has(r.c.id),
    })),
    [resultats, cibles],
  );

  const courant = React.useMemo(
    () => resultats.find((r) => r.c.id === currentId) ?? null,
    [resultats, currentId],
  );

  /* ── ♥ : optimiste, idempotent (23505 avalé), rollback en cas d'échec.
     Même table et même sémantique que le web → « Mes cibles » de Mon parcours
     lit exactement les mêmes lignes. ── */
  const toggleCible = React.useCallback(async (schoolId: string) => {
    const v = data?.viewer;
    if (!v || busyCible) return;
    const dedans = cibles.has(schoolId);
    void tap(); // haptique : toggle du ♥ (ajout/retrait d'une cible)
    setBusyCible(schoolId);
    setCibles((prev) => { const n = new Set(prev); if (dedans) n.delete(schoolId); else n.add(schoolId); return n; });
    try {
      if (dedans) {
        const { error } = await supabase.from("athlete_targets").delete()
          .eq("athlete_id", v.athleteId).eq("school_id", schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("athlete_targets")
          .insert({ athlete_id: v.athleteId, school_id: schoolId });
        if (error && error.code !== "23505") throw error;
      }
    } catch {
      setCibles((prev) => { const n = new Set(prev); if (dedans) n.add(schoolId); else n.delete(schoolId); return n; });
    } finally { setBusyCible(null); }
  }, [cibles, data, busyCible, supabase]);

  /* ── options de filtre : construites des valeurs RÉELLEMENT présentes.
     Aucune langue ni réseau deviné — un collège sans langue n'invente pas
     d'option et n'apparaît sous aucun filtre langue (A5). ── */
  const optionsDe = React.useCallback((k: FKey): { v: string; label: string }[] => {
    if (!data) return [];
    if (k === "sport") return data.sports.map((s) => ({ v: s, label: s }));
    if (k === "region") return data.regions.map((r) => ({ v: r, label: r }));
    if (k === "langue") {
      const presents = new Set(data.cegeps.map((c) => c.langue).filter(Boolean) as string[]);
      return LANGUES.filter((l) => presents.has(l.v));
    }
    if (k === "type") {
      const presents = new Set(data.cegeps.map((c) => c.reseau).filter(Boolean) as string[]);
      return RESEAUX.filter((r) => presents.has(r.v));
    }
    const nq = norm(progQ);
    return data.catalogueProgrammes
      .filter((p) => !nq || norm(p).includes(nq))
      .map((p) => ({ v: p, label: p }));
  }, [data, progQ]);

  const selDe = (k: FKey): string[] =>
    k === "sport" ? sports : k === "programme" ? progs : k === "region" ? regions
      : k === "langue" ? langues : reseaux;
  const setSelDe = (k: FKey, v: string) => {
    if (k === "sport") setSports((x) => toggleIn(x, v));
    else if (k === "programme") setProgs((x) => toggleIn(x, v));
    else if (k === "region") setRegions((x) => toggleIn(x, v));
    else if (k === "langue") setLangues((x) => toggleIn(x, v));
    else setReseaux((x) => toggleIn(x, v));
  };
  const clearDe = (k: FKey) => {
    if (k === "sport") setSports([]);
    else if (k === "programme") setProgs([]);
    else if (k === "region") setRegions([]);
    else if (k === "langue") setLangues([]);
    else setReseaux([]);
  };
  const clearTout = () => {
    setSports([]); setProgs([]); setRegions([]); setLangues([]); setReseaux([]); setPourMoi(false);
  };
  const nSel = sports.length + progs.length + regions.length + langues.length + reseaux.length + (pourMoi ? 1 : 0);

  /* ── UNE seule hauteur ouverte : 76% du viewport. Snaps peek/mid/full
     SUPPRIMÉS. La sheet n'existe QUE pour un filtre ou un aperçu — ouverte à
     76% ou fermée, rien entre les deux. ── */
  const OPEN_H = React.useMemo(() => Math.round((vh || 800) * 0.76), [vh]);

  /* ── navigation de la sheet ── */
  const showFilter = (k: FKey) => {
    void tap(); // haptique : ouverture du sheet filtre
    setAttrOpen(false);
    setMode("filter"); setFkey(k); setCurrentId(null);
    setProgQ("");
    setOpen(true);
  };

  const showPreview = (id: string) => {
    void tap(); // haptique : tap d'un pin OU d'une carte résultat + ouverture sheet
    setAttrOpen(false);
    setCurrentId(id); setMode("preview"); setFkey(null);
    setAccEquipes(false); setAccProgs(false);
    setOpen(true);
  };

  /* Ne vide PLUS mode/fkey/currentId ici : la sheet reste à l'écran le temps de
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
    setMode("list"); setFkey(null); setCurrentId(null); setOpen(false);
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
  const onGrabStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button, a, .heart, input")) return;
    dragRef.current = { y0: e.touches[0].clientY };
    setDragY(0);
  };
  const onGrabMove = (e: React.TouchEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.touches[0].clientY - d.y0; // > 0 si on descend
    setDragY(Math.max(0, Math.min(OPEN_H, dy)));
  };
  const onGrabEnd = () => {
    const y = dragY;
    dragRef.current = null;
    setDragY(null);
    if (y == null) return;
    if (y > OPEN_H * 0.25) closeSheet(); // glissé bas → fermeture
  };

  /* ── géométrie : tout ce qui flotte réserve --tabzone ── */
  // La sheet est à bottom:0 (jamais coupée par le tab bar) → le toggle
  // liste/carte flotte juste au-dessus du tab bar, sans offset de sheet.
  const flotteBottom = `calc(var(--tabzone) + 14px)`;

  const viewer = data?.viewer ?? null;
  // « Pour moi » n'a de sens que si l'athlète a déclaré un programme visé OU un
  // poste. Langue/réseau ne comptent pas (cases « ouvert à » : false/null = pas
  // de préférence). Sinon la pilule est désactivée avec une explication —
  // plutôt qu'un filtre qui vide l'écran sur une préférence jamais exprimée.
  const pourMoiDispo = !!viewer && (viewer.programmesVises.length > 0 || !!viewer.positionId);

  /* ── compatibilité : les raisons POSITIVES viennent de scoreCegep (source
     unique) ; les manques sont l'exact complément des mêmes prédicats. Rien
     n'est inventé — sans athlète connecté, la section n'existe pas (A7). ── */
  const compat = React.useCallback((c: CegepRow, raisons: string[]): { t: string; ok: boolean }[] => {
    if (!data?.viewer) return [];
    const v = data.viewer;
    const out: { t: string; ok: boolean }[] = raisons.map((t) => ({ t, ok: true }));
    if (!data.postesEnDemande.has(c.id)) out.push({ t: "Poste non listé", ok: false });
    if (v.programmesVises.length) {
      const offerts = c.programmes.map(norm);
      const trouve = v.programmesVises.some((p) => offerts.some((o) => o.includes(norm(p)) || norm(p).includes(o)));
      if (!trouve) out.push({ t: "Programme visé absent", ok: false });
    }
    return out;
  }, [data]);

  /* ─────────────────────────── rendu ─────────────────────────── */

  if (err) {
    return (
      <div className="rm" style={rootVars}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="rm-err">Chargement impossible — {err}</div>
      </div>
    );
  }

  // Les mêmes cartes servent à l'écran liste ET à la sheet — une seule
  // définition, donc jamais deux rendus qui divergent.
  const rows = () => (
    resultats.length === 0 ? (
      <div className="empty"><b>Aucun cégep</b>Retire un filtre ou élargis ta recherche.</div>
    ) : resultats.map(({ c }) => (
      <article
        key={c.id}
        className={"row" + (currentId === c.id ? " sel" : "")}
        onClick={() => { void triggerHaptic("Light"); showPreview(c.id); }}
      >
        <Crest c={c} />
        <div className="rowmid">
          <div className="rowname">{c.name}</div>
          <div className="rowmeta">
            {[c.city, libReseau(c.reseau), libLangue(c.langue)].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="rowright">
          {viewer && (
            <button
              className={"heart" + (cibles.has(c.id) ? " on" : "")}
              onClick={(e) => { void triggerHaptic("Light"); e.stopPropagation(); toggleCible(c.id); }}
              disabled={busyCible === c.id}
              aria-label={cibles.has(c.id) ? "Retirer de mes cibles" : "Ajouter à mes cibles"}
            >
              <Heart size={19} fill={cibles.has(c.id) ? "currentColor" : "none"} aria-hidden />
            </button>
          )}
        </div>
      </article>
    ))
  );

  const chips = (
    <div className="chips">
      {viewer && (
        <button
          className={"chip pourmoi" + (pourMoi ? " has" : "") + (pourMoiDispo ? "" : " off")}
          onClick={pourMoiDispo ? () => { void tap(); setPourMoi((p) => !p); } : undefined}
          disabled={!pourMoiDispo}
          title={pourMoiDispo ? undefined : "Ajoute un programme visé ou ton poste à ton profil pour activer Pour moi"}
        >
          {/* ALLUMÉE → coche pleine à gauche ; ÉTEINTE → Sparkles neutre.
              DÉSACTIVÉE (profil vide) → libellé qui dit pourquoi. */}
          {pourMoi ? <Check size={13} aria-hidden /> : <Sparkles size={13} aria-hidden />}
          {pourMoiDispo ? "Pour moi" : "Pour moi · profil à compléter"}
        </button>
      )}
      {FKEYS.map(({ k, label }) => {
        const n = selDe(k).length;
        const live = mode === "filter" && fkey === k;
        return (
          <button
            key={k}
            className={"chip" + (n ? " has" : "") + (live ? " live" : "")}
            onClick={() => { void triggerHaptic("Light"); (live ? closeSheet() : showFilter(k)); }}
          >
            {label}
            {n > 0 && <span className="n">{n}</span>}
            <ChevronDown size={13} aria-hidden />
          </button>
        );
      })}
      {nSel > 0 && (
        <button className="chip" onClick={clearTout}><X size={13} aria-hidden />Tout effacer</button>
      )}
    </div>
  );

  const barreRecherche = (
    <div className="searchrow">
      <Search size={17} aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Collège, ville, programme…"
      />
      {q && (
        <button className="clr" onClick={() => { void triggerHaptic("Light"); setQ(""); }} aria-label="Effacer la recherche">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );

  return (
    <div className="rm" style={rootVars}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ═══ ÉCRAN LISTE ═══ */}
      {view === "liste" && (
        <section className="screen">
          <div className="head" ref={headRef}>
            <div className="chrome solid">
              <div className="titlerow">
                <div className="kicker">SOIS LE NEX</div>
                <h1>Trouve ton cégep</h1>
              </div>
              {barreRecherche}
              {chips}
            </div>
            <div className="countline">
              <b>{resultats.length} collège{resultats.length > 1 ? "s" : ""}</b>
              {viewer ? " · fits d'abord" : " · par ordre alphabétique"}
            </div>
          </div>
          <div className="listscroll" style={{ top: headH }}>
            {data ? rows() : <div className="empty"><b>Chargement…</b>Un instant.</div>}
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
              selectedId={currentId}
              hoveredId={null}
              focus={focus}
              onSelect={(id) => showPreview(id)}
              zoomControl={false}
              attributionCompact
              resizeToken={resizeToken}
              className="rm-map"
            />
          </div>
          <div className="head" ref={headRef}>
            <div className="chrome float">
              {barreRecherche}
              {chips}
              {/* Compteur = pastille glass NON CLIQUABLE, sous les pilules
                  (au repos la carte n'a PLUS de sheet peek). */}
              <div className="mapcount" aria-live="polite">
                {resultats.length} collège{resultats.length > 1 ? "s" : ""}
                {viewer ? " · fits d'abord" : " · A → Z"}
              </div>
            </div>
          </div>

          {/* ═══ ATTRIBUTION — obligation de licence (ODbL pour OSM, conditions
                 CARTO). Elle n'est PAS supprimée : le contrôle Leaflet reste
                 dans le DOM (attributionControl:true, cf. MapPane) et n'est que
                 masqué visuellement ; le crédit reste accessible ici, replié
                 derrière un ⓘ — pattern Google Maps. Liens cliquables. ═══ */}
          {attrOpen && (
            <div className="attrcatch" onClick={() => { void triggerHaptic("Light"); setAttrOpen(false); }} />
          )}
          <div className={"attrzone" + (open ? " hide" : "")} style={{ bottom: flotteBottom }}>
            {attrOpen && (
              <div className="attrpill" role="note">
                ©{" "}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                  OpenStreetMap
                </a>{" "}
                ©{" "}
                <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
                  CARTO
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
          height: OPEN_H,
          // UNE seule propriété animée, du montage au démontage : translateY.
          // Hors écran tant que `sheetIn` est faux (état de DÉPART peint au
          // montage), posée ensuite, suivie au doigt pendant un glissé.
          transform: dragY != null
            ? `translateY(${dragY}px)`
            : (open && sheetIn ? "translateY(0)" : "translateY(100%)"),
        }}
      >
        <div
          className="grab"
          onTouchStart={onGrabStart}
          onTouchMove={onGrabMove}
          onTouchEnd={onGrabEnd}
          onTouchCancel={onGrabEnd}
        ><i /></div>

        {/* ── mode FILTRE ── */}
        {mode === "filter" && fkey && (
          <>
            <div
              className="shHead"
              onTouchStart={onGrabStart}
              onTouchMove={onGrabMove}
              onTouchEnd={onGrabEnd}
              onTouchCancel={onGrabEnd}
            >
              <span className="kick">{FKEYS.find((f) => f.k === fkey)?.label}</span>
              {selDe(fkey).length > 0 && (
                <button className="txtbtn red" onClick={() => { void triggerHaptic("Light"); clearDe(fkey); }}>
                  Effacer ({selDe(fkey).length})
                </button>
              )}
              <button className="txtbtn soft" onClick={closeSheet}>
                Terminé
              </button>
            </div>
            <div className="shBody">
              <div className="optwrap">
                {selDe(fkey).length > 0 && (
                  <div className="selgroup">
                    <div className="kicker2">Sélectionnés ({selDe(fkey).length})</div>
                    {selDe(fkey).map((v) => {
                      const o = [...LANGUES, ...RESEAUX].find((x) => x.v === v);
                      return (
                        <div key={v} className="selitem">
                          {o?.label ?? v}
                          <button onClick={() => { void triggerHaptic("Light"); setSelDe(fkey, v); }} aria-label="Retirer">
                            <X size={14} aria-hidden />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {fkey === "programme" && (
                  <div className="dsearch">
                    <Search size={15} aria-hidden />
                    <input
                      value={progQ}
                      onChange={(e) => setProgQ(e.target.value)}
                      placeholder={`${data?.catalogueProgrammes.length ?? 0} programmes…`}
                    />
                    {progQ && (
                      <button className="clr" onClick={() => { void triggerHaptic("Light"); setProgQ(""); }} aria-label="Effacer">
                        <X size={13} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
                {optionsDe(fkey).map((o) => (
                  <div
                    key={o.v}
                    className={"opt" + (selDe(fkey).includes(o.v) ? " on" : "")}
                    onClick={() => { void triggerHaptic("Light"); setSelDe(fkey, o.v); }}
                  >
                    {o.label}
                    <span className="box"><Check size={12} aria-hidden /></span>
                  </div>
                ))}
                {optionsDe(fkey).length === 0 && <div className="empty"><b>Aucune option</b>Rien à filtrer ici.</div>}
              </div>
              {/* sélection LIVE : les résultats se recomposent sous les options,
                  sans bouton « Appliquer » */}
              <div className="livesep">
                <span className="l" />
                <span>{resultats.length} résultat{resultats.length > 1 ? "s" : ""}</span>
                <span className="l" />
              </div>
              <div className="rows">{rows()}</div>
            </div>
          </>
        )}

        {/* ── mode APERÇU ── */}
        {mode === "preview" && courant && (
          <>
            <div
              className="shHead"
              onTouchStart={onGrabStart}
              onTouchMove={onGrabMove}
              onTouchEnd={onGrabEnd}
              onTouchCancel={onGrabEnd}
            >
              <button
                className="iconbtn"
                onClick={closeSheet}
                aria-label="Fermer"
              >
                <X size={15} aria-hidden />
              </button>
              <span className="kick">Aperçu</span>
              {viewer && (
                <button
                  className={"heart" + (cibles.has(courant.c.id) ? " on" : "")}
                  onClick={() => { void triggerHaptic("Light"); toggleCible(courant.c.id); }}
                  disabled={busyCible === courant.c.id}
                  aria-label={cibles.has(courant.c.id) ? "Retirer de mes cibles" : "Ajouter à mes cibles"}
                >
                  <Heart size={19} fill={cibles.has(courant.c.id) ? "currentColor" : "none"} aria-hidden />
                </button>
              )}
            </div>

            <div className="shBody">
              <div className="pvHead">
                <Crest c={courant.c} />
                <div className="pvTitle">
                  <h2>{courant.c.name}{courant.c.nickname ? ` — ${courant.c.nickname}` : ""}</h2>
                  <p>{[
                    courant.c.city,
                    libReseau(courant.c.reseau),
                    courant.c.langue === "EN" ? "Anglophone"
                      : courant.c.langue === "FR" ? "Francophone"
                        : courant.c.langue === "BILINGUE" ? "Bilingue" : null,
                  ].filter(Boolean).join(" · ")}</p>
                </div>
              </div>

              <div className="pvBody">
                {compat(courant.c, courant.fit.raisons).length > 0 && (
                  <>
                    <div className="kicker2">Compatibilité</div>
                    <div className="compat">
                      {compat(courant.c, courant.fit.raisons).map((x) => (
                        <span key={x.t} className={"cchip" + (x.ok ? " ok" : "")}>{x.t}</span>
                      ))}
                    </div>
                  </>
                )}

                <div className="kpis">
                  <div className="kpi"><b>{courant.c.sports.length}</b><span>Sports RSEQ</span></div>
                  <div className="kpi"><b>{courant.c.programmes.length}</b><span>Programmes</span></div>
                  {/* tilde assumé : l'origine est le barycentre de la RÉGION,
                      pas le domicile de l'athlète (cf. scoring.ts). */}
                  <div className="kpi">
                    <b>{courant.fit.distance != null ? `~${courant.fit.distance}` : "—"}</b>
                    <span>{courant.fit.distance != null ? "km · approx." : "distance n/d"}</span>
                  </div>
                </div>

                {courant.c.teams.length > 0 && (
                  <div className={"acc" + (accEquipes ? " open" : "")}>
                    <div className="accHead" onClick={() => { void triggerHaptic("Light"); setAccEquipes((o) => !o); }}>
                      Équipes ({courant.c.teams.length})<ChevronDown size={16} aria-hidden />
                    </div>
                    <div className="accBody">
                      {[...courant.c.teams]
                        .sort((a, b) => a.sport.localeCompare(b.sport, "fr") || (a.division ?? "").localeCompare(b.division ?? "", "fr"))
                        .map((t, i) => {
                          const poste = viewer?.positionAbrev || viewer?.positionNom;
                          const ciblePoste = data!.postesEnDemande.has(courant.c.id) && !!poste && viewer?.sportNom === t.sport;
                          return (
                            <div key={`${t.sport}-${i}`} className="line">
                              <span className="ln">{[t.sport, t.division, t.gender].filter(Boolean).join(" · ")}</span>
                              {ciblePoste ? <span className="tag">{poste} recherché</span> : <span />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {courant.c.programmes.length > 0 && (
                  <div className={"acc" + (accProgs ? " open" : "")}>
                    <div className="accHead" onClick={() => { void triggerHaptic("Light"); setAccProgs((o) => !o); }}>
                      Programmes ({courant.c.programmes.length})<ChevronDown size={16} aria-hidden />
                    </div>
                    <div className="accBody">
                      {[...courant.c.programmes].sort((a, b) => a.localeCompare(b, "fr")).map((p) => (
                        <div key={p} className="line"><span className="ln">{p}</span><span /></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── pied : A4 — au lancement AUCUN collège n'est « riche », donc
                le bouton primaire est TOUJOURS l'action possible (cibler), et
                « Page à venir » n'est jamais un bouton mort en tête. ── */}
            <div className="shFoot">
              {courant.c.riche ? (
                <>
                  {/* Route NATIVE (bundle Capacitor) → navigation INTERNE
                      (client-side), l'athlète ne quitte pas l'app. Idem web. */}
                  <Link className="btn primary" href={`/college/${courant.c.id}`}>
                    Accéder à la page <ArrowRight size={17} aria-hidden />
                  </Link>
                  <button
                    className={"btn ghost" + (cibles.has(courant.c.id) ? " on" : "")}
                    onClick={() => { void triggerHaptic("Light"); toggleCible(courant.c.id); }}
                    disabled={!viewer || busyCible === courant.c.id}
                  >
                    <Heart size={17} fill={cibles.has(courant.c.id) ? "currentColor" : "none"} aria-hidden />
                    {cibles.has(courant.c.id) ? "Dans mes cibles" : "Ajouter à mes cibles"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={"btn primary" + (cibles.has(courant.c.id) ? " on" : "")}
                    onClick={() => { void triggerHaptic("Light"); toggleCible(courant.c.id); }}
                    disabled={!viewer || busyCible === courant.c.id}
                  >
                    <Heart size={17} fill={cibles.has(courant.c.id) ? "currentColor" : "none"} aria-hidden />
                    {cibles.has(courant.c.id) ? "Dans mes cibles" : "Ajouter à mes cibles"}
                  </button>
                  <span className="footnote">Page à venir — cible-le pour être averti dès qu&apos;elle ouvre.</span>
                </>
              )}
              {!viewer && (
                <span className="footnote">Connecte-toi avec ton compte athlète pour cibler un collège.</span>
              )}
            </div>
          </>
        )}
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
  "--tabzone": IS_CAPACITOR
    ? "calc(env(safe-area-inset-bottom) + 88px)"
    : "env(safe-area-inset-bottom)",
} as React.CSSProperties;

/* ── CSS scopé `.rm` — injecté comme sur les pages école/équipe ───────────── */
const CSS = `
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
/* ÉTEINTE = identique aux autres pilules (fond carte, bordure neutre, texte
   soft, icône soft) — AUCUN vert. Pas d'override ici : la base .chip suffit.
   ALLUMÉE = fond vert translucide + bordure verte + texte ET coche blancs →
   l'état est évident au premier coup d'œil. */
.rm .chip.pourmoi.has{background:rgba(34,197,94,.16);border-color:var(--green);color:#fff}
.rm .chip.pourmoi.has svg{stroke:#fff}
/* DÉSACTIVÉE (profil sans aucun des 4 critères) : grisée, non tapable. */
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
.rm .cs-tile-dark .leaflet-tile{filter:brightness(1.55) contrast(1.18) saturate(1.05)}
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
.rm .crest{flex:0 0 auto;width:46px;height:46px;border-radius:12px;display:grid;place-items:center;
  font-family:var(--font-anton),sans-serif;font-size:15px;color:var(--soft);background:#252A33;border:1px solid var(--line2)}
/* Plaque CLAIRE sous le logo, et rien d'autre. Les écussons d'école sont des
   PNG transparents dessinés pour du papier : sur le #252A33 de la carte, les
   tracés foncés s'effacent. Le padding empêche le logo de toucher le bord. */
.rm .crest.logo{background:#F1EBDD;border-color:rgba(0,0,0,.20);padding:5px}
.rm .crest.logo img{width:100%;height:100%;object-fit:contain;display:block}
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

.rm .pvHead{display:flex;align-items:flex-start;gap:12px;padding:14px 16px 13px}
.rm .pvHead .crest{width:52px;height:52px;font-size:17px}
.rm .pvTitle{flex:1;min-width:0}
.rm .pvTitle h2{font-family:var(--font-anton),sans-serif;font-size:19px;line-height:1.12;text-transform:uppercase;margin-bottom:5px}
.rm .pvTitle p{font-size:13.5px;color:var(--mut)}
.rm .pvBody{padding:0 16px 18px}
.rm .compat{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}
.rm .cchip{padding:7px 11px;border-radius:9px;font-size:13.5px;font-weight:500;
  background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--soft)}
.rm .cchip.ok{background:rgba(34,197,94,.11);border-color:rgba(34,197,94,.32);color:#A7E9BF}
.rm .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.rm .kpi{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;padding:11px 8px;text-align:center}
.rm .kpi b{display:block;font-family:var(--font-anton),sans-serif;font-size:22px;line-height:1;margin-bottom:5px}
.rm .kpi span{font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.09em;color:var(--mut);text-transform:uppercase}
.rm .acc{border:1px solid var(--line);border-radius:12px;margin-bottom:8px;overflow:hidden;background:rgba(255,255,255,.03)}
.rm .accHead{min-height:50px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;
  cursor:pointer;font-family:var(--font-bebas),sans-serif;font-size:16px;letter-spacing:.10em;color:#fff}
.rm .accHead svg{stroke:var(--mut);flex:0 0 auto;transition:transform .2s}
.rm .acc.open .accHead svg{transform:rotate(180deg)}
.rm .accBody{display:none;padding:2px 14px 11px;border-top:1px solid var(--line)}
.rm .acc.open .accBody{display:block}
.rm .line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;font-size:14px;
  border-bottom:1px solid rgba(255,255,255,.05)}
.rm .line:last-child{border-bottom:0}
.rm .line .ln{min-width:0;overflow:hidden;text-overflow:ellipsis}
.rm .tag{font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.08em;padding:2px 7px;border-radius:5px;
  background:rgba(34,197,94,.13);border:1px solid rgba(34,197,94,.32);color:var(--green);white-space:nowrap;flex:0 0 auto}
.rm .btn{min-height:50px;border-radius:13px;border:1px solid transparent;font-size:15px;font-weight:600;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.rm .btn.primary{background:var(--red);color:#fff}
.rm .btn.primary.on{background:var(--green);color:#0B1F13}
.rm .btn.ghost{background:transparent;border-color:var(--line2);color:var(--soft)}
.rm .btn.ghost.on{border-color:rgba(230,57,70,.55);color:#fff}
.rm .btn.ghost.on svg{stroke:var(--red)}
.rm .btn:disabled{opacity:.55;cursor:default}
`;
