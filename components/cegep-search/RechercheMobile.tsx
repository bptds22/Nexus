"use client";

// components/cegep-search/RechercheMobile.tsx
//
// Jumeau MOBILE de « Trouve ton cégep » (le web vit dans CegepSearch.tsx).
// MÊME couche data, à l'identique : loadSearchData + scoreCegep. Zéro requête
// nouvelle, zéro fixture — le tableau SCHOOLS du mock v4 ne survit pas ici.
//
// La COQUILLE (liste XOR carte, sheet filtre/aperçu, glissé, zones sûres) vit
// dans components/carte-mobile/CarteMobile.tsx, partagée avec la carte des
// matchs : ce fichier ne garde que ce qui est propre aux cégeps (données,
// filtres, rangées, aperçu) et son CSS.

import * as React from "react";
import { Heart, Search, X, Check, ChevronDown, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadSearchData, equipesParSport, type SearchData, type CegepRow } from "@/lib/queries/cegepSearch/searchData";
import { norm, regionCentroid, scoreCegep } from "@/lib/queries/cegepSearch/scoring";
import Link from "next/link";
import CarteMobile, { CarteMobileMessage, useCarteMobile } from "@/components/carte-mobile/CarteMobile";
import { tap } from "@/lib/haptics";
import { triggerHaptic } from "@/lib/haptics";
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
  /** cegep_programs.id sélectionnés — la clé du filtre, jamais un libellé. */
  const [progs, setProgs] = React.useState<string[]>([]);
  const [regions, setRegions] = React.useState<string[]>([]);
  const [langues, setLangues] = React.useState<string[]>([]);
  const [reseaux, setReseaux] = React.useState<string[]>([]);
  const [pourMoi, setPourMoi] = React.useState(false);
  const [progQ, setProgQ] = React.useState("");

  // ── cibles ──
  const [cibles, setCibles] = React.useState<Set<string>>(new Set());
  const [busyCible, setBusyCible] = React.useState<string | null>(null);

  // ── écrans / sheet : la coquille partagée ──
  const etat = useCarteMobile<FKey>();
  const { mode, cle: fkey, courant: currentId, closeSheet } = etat;
  const [accEquipes, setAccEquipes] = React.useState(false);
  const [accProgs, setAccProgs] = React.useState(false);

  // ── carte ──
  // focus reste null : l'auto-recadrage vivait dans le FAB « localisation »
  // retiré (P2). MapPane accepte focus=null sans rien faire.
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
        if (progs.length && !progs.some((id) => c.programmeIds.includes(id))) return false;
        if (pourMoi) {
          const v = data.viewer;
          if (!v) return false;
          // Programme = ÉLIMINATOIRE : si l'athlète a déclaré des programmes et
          // qu'aucun n'est offert, le collège est exclu — on ne peut pas y
          // étudier. Poste = BONUS de TRI seulement (il pèse déjà 3 dans
          // scoreCegep → il fait remonter, il n'ouvre pas la porte à lui seul) :
          // PAS dans ce filtre. Langue/réseau : cases « ouvert à », jamais un
          // refus → pas de filtre. Distance exclue (barycentre régional).
          if (v.programmeIdsVises.length > 0) {
            // T2 — même bascule que scoring.ts : intersection d'ensembles.
            // Ce filtre est DUR (il exclut des cégeps) : le laisser sur le
            // matching par sous-chaîne revenait à écarter des établissements
            // sur la base d'un test qui réussissait 2 fois sur 40.
            const offerts = new Set(c.programmeIds);
            if (!v.programmeIdsVises.some((pid) => offerts.has(pid))) return false;
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
      // Le ♥ a été rempli en optimiste et vient de se vider tout seul. Sans
      // retour, l'athlète voit sa cible disparaître sans savoir pourquoi.
      void triggerHaptic("Error");
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
      .filter((p) => !nq || norm(p.nom).includes(nq))
      .map((p) => ({ v: p.id, label: p.nom }));
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

  /* ── navigation de la sheet : la coquille, plus ce que les cégeps remettent à zéro ── */
  const showFilter = (k: FKey) => {
    setProgQ("");
    etat.showFilter(k);
  };

  const showPreview = (id: string) => {
    setAccEquipes(false); setAccProgs(false);
    etat.showPreview(id);
  };

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
    if (v.programmeIdsVises.length) {
      // T2 — 4e et dernier site du matching par sous-chaîne. Les quatre
      // basculent ensemble : en corriger trois aurait laissé le badge
      // « Programme visé absent » mentir sur des cégeps que le score, lui,
      // considérait compatibles.
      const offerts = new Set(c.programmeIds);
      if (!v.programmeIdsVises.some((pid) => offerts.has(pid))) {
        out.push({ t: "Programme visé absent", ok: false });
      }
    }
    return out;
  }, [data]);

  /* ─────────────────────────── rendu ─────────────────────────── */

  if (err) {
    return <CarteMobileMessage css={CSS}>Chargement impossible — {err}</CarteMobileMessage>;
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
    <CarteMobile
      etat={etat}
      css={CSS}
      enTeteListe={
        <>
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
        </>
      }
      enTeteCarte={
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
      }
      liste={data ? rows() : <div className="empty"><b>Chargement…</b>Un instant.</div>}
      points={points}
      selectedId={currentId}
      onSelectPoint={(id) => showPreview(id)}
      feuille={
        <>
          {/* ── mode FILTRE ── */}
          {mode === "filter" && fkey && (
            <>
              <div
                className="shHead"
                {...etat.prise}
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
                        // Programme : la valeur est un cegep_programs.id → son nom.
                        const nomProg = data?.catalogueProgrammes.find((p) => p.id === v)?.nom;
                        return (
                          <div key={v} className="selitem">
                            {o?.label ?? nomProg ?? v}
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
                {...etat.prise}
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
                        {/* Une ligne par sport, divisions et genres en détail ;
                            le compteur ci-dessus reste le nombre réel d'équipes. */}
                        {equipesParSport(courant.c.teams).map((l) => {
                          const poste = viewer?.positionAbrev || viewer?.positionNom;
                          const ciblePoste = data!.postesEnDemande.has(courant.c.id) && !!poste && viewer?.sportNom === l.sport;
                          return (
                            <div key={l.sport} className="line sport">
                              <span className="ln">
                                <b>{l.sport}</b>
                                {l.details.length > 0 && <span className="det">{l.details.join(", ")}</span>}
                              </span>
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
        </>
      }
    />
  );
}

/* ── CSS propre aux cégeps, scopé `.rm` — la coquille (components/carte-mobile)
   porte le reste ; ce bloc s'ajoute après le sien. ── */
const CSS = `
/* ÉTEINTE = identique aux autres pilules (fond carte, bordure neutre, texte
   soft, icône soft) — AUCUN vert. Pas d'override ici : la base .chip suffit.
   ALLUMÉE = fond vert translucide + bordure verte + texte ET coche blancs →
   l'état est évident au premier coup d'œil. */
.rm .chip.pourmoi.has{background:rgba(34,197,94,.16);border-color:var(--green);color:#fff}
.rm .chip.pourmoi.has svg{stroke:#fff}

.rm .crest{flex:0 0 auto;width:46px;height:46px;border-radius:12px;display:grid;place-items:center;
  font-family:var(--font-anton),sans-serif;font-size:15px;color:var(--soft);background:#252A33;border:1px solid var(--line2)}
/* Plaque CLAIRE sous le logo, et rien d'autre. Les écussons d'école sont des
   PNG transparents dessinés pour du papier : sur le #252A33 de la carte, les
   tracés foncés s'effacent. Le padding empêche le logo de toucher le bord. */
.rm .crest.logo{background:#F1EBDD;border-color:rgba(0,0,0,.20);padding:5px}
.rm .crest.logo img{width:100%;height:100%;object-fit:contain;display:block}

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
.rm .line.sport{align-items:flex-start}
.rm .line.sport .ln{display:flex;flex-direction:column;gap:2px;overflow:visible}
.rm .line.sport .ln b{font-weight:700}
.rm .line.sport .det{font-size:12.5px;color:#8A909C;white-space:normal}
.rm .tag{font-family:var(--font-bebas),sans-serif;font-size:12px;letter-spacing:.08em;padding:2px 7px;border-radius:5px;
  background:rgba(34,197,94,.13);border:1px solid rgba(34,197,94,.32);color:var(--green);white-space:nowrap;flex:0 0 auto}
`;
