"use client";

/**
 * PhoneFrame — a reusable hardware phone bezel. Holds any children
 * (used by the athlete landing for the WOW-effect video). Pure CSS,
 * no images. The screen area is a 9/19.5 portrait aspect.
 */

import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export default function PhoneFrame({ children, className = "" }: PhoneFrameProps) {
  return (
    <div className={`relative mx-auto w-[260px] max-w-full ${className}`}>
      <div className="relative rounded-[2.5rem] border-[10px] border-[#1A1D24] bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 h-5 w-28 rounded-b-2xl bg-[#1A1D24]" />
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[1.9rem] aspect-[9/19.5] bg-[#111317]">
          {children}
        </div>
      </div>
    </div>
  );
}
