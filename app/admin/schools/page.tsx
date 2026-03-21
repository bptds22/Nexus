"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_SCHOOLS, ADMIN_LEAGUES } from "@/lib/mock/admin";
import type { AdminSchoolRow, AdminLeagueRow, ContractStatus, Loi25AuditEntry } from "@/lib/mock/admin";

/* ── Helpers ─────────────────────────────────────────────────── */

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

const REGIONS = [
  "Capitale-Nationale", "Montréal", "Montérégie", "Laval", "Lanaudière",
  "Laurentides", "Estrie", "Mauricie", "Saguenay–Lac-Saint-Jean",
  "Chaudière-Appalaches", "Outaouais", "Centre-du-Québec",
  "Bas-Saint-Laurent", "Abitibi-Témiscamingue", "Côte-Nord",
  "Nord-du-Québec", "Gaspésie–Îles-de-la-Madeleine",
];

const SPORTS_LIST = [
  "Football", "Basketball", "Hockey", "Soccer", "Volleyball",
  "Natation", "Athlétisme", "Rugby", "Cheerleading", "Flag football",
  "Badminton", "Cross-country", "Futsal", "Baseball", "Ultimate frisbee",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function daysUntil(iso: string) {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

/* ── Contract badge config ────────────────────────────────── */

const CONTRACT_BADGE: Record<ContractStatus, { dot: string; bg: string; text: string; label: string }> = {
  ACCEPTE:    { dot: "bg-[#22C55E]", bg: "bg-[#22C55E]/10", text: "text-[#22C55E]", label: "Accepté" },
  EN_ATTENTE: { dot: "bg-[#EAB308]", bg: "bg-[#EAB308]/10", text: "text-[#EAB308]", label: "En attente" },
  ENVOYE:     { dot: "bg-[#3B82F6]", bg: "bg-[#3B82F6]/10", text: "text-[#3B82F6]", label: "Envoyé" },
  EXPIRE:     { dot: "bg-[#E63946]", bg: "bg-[#E63946]/10", text: "text-[#E63946]", label: "Expiré" },
  REFUSE:     { dot: "bg-[#E63946]", bg: "bg-[#E63946]/10", text: "text-[#E63946]", label: "Refusé" },
};

const LEVEL_BADGE: Record<string, { bg: string; text: string }> = {
  AAA: { bg: "bg-[#DAB65A]/15", text: "text-[#DAB65A]" },
  AA:  { bg: "bg-[#B4BCC8]/15", text: "text-[#B4BCC8]" },
  A:   { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]" },
  Club: { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]" },
  Civil: { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]" },
};

const SUB_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  actif:  { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
  essai:  { bg: "bg-[#EAB308]/15", text: "text-[#EAB308]", label: "Essai" },
  inactif: { bg: "bg-[#6b7280]/15", text: "text-[#6b7280]", label: "Inactif" },
};

/* ── Icons ────────────────────────────────────────────────── */

function IconBuilding() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>;
}
function IconShield() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>;
}
function IconX() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}
function IconDots() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function IconUsers() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>;
}
function IconMail() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>;
}
function IconFile() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function IconRefresh() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5-3h4a1 1 0 011 1v1H9V4a1 1 0 011-1z" /></svg>;
}
function IconBan() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" /></svg>;
}
function IconEye() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IconClock() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function IconChevronLeft() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>;
}
function IconChevronRight() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>;
}
function IconPlus() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function IconAlert() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}

/* ── Contract Status Badge Component ─────────────────────── */

