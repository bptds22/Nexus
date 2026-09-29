"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";

/* ═══════════════════════════════════════════════════════════════
   PartnerAthletesSearch — partner-scoped search for
   /partenaire/athletes. Reads from `top_athletes_view`, which
   already gates eligibility via is_partner_eligible_athlete()
   (verified + opt-in + age/consent + non-null cote +
   modified_since_verification = false).

   Filter palette is intentionally narrower than the recruiter
   recherche page — academic and recruiter-specific filters are
   omitted because partners can't see academic data on the
   profile page (locked behind a placeholder) and recruiter-
   specific affordances (favorites, who-viewed, ouvert_*) don't
   apply to a media-partner editorial flow.

   Visual + state-management pattern mirrors
   app/recruteur/recherche/page.tsx (local state, filtered
   client query). Tech debt logged in
   docs/post-launch-bugs.md — three near-duplicate athlete
   search implementations are now in the codebase.
═══════════════════════════════════════════════════════════════ */

type AthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  cote_globale_entraineur: number | null;
  annee_diplomation: number | null;
  region: string | null;
  sport_id: string | null;
  position_id: string | null;
  school_id: string | null;
  photo_url: string | null;
  sport_name: string | null;
  position_name: string | null;
  school_name: string | null;
  distinctions: unknown;
  /** VOIE 2 — construite depuis athlete_badges par top_athletes_view.
   *  distinctions ne porte que les 7 codes hérités : un athlète dont tous les
   *  badges sont spécifiques au sport y apparaît VIDE, et le filtre
   *  « avec badge » l'écartait donc à tort. */
  badges: unknown;
  video_faits_saillants_url: string | null;
  video_match_complet_url: string | null;
  video_entrainement_url: string | null;
  /** 'M' | 'F' | 'X' — valeur BRUTE de athletes.genre, non normalisée. */
  genre: string | null;
};

type SportOption = { id: string; nom: string };
type PositionOption = { id: string; nom: string; abreviation: string | null; sport_id: string };

interface PartnerAthletesSearchProps {
  sports: SportOption[];
  positions: PositionOption[];
  regions: string[];
  promotions: number[];
}

/* Une cote ABSENTE n'est pas une cote de zéro. Ici les cinq étoiles grises
   sont déjà le bon rendu — mais elles l'étaient par accident arithmétique
   (`?? 0` → r = 0 → aucune étoile allumée). On l'écrit, pour que le jour où
   quelqu'un touche au calcul l'intention reste lisible. Le libellé chiffré
   qui accompagne ces étoiles est traité à son point d'usage. */
