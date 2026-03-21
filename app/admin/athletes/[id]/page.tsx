"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import {
  ALL_RECRUITER_PROFILES,
  mockAthleteProfileFull,
} from "@/lib/mock/athleteProfileRecruiter";
import { ADMIN_ATHLETES } from "@/lib/mock/admin";
import type { AthleteProfileRecruiterView, AthleteTraitRatings } from "@/lib/types/models";
import { SPORT_NAME_MAP, getBadgesForSport } from "@/lib/config/sportBadges";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";

/* ═══════════════════════════════════════════════════════════════
   Admin Athlete Detail — Full profile view + admin controls
   Same profile as recruiter view + admin action bar on top
═══════════════════════════════════════════════════════════════ */

type AthleteStatus = "draft" | "pending_approval" | "approved" | "rejected" | "archived";

const POSITIONS_BY_SPORT: Record<string, string[]> = {
  Football: ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P", "DE", "DT"],
  Hockey: ["C", "LW", "RW", "D", "G"],
  Basketball: ["PG", "SG", "SF", "PF", "C"],
  Soccer: ["GK", "CB", "LB", "RB", "MF", "CM", "ST", "LW", "RW"],
  Volleyball: ["Passeur", "Attaquant", "Central", "Libéro", "Opposé"],
  Natation: ["Sprint", "Fond", "Dos", "Brasse", "Papillon", "QNI"],
  Athlétisme: ["Sprint", "Demi-fond", "Fond", "Saut", "Lancer", "Haies", "Multi"],
  Badminton: ["Simple", "Double"],
  "Cross-country": ["Coureur"],
  Rugby: ["Pilier", "Talonneur", "Deuxième ligne", "Ailier", "Centre", "Demi", "Arrière"],
};

const SCHOOL_NAMES: string[] = [
  "Saint-Jean-Eudes", "De Mortagne", "De Rochebelle", "Roger-Comtois", "Mont-Royal",
  "Le Sommet", "Louis-Riel", "Académie les Estacades", "Armand-Corbeil", "L'Odyssée",
  "Curé-Antoine-Labelle", "Saint-Joseph", "Thérèse-Martin", "Le Tremplin", "Pierre-Laporte",
  "Mont-Saint-Sacrement", "les Etchemins", "de la Seigneurie", "Joseph-François-Perrault",
  "Charles-Gravel", "de la Baie", "Polyvalente Deux-Montagnes", "Séminaire de Sherbrooke",
];

const STATUS_OPTIONS: { value: AthleteStatus; label: string; color: string }[] = [
  { value: "draft", label: "Brouillon", color: "#6B7280" },
  { value: "pending_approval", label: "En attente", color: "#EAB308" },
  { value: "approved", label: "Approuvé", color: "#22C55E" },
  { value: "rejected", label: "Rejeté", color: "#E63946" },
  { value: "archived", label: "Archivé", color: "#4B5563" },
];

/* ── Toast ────────────────────────────────────────────────────── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-[fadeInUp_0.3s_ease-out]">
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 shadow-lg flex items-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-bold text-white">{message}</span>
        <button type="button" onClick={onDone} className="text-[#6b7280] hover:text-white ml-2" aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Modal ────────────────────────────────────────────── */

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="font-head text-[16px] font-black text-white uppercase tracking-tight">{title}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 mt-5">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={onConfirm} className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors">Confirmer</button>
        </div>
      </div>
    </div>
  );
}

/* ── Completeness Color ───────────────────────────────────────── */

function completenessColor(pct: number): string {
  if (pct < 40) return "#EF4444";
  if (pct < 70) return "#6B7280";
  return "#3B82F6";
}

/* ── Position Abbreviation ────────────────────────────────────── */

const POS_MAP: Record<string, string> = {
  "Quart-arrière": "QB", "Porteur de ballon": "RB", "Receveur éloigné": "WR",
  "Ailier rapproché": "TE", "Joueur de ligne offensive": "OL", "Secondeur": "LB",
  "Demi de coin": "CB", "Demi de sûreté": "S", "Ailier défensif": "DE",
  "Plaqueur défensif": "DT", "Joueur de ligne défensive": "DL", "Botteur": "K",
};

