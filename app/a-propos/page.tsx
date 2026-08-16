"use client";

import { useState, useRef } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { createClient } from "@/lib/supabase/client";

import { notFound } from "next/navigation";
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

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function AProposPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = useTranslation();
  const T = t.about;

  // Dropdown options come from the dictionary; keep them as a stable ordered
  // list for the <select> so the value/label both render localized text.
  const SUBJECT_OPTIONS = [
    T.contact.subjects.general,
    T.contact.subjects.partnership,
    T.contact.subjects.support,
    T.contact.subjects.media,
    T.contact.subjects.other,
  ];

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: T.contact.subjects.general,
    message: "",
    // nx_ref = honeypot. Nom volontairement neutre : un champ nommé "company"
    // est mappé par Chrome sur autocomplete="organization" et rempli par
    // 1Password, ce qui piégeait de vrais visiteurs (message avalé en silence).
    // Il part vers la fonction sous la clé `company`, qui est ce qu'elle attend.
    nx_ref: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [errored, setErrored] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setErrored(false);
    setSending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("send-contact", {
        body: {
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
          company: form.nx_ref, // honeypot
          source: "a-propos",
        },
      });
      if (error || !data?.ok) throw error ?? new Error("send-contact failed");

      setSubmitted(true);
      setForm({ name: "", email: "", subject: T.contact.subjects.general, message: "", nx_ref: "" });
      setTimeout(() => setSubmitted(false), 4000);
    } catch {
      setErrored(true);
      setTimeout(() => setErrored(false), 6000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ─── SECTION 1 — HERO ──────────────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 text-center">
            <RedLabel>{T.hero.eyebrow}</RedLabel>
            <h1 className="nx-display text-[42px] sm:text-[48px] font-extrabold text-white leading-[1.05] tracking-tight mt-4">
              {T.hero.title}
            </h1>
            <p className="text-[18px] text-white/75 leading-[1.7] mt-6 max-w-[720px] mx-auto">
              {T.hero.lede}
            </p>
          </div>
        </section>

        {/* ─── SECTION 2 — FOUNDER CARDS ─────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[1000px] mx-auto px-6 py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Bruno-Philippe */}
              <div className="bg-[#1A1D24] rounded-xl border border-white/[0.06] p-8">
                <FounderPhoto initials="BP" src="/brand/profile-bruno.jpg" alt={T.founders.bp.photoAlt} />
                <div className="text-center mt-6">
                  <h3 className="nx-display text-[22px] font-bold text-white">{T.founders.bp.name}</h3>
                  <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E63946] mt-1">{T.founders.bp.role}</p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-4 text-[15px] text-white/70 leading-[1.7]">
                  <p>{T.founders.bp.bio}</p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-3">
                  <a href="mailto:bpdesfosses@nexussports.ca" className="flex items-center gap-3 text-[14px] text-white/65 hover:text-[#E63946] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                    bpdesfosses@nexussports.ca
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
                <FounderPhoto initials="C" alt={T.founders.chuck.photoAlt} />
                <div className="text-center mt-6">
                  <h3 className="nx-display text-[22px] font-bold text-white">{T.founders.chuck.name}</h3>
                  <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#E63946] mt-1">{T.founders.chuck.role}</p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-4 text-[15px] text-white/70 leading-[1.7]">
                  <p>{T.founders.chuck.bio}</p>
                </div>

                <div className="h-px bg-white/[0.06] my-6" />

                <div className="space-y-3">
                  <a href="mailto:c.guitard@nexussports.ca" className="flex items-center gap-3 text-[14px] text-white/65 hover:text-[#E63946] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                    c.guitard@nexussports.ca
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — SÉCURITÉ ──────────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-20 text-center">
            <RedLabel>{T.security.eyebrow}</RedLabel>
            <SectionTitle>{T.security.title}</SectionTitle>
            <p className="text-[15px] sm:text-[16px] text-white/70 leading-[1.75] mt-6 max-w-[720px] mx-auto">
              {T.security.body}
            </p>
          </div>
        </section>

        {/* ─── SECTION 4 — CONTACT FORM ──────────────────────── */}
        <section className="border-b border-white/[0.06]">
          <div className="max-w-[700px] mx-auto px-6 py-20 text-center">
            <RedLabel>{T.contact.eyebrow}</RedLabel>
            <SectionTitle>{T.contact.title}</SectionTitle>
            <p className="text-[15px] text-white/65 leading-relaxed mt-4 max-w-[560px] mx-auto">
              {T.contact.lede}
            </p>

            <div ref={fadeRef} className="mt-10 text-left">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Name + Email */}
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">{T.contact.labelName}</label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder={T.contact.placeholderName}
                        required
                        className="w-full h-11 px-4 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] placeholder:text-white/25 focus:border-[#E63946] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">{T.contact.labelEmail}</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder={T.contact.placeholderEmail}
                        required
                        className="w-full h-11 px-4 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] placeholder:text-white/25 focus:border-[#E63946] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Subject dropdown */}
                  <div>
                    <label htmlFor="contact-subject" className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">{T.contact.labelSubject}</label>
                    <select
                      id="contact-subject"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      aria-label={T.contact.labelSubject}
                      className="w-full h-11 px-4 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] focus:border-[#E63946] focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                      {SUBJECT_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/45 mb-1.5 block">{T.contact.labelMessage}</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder={T.contact.placeholderMessage}
                      required
                      rows={5}
                      className="w-full px-4 py-3 rounded-lg bg-[#1A1D24] border border-white/[0.06] text-white text-[14px] placeholder:text-white/25 focus:border-[#E63946] focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Honeypot anti-spam — hors écran, jamais display:none ni
                      sr-only (les deux sont détectés et évités par les bots
                      sérieux). aria-hidden + tabIndex={-1} le retirent du
                      parcours clavier et des lecteurs d'écran. */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <input
                      type="text"
                      name="nx_ref"
                      value={form.nx_ref}
                      onChange={handleChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full h-12 rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider text-[13px] hover:bg-[#D42B22] transition-colors mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sending ? T.contact.submitting : T.contact.submit}
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
            <span className="text-[13px] text-white">{T.contact.toast}</span>
          </div>
        )}

        {/* Error toast */}
        {errored && (
          <div className="fixed bottom-6 right-6 bg-[#1A1D24] border border-[#EF4444]/50 rounded-lg px-5 py-3.5 shadow-2xl flex items-center gap-3 z-50 max-w-[360px]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <span className="text-[13px] text-white">{T.contact.toastError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
