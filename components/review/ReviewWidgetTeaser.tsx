"use client";

import EntityLink from "@/components/shared/EntityLink";

interface Props {
  coachName: string;
  coachId?: string;
  onExpand: () => void;
  onDismiss: () => void;
}

export default function ReviewWidgetTeaser({ coachName, coachId, onExpand, onDismiss }: Props) {
  return (
    <div
      className="relative flex items-center gap-3 rounded-lg px-4 py-3 animate-[slideUp_300ms_ease-out_both]"
      style={{
        background: "#1A1D24",
        borderLeft: "3px solid #E63946",
        border: "1px solid #2D3748",
        borderLeftWidth: 3,
        borderLeftColor: "#E63946",
      }}
    >
      {/* Icon */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 32, height: 32, background: "rgba(230,57,70,0.1)" }}
      >
        <span className="text-[14px]">🎯</span>
      </div>

      {/* Text */}
      <p className="text-[14px] text-[#D1D5DB] flex-1">
        Comment était votre échange avec{" "}
        <EntityLink type="coach" id={coachId} name={coachName} portal="recruiter" /> ?
      </p>

      {/* CTA */}
      <button
        type="button"
        onClick={onExpand}
        className="text-[14px] font-bold shrink-0 transition-opacity hover:opacity-80"
        style={{ color: "#E63946" }}
      >
        Évaluer →
      </button>

      {/* Dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 transition-colors"
        style={{ color: "#4B5563", fontSize: 20, lineHeight: 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#9CA3AF"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#4B5563"; }}
      >
        ×
      </button>
    </div>
  );
}