function posAbbr(pos: string) { return POS_MAP[pos] || pos; }

/* ── Trait Labels ─────────────────────────────────────────────── */

const TRAIT_LABELS: Record<keyof AthleteTraitRatings, string> = {
  leadership: "Leadership", discipline: "Discipline", coachability: "Coachabilité",
  gameIQ: "QI sportif", competitiveness: "Compétitivité", teamwork: "Esprit d'équipe",
  resilience: "Résilience", attitude: "Attitude",
};

/* ── Info Row ─────────────────────────────────────────────────── */

function InfoRow({ label, value, icon, editing, onChange }: {
  label: string; value?: string | number | null; icon?: string;
  editing?: boolean; onChange?: (v: string) => void;
}) {
  if (!editing && (value === undefined || value === null || value === "")) return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <span className="text-[13px] text-[#9CA3AF] flex items-center gap-2">
        {icon && <NxIcon name={icon} size={14} className="text-[#6B7280]" />}
        {label}
      </span>
      {editing && onChange ? (
        <input
          type="text"
          value={value?.toString() || ""}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1 text-[13px] text-white text-right w-32 focus:border-[#E63946] outline-none"
        />
      ) : (
        <span className="text-[14px] font-bold text-white">{value}</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function AdminAthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Find admin row for metadata
  const adminRow = ADMIN_ATHLETES.find((a) => a.id === id);

  // Get detailed profile — map admin IDs to recruiter profile mock data
  const profileMap: Record<string, string> = {
    "at-001": "r-001", "at-002": "r-020", "at-003": "r-001",
    "at-004": "r-006", "at-005": "r-001",
  };
  const profileKey = profileMap[id] || "r-001";
  const baseProfile = ALL_RECRUITER_PROFILES[profileKey] || mockAthleteProfileFull;

  // Override profile fields with admin row data if available
  const a: AthleteProfileRecruiterView = adminRow ? {
    ...baseProfile,
    id,
    firstName: adminRow.full_name.split(" ")[0],
    lastName: adminRow.full_name.split(" ").slice(1).join(" "),
    schoolName: adminRow.school,
    primarySport: adminRow.sport,
    primaryPosition: adminRow.position,
    graduationYear: adminRow.graduation_year,
    isVerified: adminRow.is_verified,
    profileCompleteness: adminRow.profile_completeness,
  } : baseProfile;

  const [status, setStatus] = useState<AthleteStatus>(adminRow?.status || "approved");
  const [forceVerified, setForceVerified] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Editable fields (POC — local state only)
  const [editFields, setEditFields] = useState({
    // Header
    firstName: a.firstName,
    lastName: a.lastName,
    sport: a.primarySport,
    position: a.primaryPosition,
    school: a.schoolName,
    gradYear: a.graduationYear.toString(),
    // Physical
    height: a.heightDisplay || "",
    weight: a.weightDisplay || "",
    wingspan: a.wingspan || "",
    dominantHand: a.dominantHand || "",
    dominantFoot: a.dominantFoot || "",
    fortyYard: a.fortyYard || "",
    verticalJump: a.verticalJump || "",
    broadJump: a.broadJump || "",
    benchPress: a.benchPress || "",
    shuttleAgility: a.shuttleAgility || "",
    sprint100m: a.sprint100m || "",
    // Academic
    gpa: a.gpa?.toString() || "",
    program: a.targetCegepProgram?.join(", ") || "",
    // Coach report
    coachReport: a.coachReport || "",
    // Traits (evaluation)
    traitLeadership: a.traitRatings?.leadership ?? 0,
    traitDiscipline: a.traitRatings?.discipline ?? 0,
    traitCoachability: a.traitRatings?.coachability ?? 0,
    traitGameIQ: a.traitRatings?.gameIQ ?? 0,
    traitCompetitiveness: a.traitRatings?.competitiveness ?? 0,
    traitTeamwork: a.traitRatings?.teamwork ?? 0,
    traitResilience: a.traitRatings?.resilience ?? 0,
    traitAttitude: a.traitRatings?.attitude ?? 0,
    // Media links
    highlightVideo: a.highlightVideoUrl || "",
    hudl: a.hudlUrl || "",
    youtube: a.youtubeUrl || "",
    instagram: a.instagramUrl || "",
    fullGame: a.fullGameUrl || "",
    practiceVideo: a.practiceVideoUrl || "",
  });
  const setEf = (key: keyof typeof editFields) => (v: string) => setEditFields((prev) => ({ ...prev, [key]: v }));
  const [viewAsRecruiter, setViewAsRecruiter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDetailed, setIsDetailed] = useState(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isVerified = forceVerified || a.isVerified;
  const pctColor = completenessColor(a.profileCompleteness);

  // Distinctions (editable)
  const [distinctions, setDistinctions] = useState(a.distinctions?.map((d) => d.label) || []);

  // Trait average — read from editFields in edit mode
  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];

  const editTraitValues: Record<string, number> = {
    leadership: editFields.traitLeadership,
    discipline: editFields.traitDiscipline,
    coachability: editFields.traitCoachability,
    gameIQ: editFields.traitGameIQ,
    competitiveness: editFields.traitCompetitiveness,
    teamwork: editFields.traitTeamwork,
    resilience: editFields.traitResilience,
    attitude: editFields.traitAttitude,
  };

  const activeTraitValues = editing ? Object.values(editTraitValues) : traitEntries.map(([, v]) => v);
  const traitAvg = activeTraitValues.length > 0 ? activeTraitValues.reduce((s, v) => s + v, 0) / activeTraitValues.length : null;
  const coteGlobale = traitAvg ?? a.overallRating;

  if (!adminRow) {
    return (
      <div className="px-6 py-16 text-center">
        <h1 className="font-head text-2xl font-black text-white uppercase">Athlète introuvable</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-2">L&apos;identifiant &laquo; {id} &raquo; n&apos;existe pas.</p>
        <Link href="/admin/athletes" className="inline-flex items-center gap-2 mt-6 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22]">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-6 max-w-[1200px] mx-auto space-y-5">

      {/* ── Admin Action Bar ──────────────────────────────────── */}
      {!viewAsRecruiter && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4">

            {/* Back link */}
            <Link href="/admin/athletes" className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1.5 mr-auto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              Retour à la liste
            </Link>

            {/* Status dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider">Statut</span>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as AthleteStatus); showToast("Statut changé (POC)"); }}
                aria-label="Statut"
                className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] font-bold text-white focus:border-[#E63946] outline-none"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Verification toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider">Forcer vérif.</span>
              <button
                type="button"
                onClick={() => { setForceVerified(!forceVerified); showToast(forceVerified ? "Vérification automatique (POC)" : "Vérification forcée (POC)"); }}
                className={`relative w-10 h-6 rounded-full transition-colors ${forceVerified ? "bg-[#3B82F6]" : "bg-[#2D3748]"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${forceVerified ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>

            {/* Edit / Save buttons */}
            {editing ? (
              <>
                <button type="button" onClick={() => { setEditing(false); showToast("Modifications sauvegardées (POC)"); }} className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg transition-colors">
                  Sauvegarder
                </button>
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 border border-[#2D3748] text-[#9CA3AF] text-[12px] font-bold rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors">
                  Annuler
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 border border-[#E63946] text-[#E63946] text-[12px] font-bold rounded-lg hover:bg-[#E63946]/10 transition-colors">
                Modifier
              </button>
            )}

            {/* Archive */}
            <button type="button" onClick={() => setShowArchiveConfirm(true)} className="px-4 py-2 border border-[#2D3748] text-[#6b7280] text-[12px] font-bold rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors">
              Archiver
            </button>

            {/* View as recruiter */}
            <button type="button" onClick={() => setViewAsRecruiter(true)} className="px-4 py-2 border border-[#2D3748] text-[#9CA3AF] text-[12px] font-bold rounded-lg hover:text-white hover:border-[#4a4d56] transition-colors">
              Vue recruteur
            </button>
          </div>
        </div>
      )}

      {/* Recruiter view exit bar */}
      {viewAsRecruiter && (
        <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#3B82F6]">Vue recruteur — mode lecture seule</span>
          <button type="button" onClick={() => setViewAsRecruiter(false)} className="px-4 py-2 bg-[#3B82F6] text-white text-[12px] font-bold rounded-lg hover:bg-[#2563EB] transition-colors">
            Retour admin
          </button>
        </div>
      )}

      {/* ── Profile Content ───────────────────────────────────── */}
      <div className={`transition-all duration-300 ${editing ? "border-l-4 border-[#EAB308] pl-4" : ""}`}>

        {/* Header */}
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-xl bg-[#2F3440] border border-[#2D3748] flex items-center justify-center shrink-0">
              <span className="text-[24px] font-head font-black text-white/15">{a.firstName[0]}{a.lastName[0]}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={editFields.firstName} onChange={(e) => setEf("firstName")(e.target.value)} aria-label="Prénom" className="bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1 text-[20px] font-head font-black text-white uppercase w-36 focus:border-[#E63946] outline-none" />
                    <input type="text" value={editFields.lastName} onChange={(e) => setEf("lastName")(e.target.value)} aria-label="Nom" className="bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1 text-[20px] font-head font-black text-white uppercase w-48 focus:border-[#E63946] outline-none" />
                  </div>
                ) : (
                  <h1 className="font-head text-[24px] font-black text-white uppercase tracking-tight">{a.firstName} {a.lastName}</h1>
                )}
                {isVerified && (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold`} style={{ backgroundColor: STATUS_OPTIONS.find((o) => o.value === status)!.color + "20", color: STATUS_OPTIONS.find((o) => o.value === status)!.color }}>
                  {STATUS_OPTIONS.find((o) => o.value === status)!.label}
                </span>
              </div>

              {editing ? (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <select value={editFields.sport} onChange={(e) => setEf("sport")(e.target.value)} aria-label="Sport" className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] font-bold text-[#E63946] uppercase focus:border-[#E63946] outline-none">
                    {["Football", "Hockey", "Basketball", "Soccer", "Volleyball", "Natation", "Athlétisme", "Badminton", "Cross-country", "Rugby"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={editFields.position} onChange={(e) => setEf("position")(e.target.value)} aria-label="Position" className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] font-bold text-[#9CA3AF] focus:border-[#E63946] outline-none">
                    <option value="">Position</option>
                    {(POSITIONS_BY_SPORT[editFields.sport] || []).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={editFields.school} onChange={(e) => setEf("school")(e.target.value)} aria-label="École" className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] text-[#9CA3AF] focus:border-[#E63946] outline-none">
                    <option value="">École</option>
                    {SCHOOL_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={editFields.gradYear} onChange={(e) => setEf("gradYear")(e.target.value)} aria-label="Promotion" className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[12px] text-[#9CA3AF] focus:border-[#E63946] outline-none">
                    {["2025", "2026", "2027", "2028", "2029"].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded bg-[#E63946]/20 text-[#E63946] text-[12px] font-bold uppercase tracking-wider">{a.primarySport}</span>
                  <span className="text-[14px] font-bold text-[#9CA3AF]">{posAbbr(a.primaryPosition)}</span>
                  <span className="text-[#2D3748]">·</span>
                  <span className="text-[14px] text-[#9CA3AF]">{a.schoolName}</span>
                  <span className="text-[#2D3748]">·</span>
                  <span className="text-[14px] text-[#9CA3AF]">Promotion {a.graduationYear}</span>
                </div>
              )}

              {/* Completeness bar */}
              <div className="mt-4 max-w-[300px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider">Profil complété</span>
                  <span className="text-[13px] font-bold" style={{ color: pctColor }}>{a.profileCompleteness}%</span>
                </div>
                <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${a.profileCompleteness}%`, backgroundColor: pctColor }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 mt-5">
          <button type="button" onClick={() => setIsDetailed(false)} className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${!isDetailed ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "text-[#6b7280] border border-transparent hover:text-[#9CA3AF]"}`}>
            Simplifié
          </button>
          <button type="button" onClick={() => setIsDetailed(true)} className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${isDetailed ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "text-[#6b7280] border border-transparent hover:text-[#9CA3AF]"}`}>
            Détaillé
          </button>
        </div>

        {/* ── Profile Sections ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">

          {/* Physical */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Profil physique</h2>
            <InfoRow label="Taille" value={editing ? editFields.height : a.heightDisplay} icon="ruler" editing={editing} onChange={setEf("height")} />
            <InfoRow label="Poids" value={editing ? editFields.weight : a.weightDisplay} icon="weight" editing={editing} onChange={setEf("weight")} />
            {(isDetailed || editing) && (
              <>
                <InfoRow label="Envergure" value={editing ? editFields.wingspan : a.wingspan} editing={editing} onChange={setEf("wingspan")} />
                <InfoRow label="Main dominante" value={editing ? editFields.dominantHand : a.dominantHand} editing={editing} onChange={setEf("dominantHand")} />
                <InfoRow label="Pied dominant" value={editing ? editFields.dominantFoot : a.dominantFoot} editing={editing} onChange={setEf("dominantFoot")} />
              </>
            )}
            {(isDetailed || editing) && (a.fortyYard || a.verticalJump || a.broadJump || editing) && (
              <div className="mt-4 pt-3 border-t border-[#2D3748]/40">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Tests athlétiques</h3>
                <InfoRow label="40 yards" value={editing ? editFields.fortyYard : a.fortyYard} editing={editing} onChange={setEf("fortyYard")} />
                <InfoRow label="Saut vertical" value={editing ? editFields.verticalJump : a.verticalJump} editing={editing} onChange={setEf("verticalJump")} />
                <InfoRow label="Saut en longueur" value={editing ? editFields.broadJump : a.broadJump} editing={editing} onChange={setEf("broadJump")} />
                <InfoRow label="Développé couché" value={editing ? editFields.benchPress : a.benchPress} editing={editing} onChange={setEf("benchPress")} />
                <InfoRow label="Navette" value={editing ? editFields.shuttleAgility : a.shuttleAgility} editing={editing} onChange={setEf("shuttleAgility")} />
                <InfoRow label="Sprint 100m" value={editing ? editFields.sprint100m : a.sprint100m} editing={editing} onChange={setEf("sprint100m")} />
              </div>
            )}
          </div>

          {/* Academic */}
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Profil académique</h2>
            <InfoRow label="Moyenne" value={editing ? editFields.gpa : (a.gpa ? `${a.gpa}%` : undefined)} icon="academic" editing={editing} onChange={setEf("gpa")} />
            <InfoRow label="Programme visé" value={editing ? editFields.program : a.targetCegepProgram?.join(", ")} editing={editing} onChange={setEf("program")} />
            {(isDetailed || editing) && (
              <>
                {a.strongSubjects.length > 0 && (
                  <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40">
                    <span className="text-[13px] text-[#9CA3AF]">Matières fortes</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {a.strongSubjects.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-[#2D3748]/50 text-[11px] text-[#9CA3AF]">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {a.preferredRegions.length > 0 && (
                  <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40">
                    <span className="text-[13px] text-[#9CA3AF]">Régions préférées</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {a.preferredRegions.map((r) => (
                        <span key={r} className="px-2 py-0.5 rounded bg-[#2D3748]/50 text-[11px] text-[#9CA3AF]">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Coach Report */}
        <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Rapport de l&apos;entraîneur</h2>

          {(a.coachReport || editing) && (
            <div className="bg-[#111317] rounded-lg border border-white/5 p-4 mb-4">
              <p className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-2">Coach {a.coachName}, {a.coachSchool}</p>
              {editing ? (
                <textarea
                  value={editFields.coachReport}
                  onChange={(e) => setEf("coachReport")(e.target.value)}
                  rows={3}
                  aria-label="Rapport du coach"
                  placeholder="Rapport de l'entraîneur..."
                  className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none resize-none"
                />
              ) : (
                <p className="text-[14px] text-[#9CA3AF] leading-relaxed italic">&ldquo;{a.coachReport}&rdquo;</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <StarRating rating={coteGlobale} size="md" showNumber={false} />
            <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
            <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
          </div>

          {(isDetailed || editing) && traitEntries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {traitEntries.map(([key, val]) => {
                const traitFieldKey = `trait${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof typeof editFields;
                const currentVal = editing ? (editFields[traitFieldKey] as number) : val;
                return (
                  <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#111317] border border-white/5">
                    <span className="text-[13px] text-[#9CA3AF]">{TRAIT_LABELS[key] || key}</span>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            title={`${star}/5`}
                            onClick={() => setEditFields((prev) => ({ ...prev, [traitFieldKey]: star }))}
                            className="transition-transform hover:scale-110"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
                              <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z"
                                fill={star <= currentVal ? "#F59E0B" : "#374151"}
                                stroke={star <= currentVal ? "none" : "#F59E0B"}
                                strokeWidth={star <= currentVal ? 0 : 1.5}
                              />
                            </svg>
                          </button>
                        ))}
                        <span className="text-[12px] font-bold ml-1.5" style={{ color: "#F59E0B" }}>{currentVal}.0</span>
                      </div>
                    ) : (
                      <StarRating rating={val} size="sm" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Distinctions / Tags (sport-specific badges) */}
          {(distinctions.length > 0 || editing) && (() => {
            const sportKey = SPORT_NAME_MAP[editing ? editFields.sport : a.primarySport];
            const availableBadges = sportKey ? getBadgesForSport(sportKey) : [];
            const unusedBadges = availableBadges.filter((b) => !distinctions.includes(b.label));
            return (
              <div className="flex gap-2 flex-wrap mt-4 items-center">
                {distinctions.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2D3748]/50 text-[12px] text-[#9CA3AF]">
                    {label}
                    {editing && (
                      <button type="button" title="Retirer" onClick={() => setDistinctions((prev) => prev.filter((d) => d !== label))} className="text-[#6B7280] hover:text-[#E63946] transition-colors ml-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                      </button>
                    )}
                  </span>
                ))}
                {editing && unusedBadges.length > 0 && distinctions.length < 3 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setDistinctions((prev) => [...prev, e.target.value]);
                    }}
                    aria-label="Ajouter une distinction"
                    className="bg-[#13151a] border border-[#2a2d36] border-dashed rounded-full px-3 py-1.5 text-[12px] text-[#4a4d56] focus:border-[#E63946] outline-none"
                  >
                    <option value="">+ Ajouter...</option>
                    {unusedBadges.map((b) => (
                      <option key={b.badgeId} value={b.label}>{b.label}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })()}
        </div>

        {/* Media */}
        {(a.highlightVideoUrl || a.hudlUrl || a.youtubeUrl || editing) && (
          <div className="bg-[#1A1D24] rounded-xl border border-white/5 p-5 mt-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">Médias &amp; liens</h2>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "highlightVideo" as const, label: "Faits saillants", color: "#E63946" },
                  { key: "hudl" as const, label: "Hudl", color: "#F59E0B" },
                  { key: "youtube" as const, label: "YouTube", color: "#EF4444" },
                  { key: "instagram" as const, label: "Instagram", color: "#E63946" },
                  { key: "fullGame" as const, label: "Match complet", color: "#6B7280" },
                  { key: "practiceVideo" as const, label: "Entraînement", color: "#6B7280" },
                ]).map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-2 p-3 rounded-lg bg-[#111317] border border-white/5">
                    <span className="text-[12px] font-bold shrink-0 w-28" style={{ color }}>{label}</span>
                    <input
                      type="url"
                      value={editFields[key]}
                      onChange={(e) => setEf(key)(e.target.value)}
                      placeholder="https://..."
                      aria-label={label}
                      className="flex-1 bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1.5 text-[12px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none min-w-0"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {a.highlightVideoUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#111317] border border-white/5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    <span className="text-[13px] text-[#9CA3AF]">Faits saillants</span>
                  </div>
                )}
                {a.hudlUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#111317] border border-white/5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                    <span className="text-[13px] text-[#9CA3AF]">Hudl</span>
                  </div>
                )}
                {a.youtubeUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#111317] border border-white/5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="4" /><polygon points="10 8 16 12 10 16" /></svg>
                    <span className="text-[13px] text-[#9CA3AF]">YouTube</span>
                  </div>
                )}
                {a.instagramUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#111317] border border-white/5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" /></svg>
                    <span className="text-[13px] text-[#9CA3AF]">Instagram</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Archive Confirm ────────────────────────────────────── */}
      {showArchiveConfirm && (
        <ConfirmModal
          title="Archiver ce profil?"
          message="Le profil ne sera plus visible par les recruteurs. Cette action peut être annulée."
          onConfirm={() => { setShowArchiveConfirm(false); setStatus("archived"); showToast("Profil archivé (POC)"); }}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
