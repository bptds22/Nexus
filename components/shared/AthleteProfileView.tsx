"use client";

/* ═══════════════════════════════════════════════════════════════
   Shared athlete profile view — single source of truth for the
   recruiter-style athlete page. Used by the admin aperçu drawer,
   and (eventually) by the recruiter and coach profile pages.

   - Accepts an athleteId; fetches its own data from Supabase.
   - No recruiter/coach/admin-specific actions — those are wrapped
     by the caller.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import type { AthleteProfileRecruiterView, AthleteTraitRatings, GlobalRecruitmentStatus } from "@/lib/types/models";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import { parseDistinctions, type DistinctionEntry } from "@/lib/config/badges";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import StarRating from "@/components/ui/StarRating";
import VideoEmbed from "@/components/ui/VideoEmbed";
import NxIcon from "@/components/ui/NxIcon";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";

/* ── constants ─────────────────────────────────────────────────── */

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";
const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";
const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

const TRAIT_LIST: { key: keyof AthleteTraitRatings; label: string }[] = [
  { key: "leadership", label: "Leadership" },
  { key: "discipline", label: "Discipline" },
  { key: "coachability", label: "Coachabilité" },
  { key: "gameIQ", label: "Intelligence de jeu" },
  { key: "competitiveness", label: "Compétitivité" },
  { key: "teamwork", label: "Esprit d'équipe" },
  { key: "resilience", label: "Résilience" },
  { key: "attitude", label: "Attitude / Mentalité" },
];

/* ── inline helpers ────────────────────────────────────────────── */

function ProfileToggle({ mode, onChange }: { mode: "simple" | "detailed"; onChange: (m: "simple" | "detailed") => void }) {
  const pill = (active: boolean) =>
    `px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all cursor-pointer ${
      active ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]" : "text-[#6b7280] hover:text-white"
    }`;
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5 w-fit">
      <button type="button" onClick={() => onChange("simple")} className={pill(mode === "simple")}>Simplifié</button>
      <button type="button" onClick={() => onChange("detailed")} className={pill(mode === "detailed")}>Détaillé</button>
    </div>
  );
}

function CompletenessBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? "#3B82F6" : percent >= 60 ? "#22C55E" : percent >= 40 ? "#EAB308" : "#EF4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#2D3748] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{percent}%</span>
    </div>
  );
}

function PreferencePill({ active, label }: { active?: boolean; label: string }) {
  if (active === undefined) return null;
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#22C55E" : "#6B7280" }} />
      {label}
    </span>
  );
}

function positionAbbr(pos: string): string {
  const match = pos.match(/\(([^)]+)\)/);
  if (match) return match[1].toUpperCase();
  return pos.length > 4 ? pos.slice(0, 3).toUpperCase() : pos.toUpperCase();
}

function InfoRow({ label, value, icon }: { label: string; value?: string | number | null; icon?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <span className="text-[13px] text-[#9CA3AF] flex items-center gap-2">
        {icon && <NxIcon name={icon} size={14} className="text-[#6B7280]" />}
        {label}
      </span>
      <span className="text-[14px] font-bold text-white">{value}</span>
    </div>
  );
}

const PlayerCard = AthletePlayerCard;

/* ── component ─────────────────────────────────────────────────── */

export interface AthleteProfileViewProps {
  athleteId: string;
  /** Extra slot rendered under the hero (used by wrappers to inject actions). */
  headerSlot?: React.ReactNode;
  /** Extra slot appended after the profile body. */
  footerSlot?: React.ReactNode;
  /** Hide the views/favoris/statut chips row (e.g. for screenshots). */
  hideEngagement?: boolean;
}

