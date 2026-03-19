import type { RosterAthlete } from "../_data/mockRosterData";
import RosterRow from "./RosterRow";

/* ─────────────────────────────────────────────────────────────────
   Roster Table — full-width sortable table with sticky header
───────────────────────────────────────────────────────────────── */

type SortKey = "stage" | "name" | "position" | "gradYear" | "commitment" | "views" | "favorites";

const thCls = "px-4 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] cursor-pointer select-none hover:text-[#9CA3AF] transition-colors whitespace-nowrap";

function SortArrow({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return null;
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className={`inline ml-1 ${asc ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 6l3-3 3 3" />
    </svg>
  );
}

interface RosterTableProps {
  athletes: RosterAthlete[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}

export default function RosterTable({ athletes, sortKey, sortAsc, onSort }: RosterTableProps) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-[#1A1D24]">
            <tr className="border-b border-[#2D3748]">
              <th className={thCls} onClick={() => onSort("name")}>
                Nom <SortArrow active={sortKey === "name"} asc={sortAsc} />
              </th>
              <th className={thCls} onClick={() => onSort("position")}>
                Position <SortArrow active={sortKey === "position"} asc={sortAsc} />
              </th>
              <th className={thCls} onClick={() => onSort("gradYear")}>
                Graduation <SortArrow active={sortKey === "gradYear"} asc={sortAsc} />
              </th>
              <th className={thCls} onClick={() => onSort("stage")}>
                Statut <SortArrow active={sortKey === "stage"} asc={sortAsc} />
              </th>
              <th className={thCls} onClick={() => onSort("commitment")}>
                Recrutement <SortArrow active={sortKey === "commitment"} asc={sortAsc} />
              </th>
              <th className={`${thCls} hidden md:table-cell`} onClick={() => onSort("views")}>
                Vues <SortArrow active={sortKey === "views"} asc={sortAsc} />
              </th>
              <th className={`${thCls} hidden md:table-cell`} onClick={() => onSort("favorites")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#E63946" stroke="none" className="inline">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                <SortArrow active={sortKey === "favorites"} asc={sortAsc} />
              </th>
              <th className={`${thCls} cursor-default hover:text-[#6b7280]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((a, i) => (
              <RosterRow key={a.id} athlete={a} even={i % 2 === 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { SortKey };
