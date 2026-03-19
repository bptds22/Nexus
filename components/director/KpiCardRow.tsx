"use client";

interface KpiCardRowProps {
  children: React.ReactNode;
}

export default function KpiCardRow({ children }: KpiCardRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
      {children}
    </div>
  );
}
