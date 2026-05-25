"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "IDENTIFIE" | "CONTACTE" | "VISITE_PLANIFIEE" | "ENGAGE" | "LETTRE_SIGNEE";
const STAGE_ORDER: Stage[] = ["IDENTIFIE", "CONTACTE", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"];
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
const STAGE_BORDER: Record<Stage, string> = {
  IDENTIFIE: "border-t-gray-500",
  CONTACTE: "border-t-blue-500",
  VISITE_PLANIFIEE: "border-t-amber-500",
  ENGAGE: "border-t-amber-500",
  LETTRE_SIGNEE: "border-t-green-500",
};

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  school_id: string | null;
  created_at: string | null;
}
interface PipeRow {
  id: string;
  recruiter_id: string | null;
  athlete_id: string | null;
  stage: string | null;
  moved_at: string | null;
  created_at: string | null;
  flagged: boolean | null;
}
interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport_id: string | null;
  position_id: string | null;
  school_id: string | null;
  verified: boolean | null;
  photo_url: string | null;
}
interface ConvRow {
  id: string;
  recruiter_id: string | null;
  coach_id: string | null;
  athlete_id: string | null;
  last_message_at: string | null;
}
interface MessageRow {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  content: string | null;
  read_at: string | null;
  created_at: string | null;
}

interface AthleteTableRow {
  entry_id: string;
  athlete_id: string;
  name: string;
  photo_url: string | null;
  school_name: string | null;
  sport_id: string | null;
  sport_name: string | null;
  position_name: string | null;
  stage: Stage | null;
  moved_at: string | null;
  created_at: string | null;
  flagged: boolean;
}

type AthSortKey = "name" | "sport" | "position" | "stage" | "moved_at" | "created_at";

