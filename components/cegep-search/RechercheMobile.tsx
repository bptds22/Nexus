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
import { Heart, Search, X, Check, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Sparkles, Map as MapIcon, List, Crosshair } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadSearchData, type SearchData, type CegepRow } from "@/lib/queries/cegepSearch/searchData";
import { norm, regionCentroid, scoreCegep } from "@/lib/queries/cegepSearch/scoring";
import type { MapFocus } from "./MapPane";

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

type Snap = "peek" | "mid" | "full";
type Mode = "list" | "filter" | "preview";
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
  const [mode, setMode] = React.useState<Mode>("list");
  const [snap, setSnap] = React.useState<Snap>("peek");
  const [fkey, setFkey] = React.useState<FKey | null>(null);
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  const [accEquipes, setAccEquipes] = React.useState(false);
  const [accProgs, setAccProgs] = React.useState(false);

  // ── mesures réelles (correction 6 : rien n'est constant) ──
  const headRef = React.useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = React.useState(0);
  const [vh, setVh] = React.useState(0);
  const [dragH, setDragH] = React.useState<number | null>(null);

  // ── carte ──
  const [focus, setFocus] = React.useState<MapFocus | null>(null);
  const focusToken = React.useRef(0);
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

  /* ── correction 5 : la sheet passe AU-DESSUS du tab bar, et dès qu'elle
     dépasse peek le tab bar s'efface. On ne touche pas MobileTabBar (portalé
     sur document.body) : on marque le body et une règle scopée l'escamote. ── */
  const tall = open && snap !== "peek";
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
          const posteOk = data.postesEnDemande.has(c.id);
          const offerts = c.programmes.map(norm);
          const progOk = v.programmesVises.some((p) => offerts.some((o) => o.includes(norm(p)) || norm(p).includes(o)));
          if (!posteOk && !progOk) return false;
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

  const estFit = (f: { score: number; raisons: string[] }) => f.score > 0 && f.raisons.length > 0;

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

  const viser = React.useCallback((type: MapFocus["type"], ids: string[]) => {
    focusToken.current += 1;
    setFocus({ token: focusToken.current, type, ids });
  }, []);

  /* ── ♥ : optimiste, idempotent (23505 avalé), rollback en cas d'échec.
     Même table et même sémantique que le web → « Mes cibles » de Mon parcours
     lit exactement les mêmes lignes. ── */
  const toggleCible = React.useCallback(async (schoolId: string) => {
    const v = data?.viewer;
    if (!v || busyCible) return;
    const dedans = cibles.has(schoolId);
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

  /* ── snaps : dérivés du viewport réel (peek 96 · mid 54% · full 88%) ── */
  const SNAPS = React.useMemo(() => ({
    peek: 96,
    mid: Math.round((vh || 800) * 0.54),
    full: Math.round((vh || 800) * 0.88),
  }), [vh]);

  /* ── navigation de la sheet ── */
  const showList = React.useCallback(() => {
    setMode("list"); setFkey(null); setCurrentId(null);
    setOpen(view === "carte");
    setSnap("peek");
  }, [view]);

  const showFilter = (k: FKey) => {
    setMode("filter"); setFkey(k); setCurrentId(null);
    setProgQ("");
    setOpen(true);
    setSnap((s) => (s === "peek" ? "mid" : s));
  };

  const showPreview = (id: string) => {
    setCurrentId(id); setMode("preview"); setFkey(null);
    setAccEquipes(false); setAccProgs(false);
    setOpen(true); setSnap("mid");
  };

  const closeSheet = React.useCallback(() => {
    setMode("list"); setFkey(null); setCurrentId(null); setSnap("peek");
    setOpen(false);
  }, []);

  /* ── bascule liste ↔ carte : jamais les deux montés (correction 3) ── */
  const basculer = () => {
    const next = view === "liste" ? "carte" : "liste";
    setView(next);
    if (next === "carte") {
      setMode("list"); setFkey(null); setCurrentId(null);
      setSnap("peek"); setOpen(true);
      // Leaflet a mesuré 0×0 tant que l'écran était masqué → re-mesure.
      setResizeToken((t) => t + 1);
    } else {
      closeSheet();
    }
  };

  // Toute variation de la géométrie de la sheet change la taille utile de la
  // carte : on redemande un invalidateSize.
  React.useEffect(() => {
    if (view === "carte") setResizeToken((t) => t + 1);
  }, [view, snap, open]);

  /* ── poignée draggable, snap au plus proche ── */
  const dragRef = React.useRef<{ y0: number; h0: number } | null>(null);
  const onGrabDown = (e: React.PointerEvent) => {
    dragRef.current = { y0: e.clientY, h0: SNAPS[snap] };
    setDragH(SNAPS[snap]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGrabMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setDragH(Math.min(SNAPS.full, Math.max(SNAPS.peek, d.h0 + (d.y0 - e.clientY))));
  };
  const onGrabUp = () => {
    const h = dragH;
    dragRef.current = null;
    setDragH(null);
    if (h == null) return;
    // En vue liste la sheet n'a pas d'état « peek » : elle est ouverte ou fermée.
    const pool: Snap[] = view === "liste" ? ["mid", "full"] : ["peek", "mid", "full"];
    setSnap(pool.reduce((a, b) => (Math.abs(SNAPS[b] - h) < Math.abs(SNAPS[a] - h) ? b : a)));
  };

  /* ── géométrie : tout ce qui flotte réserve --tabzone ── */
  const sheetH = dragH ?? (open ? SNAPS[snap] : 0);
  const base = open ? sheetH + (tall ? 0 : 0) : 0; // la sheet est déjà décalée de --tabzone via `bottom`
  const flotteBottom = `calc(var(--tabzone) + ${base}px + 14px)`;

  const viewer = data?.viewer ?? null;

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
    ) : resultats.map(({ c, fit }) => (
      <article
        key={c.id}
        className={"row" + (currentId === c.id ? " sel" : "")}
        onClick={() => showPreview(c.id)}
      >
        <div className="crest" style={c.riche && c.couleur ? { background: c.couleur } : undefined}>
          {initialesDe(c.name)}
        </div>
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
              onClick={(e) => { e.stopPropagation(); toggleCible(c.id); }}
              disabled={busyCible === c.id}
              aria-label={cibles.has(c.id) ? "Retirer de mes cibles" : "Ajouter à mes cibles"}
            >
              <Heart size={19} fill={cibles.has(c.id) ? "currentColor" : "none"} aria-hidden />
            </button>
          )}
          {viewer && estFit(fit) && <span className="fit">FIT</span>}
        </div>
      </article>
    ))
  );

  const chips = (
    <div className="chips">
      {viewer && (
        <button
          className={"chip pourmoi" + (pourMoi ? " has" : "")}
          onClick={() => setPourMoi((p) => !p)}
        >
          <Sparkles size={13} aria-hidden />Pour moi
        </button>
      )}
      {FKEYS.map(({ k, label }) => {
        const n = selDe(k).length;
        const live = mode === "filter" && fkey === k;
        return (
          <button
            key={k}
            className={"chip" + (n ? " has" : "") + (live ? " live" : "")}
            onClick={() => (live ? (view === "carte" ? showList() : closeSheet()) : showFilter(k))}
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
        <button className="clr" onClick={() => setQ("")} aria-label="Effacer la recherche">
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
            </div>
          </div>
          <button
            className="fab"
            style={{ bottom: `calc(var(--tabzone) + ${base}px + 70px)` }}
            onClick={() => { if (points.length) viser("bounds", points.map((p) => p.id)); }}
            aria-label="Recadrer la carte"
          >
            <Crosshair size={20} aria-hidden />
          </button>
        </section>
      )}

      {/* ═══ TOGGLE LISTE ↔ CARTE ═══ */}
      <button
        className={"vtoggle" + (view === "carte" && (!open || snap !== "peek") ? " hide" : "")}
        style={{ bottom: flotteBottom }}
        onClick={basculer}
      >
        {view === "liste" ? <MapIcon size={16} aria-hidden /> : <List size={16} aria-hidden />}
        <span>{view === "liste" ? "Carte" : "Liste"}</span>
      </button>

      {/* ═══ BACKDROP (vue liste seulement) ═══ */}
      <div
        className={"backdrop" + (view === "liste" && open ? " on" : "")}
        onClick={closeSheet}
      />

      {/* ═══ SHEET ═══ */}
      <div
        className={"sheet" + (open ? "" : " hidden") + (tall ? " tall" : " low") + (dragH != null ? " dragging" : "")}
        style={{ height: sheetH || SNAPS.peek }}
      >
        <div
          className="grab"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        ><i /></div>

        {/* ── mode LISTE ── */}
        {mode === "list" && (
          <>
            <div className="shHead" onClick={() => setSnap(snap === "peek" ? "mid" : "peek")}>
              <span className="kick">{resultats.length} collège{resultats.length > 1 ? "s" : ""}</span>
              <span className="sub">{pourMoi ? "Pour moi" : viewer ? "fits d'abord" : "A → Z"}</span>
              <span className="iconbtn">
                {snap === "peek" ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
              </span>
            </div>
            <div className="shBody"><div className="rows">{rows()}</div></div>
          </>
        )}

        {/* ── mode FILTRE ── */}
        {mode === "filter" && fkey && (
          <>
            <div
              className="shHead"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest(".txtbtn")) return;
                setSnap(snap === "full" ? "mid" : "full");
              }}
            >
              <span className="kick">{FKEYS.find((f) => f.k === fkey)?.label}</span>
              {selDe(fkey).length > 0 && (
                <button className="txtbtn red" onClick={() => clearDe(fkey)}>
                  Effacer ({selDe(fkey).length})
                </button>
              )}
              <button className="txtbtn soft" onClick={() => (view === "carte" ? showList() : closeSheet())}>
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
                          <button onClick={() => setSelDe(fkey, v)} aria-label="Retirer">
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
                      <button className="clr" onClick={() => setProgQ("")} aria-label="Effacer">
                        <X size={13} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
                {optionsDe(fkey).map((o) => (
                  <div
                    key={o.v}
                    className={"opt" + (selDe(fkey).includes(o.v) ? " on" : "")}
                    onClick={() => setSelDe(fkey, o.v)}
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
              onClick={(e) => {
                if ((e.target as HTMLElement).closest(".iconbtn, .heart")) return;
                setSnap(snap === "full" ? "mid" : "full");
              }}
            >
              <button
                className="iconbtn"
                onClick={() => (view === "carte" ? showList() : closeSheet())}
                aria-label={view === "carte" ? "Retour aux résultats" : "Fermer"}
              >
                {view === "carte" ? <ArrowLeft size={15} aria-hidden /> : <X size={15} aria-hidden />}
              </button>
              <span className="kick">{view === "carte" ? "Retour aux résultats" : "Aperçu"}</span>
              {viewer && (
                <button
                  className={"heart" + (cibles.has(courant.c.id) ? " on" : "")}
                  onClick={() => toggleCible(courant.c.id)}
                  disabled={busyCible === courant.c.id}
                  aria-label={cibles.has(courant.c.id) ? "Retirer de mes cibles" : "Ajouter à mes cibles"}
                >
                  <Heart size={19} fill={cibles.has(courant.c.id) ? "currentColor" : "none"} aria-hidden />
                </button>
              )}
            </div>

            <div className="shBody">
              <div className="pvHead">
                <div className="crest" style={courant.c.riche && courant.c.couleur ? { background: courant.c.couleur } : undefined}>
                  {initialesDe(courant.c.name)}
                </div>
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
                    <div className="accHead" onClick={() => { setAccEquipes((o) => !o); if (snap !== "full") setSnap("full"); }}>
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
                    <div className="accHead" onClick={() => { setAccProgs((o) => !o); if (snap !== "full") setSnap("full"); }}>
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
                  <a className="btn primary" href={`/page-test?school=${courant.c.id}`} target="_blank" rel="noopener noreferrer">
                    Accéder à la page <ArrowRight size={17} aria-hidden />
                  </a>
                  <button
                    className={"btn ghost" + (cibles.has(courant.c.id) ? " on" : "")}
                    onClick={() => toggleCible(courant.c.id)}
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
                    onClick={() => toggleCible(courant.c.id)}
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
.rm .float .chip{background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-color:var(--line2);box-shadow:0 4px 14px rgba(0,0,0,.45)}
.rm .chip svg{stroke:var(--mut);flex:0 0 auto;transition:transform .2s}
.rm .chip .n{min-width:18px;height:18px;padding:0 5px;border-radius:5px;background:var(--red);color:#fff;
  font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.04em;display:grid;place-items:center}
.rm .chip.has{border-color:rgba(230,57,70,.6);color:#fff}
.rm .chip.live{background:rgba(230,57,70,.18);border-color:var(--red);color:#fff}
.rm .chip.live svg{transform:rotate(180deg);stroke:#fff}
.rm .chip.pourmoi{border-color:rgba(34,197,94,.45);color:#8FE3AC}
.rm .chip.pourmoi svg{stroke:var(--green)}
.rm .chip.pourmoi.has{background:rgba(34,197,94,.16);border-color:var(--green);color:#fff}

.rm .countline{background:var(--bg);border-bottom:1px solid var(--line);border-top:1px solid var(--line);
  padding:11px 16px;font-size:14px;color:var(--mut)}
.rm .countline b{color:#fff;font-weight:700}

/* ══ ÉCRANS — liste XOR carte (correction 3 : jamais les deux montés) ══ */
.rm .screen{position:absolute;inset:0}
.rm .listscroll{position:absolute;left:0;right:0;bottom:0;overflow-y:auto;scrollbar-width:none;padding:10px 16px 0}
.rm .listscroll::-webkit-scrollbar{display:none}
/* correction 6 — espaceur de fin = la zone du tab bar, jamais un vide arbitraire */
.rm .listscroll .pad{height:calc(var(--tabzone) + 56px)}
.rm .maphost{position:absolute;inset:0}
.rm .rm-map{position:absolute;inset:0;z-index:1}
.rm .leaflet-container{background:#12151B;font-family:inherit}
.rm .cs-tile-dark .leaflet-tile{filter:brightness(1.55) contrast(1.18) saturate(1.05)}
.rm .pin-cible-wrap{transition:transform .12s;transform-origin:center}
/* sélection = anneau blanc SEUL. Aucun changement de taille : la famille de
   pins reste stricte à 20px. (Le scale(1.55) du web est une dette, pas un
   modèle — ne pas le recopier ici.) */
.rm .pin-cible-wrap.sel{transform:scale(1)}
.rm .pin-rich{filter:drop-shadow(0 0 4px rgba(230,57,70,.9));animation:rmpulse 2.4s ease-in-out infinite}
@keyframes rmpulse{0%,100%{filter:drop-shadow(0 0 3px rgba(230,57,70,.65))}50%{filter:drop-shadow(0 0 9px rgba(230,57,70,1))}}
@media(prefers-reduced-motion:reduce){.rm .pin-rich{animation:none}}
/* correction 7 — attribution en encart compact, qui remonte avec la sheet */
.rm .cs-attr-compact .leaflet-control-attribution{background:rgba(17,19,23,.75);color:var(--mut);
  font-size:12px;border-radius:6px 0 0 0;padding:2px 6px}
.rm .cs-attr-compact .leaflet-bottom.leaflet-right{bottom:calc(var(--tabzone) - 8px);
  transition:bottom .3s cubic-bezier(.32,.72,0,1)}

.rm .fab{position:absolute;right:14px;width:44px;height:44px;border-radius:22px;background:var(--glass);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line2);
  display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.5);z-index:38;color:var(--soft);
  transition:bottom .3s cubic-bezier(.32,.72,0,1)}

/* ══ CARTE RÉSULTAT (partagée liste ↔ sheet) ══ */
.rm .row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);
  border-radius:16px;padding:12px;margin-bottom:9px;cursor:pointer}
.rm .row.sel{border-color:var(--red);background:rgba(230,57,70,.09)}
.rm .crest{flex:0 0 auto;width:46px;height:46px;border-radius:12px;display:grid;place-items:center;
  font-family:var(--font-anton),sans-serif;font-size:15px;color:var(--soft);background:#252A33;border:1px solid var(--line2)}
.rm .rowmid{flex:1;min-width:0}
.rm .rowname{font-size:16px;font-weight:700;line-height:1.2;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rm .rowmeta{font-size:13.5px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rm .rowright{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px}
.rm .heart{width:40px;height:40px;border-radius:20px;border:1px solid var(--line2);background:transparent;
  display:grid;place-items:center;cursor:pointer;color:var(--mut);flex:0 0 auto}
.rm .heart.on{border-color:rgba(230,57,70,.55);color:var(--red)}
.rm .heart:disabled{opacity:.5}
.rm .fit{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;
  background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.32);
  font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.08em;color:var(--green)}
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
.rm .sheet{position:absolute;left:0;right:0;background:var(--card);border-top:1px solid var(--line2);
  border-radius:20px 20px 0 0;z-index:60;display:flex;flex-direction:column;box-shadow:0 -16px 48px rgba(0,0,0,.7);
  transition:height .3s cubic-bezier(.32,.72,0,1),bottom .3s cubic-bezier(.32,.72,0,1),transform .3s cubic-bezier(.32,.72,0,1)}
/* à peek la sheet s'arrête AU-DESSUS du tab bar ; dès qu'elle dépasse, bottom:0 */
.rm .sheet.low{bottom:var(--tabzone)}
.rm .sheet.tall{bottom:0}
.rm .sheet.hidden{transform:translateY(115%)}
.rm .sheet.dragging{transition:none}
.rm .grab{flex:0 0 auto;padding:10px 0 6px;display:grid;place-items:center;cursor:grab;touch-action:none}
.rm .grab i{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.24);display:block}
.rm .shHead{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:0 16px 12px;border-bottom:1px solid var(--line)}
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
