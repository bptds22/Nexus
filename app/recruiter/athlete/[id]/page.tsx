"use client";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter / Athlete Detail (placeholder)
   Full athlete profile view — will replace slide-out panel
   for deep-dives.
───────────────────────────────────────────────────────────────── */

export default function AthleteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Profil athlète
        </h1>
        <p className="font-sans text-sm text-[#9CA3AF] mt-1">
          ID: {params.id}
        </p>
      </div>

      <div className="nx-auth-card bg-[#1A1D24] border border-[#2D3748] p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 border-2 border-[#2D3748] rounded-full mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        </div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">
          Bientôt disponible
        </h2>
        <p className="font-sans text-sm text-[#6B7280] max-w-sm mx-auto">
          La page de profil athlète complète sera disponible dans une prochaine mise à jour.
        </p>
      </div>
    </div>
  );
}