export default function AdminRecruiterDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [recruiter, setRecruiter] = useState<User | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [pipe, setPipe] = useState<PipeRow[]>([]);
  const [athletes, setAthletes] = useState<AthleteTableRow[]>([]);
  const [conversations, setConversations] = useState<Array<{
    id: string;
    coachName: string;
    athleteName: string;
    lastMessage: MessageRow | null;
    unanswered: boolean;
  }>>([]);
  const [avgResponseH, setAvgResponseH] = useState<number | null>(null);
  const [hasCoachReplies, setHasCoachReplies] = useState(false);
  const [movedThisMonth, setMovedThisMonth] = useState(0);
  const [movedLastMonth, setMovedLastMonth] = useState(0);

  const [stageFilter, setStageFilter] = useState<"" | Stage>("");
  const [sportFilter, setSportFilter] = useState("");
  const [stagnantOnly, setStagnantOnly] = useState(false);
  const [athSortKey, setAthSortKey] = useState<AthSortKey>("moved_at");
  const [athSortDir, setAthSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);

      const [uRes, pipeRes, convRes] = await Promise.all([
        supabase.from("users").select("id,first_name,last_name,school_id,created_at").eq("id", id).maybeSingle(),
        supabase.from("recruiter_pipeline").select("id,recruiter_id,athlete_id,stage,moved_at,created_at,flagged").eq("recruiter_id", id),
        supabase.from("conversations").select("id,recruiter_id,coach_id,athlete_id,last_message_at").eq("recruiter_id", id),
      ]);

      const user = uRes.data as User | null;
      const pipeData = (pipeRes.data || []) as PipeRow[];
      const convs = (convRes.data || []) as ConvRow[];

      setRecruiter(user);
      setPipe(pipeData);

      // Gather related IDs.
      const athleteIds = Array.from(new Set(pipeData.map((p) => p.athlete_id).filter((x): x is string => !!x)));
      const convIds = convs.map((c) => c.id);
      const coachIds = Array.from(new Set(convs.map((c) => c.coach_id).filter((x): x is string => !!x)));
      const convAthleteIds = Array.from(new Set(convs.map((c) => c.athlete_id).filter((x): x is string => !!x)));
      const allAthleteIds = Array.from(new Set([...athleteIds, ...convAthleteIds]));

      const [aRes, msgRes, coachRes, schAllRes, sportsAllRes, posAllRes] = await Promise.all([
        allAthleteIds.length > 0
          ? supabase.from("athletes").select("id,first_name,last_name,sport_id,position_id,school_id,verified,photo_url").in("id", allAthleteIds)
          : Promise.resolve({ data: [] as AthleteRow[] }),
        convIds.length > 0
          ? supabase.from("messages").select("id,conversation_id,sender_id,content,read_at,created_at").in("conversation_id", convIds)
          : Promise.resolve({ data: [] as MessageRow[] }),
        coachIds.length > 0
          ? supabase.from("users").select("id,first_name,last_name").in("id", coachIds)
          : Promise.resolve({ data: [] as User[] }),
        user?.school_id
          ? supabase.from("schools").select("id,name").eq("id", user.school_id).maybeSingle()
          : Promise.resolve({ data: null as { id: string; name: string | null } | null }),
        supabase.from("sports").select("id,nom"),
        supabase.from("positions").select("id,nom"),
      ]);

      const athletesById = new Map<string, AthleteRow>();
      for (const a of (aRes.data || []) as AthleteRow[]) athletesById.set(a.id, a);
      const coachesById = new Map<string, User>();
      for (const c of (coachRes.data || []) as User[]) coachesById.set(c.id, c);
      const sportsById = new Map<string, string>();
      for (const s of ((sportsAllRes.data || []) as { id: string; nom: string }[])) sportsById.set(s.id, s.nom);
      const positionsById = new Map<string, string>();
      for (const p of ((posAllRes.data || []) as { id: string; nom: string }[])) positionsById.set(p.id, p.nom);
      setSchoolName((schAllRes.data as { name?: string | null } | null)?.name ?? null);

      // Collect school names for pipeline athletes.
      const athleteSchoolIds = Array.from(new Set(
        (aRes.data || []).map((a: AthleteRow) => a.school_id).filter((x): x is string => !!x),
      ));
      const schoolsByIdMap = new Map<string, string>();
      if (athleteSchoolIds.length > 0) {
        const { data } = await supabase.from("schools").select("id,name").in("id", athleteSchoolIds);
        for (const s of (data || []) as { id: string; name: string | null }[]) {
          if (s.name) schoolsByIdMap.set(s.id, s.name);
        }
      }

      const athTable: AthleteTableRow[] = pipeData.map((p) => {
        const a = p.athlete_id ? athletesById.get(p.athlete_id) : null;
        const stage = p.stage && (STAGE_ORDER as string[]).includes(p.stage) ? (p.stage as Stage) : null;
        return {
          entry_id: p.id,
          athlete_id: p.athlete_id || "",
          name: a ? `${a.first_name || ""} ${a.last_name || ""}`.trim() || "—" : "—",
          photo_url: a?.photo_url ?? null,
          school_name: a?.school_id ? schoolsByIdMap.get(a.school_id) || null : null,
          sport_id: a?.sport_id ?? null,
          sport_name: a?.sport_id ? sportsById.get(a.sport_id) || null : null,
          position_name: a?.position_id ? positionsById.get(a.position_id) || null : null,
          stage,
          moved_at: p.moved_at,
          created_at: p.created_at,
          flagged: !!p.flagged,
        };
      });
      setAthletes(athTable);

      // Month comparisons
      const today = new Date();
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      setMovedThisMonth(pipeData.filter((p) => p.moved_at && new Date(p.moved_at).getTime() >= thisMonthStart).length);
      setMovedLastMonth(pipeData.filter((p) => {
        if (!p.moved_at) return false;
        const t = new Date(p.moved_at).getTime();
        return t >= lastMonthStart && t < thisMonthStart;
      }).length);

      // Conversation processing
      const messages = (msgRes.data || []) as MessageRow[];
      const msgsByConv = new Map<string, MessageRow[]>();
      for (const m of messages) {
        if (!m.conversation_id) continue;
        if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, []);
        msgsByConv.get(m.conversation_id)!.push(m);
      }
      for (const [, list] of msgsByConv) {
        list.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      }

      // Average response time: for each recruiter-sent message, find next coach message in same conv.
      const diffs: number[] = [];
      let anyCoachReply = false;
      for (const c of convs) {
        const list = msgsByConv.get(c.id) || [];
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          if (m.sender_id !== id || !m.created_at) continue;
          for (let j = i + 1; j < list.length; j++) {
            const n = list[j];
            if (n.sender_id === c.coach_id && n.created_at) {
              anyCoachReply = true;
              diffs.push((new Date(n.created_at).getTime() - new Date(m.created_at).getTime()) / 3_600_000);
              break;
            }
          }
        }
      }
      setHasCoachReplies(anyCoachReply);
      setAvgResponseH(diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : null);

      const now = Date.now();
      const STALE48 = 2 * 86_400_000;
      const convRows = convs
        .sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""))
        .map((c) => {
          const list = msgsByConv.get(c.id) || [];
          const last = list.length > 0 ? list[list.length - 1] : null;
          const unanswered = !!(last && last.sender_id === id && !last.read_at && last.created_at && now - new Date(last.created_at).getTime() >= STALE48);
          const coach = c.coach_id ? coachesById.get(c.coach_id) : null;
          const athleteFromConv = c.athlete_id ? athletesById.get(c.athlete_id) : null;
          return {
            id: c.id,
            coachName: coach ? `${coach.first_name || ""} ${coach.last_name || ""}`.trim() || "Coach" : "Coach",
            athleteName: athleteFromConv ? `${athleteFromConv.first_name || ""} ${athleteFromConv.last_name || ""}`.trim() || "—" : "—",
            lastMessage: last,
            unanswered,
          };
        });
      setConversations(convRows);
      setLoading(false);
    })();
  }, [id, supabase]);

  // Stage breakdown
  const byStage = useMemo(() => {
    const m = new Map<Stage, AthleteTableRow[]>();
    for (const s of STAGE_ORDER) m.set(s, []);
    for (const a of athletes) {
      if (a.stage) m.get(a.stage)!.push(a);
    }
    return m;
  }, [athletes]);

  const sportOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of athletes) if (a.sport_id && a.sport_name) m.set(a.sport_id, a.sport_name);
    return Array.from(m.entries());
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    const now = Date.now();
    const STALE_MS = 30 * 86_400_000;
    let list = athletes.filter((a) => {
      if (stageFilter && a.stage !== stageFilter) return false;
      if (sportFilter && a.sport_id !== sportFilter) return false;
      if (stagnantOnly) {
        if (!a.moved_at) return false;
        if (now - new Date(a.moved_at).getTime() <= STALE_MS) return false;
      }
      return true;
    });
    const dir = athSortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av: number | string = 0; let bv: number | string = 0;
      switch (athSortKey) {
        case "name": av = a.name; bv = b.name; break;
        case "sport": av = a.sport_name || ""; bv = b.sport_name || ""; break;
        case "position": av = a.position_name || ""; bv = b.position_name || ""; break;
        case "stage": av = a.stage || ""; bv = b.stage || ""; break;
        case "moved_at": av = a.moved_at || ""; bv = b.moved_at || ""; break;
        case "created_at": av = a.created_at || ""; bv = b.created_at || ""; break;
      }
      return String(av).localeCompare(String(bv), "fr") * dir;
    });
    return list;
  }, [athletes, stageFilter, sportFilter, stagnantOnly, athSortKey, athSortDir]);

  function toggleAthSort(key: AthSortKey) {
    if (athSortKey === key) setAthSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setAthSortKey(key); setAthSortDir("asc"); }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      </div>
    );
  }

  const name = recruiter ? `${recruiter.first_name || ""} ${recruiter.last_name || ""}`.trim() || "Recruteur" : "Recruteur";
  const deltaMonth = movedThisMonth - movedLastMonth;
  void pipe;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="space-y-2">
        <Link href="/admin/pipeline" className="inline-flex text-[12px] text-[#9CA3AF] hover:text-white transition-colors">← Recruteurs</Link>
        <h1 className="font-head text-3xl font-black text-white uppercase tracking-tight">{name}</h1>
        <p className="text-[13px] text-[#6b7280]">
          {schoolName || "—"} · Inscrit le {formatDate(recruiter?.created_at ?? null)}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Pipeline total</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{athletes.length}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">entrées au pipeline</p>
        </div>
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Déplacés ce mois</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{movedThisMonth}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">
            {movedLastMonth === 0 ? "aucun mois dernier" : `${deltaMonth >= 0 ? "+" : ""}${deltaMonth} vs mois dernier (${movedLastMonth})`}
          </p>
        </div>
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Conversations</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">{conversations.length}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">échanges actifs</p>
        </div>
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-5">
          <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">Temps de réponse moyen</p>
          <p className="font-head text-3xl font-black text-white mt-1 tabular-nums">
            {!hasCoachReplies ? "En attente" : avgResponseH != null ? `${avgResponseH.toFixed(1)}h` : "—"}
          </p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">des entraîneurs aux messages</p>
        </div>
      </div>

      {/* Stage breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGE_ORDER.map((s) => {
          const list = byStage.get(s) || [];
          return (
            <div key={s} className={`bg-[#1A1D24] border border-white/10 border-t-4 ${STAGE_BORDER[s]} rounded-xl p-4`}>
              <p className="text-[10px] text-[#6b7280] uppercase tracking-wider font-bold">{STAGE_LABEL[s]}</p>
              <p className="font-head text-2xl font-black text-white mt-1 tabular-nums">{list.length}</p>
              <ul className="mt-2 space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <li key={a.entry_id} className="text-[11px] text-[#E0E0E0] truncate">{a.name}</li>
                ))}
                {list.length > 3 && (
                  <li className="text-[11px] text-[#6b7280]">+{list.length - 3} autre{list.length - 3 > 1 ? "s" : ""}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          title="Stage"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as "" | Stage)}
          className="bg-[#1A1D24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50"
        >
          <option value="">Tous les stages</option>
          {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select
          title="Sport"
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-[#1A1D24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50"
        >
          <option value="">Tous les sports</option>
          {sportOptions.map(([sid, nom]) => <option key={sid} value={sid}>{nom}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={stagnantOnly}
            onChange={(e) => setStagnantOnly(e.target.checked)}
            className="w-4 h-4 accent-[#E63946]"
          />
          <span className="text-[13px] text-[#E0E0E0]">Stagnants seulement</span>
        </label>
        <span className="text-[12px] text-[#9CA3AF] ml-auto">
          <span className="font-bold text-white tabular-nums">{filteredAthletes.length}</span> athlète{filteredAthletes.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Athletes table */}
      <div className="bg-[#1A1D24] border border-white/10 rounded-xl overflow-x-auto">
        <table className="w-full text-[13px] text-[#E0E0E0]">
          <thead>
            <tr className="bg-[#13151a] border-b border-[#2D3748]">
              <SortableTh label="Athlète" active={athSortKey === "name"} dir={athSortDir} onClick={() => toggleAthSort("name")} />
              <SortableTh label="Sport" active={athSortKey === "sport"} dir={athSortDir} onClick={() => toggleAthSort("sport")} />
              <SortableTh label="Position" active={athSortKey === "position"} dir={athSortDir} onClick={() => toggleAthSort("position")} />
              <SortableTh label="Stage" active={athSortKey === "stage"} dir={athSortDir} onClick={() => toggleAthSort("stage")} />
              <SortableTh label="Depuis" align="right" active={athSortKey === "moved_at"} dir={athSortDir} onClick={() => toggleAthSort("moved_at")} />
              <SortableTh label="Ajouté le" active={athSortKey === "created_at"} dir={athSortDir} onClick={() => toggleAthSort("created_at")} />
              <SortableTh label="Signalé" align="center" />
            </tr>
          </thead>
          <tbody>
            {filteredAthletes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[#6b7280] text-[13px]">Aucun athlète</td></tr>
            ) : filteredAthletes.map((a) => {
              const days = a.moved_at ? Math.floor((Date.now() - new Date(a.moved_at).getTime()) / 86_400_000) : null;
              const initials = a.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
              return (
                <tr
                  key={a.entry_id}
                  onClick={() => a.athlete_id && router.push(`/admin/athletes/${a.athlete_id}`)}
                  className="border-b border-[#2D3748] hover:bg-[#22252D] cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden">
                        {a.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
                        ) : initials}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-white">{a.name}</p>
                        <p className="text-[11px] text-[#9CA3AF]">{a.school_name || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{a.sport_name || "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{a.position_name || "—"}</td>
                  <td className="px-4 py-3">
                    {a.stage ? (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${STAGE_BADGE[a.stage]}`}>
                        {STAGE_LABEL[a.stage]}
                      </span>
                    ) : <span className="text-[#4a4d56]">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${days != null && days > 30 ? "text-red-400 font-bold" : "text-[#E0E0E0]"}`}>
                    {days != null ? `${days} jour${days > 1 ? "s" : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    {a.flagged ? <span className="text-red-400" title="Signalé">⚑</span> : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Conversations */}
      <div className="space-y-3">
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-wide">
          Conversations ({conversations.length})
        </h2>
        {conversations.length === 0 ? (
          <p className="text-[13px] text-[#6b7280]">Aucune conversation.</p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => {
              const preview = c.lastMessage?.content?.slice(0, 80) || "";
              const truncated = (c.lastMessage?.content?.length || 0) > 80;
              return (
                <li key={c.id} className="bg-[#1A1D24] border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-white">
                        {c.coachName} <span className="text-[#6b7280] font-normal">·</span> {c.athleteName}
                      </p>
                      {preview ? (
                        <p className="text-[12px] text-[#9CA3AF] mt-1 line-clamp-2">{preview}{truncated ? "…" : ""}</p>
                      ) : (
                        <p className="text-[12px] text-[#6b7280] mt-1 italic">Aucun message</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-[#9CA3AF]">{relativeTime(c.lastMessage?.created_at || null)}</span>
                      {c.unanswered && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">Sans réponse</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SortableTh({
  label, align, active, dir, onClick,
}: {
  label: string;
  align?: "left" | "right" | "center";
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
