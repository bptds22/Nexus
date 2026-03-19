"use client";

interface Props {
  value: boolean | null;
  onChange: (v: boolean) => void;
}

export default function ReviewRecommendToggle({ value, onChange }: Props) {
  const base = "flex items-center justify-center gap-2 w-[120px] rounded-lg py-2.5 text-[14px] font-bold transition-all duration-200 cursor-pointer select-none";

  return (
    <div>
      <p className="text-[14px] font-bold text-white mb-3">Recommanderiez-vous ce coach ?</p>
      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={base}
          style={{
            border: `1px solid ${value === true ? "#22C55E" : "#2A2D35"}`,
            background: value === true ? "rgba(34,197,94,0.1)" : "transparent",
            color: value === true ? "#22C55E" : "#9CA3AF",
          }}
        >
          <span>👍</span> Oui
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={base}
          style={{
            border: `1px solid ${value === false ? "#E63946" : "#2A2D35"}`,
            background: value === false ? "rgba(230,57,70,0.1)" : "transparent",
            color: value === false ? "#E63946" : "#9CA3AF",
          }}
        >
          <span>👎</span> Non
        </button>
      </div>
    </div>
  );
}
