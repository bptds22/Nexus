"use client";

// components/cegep-search/CegepSearch.tsx — v3 + polish
//
// « Trouve ton cégep » — port de docs/reference/recherche-cegep-mock.html
// (sha256 c7372817…5a8421c). Trois zones + panneau : filtres en haut, liste
// minimale à gauche, carte centrée, aperçu flottant au clic.
//
// Le composant s'INSÈRE dans une coquille existante : sa hauteur est mesurée
// depuis sa propre position à l'écran (--cs-h), donc il s'adapte à la sidebar
// athlète, à la barre mobile et à une éventuelle bannière — jamais l'inverse.
//
// Moteur inchangé depuis le v1 (chargement agrégé, score/fits, ♥, géocodage).

import * as React from "react";
import dynamic from "next/dynamic";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadSearchData, type SearchData, type CegepRow } from "@/lib/queries/cegepSearch/searchData";
import { norm, regionCentroid, scoreCegep } from "@/lib/queries/cegepSearch/scoring";
import type { MapFocus } from "./MapPane";


const MapPane = dynamic(() => import("./MapPane"), { ssr: false });

const LANGUES = [{ v: "FR", label: "Français" }, { v: "EN", label: "Anglais" }, { v: "BILINGUE", label: "Bilingue" }];
const RESEAUX = [{ v: "PUBLIC", label: "Public" }, { v: "PRIVE", label: "Privé" }];

const libLangue = (l: string | null) => (l === "EN" ? "ANG" : l === "BILINGUE" ? "BIL" : l === "FR" ? "FR" : "");
const libReseau = (r: string | null) => (r === "PRIVE" ? "Privé" : r === "PUBLIC" ? "Public" : "");

