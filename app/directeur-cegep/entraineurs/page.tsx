"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { mockTrainerOverviews } from "@/lib/mock";
import type { TrainerOverview } from "@/lib/types/models";

/* ── Helpers ─────────────────────────────────────────────── */

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffM = Math.floor(diffD / 30);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffD < 7) return `Il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
  if (diffW < 5) return `Il y a ${diffW} semaine${diffW > 1 ? "s" : ""}`;
  return `Il y a ${diffM} mois`;
}

function getDaysAgo(isoDate: string): number {
  return Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getLoginColor(isoDate: string): string {
  const days = getDaysAgo(isoDate);
  if (days < 7) return "text-white";
  if (days <= 30) return "text-[#F59E0B]";
  return "text-[#E63946]";
}

const SPORT_COLORS: Record<string, string> = {
  Football: "bg-[#3B82F6]/20 text-[#60A5FA]",
  Hockey: "bg-[#8B5CF6]/20 text-[#A78BFA]",
  Basketball: "bg-[#F97316]/20 text-[#FB923C]",
  Volleyball: "bg-[#22C55E]/20 text-[#4ADE80]",
  Soccer: "bg-[#06B6D4]/20 text-[#22D3EE]",
};

const DIVISION_COLORS: Record<string, string> = {
  D1: "bg-[#E63946]/15 text-[#E63946]",
  D2: "bg-[#F59E0B]/15 text-[#F59E0B]",
  D3: "bg-[#6B7280]/15 text-[#9CA3AF]",
};

const STATUS_DOT: Record<TrainerOverview["status"], string> = {
  active: "#22C55E",
  inactive: "#F59E0B",
  season_ended: "#6B7280",
};

const STATUS_LABEL: Record<TrainerOverview["status"], string> = {
  active: "Actif",
  inactive: "Inactif",
  season_ended: "Saison terminée",
};

type SortKey =
  | "name"
  | "sports"
  | "division"
  | "activeFavorites"
  | "messagesSent30d"
  | "recruitsConfirmed"
  | "lastLoginAt"
  | "status";

type SortDir = "asc" | "desc";

const SPORTS_FILTER = [
  "Tous",
  "Football",
  "Hockey",
  "Basketball",
  "Volleyball",
  "Soccer",
];

const STATUS_FILTER = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "season_ended", label: "Saison terminée" },
];

/* ── Component ───────────────────────────────────────────── */

export default function TrainersListPage() {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sportFilter, setSportFilter] = useState("Tous");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  /* Separate active from deactivated */
  const activeTrainers = mockTrainerOverviews.filter((t) => t.accountStatus === "ACTIF");
  const deactivatedTrainers = mockTrainerOverviews.filter((t) => t.accountStatus === "DESACTIVE");

  /* ── Filter + Sort ── */
  const filtered = useMemo(() => {
    let list = [...activeTrainers];

    if (sportFilter !== "Tous") {
      list = list.filter((t) => t.sports.includes(sportFilter));
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.firstName.toLowerCase().includes(q) ||
          t.lastName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`
          );
          break;
        case "sports":
          cmp = a.sports.join(",").localeCompare(b.sports.join(","));
          break;
        case "division":
          cmp = a.division.join(",").localeCompare(b.division.join(","));
          break;
        case "activeFavorites":
          cmp = a.activeFavorites - b.activeFavorites;
          break;
        case "messagesSent30d":
          cmp = a.messagesSent30d - b.messagesSent30d;
          break;
        case "recruitsConfirmed":
          cmp = a.recruitsConfirmed - b.recruitsConfirmed;
          break;
        case "lastLoginAt":
          cmp =
            new Date(a.lastLoginAt).getTime() -
            new Date(b.lastLoginAt).getTime();
          break;
        case "status": {
          const order = { active: 0, inactive: 1, season_ended: 2 };
          cmp = order[a.status] - order[b.status];
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [sortKey, sortDir, sportFilter, statusFilter, searchQuery]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return (
      <span className="ml-1 text-[9px]">
        {sortDir === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  /* ── Render ── */
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="uppercase text-white font-bold tracking-wide"
            style={{ fontFamily: "var(--wl-font-head)", fontSize: 22 }}
          >
            MES ENTRAÎNEURS
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {mockTrainerOverviews.length} entraîneurs-recruteurs dans votre
            CÉGEP
          </p>
        </div>
        <Link
          href="/directeur-cegep/inviter"
          className="inline-flex items-center justify-center bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-[0.12em] rounded-lg px-5 h-10 hover:bg-[#D93C3C] transition-colors"
          style={{ fontFamily: "var(--wl-font-head)" }}
        >
          + Inviter un entraîneur
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sport dropdown */}
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors"
        >
          {SPORTS_FILTER.map((s) => (
            <option key={s} value={s}>
              Sport : {s}
            </option>
          ))}
        </select>

        {/* Status dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors"
        >
          {STATUS_FILTER.map((s) => (
            <option key={s.value} value={s.value}>
              Statut : {s.label}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Recherche par nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-9 pr-3 py-2 text-[13px] text-[#e0e0e0] placeholder-[#6B7280] outline-none focus:border-[#E63946] transition-colors"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-[#6B7280] text-[14px]">
            Aucun entraîneur trouvé
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#13151a]">
                  {(
                    [
                      { key: "name" as SortKey, label: "Entraîneur" },
                      { key: "sports" as SortKey, label: "Sport(s)" },
                      { key: "division" as SortKey, label: "Division" },
                      {
                        key: "activeFavorites" as SortKey,
                        label: "Favoris actifs",
                      },
                      {
                        key: "messagesSent30d" as SortKey,
                        label: "Messages envoyés (30j)",
                      },
                      {
                        key: "recruitsConfirmed" as SortKey,
                        label: "Recrues confirmées",
                      },
                      {
                        key: "lastLoginAt" as SortKey,
                        label: "Dernière connexion",
                      },
                      { key: "status" as SortKey, label: "Statut" },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] cursor-pointer select-none hover:text-[#9CA3AF] transition-colors whitespace-nowrap"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <SortIndicator col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((trainer) => {
                  const initials =
                    trainer.firstName.charAt(0) + trainer.lastName.charAt(0);

                  return (
                    <Link
                      key={trainer.id}
                      href={`/directeur-cegep/entraineurs/${trainer.id}`}
                      className="contents"
                    >
                      <tr className="border-t border-[#1e2128] hover:bg-[#22262E] cursor-pointer transition-colors">
                        {/* Entraîneur */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[11px] font-bold text-[#9CA3AF] shrink-0">
                              {initials}
                            </div>
                            <span className="text-[13px] font-bold text-white whitespace-nowrap">
                              {trainer.firstName} {trainer.lastName}
                            </span>
                          </div>
                        </td>

                        {/* Sport(s) */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {trainer.sports.map((sport) => (
                              <span
                                key={sport}
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${SPORT_COLORS[sport] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
                              >
                                {sport}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Division */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {trainer.division.map((div) => (
                              <span
                                key={div}
                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIVISION_COLORS[div] || "bg-[#374151]/30 text-[#9CA3AF]"}`}
                              >
                                {div}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Favoris actifs */}
                        <td className="px-4 py-3 text-[13px] font-bold text-white">
                          {trainer.activeFavorites}
                        </td>

                        {/* Messages envoyés (30j) */}
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-bold text-white">
                            {trainer.messagesSent30d}
                          </span>
                        </td>

                        {/* Recrues confirmées */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-[13px] font-bold ${trainer.recruitsConfirmed > 0 ? "text-[#E63946]" : "text-[#6B7280]"}`}
                          >
                            {trainer.recruitsConfirmed}
                          </span>
                        </td>

                        {/* Dernière connexion */}
                        <td
                          className={`px-4 py-3 text-[12px] whitespace-nowrap ${getLoginColor(trainer.lastLoginAt)}`}
                        >
                          {getRelativeTime(trainer.lastLoginAt)}
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: STATUS_DOT[trainer.status],
                              }}
                            />
                            <span className="text-[12px] text-[#9CA3AF] whitespace-nowrap">
                              {STATUS_LABEL[trainer.status]}
                            </span>
                          </div>
                          <div className="mt-1">
                            <Link
                              href={`/directeur/equipe/${trainer.id}/supprimer`}
                              onClick={(e) => e.stopPropagation()}
                              className="border border-[#E63946]/40 text-[#E63946] text-[11px] px-2 py-0.5 rounded hover:bg-[#E63946]/10 transition-colors"
                            >
                              Supprimer
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </Link>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Deactivated trainers section ── */}
      {deactivatedTrainers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280]">
            Désactivés ({deactivatedTrainers.length})
          </h2>
          <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden opacity-70">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody>
                  {deactivatedTrainers.map((trainer) => {
                    const initials = trainer.firstName.charAt(0) + trainer.lastName.charAt(0);
                    const deactivatedDate = trainer.deactivatedAt
                      ? new Date(trainer.deactivatedAt).toLocaleDateString("fr-CA")
                      : "—";
                    return (
                      <tr key={trainer.id} className="border-t first:border-t-0 border-[#1e2128] hover:bg-[#22262E] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2A2D35] flex items-center justify-center text-[11px] font-bold text-[#4a4d56] shrink-0">
                              {initials}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-[#6B7280]">
                                {trainer.firstName} {trainer.lastName}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded bg-[rgba(107,114,128,0.2)] text-[#6B7280]">
                                Désactivé
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B7280]">
                          {trainer.sports.join(", ")}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B7280]">
                          Désactivé le {deactivatedDate}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B7280] max-w-[200px] truncate">
                          {trainer.deactivationReason || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setToast(`${trainer.firstName} ${trainer.lastName} a été réactivé.`);
                              setTimeout(() => setToast(null), 3000);
                            }}
                            className="text-[12px] font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors"
                          >
                            Réactiver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#22C55E] text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