function StarRow({ rating }: { rating: number | null }) {
  const r = rating == null ? 0 : Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= r ? "#F59E0B" : "#374151"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

/** Distinctions can arrive as JSON array or NULL. Returns true if non-empty array. */
function hasDistinctions(raw: unknown): boolean {
  if (!raw) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

export default function PartnerAthletesSearch({
  sports,
  positions,
  regions,
  promotions,
}: PartnerAthletesSearchProps) {
  // Filter state
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");
  const [position, setPosition] = useState("");
  const [region, setRegion] = useState("");
  const [promotion, setPromotion] = useState("");
  const [orgType, setOrgType] = useState(""); // "" | "scolaire" | "ligue_civile"
  const [genre, setGenre] = useState(""); // "" | "M" | "F" | "X"
  const [minRating, setMinRating] = useState("");
  const [withSportBadge, setWithSportBadge] = useState(false);
  const [withVideoOnly, setWithVideoOnly] = useState(false);
  const [sortBy, setSortBy] = useState("cote_desc");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Data state
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Position dropdown is sport-scoped
  const dynamicPositions = useMemo(
    () => (sport ? positions.filter((p) => p.sport_id === sport) : []),
    [sport, positions],
  );

  // Reset position when sport changes if the position no longer matches
  useEffect(() => {
    if (position && !dynamicPositions.some((p) => p.id === position)) {
      setPosition("");
    }
  }, [position, dynamicPositions]);

  // Server-side query — server-supportable filters applied here,
  // distinctions filter applied client-side after fetch.
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const supabase = createClient();

      let query = supabase.from("top_athletes_view").select("*").limit(100);

      if (search.trim().length >= 2) {
        const q = search.trim().replace(/[%,]/g, "");
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
      }
      if (sport) query = query.eq("sport_id", sport);
      if (position) query = query.eq("position_id", position);
      if (region) query = query.eq("region", region);
      if (promotion) query = query.eq("annee_diplomation", parseInt(promotion, 10));
      if (orgType === "scolaire") query = query.not("school_id", "is", null);
      if (orgType === "ligue_civile") query = query.is("school_id", null);
      if (genre) query = query.eq("genre", genre);
      if (minRating) query = query.gte("cote_globale_entraineur", parseFloat(minRating));
      if (withVideoOnly) query = query.not("video_faits_saillants_url", "is", null);

      // Server-side sort
      switch (sortBy) {
        case "cote_desc":
          query = query.order("cote_globale_entraineur", { ascending: false, nullsFirst: false });
          break;
        case "cote_asc":
          query = query.order("cote_globale_entraineur", { ascending: true, nullsFirst: false });
          break;
        case "grad_asc":
          query = query.order("annee_diplomation", { ascending: true });
          break;
        case "grad_desc":
          query = query.order("annee_diplomation", { ascending: false });
          break;
        case "name_asc":
          query = query.order("last_name", { ascending: true });
          break;
      }

      const { data, error } = await query;
      if (error) {
        console.error("[partenaire/athletes] load:", error);
        setAthletes([]);
      } else {
        setAthletes((data ?? []) as unknown as AthleteRow[]);
      }
      setLoading(false);
    };

    loadData();
  }, [
    search, sport, position, region, promotion, orgType,
    genre, minRating, withVideoOnly, sortBy,
  ]);

  // Client-side filter sur les badges (jsonb — filtre serveur
  // jsonb_array_length isn't directly exposable through PostgREST
  // without a function wrapper, so apply after fetch).
  const filtered = useMemo(() => {
    if (!withSportBadge) return athletes;
    /* VOIE 2 — on teste `badges` (issue de athlete_badges) et non plus
       `distinctions`, la colonne dérivée qui ne connaît que 7 codes. Repli sur
       distinctions pour ne pas dépendre d'un déploiement de la vue : si la
       colonne n'est pas encore servie, le filtre garde son ancien
       comportement au lieu de tout écarter. */
    return athletes.filter((a) => hasDistinctions(a.badges) || hasDistinctions(a.distinctions));
  }, [athletes, withSportBadge]);

  /* `genre` DOIT figurer ici : c'est ce test qui choisit lequel des deux états
     vides s'affiche. Sans lui, filtrer sur Féminin — qui ne rend rien en base
     aujourd'hui — tomberait dans la branche « Aucun athlète disponible pour le
     moment », un message FAUX (24 athlètes sont disponibles) et sans bouton de
     réinitialisation, laissant le partenaire coincé sur un écran vide sans
     comprendre que c'est son propre filtre qui l'a vidé. */
  const hasFilters =
    !!search || !!sport || !!position || !!region || !!promotion ||
    !!orgType || !!genre || !!minRating || withSportBadge || withVideoOnly ||
    sortBy !== "cote_desc";

  const resetFilters = () => {
    setSearch("");
    setSport("");
    setPosition("");
    setRegion("");
    setPromotion("");
    setOrgType("");
    setGenre("");
    setMinRating("");
    setWithSportBadge(false);
    setWithVideoOnly(false);
    setSortBy("cote_desc");
  };

  return (
    <div className="space-y-6">
      {/* Header — title + dynamic count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Athlètes</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">
            {filtered.length} athlète{filtered.length === 1 ? "" : "s"} disponible{filtered.length === 1 ? "" : "s"} pour publication
          </p>
        </div>
      </div>

      {/* Search bar + primary filters */}
      <div className="space-y-3">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
          />
        </div>

        {/* Primary filters — always visible */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={sport}
            onChange={(e) => { setSport(e.target.value); setPosition(""); }}
            className={`nx-filter-select${sport ? " nx-filter-active" : ""}`}
          >
            <option value="">Tous les sports</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>

          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className={`nx-filter-select${position ? " nx-filter-active" : ""}`}
            disabled={!sport}
          >
            <option value="">{sport ? "Toutes les positions" : "Sélectionner un sport d'abord"}</option>
            {dynamicPositions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom}
              </option>
            ))}
          </select>

          <select
            value={promotion}
            onChange={(e) => setPromotion(e.target.value)}
            className={`nx-filter-select${promotion ? " nx-filter-active" : ""}`}
          >
            <option value="">Toutes les promotions</option>
            {promotions.map((p) => (
              <option key={p} value={String(p)}>{p}</option>
            ))}
          </select>

          <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="nx-filter-select"
          >
            <option value="cote_desc">Trier: Meilleure cote</option>
            <option value="cote_asc">Trier: Cote croissante</option>
            <option value="grad_asc">Trier: Graduation proche</option>
            <option value="grad_desc">Trier: Graduation éloignée</option>
            <option value="name_asc">Trier: Nom A-Z</option>
          </select>

          <div className="w-px h-6 bg-[#2D3748] mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              showAdvanced
                ? "bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/30"
                : "text-[#9CA3AF] hover:text-white border border-[#2D3748]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filtres avancés
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="nx-filter-reset flex items-center gap-1.5 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
              Réinitialiser
            </button>
          )}
        </div>

        {/* Quick preset chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMinRating(minRating === "4" ? "" : "4")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              minRating === "4"
                ? "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30"
                : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={minRating === "4" ? "#F59E0B" : "none"} stroke={minRating === "4" ? "#F59E0B" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            4+ étoiles
          </button>

          <button
            type="button"
            onClick={() => setWithVideoOnly(!withVideoOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              withVideoOnly
                ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={withVideoOnly ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Avec vidéo
          </button>

          <button
            type="button"
            onClick={() => setWithSportBadge(!withSportBadge)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              withSportBadge
                ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
                : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={withSportBadge ? "#E63946" : "#6b7280"} strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
            </svg>
            Avec distinction
          </button>
        </div>

        {/* Advanced filters — collapsible */}
        {showAdvanced && (
          <div className="bg-[#13151a] border border-[#2a2d36] rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={`nx-filter-select${region ? " nx-filter-active" : ""}`}
              >
                <option value="">Toutes les régions</option>
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
                className={`nx-filter-select${orgType ? " nx-filter-active" : ""}`}
              >
                <option value="">Tous les organismes</option>
                <option value="scolaire">École secondaire</option>
                <option value="ligue_civile">Ligue civile</option>
              </select>

              {/* GENRE — `athletes.genre` est brut en base ('M' | 'F' | 'X' | NULL).
                  On normalise ICI, à l'affichage, jamais en base : la colonne est
                  écrite par quatre formulaires, et traduire côté vue créerait un
                  second vocabulaire à maintenir.
                  Un athlète sans genre SORT des résultats dès qu'un genre est choisi —
                  le champ n'est obligatoire qu'en mode « détaillé » à la création,
                  donc 12 profils sur 26 sont à NULL. Choix assumé : un partenaire qui
                  filtre fait une sélection éditoriale ; y verser des profils dont le
                  critère n'est pas établi serait pire qu'une omission. Sans filtre,
                  ils restent tous visibles.

                  ÉTAT DES DONNÉES AU 19 AOÛT 2026 : aucune ligne 'F' ni 'X' n'existe
                  en base. 26 athlètes — 14 en 'M', 12 à NULL. Les options Féminin et
                  Non genré sont câblées et fonctionnelles, mais rendront un état vide
                  tant qu'aucune athlète féminine n'est saisie. CE N'EST PAS UN BUG DU
                  FILTRE, et il ne faut pas « corriger » en dérivant la liste d'options
                  des valeurs présentes : le filtre doit rester complet pour être prêt
                  le jour où la donnée arrive, et une liste qui rétrécit avec le jeu de
                  données rend le portail imprévisible.

                  Placé dans le tiroir avancé, contrairement aux trois autres écrans
                  partenaire où il est toujours visible : ceux-là n'ont pas de découpe
                  primaire/avancé. Ici la règle de l'écran prime — région y est déjà,
                  alors qu'elle est inline sur /classements. */}
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className={`nx-filter-select${genre ? " nx-filter-active" : ""}`}
                aria-label="Genre"
              >
                <option value="">Tous les genres</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
                <option value="X">Non genré</option>
              </select>

              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className={`nx-filter-select${minRating ? " nx-filter-active" : ""}`}
              >
                <option value="">Cote min: aucune</option>
                <option value="3">Cote min: 3+</option>
                <option value="3.5">Cote min: 3.5+</option>
                <option value="4">Cote min: 4+</option>
                <option value="4.5">Cote min: 4.5+</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <p className="text-[13px] text-[#6b7280]">Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
            </svg>
          </div>
          {hasFilters ? (
            <>
              <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun athlète ne correspond à ces filtres.</p>
              <p className="text-[12px] text-[#6b7280] mt-1.5">Essayez d&apos;élargir votre recherche.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                Réinitialiser les filtres
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun athlète disponible pour le moment.</p>
              {/* Copie alignée sur is_partner_eligible_athlete() :
                  partner_visibility_opt_in ET (18 ans OU consentement
                  parental). La cote N'EST PAS une condition — l'ancienne
                  formulation l'annonçait, et envoyait le partenaire réclamer
                  des évaluations qui ne débloquent rien. Au 19 août 2026,
                  22 des 24 athlètes éligibles n'ont aucune cote et s'affichent
                  malgré tout. */}
              <p className="text-[12px] text-[#6b7280] mt-1.5">
                Les athlètes apparaissent ici une fois qu&apos;ils ont activé leur visibilité publique — et, s&apos;ils sont mineurs, obtenu le consentement d&apos;un parent.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
            return (
              <Link
                key={a.id}
                href={`/partenaire/athletes/${a.id}`}
                className="bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.10)] transition-all duration-300 overflow-hidden group flex flex-col"
              >
                <div className="relative h-[180px] bg-[#2F3440] overflow-hidden">
                  <AthletePhotoFill
                    photoUrl={a.photo_url}
                    firstName={a.first_name}
                    lastName={a.last_name}
                    initialsFontSize={72}
                    className="object-[center_15%]"
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]"
                    style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }}
                  />
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1.5">
                    <StarRow rating={a.cote_globale_entraineur} />
                    {a.cote_globale_entraineur == null ? (
                      /* Absence ≠ zéro : « 0.0 » en doré se lit comme une
                         évaluation faible sur un athlète nommé, alors qu'aucun
                         entraîneur ne s'est prononcé. Gris neutre, et on le dit. */
                      <span
                        className="text-[10px] font-semibold text-[#9CA3AF] ml-1.5 whitespace-nowrap"
                        title="Aucune évaluation d'entraîneur"
                      >
                        Non évalué
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-[#F59E0B] ml-1.5">
                        {a.cote_globale_entraineur.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1 gap-1">
                  <p className="text-[15px] font-bold text-white group-hover:text-[#E63946] transition-colors">{name}</p>
                  <p className="text-[12px] text-[#9CA3AF] truncate">
                    {[a.sport_name, a.position_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-[11px] text-[#6b7280] truncate">
                    {a.school_name || "—"}{a.region ? ` · ${a.region}` : ""}
                  </p>
                  {a.annee_diplomation && (
                    <p className="text-[11px] font-bold text-[#E63946] mt-1">Promotion {a.annee_diplomation}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