const initialesDe = (nom: string) =>
  nom.replace(/^(Cégep|Collège|Campus|Centre)\s+(de\s+|du\s+|d'|des\s+)?/i, "")
    .split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase();

/* ── liste à cases d'un dropdown ──────────────────────────────────────────
   Les sélections sont ÉPINGLÉES en tête dans un groupe « Sélectionnés (n) »
   mis à jour en direct : cocher une entrée la fait apparaître aussitôt en
   haut, avec son ✕ pour la retirer sans la chercher. La liste principale, en
   dessous, reste strictement alphabétique — donc rien ne saute sous le
   curseur pendant qu'on coche. */
function ListeCases({
  items, labels, selection, onToggle,
}: {
  items: string[];
  labels?: Record<string, string>;
  selection: string[];
  onToggle: (v: string) => void;
}) {
  const lib = (v: string) => labels?.[v] ?? v;
  const ordre = React.useMemo(
    () => [...items].sort((a, b) => lib(a).localeCompare(lib(b), "fr")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, labels],
  );
  const choisis = React.useMemo(
    () => [...selection].sort((a, b) => lib(a).localeCompare(lib(b), "fr")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, labels],
  );
  return (
    <>
      {choisis.length > 0 && (
        <span className="ddsel">
          <span className="ddseltag">Sélectionnés ({choisis.length})</span>
          <span className="ddselwrap">
            {choisis.map((v) => (
              <button key={v} className="ddpill" onClick={() => onToggle(v)} title="Retirer">
                {lib(v)}<span className="x">✕</span>
              </button>
            ))}
          </span>
        </span>
      )}
      <span className="ddlist">
        {ordre.map((v) => (
          <label key={v} className={selection.includes(v) ? "coche" : ""}>
            <input type="checkbox" checked={selection.includes(v)} onChange={() => onToggle(v)} />
            {lib(v)}
          </label>
        ))}
        {!ordre.length && <span className="more">Aucun résultat.</span>}
      </span>
    </>
  );
}

function FiltreBtn({
  label, compteur, onClear, children,
}: {
  label: string;
  compteur: number;
  onClear: () => void;
  children: () => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  const hostRef = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!open) return;
    // mousedown, pas click : un listener `click` se déclencherait dans le
    // même geste que celui qui vient d'ouvrir le menu.
    const onDown = (e: MouseEvent) => {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <span ref={hostRef} className={"fbtn" + (compteur > 0 ? " on" : "") + (open ? " open" : "")}>
      <span className="lbl" onClick={() => { setOpen((o) => !o); }}>
        {label}
        {compteur > 0 && <span className="n">{compteur}</span>}
        <span className="car">▾</span>
      </span>
      {open && (
        <span className="dd">
          <span className="ddhead">
            <span className="ddtitle">{label}</span>
            {compteur > 0 && <button className="ddclear" onClick={onClear}>Effacer ({compteur})</button>}
          </span>
          {children()}
        </span>
      )}
    </span>
  );
}

export default function CegepSearch() {
  const clientRef = React.useRef<ReturnType<typeof createClient> | null>(null);
  if (!clientRef.current) clientRef.current = createClient();
  const supabase = clientRef.current;

  const rootRef = React.useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = React.useState("100dvh");

  const [data, setData] = React.useState<SearchData | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [cibles, setCibles] = React.useState<Set<string>>(new Set());
  const [busyCible, setBusyCible] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [sports, setSports] = React.useState<string[]>([]);
  const [progs, setProgs] = React.useState<string[]>([]);
  const [progQ, setProgQ] = React.useState("");
  const [regions, setRegions] = React.useState<string[]>([]);
  const [langues, setLangues] = React.useState<string[]>([]);
  const [reseaux, setReseaux] = React.useState<string[]>([]);
  const [pourMoi, setPourMoi] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState<MapFocus | null>(null);
  const [zoomNote, setZoomNote] = React.useState<string | null>(null);
  const focusToken = React.useRef(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Hauteur disponible = viewport moins tout ce qui est AU-DESSUS de nous
  // (bannière, barre mobile…). Recalculé au redimensionnement.
  React.useEffect(() => {
    const calc = () => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setHauteur(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [data]);

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

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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
        if (error && error.code !== "23505") throw error;  // déjà ciblé → idempotent
      }
    } catch {
      setCibles((prev) => { const n = new Set(prev); if (dedans) n.add(schoolId); else n.delete(schoolId); return n; });
    } finally { setBusyCible(null); }
  }, [cibles, data, busyCible, supabase]);

  const origine = React.useMemo(() => {
    if (!data) return { lat: null, lng: null };
    const r = regions[0] ?? data.viewer?.regionOrigine ?? null;
    return r ? regionCentroid(data.cegeps, r) : { lat: null, lng: null };
  }, [data, regions]);

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

  // `cible` fait partie du point : basculer un ♥ redessine le marqueur.
  const points = React.useMemo(
    () => resultats.filter((r) => r.c.lat != null && r.c.lng != null).map((r) => ({
      id: r.c.id, nom: r.c.name, lat: r.c.lat as number, lng: r.c.lng as number,
      riche: r.c.riche, cible: cibles.has(r.c.id),
    })),
    [resultats, cibles],
  );

  const viser = React.useCallback((type: MapFocus["type"], ids: string[]) => {
    focusToken.current += 1;
    setFocus({ token: focusToken.current, type, ids });
  }, []);

  React.useEffect(() => {
    if (!data) return;
    const nq = norm(q);
    if (nq.length < 3) { setZoomNote(null); return; }
    const t = window.setTimeout(() => {
      const ecoles = data.cegeps.filter((c) => norm(c.name).includes(nq));
      if (ecoles.length === 1 && ecoles[0].lat != null) {
        setSelectedId(ecoles[0].id);
        viser("fly", [ecoles[0].id]);
        setZoomNote(`« ${q.trim()} » — la carte a zoomé sur le match`);
        return;
      }
      const villes = data.cegeps.filter((c) => norm(c.city).includes(nq) && c.lat != null);
      if (villes.length) {
        viser("bounds", villes.map((c) => c.id));
        setZoomNote(`« ${q.trim()} » — ${villes.length} collège${villes.length > 1 ? "s" : ""} cadré${villes.length > 1 ? "s" : ""}`);
        return;
      }
      const prog = data.catalogueProgrammes.find((p) => norm(p).includes(nq));
      setZoomNote(prog && !progs.includes(prog) ? `↵ Entrée pour filtrer sur « ${prog} »` : null);
    }, 450);
    return () => window.clearTimeout(t);
  }, [q, data, viser, progs]);

  const onEnterRecherche = () => {
    if (!data) return;
    const nq = norm(q);
    if (nq.length < 3) return;
    const prog = data.catalogueProgrammes.find((p) => norm(p).includes(nq));
    const ecole = data.cegeps.filter((c) => norm(c.name).includes(nq));
    if (!ecole.length && prog && !progs.includes(prog)) {
      setProgs((x) => [...x, prog]);
      setQ("");
      setZoomNote(`« ${prog} » ajouté au filtre programme`);
    }
  };

  const ouvrir = React.useCallback((id: string) => {
    setSelectedId(id);
    viser("fly", [id]);
  }, [viser]);

  React.useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-school="${selectedId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  if (err) return <div className="cs" ref={rootRef}><div className="cs-load cs-err">{err}</div></div>;
  if (!data) return <div className="cs" ref={rootRef}><div className="cs-load">Chargement des cégeps…</div></div>;

  const viewer = data.viewer;
  const nbFiltres = sports.length + progs.length + regions.length + langues.length + reseaux.length;
  const selection = resultats.find((r) => r.c.id === selectedId) ?? null;
  const catalogueFiltre = data.catalogueProgrammes.filter((p) => !progQ || norm(p).includes(norm(progQ)));

  return (
    <div className="cs" ref={rootRef} style={{ ["--cs-h" as string]: hauteur }}>
      <style dangerouslySetInnerHTML={{ __html: CS_CSS }} />

      <div className="topbar">
        <div className="brand"><span className="k">SOIS LE NEX</span><b>Trouve ton cégep</b></div>

        <div className="search">
          <svg className="sico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onEnterRecherche(); }}
            placeholder="Collège, ville, programme…"
          />
          {q && <button className="clr" onClick={() => { setQ(""); setZoomNote(null); }} aria-label="Effacer la recherche">✕</button>}
        </div>

        <FiltreBtn label="Sport" compteur={sports.length} onClear={() => setSports([])}>
          {() => (
            <>
              <ListeCases items={data.sports} selection={sports} onToggle={(v) => setSports((x) => toggle(x, v))} />
              <span className="more">Toutes divisions · masculin et féminin inclus</span>
            </>
          )}
        </FiltreBtn>

        <FiltreBtn label="Programme" compteur={progs.length} onClear={() => setProgs([])}>
          {() => (
            <>
              <span className="dsearch">
                <input className="ds" value={progQ} onChange={(e) => setProgQ(e.target.value)}
                  placeholder={`${data.catalogueProgrammes.length} programmes…`} />
                {progQ && <button className="clr" onClick={() => setProgQ("")} aria-label="Effacer">✕</button>}
              </span>
              <ListeCases items={catalogueFiltre} selection={progs} onToggle={(v) => setProgs((x) => toggle(x, v))} />
            </>
          )}
        </FiltreBtn>

        <FiltreBtn label="Région" compteur={regions.length} onClear={() => setRegions([])}>
          {() => <ListeCases items={data.regions} selection={regions} onToggle={(v) => setRegions((x) => toggle(x, v))} />}
        </FiltreBtn>

        <FiltreBtn label="Langue" compteur={langues.length} onClear={() => setLangues([])}>
          {() => (
            <ListeCases items={LANGUES.map((l) => l.v)} labels={Object.fromEntries(LANGUES.map((l) => [l.v, l.label]))}
              selection={langues} onToggle={(v) => setLangues((x) => toggle(x, v))} />
          )}
        </FiltreBtn>

        <FiltreBtn label="Type" compteur={reseaux.length} onClear={() => setReseaux([])}>
          {() => (
            <ListeCases items={RESEAUX.map((r) => r.v)} labels={Object.fromEntries(RESEAUX.map((r) => [r.v, r.label]))}
              selection={reseaux} onToggle={(v) => setReseaux((x) => toggle(x, v))} />
          )}
        </FiltreBtn>

        {viewer && (
          <span className={"fbtn fire" + (pourMoi ? " on" : "")} onClick={() => setPourMoi((p) => !p)}>
            <span className="lbl">Pour moi</span>
          </span>
        )}
        {nbFiltres > 0 && (
          <button className="clear" onClick={() => { setSports([]); setProgs([]); setRegions([]); setLangues([]); setReseaux([]); }}>
            Tout effacer ({nbFiltres})
          </button>
        )}
      </div>

      <div className="main">
        <div className="list">
          <div className="count">
            <b>{resultats.length} collège{resultats.length > 1 ? "s" : ""}</b>
            {viewer ? " · fits d'abord" : " · connecte-toi pour tes fits"}
          </div>
          <div className="cards" ref={listRef}>
            {resultats.map(({ c, fit }) => {
              // Les fits ne s'affichent QUE sur demande : pill « Pour moi »
              // éteinte → liste neutre, aucun marqueur, aucune raison.
              const montreFit = pourMoi && estFit(fit);
              return (
              <div
                key={c.id} data-school={c.id}
                className={"lc" + (montreFit ? " fit" : "") + (selectedId === c.id ? " sel" : "")}
                onClick={() => ouvrir(c.id)}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className={"crest" + (c.riche ? " rich" : "")} style={c.riche && c.couleur ? { background: c.couleur } : undefined}>
                  {initialesDe(c.name)}
                </div>
                <div className="lcinfo">
                  <div className="lctitre">
                    <b>{c.name}</b>
                    {/* UN seul signal de fit dans la liste : le détail (les
                        raisons) vit dans le panneau, pas ici. */}
                    {montreFit && <span className="fitbadge">FIT</span>}
                  </div>
                  <div className="m">
                    {[c.city, libReseau(c.reseau), libLangue(c.langue)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button
                  className={"heart" + (cibles.has(c.id) ? " on" : "")}
                  disabled={!viewer}
                  title={viewer ? (cibles.has(c.id) ? "Retirer de mes cibles" : "Ajouter à mes cibles") : "Connecte-toi pour cibler"}
                  onClick={(e) => { e.stopPropagation(); toggleCible(c.id); }}
                ><Heart size={15} fill={cibles.has(c.id) ? "currentColor" : "none"} aria-hidden /></button>
              </div>
              );
            })}
            {!resultats.length && <div className="vide">Aucun collège ne correspond. Retire un filtre.</div>}
          </div>
        </div>

        <div className="maparea">
          <MapPane points={points} selectedId={selectedId} hoveredId={hoveredId} focus={focus} onSelect={ouvrir} />

          {zoomNote && <div className="zoomnote">{zoomNote}</div>}

          {selection && (
            <Apercu
              c={selection.c} fit={selection.fit} viewer={viewer}
              enDemande={data.postesEnDemande.has(selection.c.id)}
              cible={cibles.has(selection.c.id)}
              onCible={() => toggleCible(selection.c.id)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Apercu({
  c, fit, viewer, enDemande, cible, onCible, onClose,
}: {
  c: CegepRow;
  fit: { score: number; raisons: string[]; distance: number | null };
  viewer: SearchData["viewer"];
  enDemande: boolean;
  cible: boolean;
  onCible: () => void;
  onClose: () => void;
}) {
  const poste = viewer?.positionAbrev || viewer?.positionNom;
  // Accordéons fermés par défaut : le panneau reste compact et prend la
  // hauteur de son contenu, au lieu d'étirer un vide sur tout l'écran.
  const [ouvertEquipes, setOuvertEquipes] = React.useState(false);
  const [ouvertProgs, setOuvertProgs] = React.useState(false);
  React.useEffect(() => { setOuvertEquipes(false); setOuvertProgs(false); }, [c.id]);

  const equipes = React.useMemo(
    () => [...c.teams].sort((a, b) =>
      a.sport.localeCompare(b.sport, "fr") || (a.division ?? "").localeCompare(b.division ?? "", "fr")),
    [c.teams],
  );
  const programmes = React.useMemo(
    () => [...c.programmes].sort((a, b) => a.localeCompare(b, "fr")),
    [c.programmes],
  );

  return (
    <div className="preview">
      <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
      <div className="ph">
        <div className={"crest" + (c.riche ? " rich" : "")} style={c.riche && c.couleur ? { background: c.couleur } : undefined}>
          {initialesDe(c.name)}
        </div>
        <div>
          <b>{c.name}{c.nickname ? ` — ${c.nickname}` : ""}</b>
          <div className="m">{[c.city, libReseau(c.reseau),
            c.langue === "EN" ? "Anglophone" : c.langue === "FR" ? "Francophone" : c.langue === "BILINGUE" ? "Bilingue" : null,
          ].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      {fit.raisons.length > 0 && (
        <div className="psec">
          <div className="ptag">COMPATIBILITÉ</div>
          <div className="why">{fit.raisons.map((w) => <span key={w} className="wchip">{w}</span>)}</div>
        </div>
      )}

      <div className="pstat">
        <div className="ps"><div className="v">{c.sports.length}</div><div className="l">SPORTS RSEQ</div></div>
        <div className="ps"><div className="v">{c.programmes.length}</div><div className="l">PROGRAMMES</div></div>
        <div className="ps">
          {/* tilde assumé : l'origine est le barycentre de la région, pas le
              domicile de l'athlète — voir scoring.ts */}
          <div className="v">{fit.distance != null ? `~${fit.distance}` : "—"}</div>
          <div className="l">{fit.distance != null ? "KM · APPROX." : "DISTANCE N/D"}</div>
        </div>
      </div>

      {equipes.length > 0 && (
        <div className={"acc" + (ouvertEquipes ? " open" : "")}>
          <button className="acch" onClick={() => setOuvertEquipes((o) => !o)}>
            <span className="ptag">ÉQUIPES ({equipes.length})</span>
            <span className="chev">{ouvertEquipes ? "▲" : "▼"}</span>
          </button>
          {ouvertEquipes && (
            <div className="accb">
              {equipes.map((t, i) => {
                const ciblePoste = enDemande && !!poste && viewer?.sportNom === t.sport;
                return (
                  <div key={`${t.sport}-${i}`} className="trow">
                    <span className="tsport">{t.sport}</span>
                    <span className="tmeta">{[t.division, t.gender].filter(Boolean).join(" · ") || "—"}</span>
                    {ciblePoste && <span className="b need">{poste} recherché</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {programmes.length > 0 && (
        <div className={"acc" + (ouvertProgs ? " open" : "")}>
          <button className="acch" onClick={() => setOuvertProgs((o) => !o)}>
            <span className="ptag">PROGRAMMES ({programmes.length})</span>
            <span className="chev">{ouvertProgs ? "▲" : "▼"}</span>
          </button>
          {ouvertProgs && (
            <div className="accb">
              {programmes.map((p) => <div key={p} className="prow">{p}</div>)}
            </div>
          )}
        </div>
      )}

      {cible && <div className="pcible">Ce collège est dans tes cibles.</div>}

      <div className="pcta">
        {c.riche ? (
          <a className="btn page" href={`/page-test?school=${c.id}`} target="_blank" rel="noopener noreferrer">Accéder à la page →</a>
        ) : (
          <button className="btn nopage" disabled>Page à venir — cible-le.</button>
        )}
        <button className="btn target" onClick={onCible} disabled={!viewer}>
          {/* icône du système (lucide), comme sur les pages école et équipe */}
          <Heart size={16} fill={cible ? "currentColor" : "none"} aria-hidden />
          {cible ? "Dans tes cibles" : "Ajouter à mes cibles"}
        </button>
        {!viewer && <span className="note">Connecte-toi avec ton compte athlète pour cibler un collège.</span>}
      </div>
    </div>
  );
}

/* ---------------------------------------- CSS scopé (préfixe .cs) --------- */
const CS_CSS = `
/* Design system STRICT — trois familles, aucune autre :
   Outfit (corps) · Anton (titres/KPIs) · Bebas Neue (labels/kickers).
   On passe par les variables next/font du layout racine : un littéral
   'Anton' seul retombe en serif dès que la page vit dans la coquille app. */
.cs{--f-body:var(--font-outfit),'Outfit',system-ui,sans-serif;--f-title:var(--font-anton),'Anton',var(--font-outfit),sans-serif;--f-label:var(--font-bebas),'Bebas Neue',var(--font-outfit),sans-serif;
--bg:#111317;--card:#1A1D24;--card2:#20242D;--in:#171A20;--line:#2A2F3A;--line2:#3A404D;--txt:#F2F4F8;--soft:#C9CED8;--mut:#9BA3B0;--nexus:#E63946;--ok:#22C55E;
background:var(--bg);color:var(--txt);font-family:var(--f-body);height:var(--cs-h,100dvh);display:flex;flex-direction:column;overflow:hidden}
.cs *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}
.cs .cs-load{flex:1;display:flex;align-items:center;justify-content:center;color:var(--soft);font-family:var(--f-label);letter-spacing:.18em;font-size:17px}
.cs .cs-load.cs-err{color:#F59E0B}
/* ── barre du haut ── */
.cs .topbar{padding:14px 18px 12px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:relative;z-index:900;flex:0 0 auto}
.cs .brand{display:flex;flex-direction:column;margin-right:6px}
.cs .brand .k{font-family:var(--f-label);letter-spacing:.2em;font-size:10px;color:var(--nexus)}
.cs .brand b{font-family:var(--f-title);font-size:19px;text-transform:uppercase;letter-spacing:.02em;color:var(--txt);font-weight:400}
.cs .search{display:flex;align-items:center;gap:9px;background:var(--in);border:1.5px solid var(--line2);border-radius:11px;padding:10px 13px;color:var(--soft);font-size:13.5px;min-width:250px;flex:1;max-width:330px}
.cs .search .sico{color:var(--mut);flex:0 0 auto}
.cs .search input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--txt);font-size:13.5px}
.cs .search input::placeholder{color:var(--mut)}
.cs .clr{background:none;border:0;color:var(--mut);font-size:13px;cursor:pointer;padding:0 2px;line-height:1}
.cs .clr:hover{color:var(--nexus)}
.cs .fbtn{position:relative;display:inline-flex;align-items:center;font-size:13px;font-weight:700;color:var(--soft);background:var(--card);border:1.5px solid var(--line2);border-radius:11px;cursor:pointer;user-select:none}
.cs .fbtn .lbl{display:inline-flex;align-items:center;gap:7px;padding:10px 14px}
.cs .fbtn:hover{border-color:#4A5160;color:var(--txt)}
.cs .fbtn.on{border-color:var(--nexus);color:#fff;background:#2A1A1E}
.cs .fbtn .n{background:var(--nexus);color:#fff;font-size:12px;font-weight:800;min-width:20px;height:20px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.cs .fbtn .car{font-size:12px;color:var(--mut);line-height:1}
.cs .fbtn.fire{border-color:#2A6B48;color:var(--ok)}
.cs .fbtn.fire.on{border-color:var(--ok);background:#12241A;color:#fff}
.cs .dd{position:absolute;top:112%;left:0;z-index:1000;background:#20242D;border:1px solid var(--line2);border-radius:13px;padding:10px;min-width:250px;max-width:340px;box-shadow:0 18px 46px #000B;display:block;cursor:default}
.cs .ddhead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 4px 8px;border-bottom:1px solid var(--line);margin-bottom:8px}
.cs .ddtitle{font-family:var(--f-label);letter-spacing:.16em;font-size:13.5px;color:var(--soft)}
.cs .ddclear{background:none;border:0;color:var(--nexus);font-weight:700;font-size:12.5px;cursor:pointer}
/* sélections épinglées — mises à jour en direct */
.cs .ddsel{display:block;background:#1A1F28;border:1px solid var(--line2);border-radius:10px;padding:8px;margin-bottom:9px}
.cs .ddseltag{display:block;font-family:var(--f-label);letter-spacing:.14em;font-size:10.5px;color:var(--ok);margin-bottom:6px}
.cs .ddselwrap{display:flex;gap:5px;flex-wrap:wrap}
.cs .ddpill{display:inline-flex;align-items:center;gap:7px;background:#2A1A1E;border:1px solid var(--nexus);color:#fff;font-size:13px;font-weight:700;padding:6px 12px;border-radius:99px;cursor:pointer}
.cs .ddpill .x{color:#E9909A;font-size:12px}
.cs .ddpill:hover .x{color:#fff}
.cs .dsearch{display:flex;align-items:center;gap:6px;background:var(--in);border:1px solid var(--line2);border-radius:9px;padding:2px 8px;margin-bottom:8px}
.cs .dd .ds{flex:1;min-width:0;background:none;border:0;padding:7px 2px;font-size:12px;color:var(--txt);outline:none}
.cs .dd .ds::placeholder{color:var(--mut)}
.cs .dd .ddlist{display:block;max-height:250px;overflow-y:auto}
.cs .dd .ddlist::-webkit-scrollbar{width:7px}
.cs .dd .ddlist::-webkit-scrollbar-thumb{background:#4A5160;border-radius:99px}
.cs .dd label{display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:600;color:var(--soft);padding:8px 6px;border-radius:7px;cursor:pointer}
.cs .dd label:hover{background:#2A303B;color:var(--txt)}
.cs .dd label.coche{color:#fff}
.cs .dd input[type=checkbox]{accent-color:var(--nexus);width:15px;height:15px;flex:0 0 auto}
.cs .dd .more{display:block;font-size:12.5px;color:var(--mut);padding:9px 4px 2px}
.cs .clear{background:none;border:1.5px dashed var(--line2);color:var(--soft);font-weight:700;font-size:12.5px;padding:10px 13px;border-radius:11px;cursor:pointer}
.cs .clear:hover{border-color:var(--nexus);color:var(--txt)}
/* ── 3 zones ── */
.cs .main{flex:1;display:grid;grid-template-columns:340px 1fr;min-height:0}
.cs .list{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.cs .count{padding:14px 16px 10px;font-size:13.5px;color:var(--soft)}
.cs .count b{color:#fff;font-size:13.5px}
.cs .cards{flex:1;overflow-y:auto;padding:0 12px 16px;display:flex;flex-direction:column;gap:8px}
.cs .cards::-webkit-scrollbar{width:7px}
.cs .cards::-webkit-scrollbar-thumb{background:#4A5160;border-radius:99px}
.cs .lc{display:flex;align-items:center;gap:12px;background:var(--card);border:1.5px solid var(--line2);border-radius:13px;padding:12px;cursor:pointer;transition:.12s}
.cs .lc:hover{border-color:#5A616D;background:#1E222A}
.cs .lc.sel{border-color:var(--nexus);background:#221A1D}
/* le fit ne teinte plus la carte : un seul badge, discret, suffit */
.cs .lcinfo{min-width:0;flex:1}
.cs .crest{width:40px;height:40px;border-radius:10px;background:#333A47;color:#C9CED8;display:flex;align-items:center;justify-content:center;font-family:var(--f-title);font-size:15px;flex:0 0 auto}
.cs .crest.rich{color:#fff}
.cs .lctitre{display:flex;align-items:center;gap:8px;min-width:0}
.cs .lc b{font-size:16px;font-weight:700;display:block;line-height:1.25;color:var(--txt);min-width:0}
.cs .fitbadge{font-family:var(--f-label);letter-spacing:.12em;font-size:12px;line-height:1;color:#0F1A13;background:var(--ok);padding:4px 8px 3px;border-radius:6px;flex:0 0 auto}
.cs .lc .m{font-size:12.5px;color:var(--soft);margin-top:4px}


.cs .heart{margin-left:auto;width:32px;height:32px;border-radius:50%;border:1.5px solid var(--line2);background:none;color:var(--soft);cursor:pointer;flex:0 0 auto;display:flex;align-items:center;justify-content:center}
.cs .heart:hover{border-color:var(--nexus);color:var(--nexus)}
.cs .heart.on{border-color:var(--nexus);color:var(--nexus);background:#2A1A1E}
.cs .heart:disabled{opacity:.4;cursor:not-allowed}
.cs .vide{border:1.5px dashed var(--line2);border-radius:13px;padding:20px;text-align:center;font-size:12.5px;color:var(--soft)}
/* ── carte ── */
.cs .maparea{position:relative;min-height:0;background:#12151B}
.cs .mapcanvas{position:absolute;inset:0;z-index:1}
.cs .leaflet-container{background:#12151B;font-family:var(--f-body)}
/* Tuiles Dark Matter rehaussées (A/B tranché le 28 juillet) : sans ce filtre,
   routes et quartiers sont quasi invisibles ; avec, ils se lisent et le fond
   reste sombre. La classe est posée sur la couche dans MapPane. */
.cs .cs-tile-dark .leaflet-tile{filter:brightness(1.55) contrast(1.18) saturate(1.05)}
/* marqueur « dans mes cibles » : même cercle, un glyphe blanc dedans */
.cs .pin-cible-wrap{transition:transform .12s;transform-origin:center}
.cs .pin-cible-wrap.hov{transform:scale(1.25)}
.cs .pin-cible-wrap.sel{transform:scale(1.55)}
.cs .zoomnote{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:600;font-size:12px;color:var(--txt);background:#111317F0;border:1px solid var(--line2);padding:7px 15px;border-radius:99px;white-space:nowrap}
/* pins — une seule famille de cercles, trois habits */
.cs .pin-rich{filter:drop-shadow(0 0 4px rgba(230,57,70,.9));animation:cspulse 2.4s ease-in-out infinite}
.cs .pin-cible{filter:drop-shadow(0 0 5px rgba(0,0,0,.85))}
@keyframes cspulse{0%,100%{filter:drop-shadow(0 0 3px rgba(230,57,70,.65))}50%{filter:drop-shadow(0 0 9px rgba(230,57,70,1))}}
@media(prefers-reduced-motion:reduce){.cs .pin-rich{animation:none}}
/* ── panneau aperçu : hauteur AU CONTENU, scroll seulement si ça dépasse ── */
.cs .preview{position:absolute;top:14px;right:14px;width:360px;max-height:calc(100% - 28px);z-index:700;background:#171B22F7;backdrop-filter:blur(10px);border:1px solid var(--line2);border-radius:18px;padding:20px;overflow-y:auto;box-shadow:0 18px 54px #000B;display:flex;flex-direction:column;gap:15px}
.cs .preview::-webkit-scrollbar{width:7px}
.cs .preview::-webkit-scrollbar-thumb{background:#4A5160;border-radius:99px}
.cs .preview .close{position:absolute;top:13px;right:13px;width:30px;height:30px;border-radius:50%;border:1px solid var(--line2);background:#111317CC;color:var(--soft);cursor:pointer;font-size:13px}
.cs .preview .close:hover{border-color:var(--nexus);color:var(--nexus)}
.cs .ph{display:flex;align-items:center;gap:13px;padding-right:30px}
.cs .ph .crest{width:54px;height:54px;font-size:19px;border-radius:12px}
.cs .ph b{font-size:17.5px;font-weight:800;display:block;line-height:1.2;color:var(--txt)}
.cs .ph .m{font-size:12.5px;color:var(--soft);margin-top:4px}
.cs .psec{display:flex;flex-direction:column;gap:9px}
.cs .ptag{font-family:var(--f-label);letter-spacing:.18em;font-size:13.5px;color:var(--soft)}
.cs .why{display:flex;gap:6px;flex-wrap:wrap}
.cs .wchip{font-size:13px;font-weight:700;color:#8FE7B0;background:#12241A;border:1px solid #256B45;padding:6px 12px;border-radius:99px}

.cs .pstat{display:flex;gap:9px}
.cs .ps{flex:1;background:var(--card);border:1px solid var(--line2);border-radius:12px;padding:12px 8px;text-align:center}
.cs .ps .v{font-family:var(--f-title);font-size:26px;color:var(--nexus);line-height:1;font-weight:400}
/* micro-labels des KPI : Bebas très espacé se lit mal — on monte la taille et
   on resserre l'interlettrage plutôt que l'inverse. */
.cs .ps .l{font-family:var(--f-label);letter-spacing:.05em;font-size:12px;color:var(--soft);margin-top:6px}
/* accordéons */
.cs .acc{border:1px solid var(--line2);border-radius:12px;background:#1A1E26;overflow:hidden}
.cs .acc.open{border-color:#4A5160}
/* En-tête d'accordéon = élément CLIQUABLE : cible d'au moins 44 px de haut
   et libellé à 16 px — un Bebas espacé à 12 px ne se lit pas à un mètre. */
.cs .acch{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:none;border:0;padding:12px 14px;cursor:pointer;text-align:left}
.cs .acch .ptag{font-size:16px;letter-spacing:.12em;color:var(--soft)}
.cs .acch:hover .ptag{color:var(--txt)}
.cs .acch:hover{background:#20252E}
.cs .acch .chev{color:var(--mut);font-size:12px}
.cs .accb{padding:2px 13px 12px;display:flex;flex-direction:column;gap:1px}
.cs .trow{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid #23293380;font-size:14px}
.cs .tsport{color:var(--txt);font-weight:700;flex:1;min-width:0}
.cs .tmeta{color:var(--soft);font-size:13px;white-space:nowrap}
.cs .prow{padding:10px 0;border-top:1px solid #23293380;font-size:14px;color:var(--soft)}
.cs .b{font-family:var(--f-label);letter-spacing:.08em;font-size:13px;padding:4px 10px;border-radius:99px;border:1px solid var(--line2);color:var(--soft);background:#1E222A;white-space:nowrap}
.cs .b.need{color:#fff;border-color:var(--ok);background:#14301F}
.cs .pcible{font-size:13.5px;color:#8FE7B0;font-weight:600}
.cs .pcta{display:flex;flex-direction:column;gap:9px;padding-top:2px}
/* les deux CTA partagent EXACTEMENT la même graisse et la même taille : seule
   la couleur les hiérarchise. */
.cs .btn{width:100%;border-radius:12px;padding:15px;font-family:var(--f-body);font-weight:800;font-size:15px;line-height:1.2;cursor:pointer;border:1.5px solid transparent;text-align:center;text-decoration:none;display:block}
.cs .btn.page{background:var(--nexus);color:#fff}
.cs .btn.page:hover{filter:brightness(1.08)}
.cs .btn.nopage{background:none;border-color:var(--line2);color:var(--mut);cursor:default}
.cs .btn.target{background:none;border-color:var(--nexus);color:var(--nexus);display:flex;align-items:center;justify-content:center;gap:9px;font-weight:800;font-size:15px}
.cs .btn.target:hover{background:#2A1A1E}
.cs .btn:disabled{opacity:.6}
.cs .note{font-size:12.5px;color:var(--mut);line-height:1.5}
@media(max-width:1000px){.cs .main{grid-template-columns:1fr}.cs .list{border-right:0;border-bottom:1px solid var(--line);max-height:38vh}.cs .preview{left:14px;width:auto}}
`;
