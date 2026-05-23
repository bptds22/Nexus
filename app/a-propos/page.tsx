"use client";

import { useState, useRef } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   À propos — Founders-forward page with contact form
   Public marketing, no auth, no Supabase.
═══════════════════════════════════════════════════════════════ */

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[30px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function FounderPhoto({ initials, src, alt }: { initials: string; src?: string; alt: string }) {
  return (
    <div className="w-[140px] h-[140px] rounded-full mx-auto overflow-hidden bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover object-[center_15%]" />
      ) : (
        <span className="font-head text-[48px] font-black text-[#E63946]/60">{initials}</span>
      )}
    </div>
  );
}

/* ── Data ───────────────────────────────────────────────────── */

const SUBJECTS = [
  "Question générale",
  "Partenariat",
  "Support technique",
  "Médias",
  "Autre",
];

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function AProposPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "Question générale", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    // TODO: integrate with backend / email service
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ name: "", email: "", subject: "Question générale", message: "" });
    }, 4000);
  };

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO ──────────────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 text-center">
            <RedLabel>À propos</RedLabel>
            <h1 className="nx-display text-[42px] sm:text-[48px] font-extrabold text-white leading-[1.05] tracking-tight mt-4">
              Nexus, c&apos;est nous avant d&apos;être un produit.
            </h1>
            <p className="text-[18px] text-white/75 leading-[1.7] mt-6 max-w-[720px] mx-auto">
              Un ancien athlète qui voulait être vu. Un ancien coach qui voulait donner une chance à ses joueurs. Deux professionnels en technologie qui savent bâtir des plateformes sécurisées. Voilà qui on est.
            </p>
          </div>
        </section>

        {/* ─── SECTION 2 — FOUNDER CARDS ─────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Bruno-Philippe */}
              <div className="bg-[#1A1D24] rounded-xl border border-white/[0.06] p-8">
                <FounderPhoto initials="BP" alt="Bruno-Philippe Simard" />
                <div className="text-center mt-6">
                  <h3 className="nx-display text-[22px] font-bold text-white">Bruno-Philippe Simard</h3>
                  <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E63946] mt-1">Fondateur · Ancien athlète</p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-4 text-[15px] text-white/70 leading-[1.7]">
                  <p>
                    Ancien joueur de football collégial. J&apos;ai vécu le processus de recrutement de l&apos;intérieur — j&apos;ai vu des coéquipiers plus talentueux que moi passer inaperçus parce que leur coach ne connaissait pas les bonnes personnes. En parallèle, je travaille en technologie — infrastructure, applications, cybersécurité. Nexus combine ces deux mondes.
                  </p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-3">
                  <a href="mailto:bp@nexussports.ca" className="flex items-center gap-3 text-[14px] text-white/65 hover:text-[#E63946] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                    bp@nexussports.ca
                  </a>
                  <a href="tel:4384980494" className="flex items-center gap-3 text-[14px] text-white/65 hover:text-[#E63946] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    438-498-0494
                  </a>
                </div>
              </div>

              {/* Chuck */}
              <div className="bg-[#1A1D24] rounded-xl border border-white/[0.06] p-8">
                <FounderPhoto initials="C" alt="Chuck" />
                <div className="text-center mt-6">
                  <h3 className="nx-display text-[22px] font-bold text-white">Chuck</h3>
                  <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E63946] mt-1">Co-fondateur · Ancien coach</p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-4 text-[15px] text-white/70 leading-[1.7]">
                  <p>
                    Ancien entraîneur au secondaire. J&apos;ai vu de près ce qui fait la différence entre un joueur qui se fait recruter et un joueur qui se fait oublier — et souvent, ça n&apos;a rien à voir avec le talent. Comme Bruno, je viens de la cybersécurité et de l&apos;infrastructure. On a construit Nexus avec la conviction que les données des jeunes athlètes méritent le même niveau de protection qu&apos;un système bancaire.
                  </p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-3">
                  <a href="mailto:chuck@nexussports.ca" className="flex items-center gap-3 text-[14px] text-white/65 hover:text-[#E63946] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                    chuck@nexussports.ca
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — SÉCURITÉ ──────────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-20 text-center">
            <RedLabel>Sécurité</RedLabel>
            <SectionTitle>Bâti par des professionnels en cybersécurité.</SectionTitle>
            <p className="text-[15px] sm:text-[16px] text-white/70 leading-[1.75] mt-6 max-w-[720px] mx-auto">
              Nexus est hébergé au Québec (OVHcloud Beauharnois). Conforme à la Loi 25 sur la protection des renseignements personnels. Consentement parental documenté pour chaque athlète mineur. Vos données ne quittent jamais la province.
            </p>
          </div>
        </section>

        {/* ─── SECTION 4 — CONTACT FORM ──────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[700px] mx-auto px-6 py-20 text-center">
            <RedLabel>Nous écrire</RedLabel>
            <SectionTitle>Une question pour l&apos;équipe?</SectionTitle>
            <p className="text-[15px] text-white/65 leading-relaxed mt-4 max-w-[560px] mx-auto">
              On répond dans les 48 heures.
            </p>

            <div ref={fadeRef} className="mt-10 text-left">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Name + Email */}
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">Nom complet</label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Jean Tremblay"
                        required
                        className="w-full h-11 px-4 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] placeholder:text-white/25 focus:border-[#E63946] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">Courriel</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="jean@ecole.qc.ca"
                        required
                        className="w-full h-11 px-4 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] placeholder:text-white/25 focus:border-[#E63946] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Subject dropdown */}
                  <div>
                    <label htmlFor="contact-subject" className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">Sujet</label>
                    <select
                      id="contact-subject"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      aria-label="Sujet"
                      className="w-full h-11 px-4 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] focus:border-[#E63946] focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Comment pouvons-nous t'aider?"
                      required
                      rows={5}
                      className="w-full px-4 py-3 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] placeholder:text-white/25 focus:border-[#E63946] focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider text-[13px] hover:bg-[#D42B22] transition-colors mt-1"
                  >
                    Envoyer le message
                  </button>
                </form>
            </div>
          </div>
        </section>

        {/* Success toast */}
        {submitted && (
          <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#22C55E]/50 rounded-lg px-5 py-3.5 shadow-2xl flex items-center gap-3 z-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-[13px] text-white">Message envoyé! On vous revient dans les 48 heures.</span>
          </div>
        )}
      </div>
    </div>
  );
}
