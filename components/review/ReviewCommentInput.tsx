"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

export default function ReviewCommentInput({ value, onChange, maxLength = 280 }: Props) {
  return (
    <div>
      <label className="text-[13px] text-[#6B7280] block mb-2">Commentaire (optionnel)</label>
      <textarea
        value={value}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) onChange(e.target.value);
        }}
        placeholder="Visible uniquement par le coach, de façon anonyme..."
        className="w-full rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#4B5563] placeholder:italic outline-none resize-y transition-colors"
        style={{
          background: "#22262E",
          border: "1px solid #2A2D35",
          minHeight: 80,
        }}
        rows={3}
      />
      <p
        className="text-[12px] text-right mt-1"
        style={{ color: value.length >= 260 ? "#E63946" : "#4B5563" }}
      >
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
