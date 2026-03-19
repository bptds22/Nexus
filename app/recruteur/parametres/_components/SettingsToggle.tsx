"use client";

/* ─────────────────────────────────────────────────────────────────
   SettingsToggle — iOS-style toggle switch with label + sublabel
───────────────────────────────────────────────────────────────── */

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export default function SettingsToggle({ checked, onChange, label, sublabel, disabled }: Props) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#2A2D35]">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-[15px] text-white font-medium">{label}</p>
        {sublabel && <p className="text-[13px] text-[#6B7280] mt-0.5 leading-relaxed">{sublabel}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative shrink-0 w-[48px] h-[28px] rounded-full transition-all duration-300 ease-in-out
          shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]
          ${checked ? "bg-[#E63946]" : "bg-[#1a1f2e]"}
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span
          className={`
            absolute top-[4px] left-0 w-[20px] h-[20px] rounded-full
            bg-gradient-to-b from-white to-[#e8e8e8]
            shadow-[0_1px_3px_rgba(0,0,0,0.35),0_0_0_0.5px_rgba(0,0,0,0.1)]
            transition-all duration-300 ease-in-out
            ${checked ? "translate-x-[24px]" : "translate-x-[4px]"}
          `}
        />
      </button>
    </div>
  );
}