export default function AthleteProfileView({ athleteId, headerSlot, footerSlot, hideEngagement = false }: AthleteProfileViewProps) {
  const [a, setA] = useState<AthleteProfileRecruiterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const [dbDistinctions, setDbDistinctions] = useState<DistinctionEntry[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [globalRecruit, setGlobalRecruit] = useState<string>("OUVERT");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      console.log("[AthleteProfileView] loading athleteId:", athleteId);
      try {
        const { data: raw, error } = await loadAthleteRaw(athleteId);
        if (error) console.error("[AthleteProfileView] loadAthleteRaw error:", error);
        if (!raw || cancelled) { setLoading(false); return; }
        const rawRec = raw as Record<string, unknown>;
        console.log("[AthleteProfileView] raw:", rawRec);
        const mapped = mapToRecruiterView(rawRec);
        console.log("[AthleteProfileView] mapped:", mapped);
        setA(mapped);

        const evals = rawRec.evaluations;
        const evalArr = Array.isArray(evals) ? evals : [];
        const e0 = evalArr[0] as Record<string, unknown> | undefined;
        if (e0?.distinctions) {
          let d: unknown = e0.distinctions;
          if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = []; } }
          setDbDistinctions(parseDistinctions(d));
        }

        const overrideVal = rawRec.statut_recrutement_override as string | null;
        setGlobalRecruit(overrideVal || "OUVERT");

        const supabase = createClient();
        const [{ count: vc }, { count: fc }] = await Promise.all([
          supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).eq("athlete_id", athleteId),
          supabase.from("recruiter_favorites").select("*", { count: "exact", head: true }).eq("athlete_id", athleteId),
        ]);
        if (cancelled) return;
        setViewCount(vc || 0);
        setFavoriteCount(fc || 0);
        console.log("[AthleteProfileView] engagement:", { vc, fc });
      } catch (err) {
        console.error("[AthleteProfileView] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [athleteId]);

  if (loading || !a) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 text-center text-[#6b7280]">
        Chargement du profil...
      </div>
    );
  }

  const isDetailed = mode === "detailed";
  const coteGlobale = a.overallRating || 0;
  const age = (() => {
    if (!a.dateOfBirth) return 0;
    const d = new Date(a.dateOfBirth);
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    let x = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) x--;
    return x;
  })();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 text-[#E0E0E0]" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
      {/* Toggle + Completeness */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <ProfileToggle mode={mode} onChange={setMode} />
        <div className="w-full sm:w-56">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1">Profil complété</p>
          <CompletenessBar percent={a.profileCompleteness || 0} />
        </div>
      </div>

      {headerSlot}

      {/* HERO */}
      <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
        <div className="shrink-0 flex justify-center lg:justify-start">
          <PlayerCard a={a} />
        </div>
        <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
          <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
            {a.firstName}<br />{a.lastName}
            {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
          </h1>

          {!hideEngagement && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                <span className="text-[16px] font-bold text-white">{viewCount}</span>
                <span className="text-[11px] text-[#6b7280]">vues</span>
              </div>
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                <span className="text-[16px] font-bold text-white">{favoriteCount}</span>
                <span className="text-[11px] text-[#6b7280]">favoris</span>
              </div>
              <div className="bg-[#111317] rounded-lg px-4 py-2">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Statut recrutement</span>
                <RecruitmentStatusBadge status={globalRecruit as GlobalRecruitmentStatus} size="sm" />
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-6">Profil athlète</h3>
            <div className="flex items-center gap-12 mb-8">
              {a.heightDisplay && (
                <div className="text-center">
                  <p className="text-[40px] font-head font-[800] text-white leading-none">{a.heightDisplay}</p>
                  <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mt-1.5">Taille</p>
                </div>
              )}
              {a.heightDisplay && a.weightDisplay && <div className="w-px h-12 bg-[#555]" />}
              {a.weightDisplay && (
                <div className="text-center">
                  <p className="text-[40px] font-head font-[800] text-white leading-none">
                    {a.weightDisplay.replace(" lbs", "")}<span className="text-[20px] font-semibold text-[#555]"> lbs</span>
                  </p>
                  <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mt-1.5">Poids</p>
                </div>
              )}
            </div>
            {dbDistinctions.length > 0 && (
              <div className="flex items-start gap-9 flex-wrap">
                {dbDistinctions.map((d, i) => (
                  <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} size="lg" />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* COACH REPORT */}
      {(a.coachReport || coteGlobale > 0) && (
        <section>
          <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
          <div className={`relative ${cardBase} p-6 sm:p-8 pl-8 sm:pl-10 overflow-hidden`}>
            {a.coachReport && (
              <>
                <span className="absolute top-3 left-3 text-[60px] font-serif text-[#E63946]/10 leading-none select-none">&ldquo;</span>
                <div className="relative">
                  <p className="text-[18px] sm:text-[20px] text-white italic leading-relaxed pl-5" style={{ borderLeft: "3px solid #E63946" }}>
                    &ldquo;{a.coachReport}&rdquo;
                  </p>
                  <p className="text-[14px] font-bold text-[#9CA3AF] mt-4 pl-5">-- {a.coachName}{a.coachSchool ? `, ${a.coachSchool}` : ""}</p>
                </div>
              </>
            )}
            <div className={a.coachReport ? "mt-3" : ""}>
              {!isDetailed && coteGlobale > 0 && (
                <div className="mt-3 pl-5 flex items-center gap-3">
                  <StarRating rating={coteGlobale} size="md" showNumber={false} />
                  <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                  <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                </div>
              )}
              {isDetailed && (
                <div className="mt-5 pl-5">
                  {coteGlobale > 0 && (
                    <div className="flex items-center gap-3 mb-4">
                      <StarRating rating={coteGlobale} size="md" showNumber={false} />
                      <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                      <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                    </div>
                  )}
                  {a.traitRatings && (
                    <div className="border-t border-[#2D3748]/50 pt-4">
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Détail par trait</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        {TRAIT_LIST.map((trait) => {
                          const val = a.traitRatings ? a.traitRatings[trait.key] : 0;
                          return (
                            <div key={trait.key} className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/30">
                              <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                              {val > 0 ? <StarRating rating={val} size="sm" /> : <span className="text-[13px] text-[#4a4d56]">—</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {dbDistinctions.length > 0 && (
                    <div className="border-t border-[#2D3748]/50 pt-4 mt-4">
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Distinctions</p>
                      <div className="flex flex-wrap gap-3">
                        {dbDistinctions.map((d, i) => (
                          <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} size="sm" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* FAITS SAILLANTS */}
      <section>
        <h2 className={sectionLabel}>Faits saillants</h2>
        {a.highlightVideoUrl || a.fullGameUrl || a.practiceVideoUrl ? (
          <div className="flex flex-col gap-4">
            {a.highlightVideoUrl && <VideoEmbed url={a.highlightVideoUrl} title="Faits saillants" />}
            {a.fullGameUrl && (
              <div>
                <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-3">Match complet</p>
                <VideoEmbed url={a.fullGameUrl} title="Match complet" />
              </div>
            )}
            {a.practiceVideoUrl && (
              <div>
                <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-3">Entraînement</p>
                <VideoEmbed url={a.practiceVideoUrl} title="Entraînement" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[#555]">Aucune vidéo ajoutée</p>
        )}
      </section>

      {/* PROFIL ACADÉMIQUE */}
      <section>
        <h2 className={sectionLabel}>Profil académique</h2>
        <div className={`${cardBase} overflow-hidden`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50">
            <div className="p-5 text-center">
              <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
            </div>
            <div className="p-5 text-center">
              {(() => {
                let display = "—";
                if (a.program && typeof a.program === "string" && a.program.length > 0) {
                  display = a.program;
                } else {
                  let arr: unknown = a.targetCegepProgram;
                  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = []; } }
                  if (Array.isArray(arr) && arr.length > 0) display = arr.join(", ");
                }
                return <p className="text-[18px] font-bold text-white leading-none mt-1">{display}</p>;
              })()}
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme visé</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-[18px] font-bold text-white leading-none mt-1">Juin {a.graduationYear}</p>
              <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
            </div>
          </div>
          <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
            <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
            <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
            <PreferencePill active={a.openToAnglophone} label="Ouvert anglophone" />
          </div>
        </div>
      </section>

      {/* DETAILED-ONLY */}
      {isDetailed && (
        <div className="space-y-6">
          <section>
            <h2 className={sectionLabel}>Informations personnelles</h2>
            <div className={`${cardBase} p-5`}>
              <InfoRow label="Âge" value={age > 0 ? `${age} ans` : "—"} icon="calendar" />
              <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
              <InfoRow label="Ville" value={a.city} icon="mapPin" />
              <InfoRow label="Région" value={a.region} icon="map" />
              <InfoRow label="École" value={a.schoolName} icon="building" />
              <InfoRow label="Graduation" value={a.graduationYear} icon="gradCap" />
            </div>
          </section>

          <section>
            <h2 className={sectionLabel}>Mesures physiques</h2>
            <div className={`${cardBase} overflow-hidden`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-[#2D3748]/40">
                {[
                  { label: "Taille", value: a.heightDisplay || "—" },
                  { label: "Poids", value: a.weightDisplay || "—" },
                  { label: "Envergure", value: a.wingspan || "—" },
                  { label: "Taille mains", value: a.handSize || "—" },
                  { label: "Main dom.", value: a.dominantHand || "—" },
                  { label: "Pied dom.", value: a.dominantFoot || "—" },
                ].map((m) => (
                  <div key={m.label} className="p-4 text-center">
                    <p className={`text-[20px] font-head font-black leading-none ${m.value === "—" ? "text-[#4a4d56]" : "text-white"}`}>{m.value}</p>
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {(() => {
            const tests = [
              { label: "40 verges", value: a.fortyYard },
              { label: "Saut vertical", value: a.verticalJump },
              { label: "Saut en longueur", value: a.broadJump },
              { label: "Développé couché", value: a.benchPress },
              { label: "Navette agilité", value: a.shuttleAgility },
              { label: "Sprint 100m", value: a.sprint100m },
            ];
            if (!tests.some((t) => t.value)) return null;
            return (
              <section>
                <h2 className={sectionLabel}>Tests athlétiques</h2>
                <div className={`${cardBase} overflow-hidden`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-[#2D3748]/40">
                    {tests.map((t) => (
                      <div key={t.label} className="p-4 text-center">
                        <p className={`text-[20px] font-head font-black leading-none ${t.value ? "text-white" : "text-[#4a4d56]"}`}>{t.value || "—"}</p>
                        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{t.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })()}

          {a.primarySport && (
            <section>
              <h2 className={sectionLabel}>Informations sportives</h2>
              <div className={`${cardBase} p-5`}>
                <InfoRow label="Sport principal" value={a.primarySport} icon="activity" />
                <InfoRow label="Position" value={a.primaryPosition} icon="target" />
                <InfoRow label="Numéro" value={a.jerseyNumber ? `#${a.jerseyNumber}` : undefined} icon="hash" />
                {a.secondarySport && <InfoRow label="Sport secondaire" value={a.secondarySport} icon="activity" />}
                {a.secondaryPosition && <InfoRow label="Position secondaire" value={a.secondaryPosition} icon="target" />}
                {a.teamName && <InfoRow label="Équipe" value={a.teamName} icon="flag" />}
                {a.leagueName && <InfoRow label="Ligue" value={a.leagueName} icon="trophy" />}
                {a.teamLevel && <InfoRow label="Niveau" value={a.teamLevel} icon="layers" />}
              </div>
            </section>
          )}

          {(a.strongSubjects?.length > 0 || a.academicHonors?.length > 0 || a.preferredRegions?.length > 0 || (Array.isArray(a.targetCegepProgram) && a.targetCegepProgram.length > 0)) && (
            <section>
              <h2 className={sectionLabel}>Détails académiques</h2>
              <div className={`${cardBase} p-5 space-y-4`}>
                {(() => {
                  let prog: unknown = a.targetCegepProgram;
                  if (typeof prog === "string") { try { prog = JSON.parse(prog); } catch { prog = []; } }
                  if (Array.isArray(prog) && prog.length > 0) {
                    return (
                      <div>
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Programme CÉGEP visé</p>
                        <div className="flex flex-wrap gap-2">
                          {(prog as string[]).map((p: string) => (
                            <span key={p} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">{p}</span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {a.strongSubjects?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Matières fortes</p>
                    <div className="flex flex-wrap gap-2">
                      {a.strongSubjects.map((s) => (
                        <span key={s} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-white border border-[#2D3748]">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {a.academicHonors?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Mentions académiques</p>
                    <div className="flex flex-wrap gap-2">
                      {a.academicHonors.map((h) => (
                        <span key={h} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">{h}</span>
                      ))}
                    </div>
                  </div>
                )}
                {a.preferredRegions?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Régions CÉGEP préférées</p>
                    <div className="flex flex-wrap gap-2">
                      {a.preferredRegions.map((r) => (
                        <span key={r} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-[#c8c8cc] border border-[#2D3748]">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {(a.highlightVideoUrl || a.hudlUrl || a.youtubeUrl || a.instagramUrl || a.fullGameUrl || a.practiceVideoUrl) && (
            <section>
              <h2 className={sectionLabel}>Médias &amp; liens</h2>
              <div className={`${cardBase} p-5`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { url: a.highlightVideoUrl, label: "Faits saillants", color: "#E63946" },
                    { url: a.hudlUrl, label: "Hudl", color: "#F59E0B" },
                    { url: a.youtubeUrl, label: "YouTube", color: "#EF4444" },
                    { url: a.instagramUrl, label: "Instagram", color: "#E63946" },
                    { url: a.fullGameUrl, label: "Match complet", color: "#6B7280" },
                    { url: a.practiceVideoUrl, label: "Entraînement", color: "#6B7280" },
                  ].filter(m => m.url).map((m) => (
                    <a key={m.label} href={m.url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-[#111317] border border-white/5 hover:border-[#E63946]/30 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      <span className="text-[13px] text-[#9CA3AF]">{m.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {a.coachName && (
            <section>
              <h2 className={sectionLabel}>Réputation du coach</h2>
              <div className={`${cardBase} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[14px] text-[#9CA3AF]">{a.coachName}</p>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#6B7280]/15 text-[#6B7280] border border-[#6B7280]/30">À venir</span>
                </div>
                <p className="text-[13px] text-[#4a4d56] italic">
                  La réputation du coach sera calculée automatiquement lorsque les recruteurs commenceront à évaluer les coachs sur la plateforme.
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {footerSlot}
    </div>
  );
}
