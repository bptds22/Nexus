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
        <p className="font-sans text-sm text-[#9AA3B2] mt-1">
          Gérez vos demandes envoyées et reçues
        </p>
      </div>

      <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 border-2 border-[#1E2D4A] rounded-full mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">
          Bientôt disponible
        </h2>
        <p className="font-sans text-sm text-[#475569] max-w-sm mx-auto">
          La gestion des demandes de contact sera disponible dans une prochaine mise à jour.
        </p>
      </div>
    </div>
  );
}
