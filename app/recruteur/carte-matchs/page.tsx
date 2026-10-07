"use client";

/* ═══════════════════════════════════════════════════════════════
   /recruteur/carte-matchs — CARTE DES MATCHS, lot A (décisions BP 2026-10-07).

   SQUELETTE FONCTIONNEL NEUTRE : l'écran final sera porté 1:1 depuis la
   maquette HTML validée par BP (étape 2). Ici, aucun habillage : la mise en
   page, les couleurs et les libellés secondaires sont PROVISOIRES.

   Tout le calcul vit dans lib/carteMatchs (pur, testé, réutilisable par le
   lot mobile) ; cette page ne fait que lire useCalendrierUnite (les cibles de
   l'UNITÉ) et rendre.

   · Pro, comme le Calendrier (FeatureGate : rien n'est demandé pour un gratuit).
   · Web seulement : sous Capacitor, renvoi vers /recruteur/calendrier.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import FeatureGate from "@/components/subscription/FeatureGate";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useCalendrierUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import { downloadIcs } from "@/lib/calendar/generateCalendarLinks";
import { useOrigineCarte } from "@/lib/carteMatchs/useOrigineCarte";
import {
  matchsDuJour, terrainsDuJour, optionsFiltres, distanceKm, libelleDistance, lienItineraire, evenementMatch,
  titreMatch, jourDecale, nomSuivi, terrainDuMatch, LIEU_NON_PRECISE, FILTRES_VIDES,
  type FiltresCarte, type MatchCarte,
} from "@/lib/carteMatchs/carteMatchs";
import type { MapFocus, MapPoint } from "@/components/cegep-search/MapPane";

const MapPane = dynamic(() => import("@/components/cegep-search/MapPane"), { ssr: false });
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function CarteMatchsPage() {
  const router = useRouter();
  useEffect(() => { if (IS_CAPACITOR) router.replace("/recruteur/calendrier"); }, [router]);
  if (IS_CAPACITOR) return null;
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <CarteMatchsContenu />
    </FeatureGate>
  );
}

function CarteMatchsContenu() {
  const { tier, loading: tierLoading } = useSubscription();
  const actif = tier !== "free" && !tierLoading;
  const { data, isLoading, isError } = useCalendrierUnite(actif);
  const { data: origine } = useOrigineCarte(actif);

  const aujourdhui = useMemo(() => jourDecale(new Date(), 0), []);
  const demain = useMemo(() => jourDecale(new Date(), 1), []);
  const [date, setDate] = useState(aujourdhui);
  const [filtres, setFiltres] = useState<FiltresCarte>(FILTRES_VIDES);
  const [sportInitialise, setSportInitialise] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // Sport par défaut = celui de l'unité (décision BP), posé une fois.
  useEffect(() => {
    if (sportInitialise || !origine) return;
    setFiltres((f) => ({ ...f, sport: origine.sportUnite ?? "" }));
    setSportInitialise(true);
  }, [origine, sportInitialise]);

  const calendrier = useMemo(() => ({ games: data?.games ?? [], targets: data?.targets ?? [] }), [data]);
  const matchs = useMemo(() => matchsDuJour(calendrier, date, filtres), [calendrier, date, filtres]);
  const terrains = useMemo(() => terrainsDuJour(matchs), [matchs]);
  const options = useMemo(() => optionsFiltres(calendrier, date, filtres.sport), [calendrier, date, filtres.sport]);
  const depuis = origine ? { lat: origine.cegepLat, lon: origine.cegepLon } : null;
  const terrainDe = (m: MatchCarte) => terrainDuMatch(m)?.id ?? null;

  const points: MapPoint[] = useMemo(
    () => terrains.map((t) => ({ id: t.id, nom: t.nom, lat: t.lat, lng: t.lon, riche: true, cible: false })),
    [terrains],
  );
  // Nouvelle journée ou nouveaux filtres : la carte cadre tous les terrains.
  useEffect(() => {
    setSelection(null);
    if (terrains.length > 0) setFocus({ token: Date.now(), type: "bounds", ids: terrains.map((t) => t.id) });
  }, [terrains]);

  const choisir = (id: string) => {
    setSelection(id);
    setFocus({ token: Date.now(), type: "fly", ids: [id] });
  };
  const terrainChoisi = terrains.find((t) => t.id === selection) ?? null;

  const changerFiltre = (cle: keyof FiltresCarte, valeur: string) =>
    setFiltres((f) => (cle === "sport" ? { ...FILTRES_VIDES, sport: valeur } : { ...f, [cle]: valeur }));

  return (
    <div className="cm p-6 space-y-4 text-[#e0e0e0]" data-testid="carte-matchs">
      {/* Fonctionnel seulement (survol / sélection visibles) — le rendu final vient de la maquette. */}
      <style>{`.cm .pin-cible-wrap .pd{display:block;transition:transform .12s;transform-origin:center}.cm .pin-cible-wrap.hov .pd{transform:scale(1.25)}.cm .pin-cible-wrap.sel .pd{transform:scale(1.55)}`}</style>
      <h1 className="font-head text-[22px] font-bold uppercase">Carte des matchs</h1>
      <p className="text-[13px] text-[#9CA3AF]">
        Les matchs de la journée où joue au moins un athlète suivi par ton unité.
      </p>

      {/* Journée */}
      <div className="flex flex-wrap items-center gap-2" data-testid="choix-journee">
        <button type="button" onClick={() => setDate(aujourdhui)} aria-pressed={date === aujourdhui}
          className={`px-3 py-1.5 rounded border ${date === aujourdhui ? "border-white" : "border-[#2D3748]"}`}>Aujourd&apos;hui</button>
        <button type="button" onClick={() => setDate(demain)} aria-pressed={date === demain}
          className={`px-3 py-1.5 rounded border ${date === demain ? "border-white" : "border-[#2D3748]"}`}>Demain</button>
        <label className="flex items-center gap-2 text-[13px]">
          <span>Date</span>
          <input type="date" value={date} min={aujourdhui} onChange={(e) => e.target.value && setDate(e.target.value)}
            data-testid="date-carte" className="bg-[#13151a] border border-[#2D3748] rounded px-2 py-1" />
        </label>
      </div>

      {/* Filtres : grisés quand une seule valeur existe, jamais cachés (décision BP). */}
      <div className="flex flex-wrap gap-2" data-testid="filtres-carte">
        <Filtre libelle="Sport" valeur={filtres.sport} valeurs={options.sports} tous="Tous les sports" onChange={(v) => changerFiltre("sport", v)} />
        <Filtre libelle="Catégorie" valeur={filtres.categorie} valeurs={options.categories} tous="Toutes les catégories" onChange={(v) => changerFiltre("categorie", v)} />
        <Filtre libelle="Division" valeur={filtres.division} valeurs={options.divisions} tous="Toutes les divisions" onChange={(v) => changerFiltre("division", v)} />
        <Filtre libelle="Ligue" valeur={filtres.ligue} valeurs={options.ligues} tous="Toutes les ligues" onChange={(v) => changerFiltre("ligue", v)} />
      </div>

      {isError && <p role="alert">Les matchs n&apos;ont pas pu être chargés.</p>}
      {isLoading && <p role="status">Chargement…</p>}

      <p className="text-[13px] text-[#9CA3AF]" data-testid="resume-journee">
        {matchs.length} match{matchs.length > 1 ? "s" : ""} · {terrains.length} terrain{terrains.length > 1 ? "s" : ""} sur la carte
        {matchs.some((m) => !m.lieuOk) ? ` · ${matchs.filter((m) => !m.lieuOk).length} au lieu non précisé` : ""}
        {origine && origine.cegepLat === null ? " · distances indisponibles (cégep sans coordonnées)" : ""}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste par heure, synchronisée avec la carte (sélection et survol). */}
        <ol className="space-y-2" data-testid="liste-matchs">
          {!isLoading && matchs.length === 0 && (
            <li className="text-[13px] text-[#9CA3AF]" data-testid="aucun-match">Aucun match d&apos;un athlète suivi ce jour-là.</li>
          )}
          {matchs.map((m) => {
            const tid = terrainDe(m);
            return (
              <li key={m.game.id} data-testid="ligne-match"
                onMouseEnter={() => setSurvol(tid)} onMouseLeave={() => setSurvol(null)}
                className={`border rounded p-3 ${tid && tid === selection ? "border-white" : "border-[#2D3748]"}`}>
                <button type="button" disabled={!tid} onClick={() => tid && choisir(tid)} className="w-full text-left disabled:cursor-default">
                  <LigneMatch m={m} depuis={depuis} />
                </button>
              </li>
            );
          })}
        </ol>

        <div className="space-y-4">
          <div className="relative h-[420px] rounded overflow-hidden border border-[#2D3748]" data-testid="carte">
            <MapPane points={points} selectedId={selection} hoveredId={survol} focus={focus} onSelect={choisir} className="absolute inset-0" />
          </div>

          {/* Détail du terrain sélectionné. */}
          {terrainChoisi && (
            <section className="border border-[#2D3748] rounded p-3 space-y-3" data-testid="detail-terrain">
              <h2 className="font-bold">{terrainChoisi.nom}</h2>
              {libelleDistance(distanceKm(depuis, terrainChoisi)) && (
                <p className="text-[13px]">{libelleDistance(distanceKm(depuis, terrainChoisi))} de {origine?.cegepNom ?? "ton cégep"} (à vol d&apos;oiseau)</p>
              )}
              {terrainChoisi.matchs.map((m) => (
                <div key={m.game.id} className="border-t border-[#2D3748] pt-2 space-y-1">
                  <LigneMatch m={m} depuis={depuis} />
                  <ActionsMatch m={m} />
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Filtre({ libelle, valeur, valeurs, tous, onChange }: {
  libelle: string; valeur: string; valeurs: string[]; tous: string; onChange: (v: string) => void;
}) {
  // Une seule valeur (ou aucune) : présent mais grisé.
  const unique = valeurs.length <= 1;
  return (
    <label className={`flex items-center gap-1 text-[13px] ${unique ? "opacity-50" : ""}`}>
      <span>{libelle}</span>
      <select value={valeur} disabled={unique && !valeur} onChange={(e) => onChange(e.target.value)} aria-label={libelle}
        className="bg-[#13151a] border border-[#2D3748] rounded px-2 py-1">
        <option value="">{tous}</option>
        {valeurs.map((v) => <option key={v} value={v}>{v}</option>)}
        {valeur && !valeurs.includes(valeur) && <option value={valeur}>{valeur}</option>}
      </select>
    </label>
  );
}

function LigneMatch({ m, depuis }: { m: MatchCarte; depuis: { lat: number | null; lon: number | null } | null }) {
  const g = m.game;
  const suivis = [...m.suivisDomicile, ...m.suivisVisiteur];
  const km = m.lieuOk ? libelleDistance(distanceKm(depuis, { lat: g.venueLat, lon: g.venueLon })) : null;
  return (
    <div className="text-[13px] space-y-0.5">
      <p><b>{g.gameTime || "Heure non précisée"}</b> · {titreMatch(g)}</p>
      <p className="text-[#9CA3AF]">{g.competition}</p>
      <p className="text-[#9CA3AF]" data-testid="lieu-match">{m.lieuOk ? g.venue || LIEU_NON_PRECISE : LIEU_NON_PRECISE}{km ? ` · ${km}` : ""}</p>
      <p data-testid="suivis-match">
        Suivis : {suivis.map((t) => `${nomSuivi(t)}${t.prospect ? " (prospect)" : ""}`).join(", ")}
      </p>
    </div>
  );
}

function ActionsMatch({ m }: { m: MatchCarte }) {
  const e = evenementMatch(m.game);
  return (
    <div className="flex flex-wrap gap-3 text-[13px]" data-testid="actions-match">
      {m.lieuOk && (
        <a href={lienItineraire(m.game.venueLat!, m.game.venueLon!)} target="_blank" rel="noopener noreferrer" className="underline">Itinéraire</a>
      )}
      {e ? (
        <>
          <span>Ajouter à mon agenda :</span>
          <a href={e.googleUrl} target="_blank" rel="noopener noreferrer" className="underline">Google</a>
          <a href={e.outlookUrl} target="_blank" rel="noopener noreferrer" className="underline">Outlook</a>
          <button type="button" className="underline" onClick={() => downloadIcs(e.icsBlob, `match-${m.game.gameDate}.ics`)}>.ics</button>
        </>
      ) : (
        <span className="text-[#9CA3AF]">Ajout à l&apos;agenda indisponible : heure non précisée</span>
      )}
    </div>
  );
}
