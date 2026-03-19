"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────
   CelebrationToast — Lettre d'intention signée confetti + toast
   CSS-only confetti burst (8 red/white squares) + toast message.
───────────────────────────────────────────────────────────────── */

const CONFETTI_PIECES = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  color: i % 2 === 0 ? "#E63946" : "#FFFFFF",
  left: 20 + Math.random() * 60,
  delay: Math.random() * 0.3,
  size: 6 + Math.random() * 4,
}));

interface Props {
  show: boolean;
  onDone: () => void;
}

export default function CelebrationToast({ show, onDone }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t1 = setTimeout(() => setExiting(true), 2500);
    const t2 = setTimeout(() => { setExiting(false); onDone(); }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {/* Confetti pieces */}
      <div className="absolute inset-0 overflow-hidden">
        {CONFETTI_PIECES.map((p) => (
          <div
            key={p.id}
            className="nx-confetti-piece"
            style={{
              left: `${p.left}%`,
              bottom: "40%",
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Toast */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div
          className={`flex items-center gap-3 bg-[#E63946] text-white rounded-xl px-6 py-4 shadow-[0_4px_24px_rgba(230,51,41,0.4)] ${
            exiting ? "nx-toast-exit" : "nx-toast-enter"
          }`}
        >
          <span className="text-[20px]">🎉</span>
          <div>
            <p className="font-head text-[14px] font-bold uppercase tracking-wider">Félicitations!</p>
            <p className="text-[12px] text-white/80 mt-0.5">Lettre d&apos;intention signée.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
