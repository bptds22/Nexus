"use client";

/* ─────────────────────────────────────────────────────────────────
   NotificationRow — single row in the notifications table
   Icon, label, sublabel, and two toggle switches (In-App + Email)
───────────────────────────────────────────────────────────────── */

interface Props {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  sublabel: string;
  inApp: boolean;
  email: boolean;
  onInAppChange: (v: boolean) => void;
  onEmailChange: (v: boolean) => void;
  even: boolean;
}

function MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-[40px] h-[24px] rounded-full transition-all duration-300 ease-in-out cursor-pointer shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${
        checked ? "bg-[#E63946]" : "bg-[#1a1f2e]"
      }`}
    >
      <span
        className={`absolute top-[4px] left-0 w-[16px] h-[16px] rounded-full bg-gradient-to-b from-white to-[#e8e8e8] shadow-[0_1px_3px_rgba(0,0,0,0.35),0_0_0_0.5px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${
          checked ? "translate-x-[20px]" : "translate-x-[4px]"
        }`}
      />
    </button>
  );
}

export default function NotificationRow({ icon, iconBg, label, sublabel, inApp, email, onInAppChange, onEmailChange, even }: Props) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${even ? "bg-[#1A1D24]" : "bg-[#1A1D24]/60"} hover:bg-[#22262E]`}>
      {/* Icon circle */}
      <div className={`w-[32px] h-[32px] rounded-lg flex items-center justify-center shrink-0 ${iconBg || "bg-white/[0.06]"}`}>
        {icon}
      </div>
      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-white font-medium">{label}</p>
        <p className="text-[12px] text-[#6B7280] mt-0.5">{sublabel}</p>
      </div>
      {/* Toggles */}
      <div className="flex items-center gap-5 shrink-0">
        <MiniToggle checked={inApp} onChange={onInAppChange} />
        <MiniToggle checked={email} onChange={onEmailChange} />
      </div>
    </div>
  );
}
