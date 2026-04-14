"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Placement } from "@/lib/types/models";

interface PlacementsTableProps {
  placements: Placement[];
  variant: "ecole" | "cegep";
}

type SortColumn = "date" | "sport" | "destination";
type SortDirection = "asc" | "desc";

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PlacementsTable({ placements, variant }: PlacementsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  };

  const sortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) return null;
    return (
      <span className="ml-1 text-[9px] opacity-60">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const sorted = useMemo(() => {
    const copy = [...placements];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "date":
          cmp = new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime();
          break;
        case "sport":
          cmp = a.sport.localeCompare(b.sport, "fr");
          break;
        case "destination":
          if (variant === "ecole") {
            cmp = a.destinationCegep.localeCompare(b.destinationCegep, "fr");
          } else {
            cmp = (a.sourceSchool ?? "").localeCompare(b.sourceSchool ?? "", "fr");
          }
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [placements, sortColumn, sortDirection, variant]);

  const sortableClass =
    "cursor-pointer select-none hover:text-white transition-colors";

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">
              <th className="text-left px-4 py-3">Athlète</th>
              <th
                className={`text-left px-4 py-3 ${sortableClass}`}
                onClick={() => handleSort("sport")}
              >
                Sport{sortIndicator("sport")}
              </th>
              <th className="text-left px-4 py-3">Position</th>

              {variant === "ecole" ? (
                <>
                  <th
                    className={`text-left px-4 py-3 ${sortableClass}`}
                    onClick={() => handleSort("destination")}
                  >
                    CÉGEP de destination{sortIndicator("destination")}
                  </th>
                  <th
                    className={`text-left px-4 py-3 ${sortableClass}`}
                    onClick={() => handleSort("date")}
                  >
                    Date{sortIndicator("date")}
                  </th>
                  <th className="text-left px-4 py-3">Coach</th>
                </>
              ) : (
                <>
                  <th
                    className={`text-left px-4 py-3 ${sortableClass}`}
                    onClick={() => handleSort("destination")}
                  >
                    École d&apos;origine{sortIndicator("destination")}
                  </th>
                  <th className="text-left px-4 py-3">Coach source</th>
                  <th className="text-left px-4 py-3">Recruteur</th>
                  <th
                    className={`text-left px-4 py-3 ${sortableClass}`}
                    onClick={() => handleSort("date")}
                  >
                    Date{sortIndicator("date")}
                  </th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.id}
                className="border-t border-[#1e2128] bg-[rgba(230,57,70,0.03)] hover:bg-[#22262E] transition-colors"
              >
                {/* Athlete name */}
                <td className="px-4 py-3">
                  <Link
                    href={`/recruteur/athletes/${p.athleteId}`}
                    className="font-semibold text-white text-[14px] hover:text-[#E63946] transition-colors"
                  >
                    {p.athleteName}
                  </Link>
                </td>

                {/* Sport badge */}
                <td className="px-4 py-3">
                  <span className="bg-[#2A2D35] text-[#9CA3AF] rounded-full px-2.5 py-0.5 text-[12px]">
                    {p.sport}
                  </span>
                </td>

                {/* Position */}
                <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                  {p.position}
                </td>

                {variant === "ecole" ? (
                  <>
                    {/* CÉGEP de destination */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white text-[13px]">
                        {p.destinationCegep}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {formatDateFr(p.signedAt)}
                    </td>

                    {/* Coach */}
                    <td className="px-4 py-3 text-[13px]">
                      {p.coachId ? (
                        <Link href={`/coach/ecole/coachs/${p.coachId}`} className="text-[#9CA3AF] hover:text-[#E63946] transition-colors">
                          {p.coachName}
                        </Link>
                      ) : (
                        <span className="text-[#9CA3AF]">{p.coachName}</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    {/* École d'origine */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white text-[13px]">
                        {p.sourceSchool ?? "—"}
                      </span>
                    </td>

                    {/* Coach source */}
                    <td className="px-4 py-3 text-[13px]">
                      {p.coachId ? (
                        <Link href={`/recruteur/coach/${p.coachId}`} className="text-[#9CA3AF] hover:text-[#E63946] transition-colors">
                          {p.coachName}
                        </Link>
                      ) : (
                        <span className="text-[#9CA3AF]">{p.coachName}</span>
                      )}
                    </td>

                    {/* Recruteur */}
                    <td className="px-4 py-3 text-[13px]">
                      {p.recruiterId ? (
                        <Link href={`/recruteur/cegep/entraineurs/${p.recruiterId}`} className="text-[#9CA3AF] hover:text-[#E63946] transition-colors">
                          {p.recruiterName}
                        </Link>
                      ) : (
                        <span className="text-[#9CA3AF]">{p.recruiterName ?? "—"}</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {formatDateFr(p.signedAt)}
                    </td>
                  </>
                )}
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={variant === "ecole" ? 6 : 7}
                  className="px-4 py-8 text-center text-[13px] text-[#6B7280]"
                >
                  Aucun placement pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
