"use client";

/* ─────────────────────────────────────────────────────────────────
   SportStatsFields — renders stat fields based on selected sport.
───────────────────────────────────────────────────────────────── */

interface SportStatsFieldsProps {
  sport: string;
  stats: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/* ── Field definitions per sport ────────────────────────────────── */

interface StatField {
  key: string;
  label: string;
  type: "number" | "text";
  placeholder?: string;
  decimal?: boolean;
}

const FOOTBALL_FIELDS: StatField[] = [
  { key: "matchesPlayed", label: "Matchs joués", type: "number" },
  { key: "matchesStarted", label: "Matchs partant", type: "number" },
  { key: "tackles", label: "Plaqués", type: "number" },
  { key: "sacks", label: "Sacks", type: "number" },
  { key: "forcedFumbles", label: "Échappés provoqués", type: "number" },
  { key: "interceptions", label: "Interceptions", type: "number" },
  { key: "passesDeflected", label: "Passes déviées", type: "number" },
  { key: "tacklesForLoss", label: "Plaqués pour perte", type: "number" },
  { key: "passingYards", label: "Verges par la passe", type: "number", placeholder: "QB seulement" },
  { key: "touchdowns", label: "Touchés", type: "number" },
];

const BASKETBALL_FIELDS: StatField[] = [
  { key: "matchesPlayed", label: "Matchs joués", type: "number" },
  { key: "ppg", label: "Points par match", type: "number", decimal: true },
  { key: "assists", label: "Passes décisives", type: "number", decimal: true },
  { key: "rebounds", label: "Rebonds", type: "number", decimal: true },
  { key: "steals", label: "Vols", type: "number", decimal: true },
  { key: "blocks", label: "Contres", type: "number", decimal: true },
  { key: "fgPct", label: "% Tirs", type: "number", decimal: true },
  { key: "ftPct", label: "% Lancers francs", type: "number", decimal: true },
];

const HOCKEY_FIELDS: StatField[] = [
  { key: "matchesPlayed", label: "Matchs joués", type: "number" },
  { key: "goals", label: "Buts", type: "number" },
  { key: "assistsH", label: "Passes", type: "number" },
  { key: "points", label: "Points", type: "number", placeholder: "Auto: buts + passes" },
  { key: "plusMinus", label: "Différentiel +/-", type: "number" },
  { key: "pim", label: "Minutes de pénalité", type: "number" },
  { key: "savePct", label: "% Arrêts", type: "number", decimal: true, placeholder: "Gardien seulement" },
];

const SOCCER_FIELDS: StatField[] = [
  { key: "matchesPlayed", label: "Matchs joués", type: "number" },
  { key: "goals", label: "Buts", type: "number" },
  { key: "assists", label: "Passes décisives", type: "number" },
  { key: "minutesPlayed", label: "Minutes jouées", type: "number" },
  { key: "cleanSheets", label: "Jeux blancs", type: "number", placeholder: "Gardien seulement" },
  { key: "passCompletionPct", label: "% Passes complétées", type: "number", decimal: true },
];

const VOLLEYBALL_FIELDS: StatField[] = [
  { key: "matchesPlayed", label: "Matchs joués", type: "number" },
  { key: "kills", label: "Attaques marquantes", type: "number" },
  { key: "blocks", label: "Contres", type: "number" },
  { key: "aces", label: "Aces", type: "number" },
  { key: "passingRating", label: "Cote de passe", type: "number", decimal: true },
  { key: "attackEfficiency", label: "Efficacité d'attaque", type: "number", decimal: true },
];

const SPORT_FIELDS: Record<string, StatField[]> = {
  Football: FOOTBALL_FIELDS,
  Basketball: BASKETBALL_FIELDS,
  Hockey: HOCKEY_FIELDS,
  Soccer: SOCCER_FIELDS,
  Volleyball: VOLLEYBALL_FIELDS,
};

const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3.5 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[11px] font-bold tracking-[1.2px] uppercase text-[#6b7280] mb-1.5";

export default function SportStatsFields({
  sport,
  stats,
  onChange,
}: SportStatsFieldsProps) {
  const fields = SPORT_FIELDS[sport];

  // Auto-calculate hockey points
  if (sport === "Hockey") {
    const goals = parseInt(stats.goals || "0") || 0;
    const assists = parseInt(stats.assistsH || "0") || 0;
    const sum = goals + assists;
    if (sum > 0 && stats.points !== String(sum)) {
      onChange("points", String(sum));
    }
  }

  if (!fields) {
    // Unknown sport — free text
    return (
      <div>
        <label className={labelCls}>Stats clés (format libre)</label>
        <textarea
          value={stats.customStats || ""}
          onChange={(e) => onChange("customStats", e.target.value)}
          rows={5}
          placeholder="Entrez vos statistiques ici..."
          className={`${inputCls} resize-none`}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className={labelCls}>{f.label}</label>
          <input
            type={f.type === "number" ? "text" : f.type}
            inputMode={f.type === "number" ? (f.decimal ? "decimal" : "numeric") : undefined}
            value={stats[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder || "—"}
            className={inputCls}
            readOnly={sport === "Hockey" && f.key === "points"}
          />
        </div>
      ))}
    </div>
  );
}
