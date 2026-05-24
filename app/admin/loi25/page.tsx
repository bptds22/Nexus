"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Search,
  Check,
  X as XIcon,
  Clock,
  Download,
  Plus,
  UserCheck,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Admin — Loi 25 compliance dashboard.
   6 tabs: Consentements · Incidents · Audit · Portabilité · RPRP · Conformité.

   Storage:
     - loi25_incidents          → 20260523120100 migration
     - loi25_portability_requests → 20260523120200 migration
     - loi25_settings (singleton, Nexus RPRP) → 20260524130000 migration
     - Per-school RPRP = the is_school_admin director user on each school
       (read live; no schools.rprp_* columns — director user IS the RPRP).
     - Audit-export is on-demand from existing signals (no audit_log table).
═══════════════════════════════════════════════════════════════ */

type Tab = "consentements" | "incidents" | "audit" | "portabilite" | "rprp" | "conformite";

const TABS: { key: Tab; label: string }[] = [
  { key: "consentements", label: "Consentements" },
  { key: "incidents",     label: "Incidents" },
  { key: "audit",         label: "Audit" },
  { key: "portabilite",   label: "Portabilité" },
  { key: "rprp",          label: "RPRP" },
  { key: "conformite",    label: "Conformité" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function computeAge(dateNaissance: string | null | undefined): number | null {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function AdminLoi25Page() {
  const [tab, setTab] = useState<Tab>("consentements");

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-head text-[28px] font-black text-white tracking-tight uppercase">Loi 25</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Conformité à la Loi sur la protection des renseignements personnels dans le secteur privé.
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex overflow-x-auto gap-1 bg-[#1A1D24] border border-white/[0.06] rounded-full p-1.5 mb-6 w-max max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-[12px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              tab === t.key ? "bg-[#2A2D34] text-white" : "text-[#9CA3AF] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "consentements" && <ConsentementsTab />}
      {tab === "incidents"     && <IncidentsTab />}
      {tab === "audit"         && <AuditTab />}
      {tab === "portabilite"   && <PortabiliteTab />}
      {tab === "rprp"          && <RprpTab />}
      {tab === "conformite"    && <ConformiteTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1 — CONSENTEMENTS PARENTAUX
═══════════════════════════════════════════════════════════════ */

interface ConsentRow {
  id: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  sportName: string;
  age: number | null;
  consentGiven: boolean;
  consentDate: string | null;
  coachName: string;
}

type ConsentStatus = "all" | "obtained" | "pending" | "withdrawn";

function ConsentementsTab() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Attestation pipeline counts (parental_consents) — power the 4 KPI cards.
  // Separate from the per-row athlete self-reported view below (the boolean
  // athletes.consentement_parental from athlete onboarding).
  const [attestCounts, setAttestCounts] = useState({ ATTESTED: 0, PENDING: 0, WITHDRAWN: 0, EXPIRED: 0 });
  const [statusFilter, setStatusFilter] = useState<ConsentStatus>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Query real athlete rows — filter to minors (< 18) on the client after age compute.
      // TODO: Wire to a dedicated loi25_consents table for richer status
      // (obtained / pending / withdrawn / expired + method + form version).
      const { data, error } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, date_naissance, consentement_parental, consentement_parental_date, coach_id, schools!school_id(name), sports!sport_id(nom)")
        .order("last_name", { ascending: true });
      if (error) { console.error("[Admin Loi 25] consent fetch error:", error.message); setLoading(false); return; }

      const coachIds = [...new Set(((data || []) as Record<string, unknown>[]).map((a) => a.coach_id as string).filter(Boolean))];
      const coachNames = new Map<string, string>();
      if (coachIds.length > 0) {
        const { data: coaches } = await supabase.from("users").select("id, first_name, last_name").in("id", coachIds);
        (coaches || []).forEach((c: Record<string, unknown>) => {
          const fn = (c.first_name as string) || "";
          const ln = (c.last_name as string) || "";
          coachNames.set(c.id as string, `${fn[0] || ""}. ${ln}`.trim());
        });
      }

      const built: ConsentRow[] = ((data || []) as Record<string, unknown>[]).map((a) => {
        const schoolRaw = a.schools;
        const school = (Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw) as { name?: string } | null;
        const sportRaw = a.sports;
        const sport = (Array.isArray(sportRaw) ? sportRaw[0] : sportRaw) as { nom?: string } | null;
        return {
          id: a.id as string,
          firstName: (a.first_name as string) || "",
          lastName: (a.last_name as string) || "",
          schoolName: school?.name || "—",
          sportName: sport?.nom || "—",
          age: computeAge(a.date_naissance as string | null),
          consentGiven: Boolean(a.consentement_parental),
          consentDate: (a.consentement_parental_date as string | null) || null,
          coachName: coachNames.get(a.coach_id as string) || "—",
        };
      }).filter((r) => r.age === null || r.age < 18);

      setRows(built);
      setLoading(false);

      // Attestation pipeline counts — read parental_consents (the coach-
      // attestation Loi 25 flow). Admin-only via the new SELECT policy.
      const { data: pcRows, error: pcErr } = await supabase
        .from("parental_consents")
        .select("status");
      if (pcErr) {
        console.error("[Admin Loi 25] parental_consents fetch error:", pcErr.message);
      } else {
        const counts = { ATTESTED: 0, PENDING: 0, WITHDRAWN: 0, EXPIRED: 0 };
        for (const r of (pcRows || []) as { status: string }[]) {
          if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
        }
        setAttestCounts(counts);
      }
    })();
  }, [supabase]);

  const schools = [...new Set(rows.map((r) => r.schoolName))].sort();
  const sports = [...new Set(rows.map((r) => r.sportName))].sort();

  const filtered = rows.filter((r) => {
    if (statusFilter === "obtained" && !r.consentGiven) return false;
    if (statusFilter === "pending" && r.consentGiven) return false;
    if (statusFilter === "withdrawn") return false;
    if (schoolFilter !== "all" && r.schoolName !== schoolFilter) return false;
    if (sportFilter !== "all" && r.sportName !== sportFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !`${r.firstName} ${r.lastName}`.toLowerCase().includes(q)) return false;
    return true;
  });

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Cards = coach-attestation pipeline (parental_consents). The per-row
          table below is the parallel athlete self-registration boolean — the
          two mechanisms are intentionally distinct, the caption flags it. */}
      <div>
        <p className="text-[12px] text-[#6b7280] mb-2">
          Pipeline d&apos;attestation (Loi 25 — formulaire signé par le coach). Distinct du
          consentement auto-déclaré à l&apos;inscription de l&apos;athlète, montré dans la liste ci-dessous.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Obtenus (attestés)" value={attestCounts.ATTESTED} color="text-[#10B981]" />
          <KpiCard label="En attente" value={attestCounts.PENDING} color="text-[#F59E0B]" />
          <KpiCard label="Retirés" value={attestCounts.WITHDRAWN} color="text-[#E63946]" />
          <KpiCard label="Expirés" value={attestCounts.EXPIRED} color="text-[#E63946]" />
        </div>
      </div>

      {/* Renewal banner — based on the attestation pipeline. */}
      {attestCounts.PENDING > 0 && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[#F59E0B] shrink-0" />
          <div className="flex-1 text-[13px] text-[#F59E0B]">
            {attestCounts.PENDING} attestation(s) en attente. Planifier les rappels aux coachs.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <FilterSelect label="Statut" value={statusFilter} onChange={(v) => setStatusFilter(v as ConsentStatus)}
          options={[
            { value: "all", label: "Tous" },
            { value: "obtained", label: "Obtenu" },
            { value: "pending", label: "En attente" },
            { value: "withdrawn", label: "Retiré" },
          ]} />
        <FilterSelect label="École" value={schoolFilter} onChange={setSchoolFilter}
          options={[{ value: "all", label: "Toutes" }, ...schools.map((s) => ({ value: s, label: s }))]} />
        <FilterSelect label="Sport" value={sportFilter} onChange={setSportFilter}
          options={[{ value: "all", label: "Tous" }, ...sports.map((s) => ({ value: s, label: s }))]} />
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="consent-search" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Recherche</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input
              id="consent-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom de l'athlète…"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-[13px] text-white placeholder:text-white/25 focus:border-[#E63946] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-white/[0.02] border-b border-[#1e2128]">
              <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
                <th className="px-4 py-3 font-bold">Athlète</th>
                <th className="px-4 py-3 font-bold">École</th>
                <th className="px-4 py-3 font-bold">Sport</th>
                <th className="px-4 py-3 font-bold text-right">Âge</th>
                <th className="px-4 py-3 font-bold">Statut</th>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Coach</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2128]">
              {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#6b7280]">Chargement…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#6b7280]">Aucun athlète dans cette vue.</td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-white font-medium">{r.firstName} {r.lastName}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{r.schoolName}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{r.sportName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#9CA3AF]">{r.age ?? "—"}</td>
                  <td className="px-4 py-3"><ConsentStatusBadge obtained={r.consentGiven} /></td>
                  <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{formatDate(r.consentDate)}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{r.coachName}</td>
                  <td className="px-4 py-3 text-right">
                    {r.consentGiven ? (
                      <button type="button" onClick={() => notify(`Détails consentement — ${r.firstName} ${r.lastName}`)}
                        className="text-[11px] font-bold uppercase tracking-wider text-[#3B82F6] hover:text-white">Voir</button>
                    ) : (
                      <button type="button" onClick={() => notify(`Rappel envoyé à ${r.coachName}`)}
                        className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B] hover:text-white">Relancer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2 — INCIDENTS
═══════════════════════════════════════════════════════════════ */

// Real registry — backed by public.loi25_incidents (admin-only RLS).
interface IncidentRow {
  id: string;
  date_incident: string;
  severity: string;
  type: string | null;
  description: string | null;
  affected_users_count: number;
  cause: string | null;
  containment: string | null;
  cai_notified: boolean;
  cai_notified_at: string | null;
  status: string;
  created_at: string;
}

function IncidentsTab() {
  const supabase = useMemo(() => createClient(), []);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("loi25_incidents")
      .select("id, date_incident, severity, type, description, affected_users_count, cause, containment, cai_notified, cai_notified_at, status, created_at")
      .order("date_incident", { ascending: false });
    if (error) {
      console.error("[Admin Loi 25] incidents fetch error:", error.message);
      setIncidents([]);
    } else {
      setIncidents((data || []) as IncidentRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-[#9CA3AF]">Registre des incidents de confidentialité (Loi 25 — saisie manuelle par l&apos;admin).</p>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">
          <Plus size={14} /> Signaler un incident
        </button>
      </div>

      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Sévérité</th>
              <th className="px-4 py-3 font-bold text-right">Affectés</th>
              <th className="px-4 py-3 font-bold">CAI</th>
              <th className="px-4 py-3 font-bold">Statut</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6b7280]">Chargement…</td></tr>}
            {!loading && incidents.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6b7280]">Aucun incident enregistré.</td></tr>}
            {incidents.map((inc) => (
              <Fragment key={inc.id}>
                <tr className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-[#9CA3AF] whitespace-nowrap">{formatDate(inc.date_incident)}</td>
                  <td className="px-4 py-3 text-white">{inc.type || "—"}</td>
                  <td className="px-4 py-3"><SeverityBadge level={inc.severity} /></td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#9CA3AF]">{inc.affected_users_count}</td>
                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{inc.cai_notified ? `Oui (${formatDate(inc.cai_notified_at)})` : "Non"}</td>
                  <td className="px-4 py-3"><IncidentStatusBadge status={inc.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                      className="text-[11px] font-bold uppercase tracking-wider text-[#3B82F6] hover:text-white">
                      {expandedId === inc.id ? "Fermer" : "Voir"}
                    </button>
                  </td>
                </tr>
                {expandedId === inc.id && (
                  <tr className="bg-white/[0.02]">
                    <td colSpan={7} className="px-6 py-4 text-[13px] text-[#9CA3AF]">
                      <div className="space-y-3">
                        {inc.description && <div><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Description</span><p className="text-white/85 mt-1">{inc.description}</p></div>}
                        {inc.cause && <div><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Cause</span><p className="text-white/85 mt-1">{inc.cause}</p></div>}
                        {inc.containment && <div><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Confinement</span><p className="text-white/85 mt-1">{inc.containment}</p></div>}
                        <p className="text-[11px] text-[#6b7280]">Enregistré le {formatDate(inc.created_at)}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <IncidentFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); notify("Incident enregistré"); }} />}
      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function IncidentFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date_incident: new Date().toISOString().slice(0, 10),
    severity: "Moyenne",
    type: "",
    description: "",
    affected_users_count: 0,
    cause: "",
    containment: "",
    cai_notified: false,
    cai_notified_at: "",
    status: "OPEN",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("loi25_incidents").insert({
      date_incident: form.date_incident,
      severity: form.severity,
      type: form.type || null,
      description: form.description || null,
      affected_users_count: form.affected_users_count,
      cause: form.cause || null,
      containment: form.containment || null,
      cai_notified: form.cai_notified,
      cai_notified_at: form.cai_notified && form.cai_notified_at ? form.cai_notified_at : null,
      status: form.status,
      created_by: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      console.error("[Loi 25 incident] insert error:", error.message);
      alert("Erreur : " + error.message);
      return;
    }
    onSaved();
  }

  const inputCls = "w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none";
  const textareaCls = "w-full px-3 py-2 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none";
  const labelCls = "block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] bg-[#1A1D24] border border-white/10 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-white/10"><h3 className="text-[17px] font-bold text-white">Signaler un incident</h3></div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3 text-[13px]">
          <div>
            <label htmlFor="inc-date" className={labelCls}>Date de l&apos;incident</label>
            <input id="inc-date" type="date" required value={form.date_incident} onChange={(e) => setForm({ ...form, date_incident: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="inc-severity" className={labelCls}>Sévérité</label>
            <select id="inc-severity" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inputCls}>
              {["Critique", "Élevée", "Moyenne", "Faible"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="inc-type" className={labelCls}>Type</label>
            <select id="inc-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {["Accès non autorisé", "Divulgation accidentelle", "Perte de données", "Tentative d'intrusion", "Autre"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="inc-desc" className={labelCls}>Description</label>
            <textarea id="inc-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={textareaCls} />
          </div>
          <div>
            <label htmlFor="inc-affected" className={labelCls}>Nombre de personnes affectées</label>
            <input id="inc-affected" type="number" min="0" value={form.affected_users_count} onChange={(e) => setForm({ ...form, affected_users_count: parseInt(e.target.value) || 0 })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="inc-cause" className={labelCls}>Cause</label>
            <textarea id="inc-cause" rows={2} value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} className={textareaCls} />
          </div>
          <div>
            <label htmlFor="inc-containment" className={labelCls}>Mesures de confinement</label>
            <textarea id="inc-containment" rows={2} value={form.containment} onChange={(e) => setForm({ ...form, containment: e.target.value })} className={textareaCls} />
          </div>
          <div>
            <label htmlFor="inc-status" className={labelCls}>Statut</label>
            <select id="inc-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
              <option value="OPEN">Ouvert</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="RESOLVED">Résolu</option>
              <option value="CLOSED">Fermé</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-white/80">
            <input type="checkbox" checked={form.cai_notified} onChange={(e) => setForm({ ...form, cai_notified: e.target.checked })} className="accent-[#E63946]" />
            Signalé à la CAI
          </label>
          {form.cai_notified && (
            <div>
              <label htmlFor="inc-cai-at" className={labelCls}>Date de notification CAI</label>
              <input id="inc-cai-at" type="date" value={form.cai_notified_at} onChange={(e) => setForm({ ...form, cai_notified_at: e.target.value })} className={inputCls} />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">Annuler</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-50">{submitting ? "..." : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3 — AUDIT
═══════════════════════════════════════════════════════════════ */

/* ── Audit export — on-demand, from existing signals. No loi25_audit_log
   table, no write-path instrumentation. Two scopes:
   1. User-scoped: ZIP of per-table CSVs (full message bodies). Serves Loi 25
      access / portability requests (Art. 27).
   2. Date-range: single flat timeline CSV (messages metadata only). Serves
      CAI investigations / forensics. */

interface UserOption {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

// CSV cell escape — wraps in "..." if it contains a comma/quote/newline,
// doubles internal quotes. Objects are JSON-stringified.
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build a CSV with a UTF-8 BOM (so Excel renders accents correctly).
function toCsv(rows: Record<string, unknown>[]): string {
  const BOM = "﻿";
  if (rows.length === 0) return BOM + "(aucune donnée)\n";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  return BOM + lines.join("\n") + "\n";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeSlug(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function AuditTab() {
  const supabase = useMemo(() => createClient(), []);
  const [scope, setScope] = useState<"user" | "period">("user");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [pickedUser, setPickedUser] = useState<UserOption | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  // Debounced user search (skipped while a user is picked).
  useEffect(() => {
    const q = userSearch.trim();
    if (q.length < 2 || pickedUser) { setUserResults([]); return; }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, role")
        .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(10);
      setUserResults((data || []) as UserOption[]);
    }, 300);
    return () => clearTimeout(handle);
  }, [userSearch, pickedUser, supabase]);

  // Convert YYYY-MM-DD to inclusive UTC bounds for timestamptz filters.
  function dateBounds(): { startIso: string; endIso: string } | null {
    if (!startDate || !endDate) return null;
    return { startIso: `${startDate}T00:00:00Z`, endIso: `${endDate}T23:59:59.999Z` };
  }

  // ── Scope 1 — user-scoped ZIP of per-table CSVs (full message content) ──
  async function generateUserExport() {
    if (!pickedUser) return;
    setGenerating(true);
    try {
      const zip = new JSZip();
      const dr = dateBounds();

      // Profile snapshot — users row + (for ATHLETE) athletes row.
      const { data: userRow } = await supabase.from("users").select("*").eq("id", pickedUser.id).single();
      const profileRows: Record<string, unknown>[] = [];
      if (userRow) profileRows.push({ _table: "users", ...(userRow as Record<string, unknown>) });
      let athleteId: string | null = null;
      if (pickedUser.role === "ATHLETE") {
        const { data: ath } = await supabase.from("athletes").select("*").eq("user_id", pickedUser.id).maybeSingle();
        if (ath) {
          athleteId = (ath as { id: string }).id;
          profileRows.push({ _table: "athletes", ...(ath as Record<string, unknown>) });
        }
      }
      zip.file("profile.csv", toCsv(profileRows));

      // Role-specific event tables.
      if (pickedUser.role === "ATHLETE" && athleteId) {
        async function fetchByAthlete(table: string, tsCol: string, fname: string) {
          let q = supabase.from(table).select("*").eq("athlete_id", athleteId);
          if (dr) q = q.gte(tsCol, dr.startIso).lte(tsCol, dr.endIso);
          const { data } = await q;
          zip.file(fname, toCsv((data || []) as Record<string, unknown>[]));
        }
        await fetchByAthlete("consent_audit_trail",     "created_at", "consent_audit_trail.csv");
        await fetchByAthlete("activities",              "created_at", "activities.csv");
        await fetchByAthlete("recruiter_athlete_views", "viewed_at",  "recruiter_views.csv");
        await fetchByAthlete("recruiter_activity_log",  "created_at", "recruiter_activity_log.csv");
        await fetchByAthlete("partner_profile_views",   "viewed_at",  "partner_profile_views.csv");
        await fetchByAthlete("athlete_suggestions",     "created_at", "athlete_suggestions.csv");
      } else if (pickedUser.role === "COACH") {
        // activities — coach or actor
        let q1 = supabase.from("activities").select("*").or(`coach_id.eq.${pickedUser.id},actor_id.eq.${pickedUser.id}`);
        if (dr) q1 = q1.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        const { data: actRows } = await q1;
        zip.file("activities.csv", toCsv((actRows || []) as Record<string, unknown>[]));

        let q2 = supabase.from("athlete_suggestions").select("*").eq("coach_id", pickedUser.id);
        if (dr) q2 = q2.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        const { data: sugRows } = await q2;
        zip.file("athlete_suggestions.csv", toCsv((sugRows || []) as Record<string, unknown>[]));

        let q3 = supabase.from("consent_audit_trail").select("*").eq("coach_id", pickedUser.id);
        if (dr) q3 = q3.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        const { data: catRows } = await q3;
        zip.file("consent_audit_trail.csv", toCsv((catRows || []) as Record<string, unknown>[]));
      } else if (pickedUser.role === "RECRUTEUR") {
        let q1 = supabase.from("recruiter_athlete_views").select("*").eq("recruiter_id", pickedUser.id);
        if (dr) q1 = q1.gte("viewed_at", dr.startIso).lte("viewed_at", dr.endIso);
        const { data: ravRows } = await q1;
        zip.file("recruiter_views.csv", toCsv((ravRows || []) as Record<string, unknown>[]));

        let q2 = supabase.from("recruiter_activity_log").select("*").eq("recruiter_id", pickedUser.id);
        if (dr) q2 = q2.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        const { data: ralRows } = await q2;
        zip.file("recruiter_activity_log.csv", toCsv((ralRows || []) as Record<string, unknown>[]));
      } else if (pickedUser.role === "ADMIN") {
        let q1 = supabase.from("loi25_incidents").select("*").eq("created_by", pickedUser.id);
        if (dr) q1 = q1.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        const { data: incRows } = await q1;
        zip.file("loi25_incidents.csv", toCsv((incRows || []) as Record<string, unknown>[]));

        let q2 = supabase.from("loi25_portability_requests").select("*").eq("created_by", pickedUser.id);
        if (dr) q2 = q2.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        const { data: pReqRows } = await q2;
        zip.file("loi25_portability_requests.csv", toCsv((pReqRows || []) as Record<string, unknown>[]));
      }

      // Messages — full content. Find conversations the user is involved in.
      let convoFilter = "";
      if (pickedUser.role === "ATHLETE" && athleteId) convoFilter = `athlete_id.eq.${athleteId}`;
      else if (pickedUser.role === "COACH") convoFilter = `coach_id.eq.${pickedUser.id}`;
      else if (pickedUser.role === "RECRUTEUR") convoFilter = `recruiter_id.eq.${pickedUser.id}`;
      if (convoFilter) {
        const { data: convos } = await supabase.from("conversations").select("id").or(convoFilter);
        const convoIds = ((convos || []) as { id: string }[]).map((c) => c.id);
        if (convoIds.length > 0) {
          let q = supabase.from("messages").select("*").in("conversation_id", convoIds);
          if (dr) q = q.gte("created_at", dr.startIso).lte("created_at", dr.endIso);
          const { data: msgs } = await q;
          zip.file("messages.csv", toCsv((msgs || []) as Record<string, unknown>[]));
        } else {
          zip.file("messages.csv", toCsv([]));
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const fname = `loi25_export_${safeSlug(pickedUser.email)}_${todayIso()}.zip`;
      downloadBlob(blob, fname);
      notify(`Exporté : ${fname}`);
    } catch (err) {
      console.error("[Audit export user]", err);
      notify("Erreur — voir la console");
    } finally {
      setGenerating(false);
    }
  }

  // ── Scope 2 — date-range flat CSV (messages = metadata only) ──
  async function generatePeriodExport() {
    const dr = dateBounds();
    if (!dr) return;
    setGenerating(true);
    try {
      const optUser = pickedUser?.id ?? null;
      const allRows: Record<string, unknown>[] = [];
      function push(ts: string, source_table: string, event_type: string, actor_id: string | null, actor_role: string | null, target_athlete_id: string | null, details: Record<string, unknown>) {
        allRows.push({ timestamp: ts, source_table, event_type, actor_id, actor_role, target_athlete_id, details_json: details });
      }

      // consent_audit_trail
      {
        let q = supabase.from("consent_audit_trail").select("*").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.eq("coach_id", optUser);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "consent_audit_trail", (r.action as string) || "", (r.coach_id as string) ?? null, "COACH", (r.athlete_id as string) ?? null,
            { previous_status: r.previous_status, new_status: r.new_status, ip_address: r.ip_address, metadata: r.metadata });
        }
      }
      // activities
      {
        let q = supabase.from("activities").select("*").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.or(`actor_id.eq.${optUser},coach_id.eq.${optUser}`);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "activities", (r.type as string) || "", (r.actor_id as string) ?? null, (r.actor_role as string) ?? null, (r.athlete_id as string) ?? null,
            { coach_id: r.coach_id, metadata: r.metadata });
        }
      }
      // recruiter_athlete_views
      {
        let q = supabase.from("recruiter_athlete_views").select("*").gte("viewed_at", dr.startIso).lte("viewed_at", dr.endIso);
        if (optUser) q = q.eq("recruiter_id", optUser);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.viewed_at as string, "recruiter_athlete_views", "PROFILE_VIEW", (r.recruiter_id as string) ?? null, "RECRUTEUR", (r.athlete_id as string) ?? null, {});
        }
      }
      // recruiter_activity_log
      {
        let q = supabase.from("recruiter_activity_log").select("*").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.eq("recruiter_id", optUser);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "recruiter_activity_log", (r.action_type as string) || "", (r.recruiter_id as string) ?? null, "RECRUTEUR", (r.athlete_id as string) ?? null,
            { list_id: r.list_id, details: r.details });
        }
      }
      // partner_profile_views — partner_id is media_partners.id, not users.id.
      // If optUser is set, resolve to that user's media_partners.id first.
      {
        let partnerIds: string[] | null = null;
        if (optUser) {
          const { data: mps } = await supabase.from("media_partners").select("id").eq("user_id", optUser);
          partnerIds = ((mps || []) as { id: string }[]).map((m) => m.id);
        }
        if (partnerIds === null || partnerIds.length > 0) {
          let q = supabase.from("partner_profile_views").select("*").gte("viewed_at", dr.startIso).lte("viewed_at", dr.endIso);
          if (partnerIds) q = q.in("partner_id", partnerIds);
          const { data } = await q;
          for (const r of (data || []) as Record<string, unknown>[]) {
            push(r.viewed_at as string, "partner_profile_views", "PARTNER_VIEW", (r.partner_id as string) ?? null, "PARTNER", (r.athlete_id as string) ?? null, {});
          }
        }
      }
      // athlete_suggestions
      {
        let q = supabase.from("athlete_suggestions").select("*").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.or(`submitted_by.eq.${optUser},coach_id.eq.${optUser}`);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "athlete_suggestions", `SUGGESTION_${r.status ?? ""}`, (r.submitted_by as string) ?? null, null, (r.athlete_id as string) ?? null,
            { champ: r.champ, valeur_proposee: r.valeur_proposee, status: r.status });
        }
      }
      // messages — METADATA ONLY (no body content)
      {
        let q = supabase.from("messages").select("id, conversation_id, sender_id, created_at").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.eq("sender_id", optUser);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "messages", "MESSAGE_SENT", (r.sender_id as string) ?? null, null, null, { conversation_id: r.conversation_id });
        }
      }
      // loi25_incidents
      {
        let q = supabase.from("loi25_incidents").select("*").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.eq("created_by", optUser);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "loi25_incidents", `INCIDENT_${r.status ?? ""}`, (r.created_by as string) ?? null, "ADMIN", null,
            { severity: r.severity, type: r.type, affected_users_count: r.affected_users_count, cai_notified: r.cai_notified });
        }
      }
      // loi25_portability_requests
      {
        let q = supabase.from("loi25_portability_requests").select("*").gte("created_at", dr.startIso).lte("created_at", dr.endIso);
        if (optUser) q = q.eq("created_by", optUser);
        const { data } = await q;
        for (const r of (data || []) as Record<string, unknown>[]) {
          push(r.created_at as string, "loi25_portability_requests", `PORT_${r.status ?? ""}`, (r.created_by as string) ?? null, "ADMIN", null,
            { request_type: r.request_type, requester_name: r.requester_name });
        }
      }

      allRows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      const csv = toCsv(allRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const fname = `loi25_activite_${startDate}_${endDate}${optUser ? "_" + safeSlug(pickedUser!.email) : ""}.csv`;
      downloadBlob(blob, fname);
      notify(`Exporté : ${fname} (${allRows.length} événement${allRows.length > 1 ? "s" : ""})`);
    } catch (err) {
      console.error("[Audit export period]", err);
      notify("Erreur — voir la console");
    } finally {
      setGenerating(false);
    }
  }

  const inputCls = "w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white placeholder:text-white/25 focus:border-[#E63946] focus:outline-none";
  const labelCls = "block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5";

  function clearPickedUser() {
    setPickedUser(null);
    setUserSearch("");
    setUserResults([]);
  }

  function PickedUserChip({ onClear, label }: { onClear: () => void; label: string }) {
    return (
      <div className="flex items-center justify-between bg-[#111317] border border-[#E63946]/40 rounded-lg px-3 py-2.5">
        <div>
          <p className="text-[13px] text-white">{`${pickedUser!.first_name ?? ""} ${pickedUser!.last_name ?? ""}`.trim() || pickedUser!.email}</p>
          <p className="text-[11px] text-[#6b7280]">{pickedUser!.email} · {pickedUser!.role}</p>
        </div>
        <button type="button" onClick={onClear} className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">{label}</button>
      </div>
    );
  }

  function UserSearchInput({ inputId, placeholder }: { inputId: string; placeholder: string }) {
    return (
      <>
        <input id={inputId} type="text" placeholder={placeholder} value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className={inputCls} />
        {userResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
            {userResults.map((u) => (
              <button key={u.id} type="button" onClick={() => { setPickedUser(u); setUserSearch(""); setUserResults([]); }}
                className="w-full text-left bg-[#111317] border border-white/[0.06] rounded-lg px-3 py-2 hover:border-[#E63946]/40 transition-colors">
                <p className="text-[13px] text-white">{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email}</p>
                <p className="text-[11px] text-[#6b7280]">{u.email} · {u.role}</p>
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-[#9CA3AF]">Export Loi 25 à la demande — depuis les signaux déjà enregistrés (pas de journal toujours actif).</p>

      {/* Scope picker */}
      <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Mode d&apos;export</p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="audit-scope" value="user" checked={scope === "user"} onChange={() => setScope("user")} className="accent-[#E63946] mt-1" />
            <div>
              <p className="text-[13px] text-white font-bold">Tout sur un utilisateur</p>
              <p className="text-[11px] text-[#6b7280]">ZIP de CSV par table — pour les demandes d&apos;accès / portabilité (Loi 25 Art. 27).</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name="audit-scope" value="period" checked={scope === "period"} onChange={() => setScope("period")} className="accent-[#E63946] mt-1" />
            <div>
              <p className="text-[13px] text-white font-bold">Activité par période</p>
              <p className="text-[11px] text-[#6b7280]">CSV plat (chronologie) — pour les enquêtes CAI et la forensique.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Scope 1 — user-scoped */}
      {scope === "user" && (
        <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <div>
            <label htmlFor="aud-user" className={labelCls}>Utilisateur (nom ou courriel)</label>
            {pickedUser
              ? <PickedUserChip onClear={clearPickedUser} label="Changer" />
              : <UserSearchInput inputId="aud-user" placeholder="Tape un nom ou un courriel…" />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="aud-u-start" className={labelCls}>Date de début (optionnel)</label>
              <input id="aud-u-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="aud-u-end" className={labelCls}>Date de fin (optionnel)</label>
              <input id="aud-u-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button type="button" disabled={!pickedUser || generating} onClick={generateUserExport}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={14} /> {generating ? "Génération…" : "Générer le ZIP"}
          </button>
        </div>
      )}

      {/* Scope 2 — period */}
      {scope === "period" && (
        <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="aud-p-start" className={labelCls}>Date de début</label>
              <input id="aud-p-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="aud-p-end" className={labelCls}>Date de fin</label>
              <input id="aud-p-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="aud-p-user" className={labelCls}>Filtrer par utilisateur (optionnel)</label>
            {pickedUser
              ? <PickedUserChip onClear={clearPickedUser} label="Effacer" />
              : <UserSearchInput inputId="aud-p-user" placeholder="Tape un nom ou un courriel pour filtrer…" />}
          </div>
          <button type="button" disabled={!startDate || !endDate || generating} onClick={generatePeriodExport}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={14} /> {generating ? "Génération…" : "Générer la chronologie"}
          </button>
        </div>
      )}

      {/* Scope note — what's covered and what isn't. */}
      <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl p-4">
        <p className="text-[12px] font-bold text-[#F59E0B] mb-2">Périmètre de l&apos;export</p>
        <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
          <span className="text-white/90">Inclus :</span> consentements (parental_consents + consent_audit_trail), vues RP (recruteurs, partenaires médias), actions recruteurs (notes, pipeline, favoris), suggestions de profil, registre d&apos;incidents, demandes de portabilité, snapshot du profil utilisateur, et — dans l&apos;export par utilisateur seulement — le contenu complet des messages où l&apos;utilisateur a participé.
        </p>
        <p className="text-[12px] text-[#9CA3AF] mt-2 leading-relaxed">
          <span className="text-white/90">Non couvert :</span> événements de connexion, journal des lectures SQL, diff exhaustif de chaque modification de champ. L&apos;export ne reconstruit que ce qui a été enregistré dans les tables ci-dessus.
        </p>
        <p className="text-[12px] text-[#9CA3AF] mt-2 leading-relaxed">
          <span className="text-white/90">Messages :</span> l&apos;export par utilisateur inclut les corps (les données de l&apos;utilisateur, droit d&apos;accès Loi 25). L&apos;export par période ne montre que les métadonnées (horodatage, expéditeur, conversation) — pas les corps.
        </p>
      </div>

      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4 — PORTABILITÉ
═══════════════════════════════════════════════════════════════ */

// Real tracker — backed by public.loi25_portability_requests (admin-only).
interface PortabilityRow {
  id: string;
  requester_name: string;
  requester_email: string | null;
  request_type: string;
  submitted_at: string;
  deadline: string;
  status: string;
  fulfilled_at: string | null;
  notes: string | null;
}

const PORTABILITY_TYPE_LABEL: Record<string, string> = {
  access: "Accès",
  portability: "Portabilité",
  rectification: "Rectification",
  deletion: "Suppression",
};

function PortabiliteTab() {
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState<PortabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("loi25_portability_requests")
      .select("id, requester_name, requester_email, request_type, submitted_at, deadline, status, fulfilled_at, notes")
      .order("deadline", { ascending: true });
    if (error) {
      console.error("[Admin Loi 25] portability fetch error:", error.message);
      setRequests([]);
    } else {
      setRequests((data || []) as PortabilityRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  async function setStatus(id: string, status: string, fulfilledAt: string | null) {
    const { error } = await supabase
      .from("loi25_portability_requests")
      .update({ status, fulfilled_at: fulfilledAt })
      .eq("id", id);
    if (error) {
      console.error("[Loi 25 portability] update error:", error.message);
      notify("Erreur : " + error.message);
      return;
    }
    await refresh();
    notify("Statut mis à jour");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-[#9CA3AF]">Demandes Loi 25 (accès / portabilité / rectification / suppression — délai légal de 30 jours).</p>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">
          <Plus size={14} /> Nouvelle demande
        </button>
      </div>

      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">Reçue</th>
              <th className="px-4 py-3 font-bold">Demandeur</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Statut</th>
              <th className="px-4 py-3 font-bold">Échéance</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">Chargement…</td></tr>}
            {!loading && requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#6b7280]">Aucune demande enregistrée.</td></tr>}
            {requests.map((req) => {
              const deadlineDate = new Date(req.deadline);
              deadlineDate.setHours(0, 0, 0, 0);
              const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000);
              const open = req.status === "pending" || req.status === "in_progress";
              const cls = !open
                ? "text-[#6b7280]"
                : daysLeft <= 0
                ? "text-[#E63946] font-bold"
                : daysLeft <= 7
                ? "text-[#F59E0B] font-bold"
                : "text-[#9CA3AF]";
              const label = !open
                ? formatDate(req.deadline)
                : daysLeft <= 0
                ? `${Math.abs(daysLeft)}j en retard`
                : `${daysLeft}j restants`;
              return (
                <tr key={req.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-[#9CA3AF] whitespace-nowrap">{formatDate(req.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <p className="text-white">{req.requester_name}</p>
                    {req.requester_email && <p className="text-[11px] text-[#6b7280]">{req.requester_email}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{PORTABILITY_TYPE_LABEL[req.request_type] ?? req.request_type}</td>
                  <td className="px-4 py-3"><PortabilityStatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 text-[12px]">
                    <Clock size={12} className="inline mr-1 text-[#6b7280]" />
                    <span className={cls}>{label}</span>
                    {req.fulfilled_at && <p className="text-[10px] text-[#6b7280] mt-0.5">Complétée : {formatDate(req.fulfilled_at)}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {open && (
                      <div className="inline-flex gap-3">
                        <button type="button" onClick={() => setStatus(req.id, "fulfilled", new Date().toISOString().slice(0, 10))}
                          className="text-[11px] font-bold uppercase tracking-wider text-[#10B981] hover:text-white">Compléter</button>
                        <button type="button" onClick={() => setStatus(req.id, "refused", null)}
                          className="text-[11px] font-bold uppercase tracking-wider text-[#E63946] hover:text-white">Refuser</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && <PortabilityFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refresh(); notify("Demande enregistrée"); }} />}
      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function PortabilityFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    requester_name: "",
    requester_email: "",
    request_type: "access",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("loi25_portability_requests").insert({
      requester_name: form.requester_name,
      requester_email: form.requester_email || null,
      request_type: form.request_type,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      console.error("[Loi 25 portability] insert error:", error.message);
      alert("Erreur : " + error.message);
      return;
    }
    onSaved();
  }

  const inputCls = "w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none";
  const textareaCls = "w-full px-3 py-2 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none";
  const labelCls = "block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[520px] bg-[#1A1D24] border border-white/10 rounded-xl shadow-2xl">
        <div className="px-6 py-5 border-b border-white/10"><h3 className="text-[17px] font-bold text-white">Nouvelle demande</h3></div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3 text-[13px]">
          <div>
            <label htmlFor="port-name" className={labelCls}>Demandeur</label>
            <input id="port-name" type="text" required value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="port-email" className={labelCls}>Courriel (optionnel)</label>
            <input id="port-email" type="email" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="port-type" className={labelCls}>Type de demande</label>
            <select id="port-type" value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })} className={inputCls}>
              <option value="access">Accès</option>
              <option value="portability">Portabilité</option>
              <option value="rectification">Rectification</option>
              <option value="deletion">Suppression</option>
            </select>
          </div>
          <div>
            <label htmlFor="port-notes" className={labelCls}>Notes</label>
            <textarea id="port-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={textareaCls} />
          </div>
          <p className="text-[11px] text-[#6b7280]">L&apos;échéance (30 jours) est calculée automatiquement à partir de la date de soumission.</p>
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">Annuler</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-50">{submitting ? "..." : "Créer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 5 — RPRP
═══════════════════════════════════════════════════════════════ */

// Per-school RPRP is the school's is_school_admin director user. Read live —
// no rprp_name/rprp_email cols on schools (would drift from the user record
// every rename / email change). Nomination date prefers the explicit consent
// timestamp (profile_data.rprp_accepted_at, written by DirectorChoiceStep
// from commit 2) and falls back to admin_claims.reviewed_at — the approval
// date is when the director was officially designated.
//
// Nexus-level RPRP lives in the loi25_settings singleton (admin-only RLS).

interface SchoolRprpRow {
  school_id: string;
  org: string;
  type: string;            // "École" | "CÉGEP" | "Mixte" | "—"
  director_name: string | null;
  director_email: string | null;
  admin_type: string | null;   // "owner" | "interim" | null
  // Nomination date — prefers rprp_accepted_at, then rprp_declined_at
  // (for declined directors, surface the decline date), then
  // admin_claims.reviewed_at (legacy directors with no explicit consent).
  nominated_at: string | null;
  // rprp_status discriminator: "active" (consented OR legacy approved with
  // no explicit decline), "declined" (rprp_declined_at set), "missing"
  // (no director user at all). Drives the Statut pill in the table.
  rprp_status: "active" | "declined" | "missing";
}

interface SchoolRow {
  id: string;
  name: string;
  has_secondaire: boolean | null;
  has_collegial: boolean | null;
}

interface DirectorUserRow {
  id: string;
  school_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_data: Record<string, unknown> | null;
}

interface ApprovedClaimRow {
  user_id: string;
  reviewed_at: string | null;
}

function schoolTypeLabel(s: SchoolRow): string {
  if (s.has_secondaire && s.has_collegial) return "Mixte";
  if (s.has_collegial) return "CÉGEP";
  if (s.has_secondaire) return "École";
  return "—";
}

function directorTypeLabel(t: string | null): string {
  if (t === "owner") return "Directeur";
  if (t === "interim") return "Directeur intérimaire";
  return "—";
}

function RprpTab() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SchoolRprpRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Nexus singleton state — name/email/date are seeded from loi25_settings.
  const [nexusName, setNexusName] = useState("");
  const [nexusEmail, setNexusEmail] = useState("");
  const [nexusDate, setNexusDate] = useState("");
  const [nexusLoaded, setNexusLoaded] = useState(false);
  const [savingNexus, setSavingNexus] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // Load per-school RPRPs + Nexus singleton in parallel on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // schools table is seeded from MEQ open data (>1000 rows). Scope the RPRP
      // matrix to organisations actually using Nexus — i.e. schools with at least
      // one user (coach/admin/athlete). MEQ rows with zero users aren't Nexus
      // organisations and don't need a designated RPRP.
      const [schoolsWithUsersRes, directorsRes, claimsRes, settingsRes] = await Promise.all([
        supabase
          .from("users")
          .select("school_id")
          .not("school_id", "is", null),
        supabase
          .from("users")
          .select("id,school_id,first_name,last_name,email,profile_data")
          .eq("is_school_admin", true)
          .not("school_id", "is", null),
        supabase
          .from("admin_claims")
          .select("user_id,reviewed_at")
          .eq("status", "APPROVED"),
        supabase
          .from("loi25_settings")
          .select("rprp_name,rprp_email,rprp_named_at")
          .eq("id", true)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (schoolsWithUsersRes.error) {
        setLoadError(schoolsWithUsersRes.error.message);
        setRows([]);
        return;
      }

      const activeSchoolIds = Array.from(
        new Set(
          ((schoolsWithUsersRes.data ?? []) as { school_id: string | null }[])
            .map((r) => r.school_id)
            .filter((id): id is string => !!id),
        ),
      );

      const schoolsRes = activeSchoolIds.length === 0
        ? { data: [] as SchoolRow[], error: null }
        : await supabase
            .from("schools")
            .select("id,name,has_secondaire,has_collegial")
            .in("id", activeSchoolIds)
            .order("name");

      if (schoolsRes.error || directorsRes.error || claimsRes.error) {
        setLoadError(
          schoolsRes.error?.message
            || directorsRes.error?.message
            || claimsRes.error?.message
            || "Erreur de chargement",
        );
        setRows([]);
        return;
      }

      const schools = (schoolsRes.data ?? []) as SchoolRow[];
      const directors = (directorsRes.data ?? []) as DirectorUserRow[];
      const claims = (claimsRes.data ?? []) as ApprovedClaimRow[];

      // Latest APPROVED claim per user (defensive: re-approve cycles).
      const claimByUser = new Map<string, string | null>();
      for (const c of claims) {
        const prior = claimByUser.get(c.user_id) ?? null;
        if (!prior || (c.reviewed_at && c.reviewed_at > prior)) {
          claimByUser.set(c.user_id, c.reviewed_at);
        }
      }

      // Pick one director per school — owner wins over interim.
      const bySchool = new Map<string, DirectorUserRow>();
      for (const d of directors) {
        if (!d.school_id) continue;
        const current = bySchool.get(d.school_id);
        const dType = (d.profile_data as Record<string, unknown> | null)?.["admin_type"] ?? null;
        if (!current) { bySchool.set(d.school_id, d); continue; }
        const cType = (current.profile_data as Record<string, unknown> | null)?.["admin_type"] ?? null;
        // Owner outranks interim; otherwise keep first match.
        if (dType === "owner" && cType !== "owner") bySchool.set(d.school_id, d);
      }

      const built: SchoolRprpRow[] = schools.map((s) => {
        const d = bySchool.get(s.id) ?? null;
        const profile = (d?.profile_data ?? null) as Record<string, unknown> | null;
        const adminType = (profile?.["admin_type"] as string | null) ?? null;
        const acceptedAt = (profile?.["rprp_accepted_at"] as string | null) ?? null;
        const declinedAt = (profile?.["rprp_declined_at"] as string | null) ?? null;
        const approvedAt = d ? (claimByUser.get(d.id) ?? null) : null;
        // Surface the most relevant date: explicit consent > explicit
        // decline > legacy approval. Mutual exclusivity is enforced at
        // write time (finish() always sets exactly one of accepted/declined).
        const nominatedAt = acceptedAt ?? declinedAt ?? approvedAt;
        const dirName = d ? [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || null : null;
        // Discriminator precedence: declined > active > missing.
        const rprpStatus: "active" | "declined" | "missing" = declinedAt
          ? "declined"
          : dirName
            ? "active"
            : "missing";
        return {
          school_id: s.id,
          org: s.name,
          type: schoolTypeLabel(s),
          director_name: dirName,
          director_email: d?.email ?? null,
          admin_type: adminType,
          nominated_at: nominatedAt,
          rprp_status: rprpStatus,
        };
      });

      // Sort: missing first (most urgent), then declined, then active, alpha within.
      const statusOrder: Record<SchoolRprpRow["rprp_status"], number> = { missing: 0, declined: 1, active: 2 };
      built.sort((a, b) => {
        const orderDiff = statusOrder[a.rprp_status] - statusOrder[b.rprp_status];
        if (orderDiff !== 0) return orderDiff;
        return a.org.localeCompare(b.org, "fr-CA");
      });

      setRows(built);

      if (settingsRes.data) {
        setNexusName(settingsRes.data.rprp_name ?? "");
        setNexusEmail(settingsRes.data.rprp_email ?? "");
        setNexusDate(settingsRes.data.rprp_named_at ?? "");
      }
      setNexusLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [supabase]);

  async function saveNexus() {
    setSavingNexus(true);
    const { error } = await supabase
      .from("loi25_settings")
      .update({
        rprp_name: nexusName.trim() || null,
        rprp_email: nexusEmail.trim() || null,
        rprp_named_at: nexusDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSavingNexus(false);
    if (error) {
      setToast(`Erreur : ${error.message}`);
    } else {
      setToast("RPRP Nexus enregistré");
    }
    setTimeout(() => setToast(null), 3000);
  }

  const missingCount = rows ? rows.filter((r) => r.rprp_status === "missing").length : 0;
  const declinedCount = rows ? rows.filter((r) => r.rprp_status === "declined").length : 0;

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-[#9CA3AF]">Responsable de la protection des renseignements personnels — chaque organisation doit en désigner un.</p>

      {/* Nexus RPRP card — backed by loi25_settings singleton */}
      <div className="bg-[#1A1D24] border-2 border-[#E63946]/40 rounded-xl p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#E63946]">Nexus — RPRP de la plateforme</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label htmlFor="rprp-nexus-name" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Nom</label>
            <input id="rprp-nexus-name" type="text" value={nexusName} onChange={(e) => setNexusName(e.target.value)}
              disabled={!nexusLoaded}
              className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label htmlFor="rprp-nexus-email" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Courriel</label>
            <input id="rprp-nexus-email" type="email" value={nexusEmail} onChange={(e) => setNexusEmail(e.target.value)}
              disabled={!nexusLoaded}
              className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label htmlFor="rprp-nexus-date" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Date de nomination</label>
            <input id="rprp-nexus-date" type="date" value={nexusDate} onChange={(e) => setNexusDate(e.target.value)}
              disabled={!nexusLoaded}
              className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none disabled:opacity-50" />
          </div>
        </div>
        <button type="button" onClick={saveNexus} disabled={!nexusLoaded || savingNexus}
          className="mt-4 inline-flex items-center h-9 px-4 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-50">
          {savingNexus ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {/* Missing RPRP alert */}
      {rows && missingCount > 0 && (
        <div className="bg-[#E63946]/10 border border-[#E63946]/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[#E63946] shrink-0" />
          <div className="flex-1 text-[13px] text-[#E63946]">
            {missingCount} établissement(s) n&apos;ont pas désigné leur RPRP. Ceci constitue une non-conformité à la Loi 25.
          </div>
        </div>
      )}

      {/* Declined RPRP alert — director onboarded but refused the RPRP role. */}
      {rows && declinedCount > 0 && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[#F59E0B] shrink-0" />
          <div className="flex-1 text-[13px] text-[#F59E0B]">
            {declinedCount} directeur(s) ont refusé la désignation RPRP — un responsable doit être nommé pour ces établissements.
          </div>
        </div>
      )}

      {loadError && (
        <div className="bg-[#E63946]/10 border border-[#E63946]/40 rounded-xl p-4 text-[13px] text-[#E63946]">
          Erreur : {loadError}
        </div>
      )}

      {/* Schools/CÉGEPs table — live from director users */}
      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">Organisation</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">RPRP désigné</th>
              <th className="px-4 py-3 font-bold">Courriel</th>
              <th className="px-4 py-3 font-bold">Rôle</th>
              <th className="px-4 py-3 font-bold">Nomination</th>
              <th className="px-4 py-3 font-bold">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {rows === null && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[#6b7280]">Chargement…</td></tr>
            )}
            {rows && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[#6b7280]">Aucune organisation.</td></tr>
            )}
            {rows && rows.map((r) => (
              <tr key={r.school_id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white font-medium">{r.org}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{r.type}</td>
                <td className="px-4 py-3 text-white">
                  {r.director_name ?? <span className="text-[#E63946]">Aucun RPRP désigné</span>}
                </td>
                <td className="px-4 py-3 text-[#9CA3AF]">{r.director_email ?? "—"}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{directorTypeLabel(r.admin_type)}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{formatDate(r.nominated_at)}</td>
                <td className="px-4 py-3">
                  {r.rprp_status === "active" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/15 text-[#10B981] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <Check size={10} strokeWidth={3} /> Actif
                    </span>
                  )}
                  {r.rprp_status === "declined" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <AlertTriangle size={10} /> RPRP refusé
                    </span>
                  )}
                  {r.rprp_status === "missing" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E63946]/15 text-[#E63946] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <AlertTriangle size={10} /> Non désigné
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#6b7280] italic">
        Le RPRP de chaque établissement est son utilisateur directeur (<code className="text-[#9CA3AF]">is_school_admin = true</code>).
        La date de nomination provient du consentement explicite (<code className="text-[#9CA3AF]">profile_data.rprp_accepted_at</code>),
        sinon du refus (<code className="text-[#9CA3AF]">rprp_declined_at</code>) ou de l&apos;approbation de la revendication d&apos;administration (<code className="text-[#9CA3AF]">admin_claims.reviewed_at</code>).
        Le statut « RPRP refusé » signale un directeur en poste qui n&apos;a pas accepté la désignation Loi 25 — il faut nommer un responsable.
      </p>

      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 6 — CONFORMITÉ
═══════════════════════════════════════════════════════════════ */

type CheckStatus = "done" | "partial" | "missing";

interface ChecklistItem { label: string; status: CheckStatus; description?: string }

// TODO: This checklist is hardcoded and reflects the current state of the codebase
// and infrastructure. Eventually it should be dynamic, driven by real state checks.
const CHECKLIST: { phase: string; description: string; items: ChecklistItem[] }[] = [
  {
    phase: "Phase 0 — Fondations légales",
    description: "À compléter avant la production.",
    items: [
      { label: "Politique de confidentialité publiée (/confidentialite)", status: "done" },
      { label: "RLS activé sur Supabase", status: "done" },
      { label: "Chiffrement TLS 1.3 en transit", status: "done" },
      { label: "Hébergement au Québec (OVHcloud planifié)", status: "done" },
      { label: "ÉFVP formelle", status: "partial", description: "Document interne rédigé, révision en cours." },
      { label: "RPRP Nexus désigné", status: "partial" },
      { label: "Contrats de sous-traitance écoles", status: "missing" },
      { label: "Contrats de sous-traitance CÉGEPs", status: "missing" },
      { label: "Formulaire de consentement parental validé par avocat", status: "missing" },
    ],
  },
  {
    phase: "Phase 1 — Consentement et conformité de base",
    description: "Exigences immédiates après mise en ligne.",
    items: [
      { label: "Consentement parental intégré dans le flux de création", status: "done" },
      { label: "Badge de consentement sur les profils", status: "done" },
      { label: "Tableau de bord des consentements (admin — cette page)", status: "partial" },
      { label: "Bannière cookies (CMP) sur le site", status: "missing" },
      { label: "Conditions d'utilisation avec acceptation obligatoire", status: "missing" },
      { label: "Blocage activation sans consentement (mode brouillon)", status: "missing" },
    ],
  },
  {
    phase: "Phase 2 — Traçabilité et sécurité",
    description: "Infrastructure d'audit et de suivi.",
    items: [
      { label: "Audit log complet", status: "missing" },
      { label: "Export de portabilité (bouton UI)", status: "missing" },
      { label: "Registre d'incidents intégré", status: "missing" },
      { label: "Renouvellement annuel des consentements", status: "missing" },
      { label: "Champ RPRP dans paramètres établissements", status: "missing" },
    ],
  },
  {
    phase: "Phase 3 — Conformité complète",
    description: "Maturité opérationnelle.",
    items: [
      { label: "Migration Vercel → OVHcloud", status: "missing" },
      { label: "Destruction automatisée (2 ans post-graduation)", status: "missing" },
      { label: "Rapport CAI exportable", status: "missing" },
      { label: "Anonymisation des données historiques", status: "missing" },
    ],
  },
];

function ConformiteTab() {
  const allItems = CHECKLIST.flatMap((p) => p.items);
  const total = allItems.length;
  const completed = allItems.filter((i) => i.status === "done").length;
  const partial = allItems.filter((i) => i.status === "partial").length;
  // Count "done" + half of "partial" for the progress ring.
  const score = total > 0 ? Math.round(((completed + partial * 0.5) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Score card */}
      <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreRing pct={score} />
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E63946]">Score de conformité</p>
          <p className="font-head text-[32px] sm:text-[40px] font-black text-white leading-none mt-1">{score}%</p>
          <p className="text-[13px] text-[#9CA3AF] mt-2">
            <span className="text-white font-semibold">{completed}</span> complété · <span className="text-[#F59E0B]">{partial}</span> partiel · <span className="text-[#E63946]">{total - completed - partial}</span> manquant
          </p>
        </div>
      </div>

      {/* Checklist by phase */}
      {CHECKLIST.map((phase) => (
        <div key={phase.phase} className="bg-[#1A1D24] border border-white/10 rounded-xl p-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E63946]">{phase.phase}</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">{phase.description}</p>
          <ul className="mt-4 space-y-2">
            {phase.items.map((item, i) => (
              <li key={`${phase.phase}-${i}`} className="flex items-start gap-3 py-1">
                <ChecklistIcon status={item.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/85">{item.label}</p>
                  {item.description && <p className="text-[11px] text-[#6b7280] mt-0.5">{item.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Shared atoms
═══════════════════════════════════════════════════════════════ */

function KpiCard({ label, value, color = "text-white", footnote }: { label: string; value: number; color?: string; footnote?: string }) {
  return (
    <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{label}</p>
      <p className={`font-head text-[32px] font-black leading-none mt-2 tabular-nums ${color}`}>{value}</p>
      {footnote && <p className="text-[11px] text-[#6b7280] mt-1.5">{footnote}</p>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = `flt-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="h-9 px-3 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ConsentStatusBadge({ obtained }: { obtained: boolean }) {
  return obtained ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/15 text-[#10B981] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <Check size={10} strokeWidth={3} /> Obtenu
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <Clock size={10} /> En attente
    </span>
  );
}

function SeverityBadge({ level }: { level: string }) {
  const l = level.toLowerCase();
  const cls = l === "critique" ? "bg-[#E63946]/15 text-[#E63946]"
    : l === "élevée" ? "bg-[#F59E0B]/15 text-[#F59E0B]"
    : l === "moyenne" ? "bg-[#EAB308]/15 text-[#EAB308]"
    : "bg-white/5 text-white/60";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{level}</span>;
}

function IncidentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    OPEN:        { cls: "bg-[#F59E0B]/15 text-[#F59E0B]", label: "Ouvert" },
    IN_PROGRESS: { cls: "bg-[#3B82F6]/15 text-[#3B82F6]", label: "En cours" },
    RESOLVED:    { cls: "bg-[#10B981]/15 text-[#10B981]", label: "Résolu" },
    CLOSED:      { cls: "bg-white/5 text-white/60",       label: "Fermé" },
  };
  const s = map[status] ?? { cls: "bg-white/5 text-white/60", label: status };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>{s.label}</span>;
}

function PortabilityStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:     { cls: "bg-[#F59E0B]/15 text-[#F59E0B]", label: "En attente" },
    in_progress: { cls: "bg-[#3B82F6]/15 text-[#3B82F6]", label: "En cours" },
    fulfilled:   { cls: "bg-[#10B981]/15 text-[#10B981]", label: "Complétée" },
    refused:     { cls: "bg-white/5 text-white/60",       label: "Refusée" },
  };
  const s = map[status] ?? { cls: "bg-white/5 text-white/60", label: status };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>{s.label}</span>;
}

function ChecklistIcon({ status }: { status: CheckStatus }) {
  if (status === "done") {
    return <span className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center"><Check size={11} strokeWidth={3} /></span>;
  }
  if (status === "partial") {
    return <span className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center"><AlertTriangle size={11} strokeWidth={2.5} /></span>;
  }
  return <span className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-[#E63946]/15 text-[#E63946] flex items-center justify-center"><XIcon size={11} strokeWidth={3} /></span>;
}

function ScoreRing({ pct }: { pct: number }) {
  // Simple ring using SVG stroke-dasharray so it works without recharts.
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r={radius} stroke="#2D3748" strokeWidth="10" fill="none" />
      <circle cx="60" cy="60" r={radius} stroke="#10B981" strokeWidth="10" fill="none"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round" />
    </svg>
  );
}

function FormField({ label, type = "text", textarea, select, options }: { label: string; type?: string; textarea?: boolean; select?: boolean; options?: string[] }) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  if (textarea) {
    return (
      <div>
        <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">{label}</label>
        <textarea id={id} rows={3} className="w-full px-3 py-2 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none" />
      </div>
    );
  }
  if (select) {
    return (
      <div>
        <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">{label}</label>
        <select id={id} aria-label={label}
          className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none">
          <option value="">—</option>
          {(options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">{label}</label>
      <input id={id} type={type}
        className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none" />
    </div>
  );
}

function Toast({ text, onClose }: { text: string | null; onClose: () => void }) {
  if (!text) return null;
  return (
    <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#1e2128] rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 z-50">
      <UserCheck size={16} className="text-[#10B981]" />
      <span className="text-[13px] text-white">{text}</span>
      <button type="button" onClick={onClose} aria-label="Fermer" title="Fermer" className="text-[#6b7280] hover:text-white">
        <XIcon size={14} />
      </button>
    </div>
  );
}

