"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   AdminTable — reusable data table for admin pages.

   Features:
   - Search bar filtering across `searchFields`
   - Clickable column headers (asc/desc sort)
   - Inline editing (text/number/boolean/select) → saves to Supabase
   - Cell flashes green on save, red on error
   - 50 rows per page
───────────────────────────────────────────────────────────────── */

export type AdminColumnType = "text" | "number" | "boolean" | "select" | "readonly";

export interface AdminColumn<T> {
  key: keyof T & string;
  label: string;
  type?: AdminColumnType;
  width?: string;
  options?: { value: string; label: string }[]; // required for type === "select"
  /** Custom renderer. If provided, used for the DISPLAY state (not edit). */
  render?: (row: T) => React.ReactNode;
  /** Block editing this column (takes precedence over `type`). */
  readonly?: boolean;
  align?: "left" | "right" | "center";
}

export interface AdminTableProps<T extends { id: string | number }> {
  rows: T[];
  columns: AdminColumn<T>[];
  /** Supabase table name to write updates to. */
  table: string;
  /** Fields searched by the search bar. */
  searchFields?: (keyof T & string)[];
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Called after a successful save — parent can refresh its local state. */
  onSaved?: (id: T["id"], patch: Partial<T>) => void;
  /** Rows per page. Default 50. */
  pageSize?: number;
  /** Optional row-level click handler (only fires when not editing). */
  onRowClick?: (row: T) => void;
}

type FlashState = "ok" | "err" | null;

export default function AdminTable<T extends { id: string | number }>({
  rows,
  columns,
  table,
  searchFields,
  searchPlaceholder = "Rechercher…",
  onSaved,
  pageSize = 50,
  onRowClick,
}: AdminTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: T["id"]; key: string } | null>(null);
  const [flash, setFlash] = useState<Record<string, FlashState>>({});
  const [local, setLocal] = useState<Record<string, Partial<T>>>({});

  /** Apply any unsaved local patches so the UI stays consistent. */
  const merged = useMemo(() => rows.map((r) => ({ ...r, ...(local[String(r.id)] || {}) })), [rows, local]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchFields?.length) return merged;
    return merged.filter((r) =>
      searchFields.some((f) => String((r as Record<string, unknown>)[f] ?? "").toLowerCase().includes(q)),
    );
  }, [merged, query, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "fr", { sensitivity: "base" }) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function flashCell(id: T["id"], key: string, state: FlashState) {
    const cellId = `${id}:${key}`;
    setFlash((f) => ({ ...f, [cellId]: state }));
    if (state) setTimeout(() => setFlash((f) => ({ ...f, [cellId]: null })), 1200);
  }

  async function saveCell(id: T["id"], key: string, value: unknown) {
    const supabase = createClient();
    const { error } = await supabase.from(table).update({ [key]: value }).eq("id", id);
    if (error) {
      console.error(`[AdminTable] save ${table}.${key}`, error);
      flashCell(id, key, "err");
      return;
    }
    setLocal((l) => ({ ...l, [String(id)]: { ...(l[String(id)] || {}), [key]: value } as Partial<T> }));
    flashCell(id, key, "ok");
    onSaved?.(id, { [key]: value } as Partial<T>);
  }

  function flashClass(id: T["id"], key: string) {
    const s = flash[`${id}:${key}`];
    if (s === "ok") return "bg-[#22C55E]/15 transition-colors";
    if (s === "err") return "bg-[#E63946]/20 transition-colors";
    return "transition-colors";
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder={searchPlaceholder}
          className="flex-1 bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-2.5 text-[13px] text-[#E0E0E0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none"
        />
        <span className="text-[12px] text-[#6b7280] whitespace-nowrap">
          {sorted.length} résultat{sorted.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg overflow-x-auto">
        <table className="w-full text-[13px] text-[#E0E0E0]">
          <thead>
            <tr className="bg-[#13151a] border-b border-[#2D3748]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] cursor-pointer select-none hover:text-white transition-colors"
                  style={{ width: c.width, textAlign: c.align || "left" }}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sortKey === c.key && (
                      <span className="text-[#E63946]">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={String(row.id)}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-[#2D3748] hover:bg-[#22252D] ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => {
                  const value = (row as Record<string, unknown>)[c.key];
                  const isEditing = editing?.id === row.id && editing.key === c.key;
                  const canEdit = !c.readonly && c.type !== "readonly";
                  const cellAlign = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";

                  return (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 ${cellAlign} ${flashClass(row.id, c.key)}`}
                      onClick={(e) => {
                        if (!canEdit) return;
                        if (c.type === "boolean") {
                          e.stopPropagation();
                          saveCell(row.id, c.key, !value);
                          return;
                        }
                        e.stopPropagation();
                        setEditing({ id: row.id, key: c.key });
                      }}
                    >
                      {/* Custom renderer */}
                      {!isEditing && c.render && c.type !== "boolean" && c.render(row)}

                      {/* Boolean toggle */}
                      {c.type === "boolean" && (
                        <button
                          type="button"
                          className={`relative inline-flex w-10 h-6 items-center rounded-full transition-colors ${value ? "bg-[#22C55E]" : "bg-[#4a4d56]"}`}
                          aria-pressed={!!value}
                        >
                          <span className={`inline-block w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
                        </button>
                      )}

                      {/* Inline select */}
                      {isEditing && c.type === "select" && (
                        <select
                          autoFocus
                          defaultValue={String(value ?? "")}
                          onBlur={(e) => {
                            setEditing(null);
                            if (e.target.value !== String(value ?? "")) saveCell(row.id, c.key, e.target.value);
                          }}
                          onChange={(e) => {
                            saveCell(row.id, c.key, e.target.value);
                            setEditing(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#111317] border border-[#E63946] rounded px-2 py-1 text-[13px] text-white outline-none"
                        >
                          {c.options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Inline text/number input */}
                      {isEditing && (c.type === "text" || c.type === "number" || c.type == null) && (
                        <input
                          autoFocus
                          type={c.type === "number" ? "number" : "text"}
                          defaultValue={value == null ? "" : String(value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const next = c.type === "number"
                              ? (e.target.value === "" ? null : Number(e.target.value))
                              : e.target.value;
                            setEditing(null);
                            if (String(next ?? "") !== String(value ?? "")) saveCell(row.id, c.key, next);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="w-full bg-[#111317] border border-[#E63946] rounded px-2 py-1 text-[13px] text-white outline-none"
                        />
                      )}

                      {/* Default display */}
                      {!isEditing && !c.render && c.type !== "boolean" && (
                        <span className={canEdit ? "cursor-text" : ""}>
                          {value == null || value === "" ? <span className="text-[#4a4d56]">—</span> : String(value)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[#6b7280] text-[13px]">
                  Aucun résultat
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-[#9CA3AF]">
          <span>
            Page {currentPage + 1} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1.5 rounded border border-[#2D3748] text-[#E0E0E0] hover:bg-[#22252D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1.5 rounded border border-[#2D3748] text-[#E0E0E0] hover:bg-[#22252D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
