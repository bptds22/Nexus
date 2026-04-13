"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";

interface SportRow {
  id: string;
  nom: string;
  athlete_count: number;
  position_count: number;
}

interface PositionRow {
  id: string;
  sport_id: string;
  nom: string;
  abreviation: string | null;
}

const inputBase =
  "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

export default function AdminSportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [sports, setSports] = useState<SportRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newPos, setNewPos] = useState<{ nom: string; abreviation: string }>({ nom: "", abreviation: "" });
  const [showAddSport, setShowAddSport] = useState(false);
  const [newSport, setNewSport] = useState("");

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchAll() {
    setLoading(true);
    const [sportsRes, athletesRes, positionsRes] = await Promise.all([
      supabase.from("sports").select("id,nom,categorie").order("nom"),
      supabase.from("athletes").select("sport_id"),
      supabase.from("positions").select("id,nom,abreviation,sport_id").order("nom"),
    ]);

    const athleteCounts = new Map<string, number>();
    for (const a of (athletesRes.data || []) as { sport_id: string | null }[]) {
      if (!a.sport_id) continue;
      athleteCounts.set(a.sport_id, (athleteCounts.get(a.sport_id) || 0) + 1);
    }
    const positionCounts = new Map<string, number>();
    for (const p of (positionsRes.data || []) as { sport_id: string }[]) {
      positionCounts.set(p.sport_id, (positionCounts.get(p.sport_id) || 0) + 1);
    }

    setSports(
      ((sportsRes.data || []) as Array<Record<string, unknown>>).map((s) => ({
        id: s.id as string,
        nom: (s.nom as string) ?? "",
        athlete_count: athleteCounts.get(s.id as string) || 0,
        position_count: positionCounts.get(s.id as string) || 0,
      })),
    );
    setPositions((positionsRes.data || []) as PositionRow[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const columns: AdminColumn<SportRow>[] = [
    {
      key: "id",
      label: "ID",
      readonly: true,
      width: "180px",
      render: (r) => <span className="text-[11px] text-[#6b7280] font-mono">{r.id.slice(0, 8)}…</span>,
    },
    { key: "nom", label: "Nom", type: "text" },
    {
      key: "athlete_count",
      label: "# Athlètes",
      readonly: true,
      align: "right",
      width: "130px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.athlete_count}</span>,
    },
    {
      key: "position_count",
      label: "# Positions",
      readonly: true,
      align: "right",
      width: "130px",
      render: (r) => <span className="text-[13px] text-[#E0E0E0] tabular-nums">{r.position_count}</span>,
    },
  ];

  const selectedSport = sports.find((s) => s.id === selectedSportId) || null;
  const selectedPositions = positions.filter((p) => p.sport_id === selectedSportId);

  async function handleAddSport() {
    if (!newSport.trim()) return;
    const { error } = await supabase.from("sports").insert({ nom: newSport.trim() });
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    notify("Sport ajouté");
    setNewSport("");
    setShowAddSport(false);
    fetchAll();
  }

  async function handleAddPosition() {
    if (!selectedSportId || !newPos.nom.trim()) return;
    const { error } = await supabase.from("positions").insert({
      sport_id: selectedSportId,
      nom: newPos.nom.trim(),
      abreviation: newPos.abreviation.trim() || null,
    });
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    notify("Position ajoutée");
    setNewPos({ nom: "", abreviation: "" });
    fetchAll();
  }

  async function handleUpdatePosition(id: string, patch: Partial<PositionRow>) {
    const { error } = await supabase.from("positions").update(patch).eq("id", id);
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleDeletePosition(id: string) {
    if (!confirm("Supprimer cette position ?")) return;
    const { error } = await supabase.from("positions").delete().eq("id", id);
    if (error) {
      notify(`Erreur : ${error.message}`);
      return;
    }
    notify("Position supprimée");
    fetchAll();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
            Gestion des sports
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-1">
            {sports.length} sport(s) · {positions.length} position(s) au total
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddSport((v) => !v)}
          className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors"
        >
          {showAddSport ? "Annuler" : "+ Ajouter un sport"}
        </button>
      </div>

      {showAddSport && (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-4">
          <h2 className="font-head text-[14px] font-black text-white uppercase">Nouveau sport</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nom du sport"
              value={newSport}
              onChange={(e) => setNewSport(e.target.value)}
              className={`${inputBase} flex-1`}
            />
            <button
              type="button"
              onClick={handleAddSport}
              className="px-5 py-2 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D93C3C] transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : sports.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucun sport</div>
      ) : (
        <AdminTable<SportRow>
          rows={sports}
          columns={columns}
          table="sports"
          searchFields={["nom"]}
          searchPlaceholder="Rechercher un sport..."
          onRowClick={(r) => setSelectedSportId((cur) => (cur === r.id ? null : r.id))}
          onSaved={(id, patch) =>
            setSports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
          }
        />
      )}

      {selectedSport && (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-head text-[14px] font-black text-white uppercase">
              Positions — {selectedSport.nom}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedSportId(null)}
              className="text-[12px] text-[#9CA3AF] hover:text-white"
            >
              Fermer
            </button>
          </div>

          {selectedPositions.length === 0 ? (
            <p className="text-[13px] text-[#6b7280]">Aucune position pour ce sport.</p>
          ) : (
            <div className="space-y-2">
              {selectedPositions.map((p) => (
                <PositionRowItem
                  key={p.id}
                  position={p}
                  onUpdate={handleUpdatePosition}
                  onDelete={handleDeletePosition}
                />
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-[#2D3748] flex gap-3">
            <input
              type="text"
              placeholder="Nom de la position"
              value={newPos.nom}
              onChange={(e) => setNewPos((p) => ({ ...p, nom: e.target.value }))}
              className={`${inputBase} flex-1`}
            />
            <input
              type="text"
              placeholder="Abréviation"
              value={newPos.abreviation}
              onChange={(e) => setNewPos((p) => ({ ...p, abreviation: e.target.value }))}
              className={`${inputBase} w-32`}
            />
            <button
              type="button"
              onClick={handleAddPosition}
              className="px-4 py-2 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D93C3C] transition-colors"
            >
              + Ajouter
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#E63946] rounded-lg px-5 py-3 text-[13px] text-white shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function PositionRowItem({
  position,
  onUpdate,
  onDelete,
}: {
  position: PositionRow;
  onUpdate: (id: string, patch: Partial<PositionRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [nom, setNom] = useState(position.nom);
  const [abrev, setAbrev] = useState(position.abreviation || "");

  return (
    <div className="flex items-center gap-3 bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2">
      <input
        type="text"
        title="Nom de la position"
        placeholder="Nom"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => {
          if (nom !== position.nom) onUpdate(position.id, { nom });
        }}
        className="flex-1 bg-transparent text-[13px] text-white outline-none"
      />
      <input
        type="text"
        value={abrev}
        onChange={(e) => setAbrev(e.target.value)}
        onBlur={() => {
          if (abrev !== (position.abreviation || "")) onUpdate(position.id, { abreviation: abrev || null });
        }}
        placeholder="Abrév."
        className="w-24 bg-transparent text-[13px] text-[#9CA3AF] outline-none"
      />
      <button
        type="button"
        onClick={() => onDelete(position.id)}
        className="px-2 py-1 text-[11px] text-[#E63946] hover:bg-[#E63946]/10 rounded transition-colors"
        title="Supprimer"
      >
        Supprimer
      </button>
    </div>
  );
}
