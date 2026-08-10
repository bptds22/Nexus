"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DatePicker from "@/app/coach/components/DatePicker";
import SchoolSelect from "@/components/ui/SchoolSelect";
import FormModeToggle from "@/app/coach/components/FormModeToggle";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import StarRating from "@/components/ui/StarRating";
import VideoEmbed from "@/components/ui/VideoEmbed";
import NxIcon from "@/components/ui/NxIcon";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import AthleteProfileView from "@/components/shared/AthleteProfileView";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import type { AthleteProfileRecruiterView, AthleteTraitRatings, GlobalRecruitmentStatus } from "@/lib/types/models";
import {
  BADGE_CONFIG,
  BADGE_ORDER,
  MAX_BADGES,
  MAX_DETAIL_LENGTH,
  parseDistinctions,
  getSportStats,
  type DistinctionEntry,
} from "@/lib/config/badges";

/* ─────────────────────────────────────────────────────────────
   Admin athlete detail — full edit form wired to Supabase.
───────────────────────────────────────────────────────────── */

type AthleteData = Record<string, unknown>;
type EvaluationData = Record<string, unknown>;

interface Sport {
  id: string;
  nom: string;
}
interface Position {
  id: string;
  nom: string;
  sport_id: string;
}
interface School {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
}

interface PipelineEntry {
  id: string;
  stage: string;
  moved_at: string | null;
  updated_at: string | null;
  recruiter_id: string;
  recruiter_name: string;
  recruiter_email: string;
  cegep_name: string;
}

const PIPELINE_STAGE_OPTS = [
  { v: "IDENTIFIE", l: "Identifié" },
  { v: "CONTACTE", l: "Contacté" },
  { v: "EN_DISCUSSION", l: "En discussion" },
  { v: "VISITE_PLANIFIEE", l: "Visite planifiée" },
  { v: "ENGAGE", l: "Engagé" },
  { v: "LETTRE_SIGNEE", l: "Lettre signée" },
];

const GENRE_OPTS = [
  { v: "", l: "—" },
  { v: "M", l: "Masculin" },
  { v: "F", l: "Féminin" },
  { v: "Autre", l: "Autre" },
];

// DB stores capitalized FR values: "Droite" (feminine) for hand, "Droit" (masculine) for foot.
const MAIN_DOM_OPTS = [
  { v: "", l: "—" },
  { v: "Droite", l: "Droite" },
  { v: "Gauche", l: "Gauche" },
  { v: "Ambidextre", l: "Ambidextre" },
];

const PIED_DOM_OPTS = [
  { v: "", l: "—" },
  { v: "Droit", l: "Droit" },
  { v: "Gauche", l: "Gauche" },
  { v: "Ambidextre", l: "Ambidextre" },
];

const SUBJECTS = [
  "Mathématiques",
  "Français",
  "Anglais",
  "Sciences",
  "Histoire",
  "Éducation physique",
  "Arts",
];

const CEGEP_PROGRAMS = [
  "DEC général",
  "Sciences de la nature",
  "Sciences humaines",
  "Arts",
  "Techniques policières",
  "Techniques informatiques",
  "Administration",
  "Autre",
];

const QC_REGIONS = [
  "Bas-Saint-Laurent",
  "Saguenay–Lac-Saint-Jean",
  "Capitale-Nationale",
  "Mauricie",
  "Estrie",
  "Montréal",
  "Outaouais",
  "Abitibi-Témiscamingue",
  "Côte-Nord",
  "Nord-du-Québec",
  "Gaspésie–Îles-de-la-Madeleine",
  "Chaudière-Appalaches",
  "Laval",
  "Lanaudière",
  "Laurentides",
  "Montérégie",
  "Centre-du-Québec",
];

const STATUS_OPTS = [
  { v: "ACTIF", l: "Actif" },
  { v: "DESACTIVE", l: "Désactivé" },
  { v: "EN_ATTENTE", l: "En attente" },
  { v: "DIPLOME", l: "Diplômé" },
];

const VERIF_METHOD_OPTS = [
  { v: "", l: "—" },
  { v: "auto", l: "Automatique" },
  { v: "manuel_coach", l: "Manuel — coach" },
  { v: "manuel_directeur", l: "Manuel — directeur" },
];

const RECRUIT_OPTS = [
  { v: "", l: "—" },
  { v: "OUVERT", l: "Ouvert" },
  { v: "EN_PROCESSUS", l: "En processus" },
  { v: "RECRUTE", l: "Recruté" },
  { v: "RETIRE", l: "Retiré" },
];

const inputCls =
  "w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-[#E0E0E0] focus:outline-none focus:border-[#E63946]/50";
const labelCls = "text-[11px] font-bold tracking-[0.12em] uppercase text-[#9CA3AF]";

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";
const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";
const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";

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

/* ── Inline helpers cloned from coach profile ──────────────────── */

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

function PreviewPreferencePill({ active, label }: { active?: boolean; label: string }) {
  if (active === undefined) return null;
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#22C55E" : "#6B7280" }} />
      {label}
    </span>
  );
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

