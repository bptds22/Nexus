"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "IDENTIFIE" | "CONTACTE" | "VISITE_PLANIFIEE" | "ENGAGE" | "LETTRE_SIGNEE";
const STAGE_ORDER: Stage[] = ["IDENTIFIE", "CONTACTE", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"];
const STAGE_RANK: Record<Stage, number> = { IDENTIFIE: 1, CONTACTE: 2, VISITE_PLANIFIEE: 3, ENGAGE: 4, LETTRE_SIGNEE: 5 };
const STAGE_LABEL: Record<Stage, string> = {
  IDENTIFIE: "IDENTIFIÉ",
  CONTACTE: "CONTACTÉ",
  VISITE_PLANIFIEE: "VISITE PLANIFIÉE",
  ENGAGE: "ENGAGÉ",
  LETTRE_SIGNEE: "LETTRE SIGNÉE",
};
const STAGE_BADGE: Record<Stage, string> = {
  IDENTIFIE: "bg-gray-500/20 text-gray-400",
  CONTACTE: "bg-indigo-500/20 text-indigo-400",
  VISITE_PLANIFIEE: "bg-amber-500/20 text-amber-400",
  ENGAGE: "bg-amber-500/20 text-amber-400",
  LETTRE_SIGNEE: "bg-green-500/20 text-green-400",
};

interface UserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  school_id: string | null;
  role?: string | null;
}
interface PipelineEntry {
  id: string;
  recruiter_id: string | null;
  stage: string | null;
  moved_at: string | null;
  created_at: string | null;
}
interface ConvRow { id: string; recruiter_id: string | null }
interface MessageRow { id: string; conversation_id: string | null; sender_id: string | null; read_at: string | null; created_at: string | null }
interface SchoolRow { id: string; name: string | null }

interface RecruiterRow {
  id: string;
  name: string;
  school_name: string | null;
  pipeline_count: number;
  moved_this_month: number;
  stagnant_count: number;
  furthest_stage: Stage | null;
  conversation_count: number;
  unanswered_count: number;
  last_activity: string | null;
}