function ContractBadge({ school }: { school: AdminSchoolRow }) {
  const c = school.contract;
  if (!c) return <span className="text-[12px] text-[#6b7280]">—</span>;

  const badge = CONTRACT_BADGE[c.status];
  return (
    <div className="flex flex-col gap-0.5">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badge.bg}`}>
        <span className={`w-2 h-2 rounded-full ${badge.dot} ${c.status === "EN_ATTENTE" ? "animate-pulse" : ""}`} />
        <span className={`text-[11px] font-bold ${badge.text}`}>{badge.label}</span>
      </div>
      {c.status === "ACCEPTE" && c.expires_at && (
        <span className="text-[10px] text-[#6b7280] pl-1">Exp: {formatDateShort(c.expires_at)}</span>
      )}
      {c.status === "ENVOYE" && c.sent_at && (
        <span className="text-[10px] text-[#6b7280] pl-1">Il y a {daysAgo(c.sent_at)} jours</span>
      )}
    </div>
  );
}

/* ── Row border helper ───────────────────────────────────── */

function rowLeftBorder(school: AdminSchoolRow): string {
  const s = school.contract?.status;
  if (s === "EN_ATTENTE" || s === "ENVOYE") return "border-l-2 border-l-[#FFCC02]";
  if (s === "EXPIRE") return "border-l-2 border-l-[#E63946]";
  return "";
}

/* ── Page ─────────────────────────────────────────────────── */

export default function AdminSchoolsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confFilter, setConfFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [contractFilter, setContractFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [tab, setTab] = useState<"secondaire" | "cegep" | "ligue">("secondaire");
  const [toast, setToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [schools, setSchools] = useState<AdminSchoolRow[]>(ADMIN_SCHOOLS);
  const [leagues, setLeagues] = useState<AdminLeagueRow[]>(ADMIN_LEAGUES);
  const [selectedSchool, setSelectedSchool] = useState<AdminSchoolRow | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<AdminLeagueRow | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<AdminSchoolRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<AdminSchoolRow | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Creation form state
  const [createStep, setCreateStep] = useState(1);
  const [createForm, setCreateForm] = useState({
    type: "secondaire" as "secondaire" | "cegep" | "college_prive",
    name: "", city: "", region: "", conference: "", is_private: false,
    sports: [] as string[],
    rprp_nom: "", rprp_courriel: "", rprp_telephone: "", director_name: "",
    contract_method: "email" as "email" | "paper",
    paper_date: "", paper_signer: "", contract_email: "",
  });

  function showToastMsg(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  /* ── Computed KPIs ─────────────────────────────────────── */

  const secCount = schools.filter((s) => s.type === "secondaire").length;
  const cegCount = schools.filter((s) => s.type === "cegep").length;
  const ligueCount = leagues.length;

  const pendingContractCount = schools.filter((s) => {
    const cs = s.contract?.status;
    return cs === "EN_ATTENTE" || cs === "ENVOYE";
  }).length;

  const expiringCount = schools.filter((s) => {
    if (s.contract?.status !== "ACCEPTE" || !s.contract.expires_at) return false;
    return daysUntil(s.contract.expires_at) <= 60;
  }).length;

  const activeInstitutions = schools.filter((s) => s.status !== "DESACTIVE" && s.status !== "INACTIF");
  const validContractCount = activeInstitutions.filter((s) => s.contract?.status === "ACCEPTE").length;
  const complianceRate = activeInstitutions.length > 0 ? Math.round((validContractCount / activeInstitutions.length) * 100) : 100;

  /* ── Filtered + sorted ─────────────────────────────────── */

  const filtered = useMemo(() => {
    let list = schools.filter((s) => {
      if (s.type !== tab) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.city.toLowerCase().includes(search.toLowerCase())) return false;
      if (confFilter !== "all" && s.conference !== confFilter) return false;
      if (regionFilter !== "all" && s.region !== regionFilter) return false;
      if (contractFilter !== "all") {
        if (!s.contract || s.contract.status !== contractFilter) return false;
      }
      if (!showInactive && (s.status === "DESACTIVE" || s.status === "INACTIF")) return false;
      return true;
    });

    if (sortCol) {
      list = [...list].sort((a, b) => {
        let va: string | number = "";
        let vb: string | number = "";
        switch (sortCol) {
          case "name": va = a.name; vb = b.name; break;
          case "city": va = a.city; vb = b.city; break;
          case "region": va = a.region; vb = b.region; break;
          case "conference": va = a.conference || ""; vb = b.conference || ""; break;
          case "coaches": va = a.coaches_count; vb = b.coaches_count; break;
          case "athletes": va = a.athletes_count; vb = b.athletes_count; break;
          case "recruiters": va = a.recruiters_count; vb = b.recruiters_count; break;
          case "contract": va = a.contract?.status || ""; vb = b.contract?.status || ""; break;
          case "private": va = a.is_private ? 1 : 0; vb = b.is_private ? 1 : 0; break;
        }
        if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
    }

    return list;
  }, [schools, search, confFilter, regionFilter, contractFilter, showInactive, tab, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (sortCol === col) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortCol(col); setSortDir("asc"); }
  }

  function SortHeader({ col, children }: { col: string; children: React.ReactNode }) {
    return (
      <button type="button" onClick={() => toggleSort(col)} className="flex items-center gap-1 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] hover:text-white transition-colors">
        {children}
        {sortCol === col && <span className="text-[#E63946]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  /* ── Action handlers ───────────────────────────────────── */

  function handleSendContract(s: AdminSchoolRow) {
    setSchools((prev) => prev.map((x) => {
      if (x.id !== s.id) return x;
      const now = new Date().toISOString();
      return {
        ...x,
        contract: x.contract ? { ...x.contract, status: "ENVOYE" as ContractStatus, sent_at: now } : x.contract,
        audit_log: [...x.audit_log, { date: now, action: `Contrat envoyé à ${x.contract?.rprp_courriel}` }],
      };
    }));
    setOpenMenu(null);
    showToastMsg(`Contrat envoyé à ${s.contract?.rprp_courriel}`);
  }

  function handleResendContract(s: AdminSchoolRow) {
    const now = new Date().toISOString();
    setSchools((prev) => prev.map((x) => x.id !== s.id ? x : {
      ...x,
      audit_log: [...x.audit_log, { date: now, action: `Rappel de contrat envoyé à ${x.contract?.rprp_courriel}` }],
    }));
    setOpenMenu(null);
    showToastMsg(`Rappel envoyé à ${s.contract?.rprp_courriel}`);
  }

  function handleRenewContract(s: AdminSchoolRow) {
    const now = new Date().toISOString();
    setSchools((prev) => prev.map((x) => {
      if (x.id !== s.id) return x;
      return {
        ...x,
        contract: x.contract ? { ...x.contract, status: "ENVOYE" as ContractStatus, sent_at: now, contract_version: "1.1" } : x.contract,
        audit_log: [...x.audit_log, { date: now, action: `Contrat de renouvellement (v1.1) envoyé à ${x.contract?.rprp_courriel}` }],
      };
    }));
    setOpenMenu(null);
    showToastMsg(`Contrat de renouvellement envoyé`);
  }

  function handleDeactivate(s: AdminSchoolRow) {
    setSchools((prev) => prev.map((x) => {
      if (x.id !== s.id) return x;
      const now = new Date().toISOString();
      return { ...x, status: "DESACTIVE", is_active: false, audit_log: [...x.audit_log, { date: now, action: "Établissement désactivé par l'administrateur" }] };
    }));
    setShowDeactivateModal(null);
    setSelectedSchool(null);
    showToastMsg(`${s.name} désactivé`);
  }

  function handleDelete(s: AdminSchoolRow) {
    setSchools((prev) => prev.filter((x) => x.id !== s.id));
    setShowDeleteModal(null);
    setSelectedSchool(null);
    showToastMsg(`${s.name} supprimé définitivement`);
  }

  /* ── Create institution ────────────────────────────────── */

  function resetCreateForm() {
    setCreateStep(1);
    setCreateForm({
      type: "secondaire", name: "", city: "", region: "", conference: "", is_private: false,
      sports: [], rprp_nom: "", rprp_courriel: "", rprp_telephone: "", director_name: "",
      contract_method: "email", paper_date: "", paper_signer: "", contract_email: "",
    });
  }

  function handleCreateSubmit() {
    const now = new Date().toISOString();
    const id = `s-new-${Date.now()}`;
    const isPaper = createForm.contract_method === "paper";
    const contractStatus: ContractStatus = isPaper ? "ACCEPTE" : "EN_ATTENTE";
    const newSchool: AdminSchoolRow = {
      id,
      name: createForm.name,
      type: createForm.type === "college_prive" ? "cegep" : createForm.type as "secondaire" | "cegep",
      city: createForm.city,
      region: createForm.region,
      conference: (createForm.type === "cegep" || createForm.type === "college_prive") ? (createForm.conference as "sud_ouest" | "nord_est" || null) : null,
      sports: createForm.sports,
      coaches_count: 0,
      recruiters_count: 0,
      directors_count: 0,
      athletes_count: 0,
      is_active: true,
      is_private: createForm.is_private,
      status: isPaper ? "ACTIF" : "EN_ATTENTE_CONTRAT",
      onboarding_completed: isPaper,
      subscription_status: createForm.type !== "secondaire" ? "essai" : undefined,
      created_at: now,
      contract: {
        id: `loi-${id}`,
        institution_id: id,
        institution_type: createForm.type === "secondaire" ? "ECOLE_SECONDAIRE" : "CEGEP",
        contract_version: "1.0",
        status: contractStatus,
        rprp_nom: createForm.rprp_nom,
        rprp_courriel: createForm.rprp_courriel,
        rprp_telephone: createForm.rprp_telephone || undefined,
        sent_at: isPaper ? undefined : undefined,
        accepted_at: isPaper ? (createForm.paper_date || now) : undefined,
        accepted_by: isPaper ? "admin" : undefined,
        pdf_url: isPaper ? `/contracts/loi25-${id}.pdf` : undefined,
      },
      audit_log: [
        { date: now, action: "Établissement créé par l'administrateur" },
        ...(isPaper
          ? [{ date: now, action: `Contrat accepté (contrat papier signé par ${createForm.paper_signer || createForm.director_name})` }]
          : []),
      ],
    };
    setSchools((prev) => [newSchool, ...prev]);
    setShowCreateDrawer(false);
    resetCreateForm();
    if (isPaper) {
      showToastMsg(`Établissement créé et activé.`);
    } else {
      showToastMsg(`Établissement créé. Contrat à envoyer à ${createForm.rprp_courriel}.`);
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Gestion des établissements</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            {secCount} écoles secondaires · {cegCount} CÉGEPs · {ligueCount} ligues civiles ·{" "}
            <span className={pendingContractCount > 0 ? "text-[#E63946] font-bold" : ""}>
              {pendingContractCount} en attente de contrat
            </span>
          </p>
        </div>
        <button type="button" onClick={() => { resetCreateForm(); setShowCreateDrawer(true); }} className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors flex items-center gap-2">
          <IconPlus /> Ajouter un établissement
        </button>
      </div>

      {/* ── KPI Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { value: activeInstitutions.length, label: "Établissements actifs", color: "text-white" },
          { value: pendingContractCount, label: "En attente de contrat", color: pendingContractCount > 0 ? "text-[#E63946]" : "text-white" },
          { value: expiringCount, label: "Contrats expirant bientôt", color: expiringCount > 0 ? "text-[#EAB308]" : "text-white" },
          { value: `${complianceRate}%`, label: "Taux de conformité Loi 25", color: complianceRate === 100 ? "text-[#22C55E]" : "text-[#E63946]" },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className={`font-head text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[12px] text-[#6b7280] mt-1 uppercase tracking-wider font-bold">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher un établissement..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${selectBase} flex-1 min-w-[240px]`} />
        <select value={confFilter} onChange={(e) => setConfFilter(e.target.value)} className={selectBase}>
          <option value="all">Toutes les conférences</option>
          <option value="sud_ouest">Sud-Ouest</option>
          <option value="nord_est">Nord-Est</option>
        </select>
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className={selectBase}>
          <option value="all">Toutes les régions</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)} className={selectBase}>
          <option value="all">Tous les statuts contrat</option>
          <option value="ACCEPTE">Accepté</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="ENVOYE">Envoyé</option>
          <option value="EXPIRE">Expiré</option>
        </select>
        <label className="flex items-center gap-2 text-[13px] text-[#9CA3AF] cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-[#E63946]" />
          Afficher inactifs
        </label>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[#2D3748]">
        {([["secondaire", `Écoles secondaires (${secCount})`], ["cegep", `CÉGEPs (${cegCount})`], ["ligue", `Ligues civiles (${ligueCount})`]] as [("secondaire" | "cegep" | "ligue"), string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${tab === key ? "text-[#E63946] border-[#E63946]" : "text-[#6b7280] border-transparent hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────── */}
      {tab !== "ligue" && (
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2D3748]">
                {tab === "secondaire" ? (
                  <>
                    <th className="px-4 py-3"><SortHeader col="name">Nom</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="city">Ville</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="region">Région</SortHeader></th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Sports</th>
                    <th className="px-4 py-3"><SortHeader col="coaches">Coachs</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="athletes">Athlètes</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="contract">Contrat Loi 25</SortHeader></th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]"></th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3"><SortHeader col="name">Nom</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="city">Ville</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="conference">Conférence</SortHeader></th>
                    <th className="px-4 py-3"><SortHeader col="private">Privé?</SortHeader></th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Sports</th>
                    <th className="px-4 py-3"><SortHeader col="recruiters">Recruteurs</SortHeader></th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Abonnement</th>
                    <th className="px-4 py-3"><SortHeader col="contract">Contrat Loi 25</SortHeader></th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]"></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const cs = s.contract?.status;
                return (
                  <tr key={s.id} className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"} ${rowLeftBorder(s)}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button type="button" onClick={() => setSelectedSchool(s)} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors text-left">
                        {s.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{s.city}</td>
                    {tab === "secondaire" && <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{s.region}</td>}
                    {tab === "cegep" && (
                      <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{s.conference === "sud_ouest" ? "Sud-Ouest" : s.conference === "nord_est" ? "Nord-Est" : "—"}</td>
                    )}
                    {tab === "cegep" && (
                      <td className="px-4 py-3 text-center">
                        {s.is_private ? <span className="text-[#22C55E]"><IconCheck /></span> : <span className="text-[#6b7280]">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.sports.slice(0, 3).map((sp) => (
                          <span key={sp} className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#9CA3AF]">{sp}</span>
                        ))}
                        {s.sports.length > 3 && <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#6b7280]">+{s.sports.length - 3}</span>}
                      </div>
                    </td>
                    {tab === "secondaire" && <td className="px-4 py-3 text-[13px] font-bold text-white">{s.coaches_count}</td>}
                    {tab === "secondaire" && <td className="px-4 py-3 text-[13px] font-bold text-white">{s.athletes_count}</td>}
                    {tab === "cegep" && <td className="px-4 py-3 text-[13px] font-bold text-white">{s.recruiters_count}</td>}
                    {tab === "cegep" && (
                      <td className="px-4 py-3">
                        {s.subscription_status ? (() => {
                          const sub = SUB_BADGE[s.subscription_status];
                          return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${sub.bg} ${sub.text}`}>{sub.label}</span>;
                        })() : <span className="text-[#6b7280]">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3"><ContractBadge school={s} /></td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button type="button" title="Actions" onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} className="text-[#6b7280] hover:text-white p-1 transition-colors">
                          <IconDots />
                        </button>
                        {openMenu === s.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-8 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg py-1.5 min-w-[220px] shadow-xl">
                              {/* View details */}
                              <button type="button" onClick={() => { setOpenMenu(null); setSelectedSchool(s); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                <IconEye /> Voir les détails
                              </button>
                              {/* Edit */}
                              <button type="button" onClick={() => { setOpenMenu(null); showToastMsg("Modification — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                <IconEdit /> Modifier
                              </button>
                              {/* Send contract — EN_ATTENTE only */}
                              {cs === "EN_ATTENTE" && (
                                <button type="button" onClick={() => handleSendContract(s)} className="w-full text-left px-4 py-2.5 text-[12px] text-[#3B82F6] hover:bg-[#3B82F6]/10 flex items-center gap-2.5">
                                  <IconMail /> Envoyer le contrat
                                </button>
                              )}
                              {/* Resend — ENVOYE only */}
                              {cs === "ENVOYE" && (
                                <button type="button" onClick={() => handleResendContract(s)} className="w-full text-left px-4 py-2.5 text-[12px] text-[#3B82F6] hover:bg-[#3B82F6]/10 flex items-center gap-2.5">
                                  <IconRefresh /> Renvoyer le contrat
                                </button>
                              )}
                              {/* Renew — EXPIRE only */}
                              {cs === "EXPIRE" && (
                                <button type="button" onClick={() => handleRenewContract(s)} className="w-full text-left px-4 py-2.5 text-[12px] text-[#EAB308] hover:bg-[#EAB308]/10 flex items-center gap-2.5">
                                  <IconRefresh /> Renouveler le contrat
                                </button>
                              )}
                              {/* View signed contract — ACCEPTE only */}
                              {cs === "ACCEPTE" && (
                                <button type="button" onClick={() => { setOpenMenu(null); showToastMsg("Aperçu du contrat PDF — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                  <IconFile /> Voir le contrat signé
                                </button>
                              )}
                              {/* View users */}
                              <button type="button" onClick={() => { setOpenMenu(null); router.push(`/admin/users?school=${encodeURIComponent(s.name)}`); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                <IconUsers /> {tab === "secondaire" ? "Voir les coachs" : "Voir les recruteurs"}
                              </button>
                              <div className="border-t border-[#2D3748] my-1.5" />
                              {/* Deactivate */}
                              {s.status !== "DESACTIVE" && (
                                <button type="button" onClick={() => { setOpenMenu(null); setShowDeactivateModal(s); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-2.5">
                                  <IconBan /> Désactiver
                                </button>
                              )}
                              {/* Delete — only if 0 users */}
                              {(s.coaches_count + s.recruiters_count + s.directors_count) === 0 && (
                                <button type="button" onClick={() => { setOpenMenu(null); setShowDeleteModal(s); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#E63946] hover:bg-[#E63946]/10 flex items-center gap-2.5">
                                  <IconTrash /> Supprimer
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucun établissement trouvé</div>}
      </div>
      )}

      {/* ── Leagues Table ────────────────────────────────── */}
      {tab === "ligue" && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Nom</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Sport</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Ville</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Région</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Niveau</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Équipes</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Coachs</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Coordonnateur</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Contrat Loi 25</th>
                  <th className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]"></th>
                </tr>
              </thead>
              <tbody>
                {leagues.filter((l) => {
                  if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.city.toLowerCase().includes(search.toLowerCase())) return false;
                  if (regionFilter !== "all" && l.region !== regionFilter) return false;
                  if (contractFilter !== "all" && l.contract?.status !== contractFilter) return false;
                  if (!showInactive && !l.is_active) return false;
                  return true;
                }).map((l, i) => {
                  const lvl = LEVEL_BADGE[l.level] || LEVEL_BADGE.Club;
                  const cs = l.contract?.status;
                  return (
                    <tr key={l.id} className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button type="button" onClick={() => setSelectedLeague(l)} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors text-left">
                          {l.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#9CA3AF]">{l.sport}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{l.city}</td>
                      <td className="px-4 py-3 text-[13px] text-[#9CA3AF] whitespace-nowrap">{l.region}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${lvl.bg} ${lvl.text}`}>{l.level}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold text-white">{l.teams_count}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-white">{l.coaches_count}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {l.coordinator_name ? (
                          <div className="flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#DAB65A" stroke="none" className="shrink-0">
                              <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
                              <circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
                            </svg>
                            <span className="text-[13px] text-white">{l.coordinator_name}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] font-bold text-[#E63946]">AUCUN</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {l.contract ? (() => {
                          const badge = CONTRACT_BADGE[l.contract.status];
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badge.bg}`}>
                              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                              <span className={`text-[11px] font-bold ${badge.text}`}>{badge.label}</span>
                            </div>
                          );
                        })() : <span className="text-[12px] text-[#6b7280]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button type="button" title="Actions" onClick={() => setOpenMenu(openMenu === l.id ? null : l.id)} className="text-[#6b7280] hover:text-white p-1 transition-colors">
                            <IconDots />
                          </button>
                          {openMenu === l.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-8 z-50 bg-[#1A1D24] border border-[#2D3748] rounded-lg py-1.5 min-w-[200px] shadow-xl">
                                <button type="button" onClick={() => { setOpenMenu(null); setSelectedLeague(l); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                  <IconEye /> Voir les détails
                                </button>
                                <button type="button" onClick={() => { setOpenMenu(null); showToastMsg("Modification — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                  <IconEdit /> Modifier
                                </button>
                                <button type="button" onClick={() => { setOpenMenu(null); showToastMsg("Voir les équipes — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                  <IconUsers /> Voir les équipes
                                </button>
                                {cs === "ACCEPTE" && (
                                  <button type="button" onClick={() => { setOpenMenu(null); showToastMsg("Aperçu du contrat PDF — POC"); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#9CA3AF] hover:text-white hover:bg-white/5 flex items-center gap-2.5">
                                    <IconFile /> Voir le contrat signé
                                  </button>
                                )}
                                <div className="border-t border-[#2D3748] my-1.5" />
                                <button type="button" onClick={() => { setOpenMenu(null); setLeagues((prev) => prev.map((x) => x.id === l.id ? { ...x, is_active: false, status: "DESACTIVE" } : x)); showToastMsg(`${l.name} désactivé`); }} className="w-full text-left px-4 py-2.5 text-[12px] text-[#F59E0B] hover:bg-[#F59E0B]/10 flex items-center gap-2.5">
                                  <IconBan /> Désactiver
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {leagues.filter((l) => search ? l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase()) : true).length === 0 && (
            <div className="text-center py-12 text-[#6b7280] text-[14px]">Aucune ligue trouvée</div>
          )}
        </div>
      )}

      {/* ── League Detail Drawer ─────────────────────────── */}
      {selectedLeague && (() => {
        const l = selectedLeague;
        const c = l.contract;
        const cs = c?.status;
        const borderColor = cs === "ACCEPTE" ? "border-l-[#22C55E]" : cs === "EN_ATTENTE" || cs === "ENVOYE" ? "border-l-[#EAB308]" : "border-l-[#E63946]";
        const lvl = LEVEL_BADGE[l.level] || LEVEL_BADGE.Club;
        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLeague(null)} />
            <div className="relative bg-[#1A1D24] border-l border-[#2D3748] w-full max-w-[560px] shadow-2xl overflow-y-auto">
              <button type="button" onClick={() => setSelectedLeague(null)} className="absolute top-4 right-4 text-[#6b7280] hover:text-white z-10"><IconX /></button>

              {/* Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-head text-[18px] font-black text-white">{l.name}</h2>
                    <p className="text-[13px] text-[#9CA3AF] mt-0.5">{l.city}, {l.region}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">Ligue civile</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#9CA3AF]">{l.sport}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${lvl.bg} ${lvl.text}`}>{l.level}</span>
                    </div>
                    <p className="text-[11px] text-[#6b7280] mt-2">Créé le {formatDate(l.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Coordinator */}
              <div className="px-6 pb-4">
                <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Coordonnateur</h3>
                {l.coordinator_name ? (
                  <div className="bg-[#111317] rounded-lg border border-[#2D3748]/40 p-4 flex items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#DAB65A" stroke="none">
                      <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
                      <circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
                    </svg>
                    <div>
                      <p className="text-[13px] font-bold text-white">{l.coordinator_name}</p>
                      <p className="text-[11px] text-[#6b7280]">Coordonnateur principal</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#E63946]/5 border border-[#E63946]/20 rounded-lg p-4 text-center">
                    <p className="text-[13px] font-bold text-[#E63946]">Aucun coordonnateur assigné</p>
                    <p className="text-[11px] text-[#6b7280] mt-1">Cette ligue n&apos;a pas encore de coordonnateur sur Nexus.</p>
                  </div>
                )}
              </div>

              {/* Loi 25 */}
              {c && (
                <div className="px-6 pb-4">
                  <div className={`bg-[#111317] rounded-xl border border-[#2D3748] border-l-4 ${borderColor} p-5`}>
                    <div className="flex items-center gap-2 mb-3">
                      <IconShield />
                      <h3 className="font-head text-[14px] font-black text-white uppercase tracking-wider">Conformité Loi 25</h3>
                    </div>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between"><span className="text-[#6b7280]">RPRP</span><span className="text-white font-bold">{c.rprp_nom}</span></div>
                      <div className="flex justify-between"><span className="text-[#6b7280]">Statut</span>
                        {(() => { const badge = CONTRACT_BADGE[c.status]; return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>; })()}
                      </div>
                      {c.expires_at && <div className="flex justify-between"><span className="text-[#6b7280]">Expire le</span><span className="text-[#9CA3AF]">{formatDate(c.expires_at)}</span></div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="px-6 pb-4">
                <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Statistiques</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: "Équipes", value: l.teams_count }, { label: "Entraîneurs", value: l.coaches_count }, { label: "Athlètes", value: l.athletes_count }].map((stat) => (
                    <div key={stat.label} className="bg-[#111317] rounded-lg p-3 border border-[#2D3748]/40">
                      <p className="font-head text-[18px] font-black text-white">{stat.value}</p>
                      <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit */}
              {l.audit_log.length > 0 && (
                <div className="px-6 pb-6">
                  <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3 flex items-center gap-2"><IconClock /> Historique</h3>
                  <div className="space-y-0">
                    {[...l.audit_log].reverse().map((entry, i) => (
                      <div key={i} className="flex gap-3 py-2.5 border-b border-[#2D3748]/30 last:border-0">
                        <span className="text-[11px] text-[#6b7280] whitespace-nowrap shrink-0">{formatDate(entry.date)}</span>
                        <span className="text-[12px] text-[#9CA3AF]">{entry.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom actions */}
              <div className="bg-[#111317] border-t border-[#2D3748] px-6 py-4 sticky bottom-0">
                <div className="flex flex-wrap gap-2 justify-center">
                  <button type="button" onClick={() => { setSelectedLeague(null); showToastMsg("Voir les équipes — POC"); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    Voir les équipes
                  </button>
                  <button type="button" onClick={() => { setSelectedLeague(null); showToastMsg("Modifier — POC"); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    Modifier
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
         DETAIL DRAWER
      ═══════════════════════════════════════════════════════ */}
      {selectedSchool && (() => {
        const s = selectedSchool;
        const c = s.contract;
        const cs = c?.status;
        const borderColor = cs === "ACCEPTE" ? "border-l-[#22C55E]" : cs === "EN_ATTENTE" || cs === "ENVOYE" ? "border-l-[#EAB308]" : "border-l-[#E63946]";

        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSchool(null)} />
            <div className="relative bg-[#1A1D24] border-l border-[#2D3748] w-full max-w-[560px] shadow-2xl overflow-y-auto">
              {/* Close */}
              <button type="button" onClick={() => setSelectedSchool(null)} className="absolute top-4 right-4 text-[#6b7280] hover:text-white z-10">
                <IconX />
              </button>

              {/* Section 1: Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                    <IconBuilding />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-head text-[18px] font-black text-white">{s.name}</h2>
                    <p className="text-[13px] text-[#9CA3AF] mt-0.5">{s.city}, {s.region}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.type === "cegep" ? "bg-[#A855F7]/15 text-[#A855F7]" : "bg-[#3B82F6]/15 text-[#3B82F6]"}`}>
                        {s.type === "cegep" ? "CÉGEP" : "École secondaire"}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.status === "ACTIF" ? "bg-[#22C55E]/15 text-[#22C55E]" : s.status === "EN_ATTENTE_CONTRAT" ? "bg-[#EAB308]/15 text-[#EAB308]" : "bg-[#6b7280]/15 text-[#6b7280]"}`}>
                        {s.status === "ACTIF" ? "Actif" : s.status === "EN_ATTENTE_CONTRAT" ? "En attente" : s.status === "DESACTIVE" ? "Désactivé" : "Inactif"}
                      </span>
                      {s.is_private && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F59E0B]/15 text-[#F59E0B]">Privé</span>}
                    </div>
                    <p className="text-[11px] text-[#6b7280] mt-2">Créé le {formatDate(s.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Loi 25 Compliance */}
              {c && (
                <div className="px-6 pb-4">
                  <div className={`bg-[#111317] rounded-xl border border-[#2D3748] border-l-4 ${borderColor} p-5`}>
                    <div className="flex items-center gap-2 mb-4">
                      <IconShield />
                      <h3 className="font-head text-[14px] font-black text-white uppercase tracking-wider">Conformité Loi 25</h3>
                    </div>

                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#6b7280]">RPRP désigné</span>
                        <span className="text-white font-bold">{c.rprp_nom}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b7280]">Courriel</span>
                        <span className="text-[#9CA3AF]">{c.rprp_courriel}</span>
                      </div>
                      {c.rprp_telephone && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7280]">Téléphone</span>
                          <span className="text-[#9CA3AF]">{c.rprp_telephone}</span>
                        </div>
                      )}

                      <div className="border-t border-[#2D3748] my-3" />

                      <div className="flex justify-between items-center">
                        <span className="text-[#6b7280]">Statut du contrat</span>
                        <ContractBadge school={s} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b7280]">Version</span>
                        <span className="text-[#9CA3AF]">{c.contract_version}</span>
                      </div>
                      {c.sent_at && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7280]">Envoyé le</span>
                          <span className="text-[#9CA3AF]">{formatDate(c.sent_at)}</span>
                        </div>
                      )}
                      {c.accepted_at && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7280]">Accepté le</span>
                          <span className="text-[#9CA3AF]">{formatDate(c.accepted_at)}</span>
                        </div>
                      )}
                      {c.accepted_by && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7280]">Accepté par</span>
                          <span className="text-[#9CA3AF]">{c.rprp_nom}</span>
                        </div>
                      )}
                      {c.expires_at && (
                        <div className="flex justify-between">
                          <span className="text-[#6b7280]">Expire le</span>
                          <span className={`font-bold ${cs === "EXPIRE" || (cs === "ACCEPTE" && daysUntil(c.expires_at) <= 60) ? "text-[#E63946]" : "text-[#9CA3AF]"}`}>
                            {formatDate(c.expires_at)}
                            {cs === "ACCEPTE" && daysUntil(c.expires_at) <= 60 && daysUntil(c.expires_at) > 0 && (
                              <span className="text-[10px] ml-1">({daysUntil(c.expires_at)}j restants)</span>
                            )}
                          </span>
                        </div>
                      )}
                      {c.pdf_url && cs === "ACCEPTE" && (
                        <button type="button" onClick={() => showToastMsg("Aperçu du contrat PDF — POC")} className="mt-2 w-full text-left px-3 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] hover:text-white hover:bg-[#2D3748] transition-colors text-[12px] font-bold flex items-center gap-2">
                          <IconFile /> Voir le contrat signé (PDF)
                        </button>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                      {cs === "ENVOYE" && (
                        <button type="button" onClick={() => handleResendContract(s)} className="px-4 py-2 rounded-lg bg-[#3B82F6]/15 text-[#3B82F6] font-bold text-[11px] uppercase tracking-wider hover:bg-[#3B82F6]/25 transition-colors flex items-center gap-1.5">
                          <IconRefresh /> Renvoyer le contrat
                        </button>
                      )}
                      {cs === "EN_ATTENTE" && (
                        <button type="button" onClick={() => handleSendContract(s)} className="px-4 py-2 rounded-lg bg-[#3B82F6]/15 text-[#3B82F6] font-bold text-[11px] uppercase tracking-wider hover:bg-[#3B82F6]/25 transition-colors flex items-center gap-1.5">
                          <IconMail /> Envoyer le contrat
                        </button>
                      )}
                      {(cs === "EXPIRE" || (cs === "ACCEPTE" && c.expires_at && daysUntil(c.expires_at) <= 60)) && (
                        <button type="button" onClick={() => handleRenewContract(s)} className="px-4 py-2 rounded-lg bg-[#EAB308]/15 text-[#EAB308] font-bold text-[11px] uppercase tracking-wider hover:bg-[#EAB308]/25 transition-colors flex items-center gap-1.5">
                          <IconRefresh /> Renouveler le contrat
                        </button>
                      )}
                      <button type="button" onClick={() => showToastMsg("Modifier le RPRP — POC")} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[11px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors flex items-center gap-1.5">
                        <IconEdit /> Modifier le RPRP
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Sports */}
              <div className="px-6 pb-4">
                <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Sports offerts</h3>
                <div className="flex flex-wrap gap-1.5">
                  {s.sports.map((sp) => (
                    <span key={sp} className="px-2.5 py-1 rounded-full bg-[#2D3748] text-[11px] font-bold text-[#9CA3AF]">{sp}</span>
                  ))}
                </div>
              </div>

              {/* Section 4: Stats */}
              <div className="px-6 pb-4">
                <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Statistiques</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: s.type === "cegep" ? "Recruteurs" : "Coachs", value: s.type === "cegep" ? s.recruiters_count : s.coaches_count },
                    { label: "Directeurs", value: s.directors_count },
                    ...(s.type === "secondaire" ? [{ label: "Athlètes", value: s.athletes_count }] : []),
                  ].map((stat) => (
                    <div key={stat.label} className="bg-[#111317] rounded-lg p-3 border border-[#2D3748]/40">
                      <p className="font-head text-[18px] font-black text-white">{stat.value}</p>
                      <p className="text-[11px] text-[#6b7280] uppercase tracking-wider font-bold">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: Audit History */}
              {s.audit_log.length > 0 && (
                <div className="px-6 pb-6">
                  <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3 flex items-center gap-2">
                    <IconClock /> Historique d&apos;audit
                  </h3>
                  <div className="space-y-0">
                    {[...s.audit_log].reverse().map((entry, i) => (
                      <div key={i} className="flex gap-3 py-2.5 border-b border-[#2D3748]/30 last:border-0">
                        <span className="text-[11px] text-[#6b7280] whitespace-nowrap shrink-0">{formatDate(entry.date)}</span>
                        <span className="text-[12px] text-[#9CA3AF]">{entry.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom actions */}
              <div className="bg-[#111317] border-t border-[#2D3748] px-6 py-4 sticky bottom-0">
                <div className="flex flex-wrap gap-2 justify-center">
                  <button type="button" onClick={() => { setSelectedSchool(null); router.push(`/admin/users?school=${encodeURIComponent(s.name)}`); }} className="px-4 py-2 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                    Voir les utilisateurs
                  </button>
                  {s.status !== "DESACTIVE" && (
                    <button type="button" onClick={() => setShowDeactivateModal(s)} className="px-4 py-2 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-[12px] uppercase tracking-wider hover:bg-[#F59E0B]/25 transition-colors">
                      Désactiver
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
         CREATION DRAWER (4-step)
      ═══════════════════════════════════════════════════════ */}
      {showCreateDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateDrawer(false)} />
          <div className="relative bg-[#1A1D24] border-l border-[#2D3748] w-full max-w-[480px] shadow-2xl overflow-y-auto">
            {/* Close */}
            <button type="button" onClick={() => setShowCreateDrawer(false)} className="absolute top-4 right-4 text-[#6b7280] hover:text-white z-10">
              <IconX />
            </button>

            {/* Drawer header */}
            <div className="p-6 pb-2">
              <h2 className="font-head text-[16px] font-black text-white uppercase tracking-wider">Ajouter un établissement</h2>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${createStep >= step ? "bg-[#E63946] text-white" : "bg-[#2D3748] text-[#6b7280]"}`}>
                      {createStep > step ? <IconCheck /> : step}
                    </div>
                    {step < 4 && <div className={`w-8 h-0.5 ${createStep > step ? "bg-[#E63946]" : "bg-[#2D3748]"}`} />}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#6b7280] mt-2">
                {createStep === 1 && "Informations de base"}
                {createStep === 2 && "Responsable Loi 25"}
                {createStep === 3 && "Contrat de sous-traitance"}
                {createStep === 4 && "Résumé et confirmation"}
              </p>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {/* ── Step 1: Basic info ───────────────────── */}
              {createStep === 1 && (
                <>
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Type d&apos;établissement</label>
                    <div className="flex flex-col gap-2">
                      {([["secondaire", "École secondaire"], ["cegep", "CÉGEP"], ["college_prive", "Collège privé"]] as const).map(([val, lbl]) => (
                        <label key={val} className="flex items-center gap-3 cursor-pointer">
                          <input type="radio" name="type" value={val} checked={createForm.type === val} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as typeof createForm.type })} className="accent-[#E63946]" />
                          <span className="text-[13px] text-white">{lbl}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Nom de l&apos;établissement *</label>
                    <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className={selectBase + " w-full"} placeholder="Ex: CÉGEP Garneau" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Ville *</label>
                      <input type="text" value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} className={selectBase + " w-full"} />
                    </div>
                    <div>
                      <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Région *</label>
                      <select value={createForm.region} onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })} className={selectBase + " w-full"}>
                        <option value="">Sélectionner</option>
                        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  {(createForm.type === "cegep" || createForm.type === "college_prive") && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Conférence RSEQ</label>
                        <select value={createForm.conference} onChange={(e) => setCreateForm({ ...createForm, conference: e.target.value })} className={selectBase + " w-full"}>
                          <option value="">Sélectionner</option>
                          <option value="sud_ouest">Sud-Ouest</option>
                          <option value="nord_est">Nord-Est</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={createForm.is_private} onChange={(e) => setCreateForm({ ...createForm, is_private: e.target.checked })} className="accent-[#E63946]" />
                          <span className="text-[13px] text-[#9CA3AF]">Privé</span>
                        </label>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Sports offerts</label>
                    <div className="flex flex-wrap gap-2">
                      {SPORTS_LIST.map((sp) => {
                        const selected = createForm.sports.includes(sp);
                        return (
                          <button key={sp} type="button" onClick={() => setCreateForm({ ...createForm, sports: selected ? createForm.sports.filter((x) => x !== sp) : [...createForm.sports, sp] })} className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${selected ? "bg-[#E63946] text-white" : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946] hover:text-white"}`}>
                            {sp}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 2: RPRP (Loi 25) ───────────────── */}
              {createStep === 2 && (
                <>
                  <h3 className="font-head text-[14px] font-black text-white">Conformité Loi 25 — Responsable de la protection des renseignements personnels</h3>
                  <div className="bg-[#EAB308]/10 border-l-4 border-[#E63946] rounded-r-lg p-4">
                    <p className="text-[12px] text-[#EAB308] leading-relaxed">
                      La Loi 25 exige que chaque organisation désigne un Responsable de la Protection des Renseignements Personnels (RPRP). Ces informations seront incluses dans le contrat de sous-traitance.
                    </p>
                  </div>
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Nom du RPRP *</label>
                    <input type="text" value={createForm.rprp_nom} onChange={(e) => setCreateForm({ ...createForm, rprp_nom: e.target.value })} className={selectBase + " w-full"} placeholder="Le directeur / La directrice" />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Courriel du RPRP *</label>
                    <input type="email" value={createForm.rprp_courriel} onChange={(e) => setCreateForm({ ...createForm, rprp_courriel: e.target.value })} className={selectBase + " w-full"} placeholder="rprp@ecole.qc.ca" />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Téléphone du RPRP</label>
                    <input type="tel" value={createForm.rprp_telephone} onChange={(e) => setCreateForm({ ...createForm, rprp_telephone: e.target.value })} className={selectBase + " w-full"} placeholder="(418) 555-0123" />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Nom du directeur / de la directrice *</label>
                    <input type="text" value={createForm.director_name} onChange={(e) => setCreateForm({ ...createForm, director_name: e.target.value })} className={selectBase + " w-full"} placeholder="Personne qui signera le contrat" />
                  </div>
                </>
              )}

              {/* ── Step 3: Contract method ─────────────── */}
              {createStep === 3 && (
                <>
                  <h3 className="font-head text-[14px] font-black text-white">Entente de sous-traitance — Protection des renseignements personnels</h3>
                  <div className="bg-[#E63946]/10 border-l-4 border-[#E63946] rounded-r-lg p-4">
                    <p className="text-[12px] text-[#E63946] leading-relaxed">
                      Avant que les utilisateurs de cet établissement puissent accéder aux données d&apos;athlètes sur Nexus, le directeur ou la directrice doit accepter l&apos;entente de sous-traitance Loi 25.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border transition-colors bg-[#111317] border-[#2D3748] hover:border-[#E63946]/30" onClick={() => setCreateForm({ ...createForm, contract_method: "email" })}>
                      <input type="radio" name="contract_method" value="email" checked={createForm.contract_method === "email"} onChange={() => setCreateForm({ ...createForm, contract_method: "email" })} className="accent-[#E63946] mt-1" />
                      <div>
                        <p className="text-[13px] text-white font-bold">Envoyer le contrat par courriel</p>
                        <p className="text-[11px] text-[#6b7280] mt-1">Un courriel avec un lien sécurisé sera envoyé au RPRP/directeur. Ils révisent et signent numériquement.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border transition-colors bg-[#111317] border-[#2D3748] hover:border-[#E63946]/30" onClick={() => setCreateForm({ ...createForm, contract_method: "paper" })}>
                      <input type="radio" name="contract_method" value="paper" checked={createForm.contract_method === "paper"} onChange={() => setCreateForm({ ...createForm, contract_method: "paper" })} className="accent-[#E63946] mt-1" />
                      <div>
                        <p className="text-[13px] text-white font-bold">Marquer comme accepté (contrat papier)</p>
                        <p className="text-[11px] text-[#6b7280] mt-1">Pour les cas où le contrat a été signé hors ligne. L&apos;admin téléverse le PDF signé.</p>
                      </div>
                    </label>
                  </div>

                  {createForm.contract_method === "email" && (
                    <div className="bg-[#111317] rounded-xl border border-[#2D3748] p-4">
                      <p className="text-[12px] text-[#9CA3AF] mb-3">
                        Un courriel sera envoyé à <span className="text-white font-bold">{createForm.rprp_courriel || "(courriel du RPRP)"}</span> avec un lien sécurisé vers l&apos;entente.
                      </p>
                      <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Courriel du destinataire</label>
                      <input type="email" value={createForm.contract_email || createForm.rprp_courriel} onChange={(e) => setCreateForm({ ...createForm, contract_email: e.target.value })} className={selectBase + " w-full"} />
                    </div>
                  )}

                  {createForm.contract_method === "paper" && (
                    <div className="bg-[#111317] rounded-xl border border-[#2D3748] p-4 space-y-3">
                      <div className="border-2 border-dashed border-[#2D3748] rounded-xl p-6 text-center hover:border-[#E63946]/30 transition-colors cursor-pointer">
                        <IconFile />
                        <p className="text-[12px] text-[#6b7280] mt-2">Glisser-déposer ou cliquer pour téléverser le PDF signé</p>
                        <p className="text-[10px] text-[#4B5563] mt-1">PDF uniquement, max 10 Mo</p>
                      </div>
                      <div>
                        <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Date de signature *</label>
                        <input type="date" value={createForm.paper_date} onChange={(e) => setCreateForm({ ...createForm, paper_date: e.target.value })} className={selectBase + " w-full"} />
                      </div>
                      <div>
                        <label className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] block mb-2">Signataire</label>
                        <input type="text" value={createForm.paper_signer || createForm.director_name} onChange={(e) => setCreateForm({ ...createForm, paper_signer: e.target.value })} className={selectBase + " w-full"} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Step 4: Summary ─────────────────────── */}
              {createStep === 4 && (
                <>
                  <div className="bg-[#111317] rounded-xl border border-[#2D3748] p-5 space-y-4">
                    <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Informations de l&apos;établissement</h3>
                    <div className="space-y-2 text-[13px]">
                      {[
                        ["Type", createForm.type === "secondaire" ? "École secondaire" : createForm.type === "cegep" ? "CÉGEP" : "Collège privé"],
                        ["Nom", createForm.name],
                        ["Ville", createForm.city],
                        ["Région", createForm.region],
                        ...(createForm.type !== "secondaire" && createForm.conference ? [["Conférence", createForm.conference === "sud_ouest" ? "Sud-Ouest" : "Nord-Est"]] : []),
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-[#6b7280]">{label}</span>
                          <span className="text-white">{value || "—"}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-start">
                        <span className="text-[#6b7280]">Sports</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                          {createForm.sports.length > 0 ? createForm.sports.map((sp) => (
                            <span key={sp} className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[10px] font-bold text-[#9CA3AF]">{sp}</span>
                          )) : <span className="text-[#6b7280]">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111317] rounded-xl border border-[#2D3748] p-5 space-y-4">
                    <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Conformité Loi 25</h3>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-[#6b7280]">RPRP</span>
                        <span className="text-white">{createForm.rprp_nom} ({createForm.rprp_courriel})</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#6b7280]">Contrat</span>
                        {createForm.contract_method === "email" ? (
                          <span className="text-[#3B82F6] text-[12px]">Sera envoyé par courriel à {createForm.contract_email || createForm.rprp_courriel}</span>
                        ) : (
                          <span className="text-[#22C55E] text-[12px]">Accepté le {createForm.paper_date || "—"} (contrat papier)</span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b7280]">Statut initial</span>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${createForm.contract_method === "paper" ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EAB308]/10 text-[#EAB308]"}`}>
                          {createForm.contract_method === "paper" ? "Accepté" : "En attente de contrat"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="bg-[#111317] border-t border-[#2D3748] px-6 py-4 sticky bottom-0 flex justify-between">
              {createStep > 1 ? (
                <button type="button" onClick={() => setCreateStep(createStep - 1)} className="px-4 py-2.5 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors flex items-center gap-1">
                  <IconChevronLeft /> Précédent
                </button>
              ) : (
                <button type="button" onClick={() => setShowCreateDrawer(false)} className="px-4 py-2.5 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                  Annuler
                </button>
              )}
              {createStep < 4 ? (
                <button type="button" onClick={() => setCreateStep(createStep + 1)} disabled={createStep === 1 && (!createForm.name || !createForm.city || !createForm.region)} className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                  Suivant <IconChevronRight />
                </button>
              ) : (
                <button type="button" onClick={handleCreateSubmit} className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors flex items-center gap-1">
                  Créer l&apos;établissement
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         DEACTIVATION MODAL
      ═══════════════════════════════════════════════════════ */}
      {showDeactivateModal && (() => {
        const s = showDeactivateModal;
        const totalUsers = s.coaches_count + s.recruiters_count + s.directors_count;
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeactivateModal(null)} />
            <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#F59E0B]/15 flex items-center justify-center">
                  <span className="text-[#F59E0B]"><IconAlert /></span>
                </div>
                <h3 className="font-head text-[16px] font-black text-white">Désactiver {s.name} ?</h3>
              </div>
              <p className="text-[13px] text-[#9CA3AF] mb-4">Cette action aura les effets suivants :</p>
              <div className="bg-[#111317] rounded-lg border border-[#F59E0B]/20 p-4 space-y-2 mb-5">
                {totalUsers > 0 && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    <span className="text-[#9CA3AF]"><span className="text-white font-bold">{totalUsers}</span> utilisateurs seront désactivés</span>
                  </div>
                )}
                {s.athletes_count > 0 && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    <span className="text-[#9CA3AF]"><span className="text-white font-bold">{s.athletes_count}</span> profils d&apos;athlètes masqués</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#9CA3AF]">Pipelines actifs gelés</span>
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                  <span className="text-[#9CA3AF]">Aucune donnée supprimée (traçabilité Loi 25)</span>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowDeactivateModal(null)} className="px-4 py-2.5 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                  Annuler
                </button>
                <button type="button" onClick={() => handleDeactivate(s)} className="px-5 py-2.5 rounded-lg bg-[#F59E0B] text-black font-bold text-[12px] uppercase tracking-wider hover:bg-[#D97706] transition-colors">
                  Désactiver
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
         DELETE MODAL (triple confirmation)
      ═══════════════════════════════════════════════════════ */}
      {showDeleteModal && (() => {
        const s = showDeleteModal;
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(null)} />
            <div className="relative bg-[#1A1D24] border border-[#E63946]/30 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center">
                  <span className="text-[#E63946]"><IconTrash /></span>
                </div>
                <h3 className="font-head text-[16px] font-black text-white">Supprimer {s.name} ?</h3>
              </div>
              <p className="text-[13px] text-[#E63946] mb-4 font-bold">
                Cette action est irréversible. L&apos;établissement et toutes ses données seront supprimés définitivement.
              </p>
              <p className="text-[12px] text-[#9CA3AF] mb-5">
                Cette suppression est possible uniquement car cet établissement n&apos;a aucun utilisateur rattaché.
              </p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowDeleteModal(null)} className="px-4 py-2.5 rounded-lg bg-[#2D3748]/50 text-[#9CA3AF] font-bold text-[12px] uppercase tracking-wider hover:bg-[#2D3748] hover:text-white transition-colors">
                  Annuler
                </button>
                <button type="button" onClick={() => handleDelete(s)} className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors">
                  Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