function jsonArrayToString(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  return "";
}
function stringToJsonArray(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function AdminAthleteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<AthleteData>({});
  const [evaluation, setEvaluation] = useState<EvaluationData>({});
  const [sports, setSports] = useState<Sport[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [pipelineSaving, setPipelineSaving] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [evalMode, setEvalMode] = useState<"simple" | "detailed">("simple");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [togglingVerified, setTogglingVerified] = useState(false);
  const [coachInfo, setCoachInfo] = useState<{ name: string; school: string } | null>(null);
  const [previewView, setPreviewView] = useState<AthleteProfileRecruiterView | null>(null);
  const [dbDistinctions, setDbDistinctions] = useState<DistinctionEntry[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, spRes, posRes, schRes, pipeRes] = await Promise.all([
        supabase.from("athletes").select("*").eq("id", id).maybeSingle(),
        supabase.from("sports").select("id,nom").order("nom"),
        supabase.from("positions").select("id,nom,sport_id,abreviation"),
        supabase.from("schools").select("id,name,city,region").order("name"),
        supabase
          .from("recruiter_pipeline")
          .select("id, recruiter_id, stage, moved_at, updated_at")
          .eq("athlete_id", id)
          .order("updated_at", { ascending: false }),
      ]);

      const schoolNameMap = new Map(
        ((schRes.data as School[]) || []).map((s) => [s.id, s.name]),
      );

      type PipelineRaw = {
        id: string;
        recruiter_id: string | null;
        stage: string;
        moved_at: string | null;
        updated_at: string | null;
      };
      type RecruiterRow = {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        school_id: string | null;
      };

      const pipelineRaw = (pipeRes.data as PipelineRaw[]) || [];
      const recruiterIds = Array.from(
        new Set(pipelineRaw.map((p) => p.recruiter_id).filter((v): v is string => !!v)),
      );
      let recruiterMap = new Map<string, RecruiterRow>();
      if (recruiterIds.length > 0) {
        const recRes = await supabase
          .from("users")
          .select("id, first_name, last_name, email, school_id")
          .in("id", recruiterIds);
        recruiterMap = new Map(
          ((recRes.data as RecruiterRow[]) || []).map((r) => [r.id, r]),
        );
      }

      const mappedPipeline: PipelineEntry[] = pipelineRaw.map((p) => {
        const rec = p.recruiter_id ? recruiterMap.get(p.recruiter_id) ?? null : null;
        const recruiterName = rec
          ? `${rec.first_name ?? ""} ${rec.last_name ?? ""}`.trim() || (rec.email ?? "—")
          : "—";
        return {
          id: p.id,
          stage: p.stage,
          moved_at: p.moved_at,
          updated_at: p.updated_at,
          recruiter_id: rec?.id ?? "",
          recruiter_name: recruiterName,
          recruiter_email: rec?.email ?? "",
          cegep_name: rec?.school_id ? schoolNameMap.get(rec.school_id) ?? "" : "",
        };
      });
      setPipeline(mappedPipeline);

      if (aRes.data) {
        setAthlete(aRes.data);
        if (aRes.data.coach_id) {
          const cRes = await supabase
            .from("users")
            .select("first_name, last_name, school_id")
            .eq("id", aRes.data.coach_id)
            .maybeSingle();
          if (cRes.data) {
            const c = cRes.data as { first_name: string | null; last_name: string | null; school_id: string | null };
            const schoolName = c.school_id ? schoolNameMap.get(c.school_id) ?? "" : "";
            setCoachInfo({
              name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—",
              school: schoolName,
            });
          }
          const eRes = await supabase
            .from("evaluations")
            .select("*")
            .eq("athlete_id", id)
            .eq("coach_id", aRes.data.coach_id)
            .maybeSingle();
          if (eRes.data) {
            setEvaluation(eRes.data);
            const traitKeys = [
              "leadership", "discipline", "coachabilite", "intelligence_jeu",
              "competitivite", "esprit_equipe", "resilience", "attitude_mentalite",
              "vitesse_explosivite", "force_puissance", "endurance_cardio", "agilite_coordination",
              "vision_du_jeu", "sens_tactique",
            ];
            const anyTrait = traitKeys.some((k) => {
              const v = (eRes.data as Record<string, unknown>)[k];
              return typeof v === "number" && v > 0;
            });
            if (anyTrait) setEvalMode("detailed");
          }
        }
      }
      // Load full recruiter-view model + engagement counts (for aperçu recruteur)
      try {
        const { data: rawA } = await loadAthleteRaw(id);
        if (rawA) {
          const mapped = mapToRecruiterView(rawA as Record<string, unknown>);
          setPreviewView(mapped);
          const evals = (rawA as Record<string, unknown>).evaluations;
          const evalArr = Array.isArray(evals) ? evals : [];
          const e0 = selectBestEvaluation(evalArr) as Record<string, unknown> | undefined;
          if (e0?.distinctions) {
            let d: unknown = e0.distinctions;
            if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = []; } }
            setDbDistinctions(parseDistinctions(d));
          }
        }
      } catch (err) {
        console.error("[admin/athletes] loadAthleteRaw failed:", err);
      }
      const [{ count: vc }, { count: fc }] = await Promise.all([
        supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).eq("athlete_id", id),
        supabase.from("recruiter_favorites").select("*", { count: "exact", head: true }).eq("athlete_id", id),
      ]);
      setViewCount(vc || 0);
      setFavoriteCount(fc || 0);

      setSports((spRes.data as Sport[]) || []);
      setPositions((posRes.data as Position[]) || []);
      setSchools((schRes.data as School[]) || []);
      setLoading(false);
    })();
  }, [supabase, id]);

  function A(key: string) {
    return (athlete as Record<string, unknown>)[key];
  }
  function setA(key: string, value: unknown) {
    setAthlete((a) => ({ ...a, [key]: value }));
  }
  function setE(key: string, value: unknown) {
    setEvaluation((e) => ({ ...e, [key]: value }));
  }

  async function handlePhotoUpload(file: File) {
    try {
      setUploadingPhoto(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${id}/profile.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateErr } = await supabase
        .from("athletes")
        .update({ photo_url: publicUrl })
        .eq("id", id);
      if (updateErr) throw updateErr;
      setA("photo_url", publicUrl);
      setToast("Photo mise à jour");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error("Photo upload failed:", err);
      setToast("Échec du téléversement");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleToggleVerified() {
    if (togglingVerified) return;
    const current = !!A("verified");
    const next = !current;
    try {
      setTogglingVerified(true);
      const { error } = await supabase
        .from("athletes")
        .update({ verified: next })
        .eq("id", id);
      if (error) throw error;
      setA("verified", next);
      setToast(next ? "Athlète vérifié" : "Vérification retirée");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error("Toggle verified failed:", err);
      setToast("Échec de la mise à jour");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setTogglingVerified(false);
    }
  }

  async function handlePhotoRemove() {
    try {
      setUploadingPhoto(true);
      const { error } = await supabase.from("athletes").update({ photo_url: null }).eq("id", id);
      if (error) throw error;
      setA("photo_url", null);
      setToast("Photo supprimée");
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error("Photo remove failed:", err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  const filteredPositions = positions.filter((p) => p.sport_id === A("sport_id"));

  async function updatePipelineStage(rowId: string, nextStage: string) {
    setPipelineSaving(rowId);
    const supa = createClient();
    const nowIso = new Date().toISOString();
    const { error } = await supa
      .from("recruiter_pipeline")
      .update({ stage: nextStage, moved_at: nowIso })
      .eq("id", rowId);
    setPipelineSaving(null);
    if (error) {
      setToast(`Erreur: ${error.message}`);
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setPipeline((list) =>
      list.map((p) => (p.id === rowId ? { ...p, stage: nextStage, moved_at: nowIso } : p)),
    );
    setToast("Stage mis à jour");
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSave() {
    setSaving(true);
    const supa = createClient();
    const athletePatch: Record<string, unknown> = {
      first_name: A("first_name"),
      last_name: A("last_name"),
      date_naissance: A("date_naissance") || null,
      genre: A("genre") || null,
      email: A("email") || null,
      telephone: A("telephone") || null,
      photo_url: A("photo_url") || null,
      nom_parent: A("nom_parent") || null,
      telephone_parent: A("telephone_parent") || null,
      sport_id: A("sport_id") || null,
      position_id: A("position_id") || null,
      school_id: A("school_id") || null,
      numero_jersey: A("numero_jersey") || null,
      taille_pieds: A("taille_pieds") ?? null,
      taille_pouces: A("taille_pouces") ?? null,
      poids_lbs: A("poids_lbs") ?? null,
      envergure: A("envergure") || null,
      taille_mains: A("taille_mains") || null,
      main_dominante: A("main_dominante") || null,
      pied_dominant: A("pied_dominant") || null,
      test_40_verges: A("test_40_verges") || null,
      saut_vertical: A("saut_vertical") || null,
      saut_longueur: A("saut_longueur") || null,
      developpe_couche: A("developpe_couche") || null,
      navette_agilite: A("navette_agilite") || null,
      sprint_100m: A("sprint_100m") || null,
      annee_diplomation: A("annee_diplomation") ?? null,
      moyenne_generale: A("moyenne_generale") ?? null,
      matieres_fortes: A("matieres_fortes") ?? [],
      mentions_academiques: A("mentions_academiques") ?? [],
      programme_cegep_vise: A("programme_cegep_vise") ?? [],
      ouvert_cegep_prive: !!A("ouvert_cegep_prive"),
      ouvert_cegep_anglophone: !!A("ouvert_cegep_anglophone"),
      pret_changer_region: !!A("pret_changer_region"),
      regions_cegep_preferees: A("regions_cegep_preferees") ?? [],
      video_faits_saillants_url: A("video_faits_saillants_url") || null,
      hudl_url: A("hudl_url") || null,
      youtube_url: A("youtube_url") || null,
      instagram_url: A("instagram_url") || null,
      video_match_complet_url: A("video_match_complet_url") || null,
      video_entrainement_url: A("video_entrainement_url") || null,
      status: A("status") || "ACTIF",
      verified: !!A("verified"),
      verification_method: A("verification_method") || null,
      statut_recrutement_override: A("statut_recrutement_override") || null,
      ouvert_entraineur_cegep: !!A("ouvert_entraineur_cegep"),
    };

    const { error: aErr } = await supa.from("athletes").update(athletePatch).eq("id", id);
    if (aErr) {
      setToast(`Erreur athlète: ${aErr.message}`);
      setTimeout(() => setToast(null), 4000);
      setSaving(false);
      return;
    }

    const coachId = A("coach_id") as string | null;
    if (coachId && Object.keys(evaluation).length > 0) {
      const evalPatch: Record<string, unknown> = {
        coach_id: coachId,
        athlete_id: id,
        leadership: evaluation.leadership ?? null,
        discipline: evaluation.discipline ?? null,
        coachabilite: evaluation.coachabilite ?? null,
        intelligence_jeu: evaluation.intelligence_jeu ?? null,
        competitivite: evaluation.competitivite ?? null,
        esprit_equipe: evaluation.esprit_equipe ?? null,
        resilience: evaluation.resilience ?? null,
        attitude_mentalite: evaluation.attitude_mentalite ?? null,
        vitesse_explosivite: evaluation.vitesse_explosivite ?? null,
        force_puissance: evaluation.force_puissance ?? null,
        endurance_cardio: evaluation.endurance_cardio ?? null,
        agilite_coordination: evaluation.agilite_coordination ?? null,
        vision_du_jeu: evaluation.vision_du_jeu ?? null,
        sens_tactique: evaluation.sens_tactique ?? null,
        cote_globale: evaluation.cote_globale ?? null,
        rapport_entraineur: evaluation.rapport_entraineur ?? null,
        distinctions: evaluation.distinctions ?? [],
      };
      const { error: eErr } = await supa
        .from("evaluations")
        .upsert(evalPatch, { onConflict: "coach_id,athlete_id" });
      if (eErr) {
        setToast(`Erreur évaluation: ${eErr.message}`);
        setTimeout(() => setToast(null), 4000);
        setSaving(false);
        return;
      }
    }

    setToast("Enregistré");
    setTimeout(() => setToast(null), 2500);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      </div>
    );
  }

  if (!athlete.id) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/admin/athletes" className="text-[13px] text-[#E63946] hover:underline">
          ← Retour
        </Link>
        <p className="mt-6 text-[#9CA3AF]">Athlète introuvable.</p>
      </div>
    );
  }

  const section = (title: string, children: React.ReactNode) => (
    <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
      <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );

  const row = (label: string, input: React.ReactNode) => (
    <label className="space-y-1.5 block">
      <span className={labelCls}>{label}</span>
      {input}
    </label>
  );

  /** Inline toggle row — label+switch on a single line in a card,
   *  for boolean fields where label-above-input wastes space. */
  const boolRow = (label: string, key: string) => {
    const on: boolean = !!A(key);
    return (
      <button
        type="button"
        onClick={() => setA(key, !on)}
        aria-pressed={on ? true : false}
        className="flex items-center justify-between gap-4 w-full bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 hover:border-[#4a4d56] transition-colors"
      >
        <span className={labelCls}>{label}</span>
        <span
          className={`relative inline-flex w-11 h-6 items-center rounded-full transition-colors shrink-0 ${
            on ? "bg-[#22C55E]" : "bg-[#4a4d56]"
          }`}
        >
          <span
            className={`inline-block w-4 h-4 rounded-full bg-white transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </span>
      </button>
    );
  };

  const text = (key: string, placeholder?: string) => (
    <input
      type="text"
      title={key}
      placeholder={placeholder ?? key}
      value={(A(key) as string) ?? ""}
      onChange={(e) => setA(key, e.target.value)}
      className={inputCls}
    />
  );
  const num = (key: string, step = "1") => (
    <input
      type="number"
      step={step}
      title={key}
      placeholder={key}
      value={(A(key) as number | null) ?? ""}
      onChange={(e) => setA(key, e.target.value === "" ? null : Number(e.target.value))}
      className={inputCls}
    />
  );
  const numRange = (key: string, min: number, max: number, step = "1") => (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      title={key}
      placeholder={key}
      value={(A(key) as number | null) ?? ""}
      onChange={(e) => setA(key, e.target.value === "" ? null : Number(e.target.value))}
      className={inputCls}
    />
  );
  /** Chip-toggle multi-select for JSONB array columns. */
  const chips = (key: string, options: string[]) => {
    const current = Array.isArray(A(key)) ? (A(key) as string[]) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = current.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = on ? current.filter((x) => x !== opt) : [...current, opt];
                setA(key, next);
              }}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                on
                  ? "bg-[#E63946]/15 border-[#E63946] text-[#E63946]"
                  : "bg-[#111317] border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  };
  /** Single-select dropdown for a JSONB array stored as `[value]`. */
  const selectSingleArray = (key: string, options: string[]) => {
    const arr = Array.isArray(A(key)) ? (A(key) as string[]) : [];
    const current = arr[0] ?? "";
    return (
      <select
        title={key}
        value={current}
        onChange={(e) => setA(key, e.target.value ? [e.target.value] : [])}
        className={inputCls}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  };
  const date = (key: string) => (
    <DatePicker
      value={(A(key) as string)?.slice(0, 10) ?? ""}
      onChange={(v) => setA(key, v || null)}
    />
  );
  const bool = (key: string) => (
    <button
      type="button"
      title={key}
      onClick={() => setA(key, !A(key))}
      className={`relative inline-flex w-11 h-6 items-center rounded-full transition-colors ${
        A(key) ? "bg-[#22C55E]" : "bg-[#4a4d56]"
      }`}
      aria-pressed={A(key) ? true : false}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full bg-white transition-transform ${
          A(key) ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
  const select = (
    key: string,
    opts: { v: string; l: string }[],
    onChange?: (v: string) => void,
  ) => (
    <select
      title={key}
      value={(A(key) as string) ?? ""}
      onChange={(e) => {
        setA(key, e.target.value || null);
        onChange?.(e.target.value);
      }}
      className={inputCls}
    >
      {opts.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
  const arrayText = (key: string) => (
    <input
      type="text"
      title={key}
      placeholder="séparé par des virgules"
      value={jsonArrayToString(A(key))}
      onChange={(e) => setA(key, stringToJsonArray(e.target.value))}
      className={inputCls}
    />
  );

  /* ── Évaluation helpers (mirror coach modifier) ───────────────── */
  const TRAIT_GROUPS: { title: string; traits: { key: string; label: string }[] }[] = [
    {
      title: "Capacités athlétiques",
      traits: [
        { key: "vitesse_explosivite", label: "Vitesse / Explosivité" },
        { key: "force_puissance", label: "Force / Puissance" },
        { key: "endurance_cardio", label: "Endurance / Cardio" },
        { key: "agilite_coordination", label: "Agilité / Coordination" },
      ],
    },
    {
      title: "Intelligence sportive",
      traits: [
        { key: "vision_du_jeu", label: "Vision du jeu" },
        { key: "sens_tactique", label: "Sens tactique" },
      ],
    },
    {
      title: "Caractère",
      traits: [
        { key: "leadership", label: "Leadership" },
        { key: "discipline", label: "Discipline / Éthique de travail" },
        { key: "coachabilite", label: "Coachabilité" },
        { key: "intelligence_jeu", label: "Intelligence de jeu" },
        { key: "competitivite", label: "Compétitivité" },
        { key: "esprit_equipe", label: "Esprit d'équipe" },
        { key: "resilience", label: "Résilience" },
        { key: "attitude_mentalite", label: "Attitude / Mentalité" },
      ],
    },
  ];

  const ALL_TRAIT_KEYS = TRAIT_GROUPS.flatMap((g) => g.traits.map((t) => t.key));

  const distinctionsEntries: DistinctionEntry[] = parseDistinctions(evaluation.distinctions);
  const selectedBadgeMap = new Map(distinctionsEntries.map((e) => [e.badge, e]));
  const primarySportId = (A("sport_id") as string | null) ?? null;
  const primarySportName = sports.find((s) => s.id === primarySportId)?.nom ?? null;
  const sportStatsOpts = getSportStats(primarySportName);

  function setTrait(key: string, value: number) {
    const current = (evaluation[key] as number | null) ?? 0;
    setE(key, current === value ? null : value);
  }

  function toggleBadge(key: string) {
    const existing = selectedBadgeMap.get(key);
    let next: DistinctionEntry[];
    if (existing) {
      next = distinctionsEntries.filter((e) => e.badge !== key);
    } else {
      if (distinctionsEntries.length >= MAX_BADGES) return;
      next = [...distinctionsEntries, { badge: key }];
    }
    setE("distinctions", next);
  }

  function updateBadgeDetail(key: string, detail: string) {
    const next = distinctionsEntries.map((e) => (e.badge === key ? { ...e, detail } : e));
    setE("distinctions", next);
  }

  function renderEvaluationSection() {
    const hasCoach = !!A("coach_id");
    const isDetailed = evalMode === "detailed";
    const traitValues = ALL_TRAIT_KEYS
      .map((k) => (evaluation[k] as number | null) ?? 0)
      .filter((v) => v > 0);
    const autoAvg = traitValues.length > 0 ? traitValues.reduce((a, b) => a + b, 0) / traitValues.length : 0;
    const starRating = (evaluation.cote_globale as number | null) ?? 0;
    const totalDistinctions = distinctionsEntries.length;
    const atMax = totalDistinctions >= MAX_BADGES;
    const rapport = (evaluation.rapport_entraineur as string) ?? "";
    const sectionTitle = "text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-4";

    return (
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6">
        <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3 mb-5">
          Évaluation
        </h2>

        {!hasCoach ? (
          <div className="bg-[#13151a] border border-[#2a2d36] rounded-lg p-5 opacity-70">
            <p className="text-[13px] text-[#9CA3AF]">
              Évaluation indisponible — l&apos;athlète n&apos;a pas de coach assigné.
            </p>
          </div>
        ) : (
          <>
            <FormModeToggle mode={evalMode} onChange={setEvalMode} />

            {/* ── Detailed: 14 trait ratings grouped ────────────── */}
            {isDetailed && (
              <div className="mb-8 space-y-4">
                {/* Auto-calculated cote globale */}
                <div className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
                      Cote globale (moyenne auto)
                    </p>
                    <p className="text-[28px] font-head font-black text-[#F59E0B] leading-none mt-1">
                      {autoAvg > 0 ? autoAvg.toFixed(1) : "—"}
                      <span className="text-[14px] text-[#6b7280] font-normal ml-1">/ 5</span>
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg
                        key={i}
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill={autoAvg >= i + 1 ? "#F59E0B" : autoAvg >= i + 0.5 ? "#F59E0B" : "#374151"}
                        stroke="none"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                </div>

                {TRAIT_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-5"
                  >
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {group.traits.map((trait) => {
                        const val = (evaluation[trait.key] as number | null) ?? 0;
                        return (
                          <div
                            key={trait.key}
                            className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                          >
                            <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }, (_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  title={`${i + 1} étoile${i > 0 ? "s" : ""}`}
                                  className="w-6 h-6 cursor-pointer hover:scale-110 transition-transform"
                                  onClick={() => setTrait(trait.key, i + 1)}
                                >
                                  <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill={val >= i + 1 ? "#F59E0B" : "#374151"}
                                    stroke="none"
                                  >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                </button>
                              ))}
                              <span className="text-[12px] font-bold text-[#6b7280] w-8 text-right">
                                {val > 0 ? `${val}/5` : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Simplified: half-star overall rating ────────────── */}
            {!isDetailed && (
              <div className="mb-8 bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
                <p className={sectionTitle}>Cote de l&apos;entraîneur</p>
                <p className="text-[12px] text-[#6b7280] mb-4 -mt-3">
                  Évalue le potentiel global de cet athlète. Clique pour attribuer une note, clique à gauche d&apos;une étoile pour un demi-point.
                </p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => {
                    const starIndex = i + 1;
                    const filled = starRating >= starIndex;
                    const half = !filled && starRating >= starIndex - 0.5;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="relative w-8 h-8 cursor-pointer group"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const isLeftHalf = x < rect.width / 2;
                          const value = isLeftHalf ? starIndex - 0.5 : starIndex;
                          setE("cote_globale", starRating === value ? null : value);
                        }}
                      >
                        <svg className="absolute inset-0 w-8 h-8" viewBox="0 0 24 24" fill="#2D3748" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        {filled && (
                          <svg className="absolute inset-0 w-8 h-8" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        )}
                        {half && (
                          <svg className="absolute inset-0 w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="none">
                            <defs>
                              <clipPath id={`admin-half-${i}`}>
                                <rect x="0" y="0" width="12" height="24" />
                              </clipPath>
                            </defs>
                            <polygon
                              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                              fill="#F59E0B"
                              clipPath={`url(#admin-half-${i})`}
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  <span className="ml-3 text-[15px] font-bold text-white">
                    {starRating > 0 ? `${starRating} / 5` : "—"}
                  </span>
                </div>
              </div>
            )}

            {/* ── Distinctions (7-badge grid) ────────────── */}
            <div className="mb-8 bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
                  Distinctions
                </p>
                <span className="text-[11px] font-bold tabular-nums text-[#6b7280]">
                  {totalDistinctions} / {MAX_BADGES}
                </span>
              </div>
              <p className="text-[12px] text-[#6b7280] mb-1">
                Sélectionne les reconnaissances qui s&apos;appliquent à cet athlète cette saison.
              </p>
              <p className="text-[11px] text-[#4a4d56] mb-4 italic">
                Maximum de 5 distinctions affichées sur le profil
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BADGE_ORDER.map((key) => {
                  const cfg = BADGE_CONFIG[key];
                  const entry = selectedBadgeMap.get(key);
                  const isSelected = !!entry;
                  const isDisabled = !isSelected && atMax;
                  return (
                    <div
                      key={key}
                      className={`border rounded-lg transition-all ${
                        isSelected ? "border-[#E63946]/40 bg-[#E63946]/[0.06]" : "border-[#2a2d36]"
                      } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => !isDisabled && toggleBadge(key)}
                        disabled={isDisabled}
                        className="w-full flex flex-col items-center gap-2 px-3 py-4 text-center"
                      >
                        <DistinctionBadge badge={key} detail={entry?.detail} size="sm" />
                        <span
                          className={`text-[12px] font-bold ${
                            isSelected ? "text-white" : "text-[#8a8d96]"
                          }`}
                        >
                          {key === "custom" ? "Personnalisée" : cfg.label}
                        </span>
                      </button>

                      {isSelected && cfg.hasDetail && (
                        <div className="px-3 pb-3 space-y-2">
                          {(key === "team_leader" || key === "league_leader") &&
                            sportStatsOpts.length > 0 && (
                              <select
                                aria-label="Statistique"
                                value={sportStatsOpts.includes(entry?.detail || "") ? entry?.detail || "" : ""}
                                onChange={(ev) => updateBadgeDetail(key, ev.target.value)}
                                className={`${inputCls} text-[13px]`}
                              >
                                <option value="">— Choisir une stat —</option>
                                {sportStatsOpts.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            )}
                          <input
                            type="text"
                            value={entry?.detail || ""}
                            onChange={(ev) => updateBadgeDetail(key, ev.target.value.slice(0, MAX_DETAIL_LENGTH))}
                            maxLength={MAX_DETAIL_LENGTH}
                            placeholder={
                              key === "custom" ? "Titre de la distinction" : "Précise (ex: Points)"
                            }
                            className={`${inputCls} text-[13px]`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Rapport de l'entraîneur ────────────── */}
            <div className="bg-[#13151a] border border-[#2a2d36] rounded-xl p-5">
              <p className={sectionTitle}>Rapport de l&apos;entraîneur</p>
              <p className="text-[12px] text-[#6b7280] mb-3 -mt-3">
                Décris cet athlète aux recruteurs. Parle de son caractère, ses forces et ses performances marquantes.
              </p>
              <textarea
                value={rapport}
                onChange={(e) => setE("rapport_entraineur", e.target.value)}
                maxLength={300}
                rows={4}
                placeholder="Ex: Joueur le plus discipliné de mon roster. Meneur de l'équipe en plaqués avec 67 cette saison. Leadership exceptionnel, capitaine depuis 2 ans..."
                className={`${inputCls} resize-none min-h-[100px]`}
              />
              <p className="text-[12px] text-[#4a4d56] text-right mt-1 tabular-nums">
                {rapport.length} / 300
              </p>
            </div>
          </>
        )}
      </section>
    );
  }

  const sportOpts = [{ v: "", l: "—" }, ...sports.map((s) => ({ v: s.id, l: s.nom }))];
  const posOpts = [{ v: "", l: "—" }, ...filteredPositions.map((p) => ({ v: p.id, l: p.nom }))];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/athletes"
            className="text-[13px] text-[#E63946] hover:underline inline-flex items-center gap-1"
          >
            ← Retour à la liste
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
              {(A("first_name") as string) ?? ""} {(A("last_name") as string) ?? ""}
            </h1>
            <button
              type="button"
              onClick={handleToggleVerified}
              disabled={togglingVerified}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border transition-colors disabled:opacity-40 cursor-pointer ${
                A("verified")
                  ? "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30 hover:bg-[#3B82F6]/20"
                  : "bg-[#2A2D35] text-gray-400 border-[#2A2D35] hover:bg-[#333842]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 2 3-1 1 3 3 1-1 3 2 3-2 3 1 3-3 1-1 3-3-1-3 2-3-2-3 1-1-3-3-1 1-3-2-3 2-3-1-3 3-1 1-3 3 1z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              {A("verified") ? "Vérifié" : "Non vérifié"}
            </button>
          </div>
          <p className="text-[12px] text-[#6b7280] mt-1 font-mono">{id}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors inline-flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Aperçu recruteur
          </button>
        </div>
      </div>

      {section(
        "Identité",
        <>
          <div className="md:col-span-2 flex flex-col items-center gap-3 pb-4 mb-2 border-b border-[#2A2D35]">
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-[#1A1D24] border border-[#2A2D35] flex items-center justify-center">
              {A("photo_url") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={A("photo_url") as string}
                  alt="Athlete"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold text-3xl uppercase">
                  {((A("first_name") as string) || "?").charAt(0)}
                  {((A("last_name") as string) || "").charAt(0)}
                </span>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input
              id="admin-athlete-photo-input"
              type="file"
              accept="image/*"
              title="Téléverser une photo"
              aria-label="Téléverser une photo de l'athlète"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoUpload(f);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => document.getElementById("admin-athlete-photo-input")?.click()}
                className="px-4 py-2 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[12px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors disabled:opacity-40"
              >
                {A("photo_url") ? "Changer" : "Téléverser"}
              </button>
              {Boolean(A("photo_url")) && (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={handlePhotoRemove}
                  className="px-4 py-2 rounded-lg border border-[#2A2D35] text-[#6b7280] font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
          {row("Prénom", text("first_name"))}
          {row("Nom", text("last_name"))}
          {row("Date de naissance", date("date_naissance"))}
          {row("Genre", select("genre", GENRE_OPTS))}
          {row("Courriel", text("email"))}
          {row("Téléphone", text("telephone"))}
          {row("Nom du parent", text("nom_parent"))}
          {row("Téléphone parent", text("telephone_parent"))}
        </>,
      )}

      {section(
        "Sport",
        <>
          {row(
            "Sport principal",
            select("sport_id", sportOpts, () => setA("position_id", null)),
          )}
          {row("Position principale", select("position_id", posOpts))}
          {row(
            "École",
            <SchoolSelect
              value={(A("school_id") as string) ?? null}
              onChange={(id) => setA("school_id", id || null)}
            />,
          )}
          {row("Numéro de jersey", text("numero_jersey"))}
        </>,
      )}

      {section(
        "Physique",
        <>
          {row("Taille (pieds)", num("taille_pieds"))}
          {row("Taille (pouces)", num("taille_pouces"))}
          {row("Poids (lbs)", num("poids_lbs", "0.1"))}
          {row("Envergure", text("envergure"))}
          {row("Taille des mains", text("taille_mains"))}
          {row("Main dominante", select("main_dominante", MAIN_DOM_OPTS))}
          {row("Pied dominant", select("pied_dominant", PIED_DOM_OPTS))}
          {row("40 verges", text("test_40_verges"))}
          {row("Saut vertical", text("saut_vertical"))}
          {row("Saut en longueur", text("saut_longueur"))}
          {row("Développé couché", text("developpe_couche"))}
          {row("Navette agilité", text("navette_agilite"))}
          {row("Sprint 100m", text("sprint_100m"))}
        </>,
      )}

      {section(
        "Académique",
        <>
          {row("Année de diplomation", numRange("annee_diplomation", 2024, 2035))}
          {row("Moyenne générale", numRange("moyenne_generale", 0, 100, "0.01"))}
          {row("Matières fortes", chips("matieres_fortes", SUBJECTS))}
          {row("Mentions académiques", arrayText("mentions_academiques"))}
          {row("Programme CÉGEP visé", selectSingleArray("programme_cegep_vise", CEGEP_PROGRAMS))}
          {row("Régions CÉGEP préférées", chips("regions_cegep_preferees", QC_REGIONS))}
          {boolRow("Ouvert CÉGEP privé", "ouvert_cegep_prive")}
          {boolRow("Ouvert CÉGEP anglophone", "ouvert_cegep_anglophone")}
          {boolRow("Prêt à changer de région", "pret_changer_region")}
        </>,
      )}

      {section(
        "Médias",
        <>
          {row("Vidéo faits saillants", text("video_faits_saillants_url"))}
          {row("Hudl", text("hudl_url"))}
          {row("YouTube", text("youtube_url"))}
          {row("Instagram", text("instagram_url"))}
          {row("Vidéo match complet", text("video_match_complet_url"))}
          {row("Vidéo entraînement", text("video_entrainement_url"))}
        </>,
      )}

      {section(
        "Statut",
        <>
          {row("Statut du compte", select("status", STATUS_OPTS))}
          {row("Méthode de vérification", select("verification_method", VERIF_METHOD_OPTS))}
          {row("Statut recrutement", select("statut_recrutement_override", RECRUIT_OPTS))}
          {boolRow("Vérifié", "verified")}
          {boolRow("Ouvert à entraîneur CÉGEP", "ouvert_entraineur_cegep")}
        </>,
      )}

      {renderEvaluationSection()}

      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-lg p-5">
        <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mb-2">
          Pipeline recruteurs
        </h2>
        <p className="text-[12px] text-[#6b7280] mb-4">
          Le statut global de l&apos;athlète est dérivé automatiquement du stage le plus avancé ci-dessous.
        </p>
        {pipeline.length === 0 ? (
          <p className="text-[13px] text-[#4a4d56] italic">Aucun recruteur dans le pipeline</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-[#E0E0E0]">
              <thead>
                <tr className="bg-[#13151a] border-b border-[#2D3748]">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Recruteur</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">CÉGEP</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Stage</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((p) => {
                  const updated = p.moved_at || p.updated_at;
                  const fmt = updated ? new Date(updated).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" }) : "—";
                  return (
                    <tr key={p.id} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-[#E0E0E0]">{p.recruiter_name}</span>
                          {p.recruiter_email && (
                            <span className="text-[11px] text-[#6b7280]">{p.recruiter_email}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[#9CA3AF]">
                        {p.cegep_name || <span className="text-[#4a4d56]">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          title="Stage"
                          value={p.stage}
                          onChange={(e) => updatePipelineStage(p.id, e.target.value)}
                          disabled={pipelineSaving === p.id}
                          className="bg-[#111317] border border-[#2D3748] rounded px-2 py-1 text-[12px] text-white focus:outline-none focus:border-[#E63946]/50 disabled:opacity-50"
                        >
                          {PIPELINE_STAGE_OPTS.map((o) => (
                            <option key={o.v} value={o.v}>{o.l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-[#9CA3AF]">{fmt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="fixed bottom-6 right-6 left-4 sm:left-auto z-50 px-6 py-3 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40 shadow-lg shadow-black/40"
      >
        {saving ? "Enregistrement..." : "Sauvegarder"}
      </button>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}

      {/* ── Aperçu recruteur — slide-out panel ─────────────────── */}
      {showPreview && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
            aria-hidden
          />
          <div
            className="fixed top-0 right-0 bottom-0 z-50 bg-[#111317] border-l border-[#2D3748] shadow-[-8px_0_40px_rgba(0,0,0,0.6)] flex flex-col"
            style={{ width: "80vw" }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2D3748] bg-[#1A1D24]">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E63946]">
                  Aperçu recruteur
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 rounded-lg border border-[#E63946] bg-[#E63946] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                >
                  ✎ Éditer
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 rounded-lg border border-[#2D3748] text-[#E0E0E0] text-[11px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors"
                >
                  ✕ Fermer l&apos;aperçu
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#111317] relative">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <PlaybookBackground />
              </div>
              <div className="relative">
                <AthleteProfileView athleteId={id} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  function renderRecruiterPreview() {
    const a = previewView;
    if (!a) {
      return (
        <div className="max-w-5xl mx-auto px-6 py-12 text-center text-[#6b7280]">
          Chargement du profil...
        </div>
      );
    }
    const isDetailed = evalMode === "detailed";
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
    const accountStatus = (A("status") as string) || null;
    const globalRecruit = (A("statut_recrutement_override") as string) || "OUVERT";

    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 text-[#E0E0E0]" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
        {/* Toggle + Completeness */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <ProfileToggle mode={evalMode} onChange={setEvalMode} />
          <div className="w-full sm:w-56">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1">Profil complété</p>
            <CompletenessBar percent={a.profileCompleteness || 0} />
          </div>
        </div>

        {/* HERO */}
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
          <div className="shrink-0 flex justify-center lg:justify-start">
            <AthletePlayerCard a={a} format="compact" animate />
          </div>
          <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
            <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
              {a.firstName}<br />{a.lastName}
              {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
            </h1>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                <span className="text-[16px] font-bold text-white">{viewCount}</span>
                <span className="text-[11px] text-[#6b7280]">{viewCount === 1 ? "vue totale" : "vues totales"}</span>
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
              {accountStatus && (
                <div className="bg-[#111317] rounded-lg px-4 py-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Compte</span>
                  <span className="text-[12px] font-bold text-white uppercase tracking-wider">{accountStatus}</span>
                </div>
              )}
            </div>

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
                                {val > 0 ? <StarRating rating={val} size="sm" /> : <span className="text-[13px] text-[#4a4d56]">&mdash;</span>}
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
                  <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-3">Entrainement</p>
                  <VideoEmbed url={a.practiceVideoUrl} title="Entraînement" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[#555]">Aucune vidéo ajoutée</p>
          )}
        </section>

        {/* PROFIL ACADEMIQUE */}
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <div className={`${cardBase} overflow-hidden`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50">
              <div className="p-5 text-center">
                <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "\u2014"}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
              </div>
              <div className="p-5 text-center">
                {(() => {
                  let display = "\u2014";
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
              <PreviewPreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
              <PreviewPreferencePill active={a.openToPrivate} label="Ouvert au privé" />
              <PreviewPreferencePill active={a.openToAnglophone} label="Ouvert anglophone" />
            </div>
          </div>
        </section>

        {/* DETAILED SECTIONS */}
        {isDetailed && (
          <div className="space-y-6">
            <section>
              <h2 className={sectionLabel}>Informations personnelles</h2>
              <div className={`${cardBase} p-5`}>
                <InfoRow label="Âge" value={age > 0 ? `${age} ans` : "\u2014"} icon="calendar" />
                <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
                <InfoRow label="Ville" value={a.city} icon="mapPin" />
                <InfoRow label="Région" value={a.region} icon="map" />
                <InfoRow label={a.isCivil ? "Équipe civile" : "École"} value={a.isCivil ? (a.teamName || a.leagueName || "—") : (a.schoolName || "—")} icon="building" />
                <InfoRow label="Graduation" value={a.graduationYear} icon="gradCap" />
              </div>
            </section>

            <section>
              <h2 className={sectionLabel}>Mesures physiques</h2>
              <div className={`${cardBase} overflow-hidden`}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-[#2D3748]/40">
                  {[
                    { label: "Taille", value: a.heightDisplay || "\u2014" },
                    { label: "Poids", value: a.weightDisplay || "\u2014" },
                    { label: "Envergure", value: a.wingspan || "\u2014" },
                    { label: "Taille mains", value: a.handSize || "\u2014" },
                    { label: "Main dom.", value: a.dominantHand || "\u2014" },
                    { label: "Pied dom.", value: a.dominantFoot || "\u2014" },
                  ].map((m) => (
                    <div key={m.label} className="p-4 text-center">
                      <p className={`text-[20px] font-head font-black leading-none ${m.value === "\u2014" ? "text-[#4a4d56]" : "text-white"}`}>{m.value}</p>
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
                          <p className={`text-[20px] font-head font-black leading-none ${t.value ? "text-white" : "text-[#4a4d56]"}`}>{t.value || "\u2014"}</p>
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
      </div>
    );
  }
}