type SortKey = "name" | "pipeline_count" | "moved_this_month" | "stagnant_count" | "furthest_stage" | "conversation_count" | "unanswered_count" | "last_activity";

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "à l'instant";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} jour${d > 1 ? "s" : ""}`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.floor(mo / 12);
  return `il y a ${y} an${y > 1 ? "s" : ""}`;
}

export default function AdminPipelinePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);
  const [totalPipeline, setTotalPipeline] = useState(0);
  const [movedThisMonth, setMovedThisMonth] = useState(0);
  const [lettreSignee, setLettreSignee] = useState(0);
  const [globalStagnant, setGlobalStagnant] = useState(0);
  const [totalRecruiters, setTotalRecruiters] = useState(0);
  const [activeRecruiters, setActiveRecruiters] = useState(0);

  const [sortKey, setSortKey] = useState<SortKey>("pipeline_count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [uRes, pipeRes, convRes, msgRes, schRes] = await Promise.all([
        supabase.from("users").select("id,first_name,last_name,school_id,role"),
        supabase.from("recruiter_pipeline").select("id,recruiter_id,stage,moved_at,created_at"),
        supabase.from("conversations").select("id,recruiter_id"),
        supabase.from("messages").select("id,conversation_id,sender_id,read_at,created_at"),
        supabase.from("schools").select("id,name"),
      ]);

      const users = ((uRes.data || []) as UserRow[]).filter((u) => u.role === "RECRUTEUR");
      const pipeline = (pipeRes.data || []) as PipelineEntry[];
      const conversations = (convRes.data || []) as ConvRow[];
      const messages = (msgRes.data || []) as MessageRow[];
      const schools = (schRes.data || []) as SchoolRow[];

      const schoolsById = new Map<string, SchoolRow>();
      for (const s of schools) schoolsById.set(s.id, s);

      const now = Date.now();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const STALE_MS = 30 * 86_400_000;

      const pipeByRec = new Map<string, PipelineEntry[]>();
      for (const p of pipeline) {
        if (!p.recruiter_id) continue;
        if (!pipeByRec.has(p.recruiter_id)) pipeByRec.set(p.recruiter_id, []);
        pipeByRec.get(p.recruiter_id)!.push(p);
      }
      const convByRec = new Map<string, number>();
      for (const c of conversations) {
        if (!c.recruiter_id) continue;
        convByRec.set(c.recruiter_id, (convByRec.get(c.recruiter_id) || 0) + 1);
      }
      const lastMsgByUser = new Map<string, number>();
      for (const m of messages) {
        if (!m.sender_id || !m.created_at) continue;
        const t = new Date(m.created_at).getTime();
        const cur = lastMsgByUser.get(m.sender_id) || 0;
        if (t > cur) lastMsgByUser.set(m.sender_id, t);
      }

      // Last message per conversation (for unanswered detection)
      const convRecruiter = new Map<string, string>();
      for (const c of conversations) if (c.recruiter_id) convRecruiter.set(c.id, c.recruiter_id);
      const lastMsgPerConv = new Map<string, MessageRow>();
      for (const m of messages) {
        if (!m.conversation_id || !m.created_at) continue;
        const cur = lastMsgPerConv.get(m.conversation_id);
        if (!cur || (cur.created_at && new Date(m.created_at).getTime() > new Date(cur.created_at).getTime())) {
          lastMsgPerConv.set(m.conversation_id, m);
        }
      }
      const unansweredByRec = new Map<string, number>();
      const STALE48 = 2 * 86_400_000;
      for (const [convId, msg] of lastMsgPerConv) {
        const rec = convRecruiter.get(convId);
        if (!rec) continue;
        if (msg.sender_id !== rec) continue;
        if (msg.read_at) continue;
        if (!msg.created_at) continue;
        if (now - new Date(msg.created_at).getTime() < STALE48) continue;
        unansweredByRec.set(rec, (unansweredByRec.get(rec) || 0) + 1);
      }

      const rows: RecruiterRow[] = users.map((u) => {
        const list = pipeByRec.get(u.id) || [];
        const movedMonth = list.filter((p) => p.moved_at && new Date(p.moved_at).getTime() >= monthStart).length;
        const stagnant = list.filter((p) => p.moved_at && now - new Date(p.moved_at).getTime() > STALE_MS).length;
        let furthest: Stage | null = null;
        for (const p of list) {
          if (!p.stage) continue;
          if (!(p.stage in STAGE_RANK)) continue;
          const st = p.stage as Stage;
          if (furthest == null || STAGE_RANK[st] > STAGE_RANK[furthest]) furthest = st;
        }
        let lastActT = 0;
        for (const p of list) {
          if (p.moved_at) {
            const t = new Date(p.moved_at).getTime();
            if (t > lastActT) lastActT = t;
          }
        }
        const lastMsgT = lastMsgByUser.get(u.id) || 0;
        if (lastMsgT > lastActT) lastActT = lastMsgT;

        return {
          id: u.id,
          name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "—",
          school_name: u.school_id ? schoolsById.get(u.school_id)?.name || null : null,
          pipeline_count: list.length,
          moved_this_month: movedMonth,
          stagnant_count: stagnant,
          furthest_stage: furthest,
          conversation_count: convByRec.get(u.id) || 0,
          unanswered_count: unansweredByRec.get(u.id) || 0,
          last_activity: lastActT > 0 ? new Date(lastActT).toISOString() : null,
        };
      });

      setRecruiters(rows);
      setTotalRecruiters(users.length);
      const active = new Set<string>();
      for (const p of pipeline) if (p.recruiter_id) active.add(p.recruiter_id);
      setActiveRecruiters(active.size);
      setTotalPipeline(pipeline.length);
      setMovedThisMonth(pipeline.filter((p) => p.moved_at && new Date(p.moved_at).getTime() >= monthStart).length);
      setLettreSignee(pipeline.filter((p) => p.stage === "LETTRE_SIGNEE").length);
      setGlobalStagnant(pipeline.filter((p) => p.moved_at && now - new Date(p.moved_at).getTime() > STALE_MS).length);

      setLoading(false);
    })();
  }, [supabase]);

  const conversionPct = totalPipeline > 0 ? Math.round((lettreSignee / totalPipeline) * 100) : 0;

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...recruiters].sort((a, b) => {
      let av: number | string = 0; let bv: number | string = 0;
      switch (sortKey) {
        case "name": av = a.name; bv = b.name; break;
        case "pipeline_count": av = a.pipeline_count; bv = b.pipeline_count; break;
        case "moved_this_month": av = a.moved_this_month; bv = b.moved_this_month; break;
        case "stagnant_count": av = a.stagnant_count; bv = b.stagnant_count; break;
        case "furthest_stage": av = a.furthest_stage ? STAGE_RANK[a.furthest_stage] : 0; bv = b.furthest_stage ? STAGE_RANK[b.furthest_stage] : 0; break;
        case "conversation_count": av = a.conversation_count; bv = b.conversation_count; break;
        case "unanswered_count": av = a.unanswered_count; bv = b.unanswered_count; break;
        case "last_activity": av = a.last_activity || ""; bv = b.last_activity || ""; break;
      }
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "fr") * dir;
    });
  }, [recruiters, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  }

  const bigStagnantAlerts = recruiters.filter((r) => r.stagnant_count > 5);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Recruteurs — Performance
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">{totalRecruiters} recruteur{totalRecruiters > 1 ? "s" : ""} sur la plateforme</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Recruteurs actifs</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{activeRecruiters}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">sur {totalRecruiters} inscrits</p>
        </div>
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Entrées pipeline</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{totalPipeline}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">{movedThisMonth} déplacée{movedThisMonth > 1 ? "s" : ""} ce mois</p>
        </div>
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Taux de conversion</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{conversionPct}%</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">IDENTIFIÉ → LETTRE SIGNÉE</p>
        </div>
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Stagnation</p>
          <p className={`font-head text-3xl font-black mt-1 tabular-nums ${globalStagnant > 0 ? "text-red-400" : "text-white"}`}>{globalStagnant}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">entrées sans mouvement depuis 30+ jours</p>
        </div>
      </div>

      {/* Alerts for high-stagnation recruiters */}
      {bigStagnantAlerts.length > 0 && (
        <div className="space-y-2">
          {bigStagnantAlerts.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-[13px] text-amber-300">
              ⚠ {r.name} a {r.stagnant_count} entrée{r.stagnant_count > 1 ? "s" : ""} stagnante{r.stagnant_count > 1 ? "s" : ""} depuis 30+ jours
            </div>
          ))}
        </div>
      )}

      {/* Recruiter table */}
      <div className="bg-[#1A1D24] border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-[13px] text-[#E0E0E0]">
          <thead>
            <tr className="bg-[#13151a] border-b border-[#2D3748]">
              <Th label="Recruteur" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <Th label="CÉGEP" />
              <Th label="Pipeline" align="right" active={sortKey === "pipeline_count"} dir={sortDir} onClick={() => toggleSort("pipeline_count")} />
              <Th label="Ce mois" align="right" active={sortKey === "moved_this_month"} dir={sortDir} onClick={() => toggleSort("moved_this_month")} />
              <Th label="Stagnants" align="right" active={sortKey === "stagnant_count"} dir={sortDir} onClick={() => toggleSort("stagnant_count")} />
              <Th label="Stade max" active={sortKey === "furthest_stage"} dir={sortDir} onClick={() => toggleSort("furthest_stage")} />
              <Th label="Conversations" align="right" active={sortKey === "conversation_count"} dir={sortDir} onClick={() => toggleSort("conversation_count")} />
              <Th label="Sans réponse" align="right" active={sortKey === "unanswered_count"} dir={sortDir} onClick={() => toggleSort("unanswered_count")} />
              <Th label="Dernière activité" active={sortKey === "last_activity"} dir={sortDir} onClick={() => toggleSort("last_activity")} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[#6b7280] text-[13px]">
                  Aucun recruteur
                </td>
              </tr>
            ) : sorted.map((r) => {
              const initials = r.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
              return (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/admin/pipeline/${r.id}`)}
                  className="border-b border-[#2D3748] hover:bg-[#22252D] cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2D3748] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {initials}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-white">{r.name}</p>
                        <p className="text-[11px] text-[#9CA3AF]">{r.school_name || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{r.school_name || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={r.pipeline_count === 0 ? "text-[#4a4d56]" : "text-white font-bold"}>{r.pipeline_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={r.moved_this_month > 0 ? "text-green-400 font-bold" : "text-[#4a4d56]"}>{r.moved_this_month}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.stagnant_count > 0 ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 tabular-nums">{r.stagnant_count}</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/10 text-green-400 tabular-nums">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.furthest_stage ? (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${STAGE_BADGE[r.furthest_stage]}`}>
                        {STAGE_LABEL[r.furthest_stage]}
                      </span>
                    ) : (
                      <span className="text-[#4a4d56]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#E0E0E0] tabular-nums">{r.conversation_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={r.unanswered_count > 0 ? "text-red-400 font-bold" : "text-[#4a4d56]"}>{r.unanswered_count}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{r.last_activity ? relativeTime(r.last_activity) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label, align, active, dir, onClick,
}: {
  label: string;
  align?: "left" | "right";
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
}) {
  const sortable = !!onClick;
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] ${sortable ? "cursor-pointer select-none hover:text-white" : ""}`}
      style={{ textAlign: align || "left" }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-[#E63946]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

// Silence unused warning — reserved for future STAGE_ORDER usage on detail page.
void STAGE_ORDER;
