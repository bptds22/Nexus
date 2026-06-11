"use client";

/* DaySeparator — small uppercase pill between message clusters
   of different calendar days. Extracted verbatim from
   RecruteurMessagesThreadMobile. */

import { dayLabel } from "./utils";

export function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="text-[11px] uppercase tracking-wider text-white/40 font-semibold px-3 py-1 rounded-full bg-white/[0.04]">
        {dayLabel(iso)}
      </span>
    </div>
  );
}
