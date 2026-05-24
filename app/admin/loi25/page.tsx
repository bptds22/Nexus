"use client";

import { useEffect, useMemo, useState } from "react";
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

   TODO: tables to create later:
     - loi25_incidents
     - loi25_audit_log
     - loi25_portability_requests
     - loi25_consents (detailed consent tracking beyond the boolean)
     - schools.rprp_name, schools.rprp_email
   Most tabs use mock data until these tables exist.
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

// TODO: Wire to loi25_incidents table.
const MOCK_INCIDENTS = [
  { id: "INC-001", date: "2026-02-15", type: "Accès non autorisé", severity: "Élevée", school: "Saint-Jean-Eudes", status: "Résolu" },
  { id: "INC-002", date: "2026-03-22", type: "Divulgation accidentelle", severity: "Moyenne", school: "CÉGEP Garneau", status: "En cours" },
];

function IncidentsTab() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[13px] text-[#9CA3AF]">Registre des incidents de confidentialité (Loi 25 Phase 1).</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">
          <Plus size={14} /> Signaler un incident
        </button>
      </div>

      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Sévérité</th>
              <th className="px-4 py-3 font-bold">Établissement</th>
              <th className="px-4 py-3 font-bold">Statut</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {MOCK_INCIDENTS.map((inc) => (
              <tr key={inc.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white font-mono text-[12px]">{inc.id}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{formatDate(inc.date)}</td>
                <td className="px-4 py-3 text-white">{inc.type}</td>
                <td className="px-4 py-3"><SeverityBadge level={inc.severity} /></td>
                <td className="px-4 py-3 text-[#9CA3AF]">{inc.school}</td>
                <td className="px-4 py-3"><IncidentStatusBadge status={inc.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setSelected(inc.id)}
                    className="text-[11px] font-bold uppercase tracking-wider text-[#3B82F6] hover:text-white">Voir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E63946]">Chronologie — {selected}</p>
          <ul className="mt-4 space-y-3 text-[13px]">
            <li className="flex gap-3"><span className="text-[#6b7280] w-32">15 fév 2026</span><span className="text-white">Détecté par le système</span></li>
            <li className="flex gap-3"><span className="text-[#6b7280] w-32">15 fév 2026</span><span className="text-white">Confinement : accès bloqué</span></li>
            <li className="flex gap-3"><span className="text-[#6b7280] w-32">16 fév 2026</span><span className="text-white">Évaluation : 3 profils d&apos;athlètes consultés</span></li>
            <li className="flex gap-3"><span className="text-[#6b7280] w-32">17 fév 2026</span><span className="text-white">CAI notifiée</span></li>
            <li className="flex gap-3"><span className="text-[#6b7280] w-32">18 fév 2026</span><span className="text-white">Parents des 3 athlètes notifiés</span></li>
            <li className="flex gap-3"><span className="text-[#6b7280] w-32">20 fév 2026</span><span className="text-[#10B981]">Résolu — mot de passe réinitialisé, MFA activé</span></li>
          </ul>
          <button type="button" onClick={() => setSelected(null)} className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#6b7280] hover:text-white">Fermer</button>
        </div>
      )}

      {showForm && <IncidentFormModal onClose={() => setShowForm(false)} onSubmit={() => { setShowForm(false); notify("Incident enregistré (localStorage — à wire à loi25_incidents)"); }} />}
      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function IncidentFormModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  // TODO: Wire to loi25_incidents table via Supabase insert.
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] bg-[#1A1D24] border border-white/10 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-white/10"><h3 className="text-[17px] font-bold text-white">Signaler un incident</h3></div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="px-6 py-5 space-y-3 text-[13px]">
          <FormField label="Date de l'incident" type="date" />
          <FormField label="Type" select options={["Accès non autorisé", "Divulgation accidentelle", "Perte de données", "Tentative d'intrusion", "Autre"]} />
          <FormField label="Description" textarea />
          <FormField label="RP concernés" textarea />
          <FormField label="Nombre de personnes affectées" type="number" />
          <FormField label="Sévérité" select options={["Critique", "Élevée", "Moyenne", "Faible"]} />
          <FormField label="Établissement concerné" />
          <FormField label="Mesures prises" textarea />
          <label className="flex items-center gap-2 text-white/80">
            <input type="checkbox" className="accent-[#E63946]" />
            Signalé à la CAI
          </label>
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">Annuler</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3 — AUDIT
═══════════════════════════════════════════════════════════════ */

// TODO: Wire to loi25_audit_log table.
// Columns: id, timestamp, user_id, user_role, action_type, target_type, target_id, details, ip_address
const MOCK_AUDIT = [
  { ts: "2026-04-16 14:23", user: "Marc Tremblay (Recruteur)", action: "Consultation", target: "Athlète #142", details: "Vue simplifiée" },
  { ts: "2026-04-16 14:20", user: "Bruno Simard (Coach)",       action: "Modification", target: "Athlète #087", details: "Cote globale : 7.2 → 8.1" },
  { ts: "2026-04-16 13:55", user: "Admin",                      action: "Export",       target: "Athlète #142", details: "Export JSON portabilité" },
  { ts: "2026-04-16 12:10", user: "Marie Côté (Recruteur)",     action: "Consultation", target: "Athlète #201", details: "Vue complète (Pro)" },
];

function AuditTab() {
  const [actionType, setActionType] = useState("all");
  const [userRole, setUserRole] = useState("all");
  const [period, setPeriod] = useState("7d");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-[#9CA3AF]">Journal d&apos;accès aux renseignements personnels (Loi 25 Phase 3).</p>
        <button type="button"
          onClick={() => { setToast("Export CSV généré (placeholder)"); setTimeout(() => setToast(null), 2500); }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/20 text-white text-[12px] font-bold uppercase tracking-wider hover:bg-white/5">
          <Download size={14} /> Exporter le journal
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <FilterSelect label="Action" value={actionType} onChange={setActionType}
          options={[
            { value: "all", label: "Toutes" },
            { value: "consult", label: "Consultation" },
            { value: "modify", label: "Modification" },
            { value: "delete", label: "Suppression" },
            { value: "export", label: "Export" },
            { value: "login", label: "Connexion" },
          ]} />
        <FilterSelect label="Rôle" value={userRole} onChange={setUserRole}
          options={[
            { value: "all", label: "Tous" },
            { value: "coach", label: "Coach" },
            { value: "recruteur", label: "Recruteur" },
            { value: "admin", label: "Admin" },
          ]} />
        <FilterSelect label="Période" value={period} onChange={setPeriod}
          options={[
            { value: "today", label: "Aujourd'hui" },
            { value: "7d", label: "7 jours" },
            { value: "30d", label: "30 jours" },
            { value: "custom", label: "Personnalisé" },
          ]} />
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="audit-search" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Recherche</label>
          <input id="audit-search" type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Utilisateur ou cible…"
            className="w-full h-9 px-3 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-[13px] text-white placeholder:text-white/25 focus:border-[#E63946] focus:outline-none" />
        </div>
      </div>

      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">Date/heure</th>
              <th className="px-4 py-3 font-bold">Utilisateur</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">Cible</th>
              <th className="px-4 py-3 font-bold">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {MOCK_AUDIT.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-[#9CA3AF] font-mono text-[12px] whitespace-nowrap">{row.ts}</td>
                <td className="px-4 py-3 text-white">{row.user}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{row.action}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{row.target}</td>
                <td className="px-4 py-3 text-[#6b7280]">{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#6b7280] italic">
        Données de démonstration. Création de la table <code className="text-[#9CA3AF]">loi25_audit_log</code> requise pour la production.
      </p>

      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 4 — PORTABILITÉ
═══════════════════════════════════════════════════════════════ */

// TODO: Wire to loi25_portability_requests table.
interface PortabilityRequest {
  id: string;
  dateReceived: string;
  requester: string;
  type: string;
  target: string;
  status: "reçu" | "en_cours" | "complété" | "expiré";
  daysElapsed: number;
}
const MOCK_PORTABILITY: PortabilityRequest[] = [
  { id: "PORT-001", dateReceived: "2026-04-01", requester: "Marie Côté (Parent)", type: "Portabilité", target: "Athlète #087", status: "complété", daysElapsed: 12 },
  { id: "PORT-002", dateReceived: "2026-04-10", requester: "Coach Simard",         type: "Mes données", target: "—",           status: "en_cours", daysElapsed: 6 },
];

function PortabiliteTab() {
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-[#9CA3AF]">Demandes de portabilité et d&apos;accès aux données (Loi 25 Phase 3 — délai légal de 30 jours).</p>
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">
          <Plus size={14} /> Nouvelle demande
        </button>
      </div>

      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">#</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold">Demandeur</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Cible</th>
              <th className="px-4 py-3 font-bold">Statut</th>
              <th className="px-4 py-3 font-bold">Délai</th>
              <th className="px-4 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {MOCK_PORTABILITY.map((req) => (
              <tr key={req.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white font-mono text-[12px]">{req.id}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{formatDate(req.dateReceived)}</td>
                <td className="px-4 py-3 text-white">{req.requester}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{req.type}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{req.target}</td>
                <td className="px-4 py-3"><PortabilityStatusBadge status={req.status} /></td>
                <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">
                  <Clock size={12} className="inline mr-1" />
                  {req.daysElapsed}j / 30
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => notify(`Export généré pour ${req.id} (placeholder)`)}
                    className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B] hover:text-white">
                    {req.status === "complété" ? "Voir" : "Traiter"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[520px] bg-[#1A1D24] border border-white/10 rounded-xl shadow-2xl">
            <div className="px-6 py-5 border-b border-white/10"><h3 className="text-[17px] font-bold text-white">Nouvelle demande</h3></div>
            <form onSubmit={(e) => { e.preventDefault(); setShowForm(false); notify("Demande enregistrée (UI seulement — à wire à loi25_portability_requests)"); }} className="px-6 py-5 space-y-3 text-[13px]">
              <FormField label="Demandeur" />
              <FormField label="Type" select options={["Portabilité athlète", "Portabilité coach", "Portabilité recruteur", "Suppression"]} />
              <FormField label="Athlète concerné" />
              <label className="flex items-center gap-2 text-white/80">
                <input type="checkbox" className="accent-[#E63946]" />
                Vérification d&apos;identité reçue
              </label>
              <FormField label="Notes" textarea />
              <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">Annuler</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Toast text={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 5 — RPRP
═══════════════════════════════════════════════════════════════ */

// TODO: Add rprp_name + rprp_email columns to schools table and read from there.
const MOCK_RPRP = [
  { org: "Saint-Jean-Eudes", type: "École", name: "Marie Lavoie", email: "m.lavoie@sje.qc.ca", date: "2026-01-10", active: true },
  { org: "CÉGEP Garneau",    type: "CÉGEP", name: null,            email: null,                  date: null,        active: false },
  { org: "De Mortagne",      type: "École", name: "Paul Martin",   email: "p.martin@dm.qc.ca",   date: "2025-09-01", active: true },
];

function RprpTab() {
  const [nexusName, setNexusName] = useState("Bruno-Philippe Desfosses Simard");
  const [nexusEmail, setNexusEmail] = useState("confidentialite@nexussports.ca");
  const [nexusDate, setNexusDate] = useState("2026-01-01");
  const [toast, setToast] = useState<string | null>(null);
  const missingCount = MOCK_RPRP.filter((r) => !r.active).length;

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-[#9CA3AF]">Responsable de la protection des renseignements personnels — chaque organisation doit en désigner un.</p>

      {/* Nexus RPRP card */}
      <div className="bg-[#1A1D24] border-2 border-[#E63946]/40 rounded-xl p-6">
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#E63946]">Nexus — RPRP de la plateforme</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label htmlFor="rprp-nexus-name" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Nom</label>
            <input id="rprp-nexus-name" type="text" value={nexusName} onChange={(e) => setNexusName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="rprp-nexus-email" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Courriel</label>
            <input id="rprp-nexus-email" type="email" value={nexusEmail} onChange={(e) => setNexusEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="rprp-nexus-date" className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5">Date de nomination</label>
            <input id="rprp-nexus-date" type="date" value={nexusDate} onChange={(e) => setNexusDate(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#111317] border border-white/[0.06] text-[13px] text-white focus:border-[#E63946] focus:outline-none" />
          </div>
        </div>
        <button type="button" onClick={() => { setToast("Enregistré (placeholder — à persister dans settings)"); setTimeout(() => setToast(null), 2500); }}
          className="mt-4 inline-flex items-center h-9 px-4 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D42B22]">Enregistrer</button>
      </div>

      {/* Missing RPRP alert */}
      {missingCount > 0 && (
        <div className="bg-[#E63946]/10 border border-[#E63946]/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[#E63946] shrink-0" />
          <div className="flex-1 text-[13px] text-[#E63946]">
            {missingCount} établissement(s) n&apos;ont pas désigné leur RPRP. Ceci constitue une non-conformité à la Loi 25 (Phase 1).
          </div>
        </div>
      )}

      {/* Schools/CÉGEPs table */}
      <div className="bg-[#1A1D24] border border-[#1e2128] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-[#1e2128]">
            <tr className="text-left text-[11px] text-[#6b7280] uppercase tracking-wider">
              <th className="px-4 py-3 font-bold">Organisation</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">RPRP désigné</th>
              <th className="px-4 py-3 font-bold">Courriel</th>
              <th className="px-4 py-3 font-bold">Nomination</th>
              <th className="px-4 py-3 font-bold">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2128]">
            {MOCK_RPRP.map((r, i) => (
              <tr key={i} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-white font-medium">{r.org}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{r.type}</td>
                <td className="px-4 py-3 text-white">{r.name ?? <span className="text-[#E63946]">—</span>}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{r.email ?? "—"}</td>
                <td className="px-4 py-3 text-[#9CA3AF]">{formatDate(r.date)}</td>
                <td className="px-4 py-3">
                  {r.active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/15 text-[#10B981] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <Check size={10} strokeWidth={3} /> Actif
                    </span>
                  ) : (
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
        Données de démonstration. Ajouter les colonnes <code className="text-[#9CA3AF]">rprp_name</code> et <code className="text-[#9CA3AF]">rprp_email</code> à la table <code className="text-[#9CA3AF]">schools</code>.
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
  const cls = status === "Résolu" ? "bg-[#10B981]/15 text-[#10B981]"
    : status === "En cours" ? "bg-[#3B82F6]/15 text-[#3B82F6]"
    : status === "Signalé à la CAI" ? "border border-[#E63946] text-[#E63946]"
    : "bg-[#F59E0B]/15 text-[#F59E0B]";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{status}</span>;
}

function PortabilityStatusBadge({ status }: { status: PortabilityRequest["status"] }) {
  const map = {
    reçu:      { cls: "bg-[#F59E0B]/15 text-[#F59E0B]", label: "Reçu" },
    en_cours:  { cls: "bg-[#3B82F6]/15 text-[#3B82F6]", label: "En cours" },
    complété:  { cls: "bg-[#10B981]/15 text-[#10B981]", label: "Complété" },
    expiré:    { cls: "bg-[#E63946]/15 text-[#E63946]", label: "Expiré" },
  } as const;
  const s = map[status];
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

