"use client";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter / Demandes de contact (placeholder)
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

export default function RequestsPage() {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Demandes de contact
        </h1>
        <p className="font-sans text-sm text-[#9CA3AF] mt-1">
          Gérez vos demandes envoyées et reçues
        </p>
      </div>

      <div className="nx-auth-card bg-[#1A1D24] border border-[#2D3748] p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 border-2 border-[#2D3748] rounded-full mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">
          Bientôt disponible
        </h2>
        <p className="font-sans text-sm text-[#6B7280] max-w-sm mx-auto">
          La gestion des demandes de contact sera disponible dans une prochaine mise à jour.
        </p>
      </div>
    </div>
  );
}
