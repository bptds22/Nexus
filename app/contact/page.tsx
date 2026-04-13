"use client";

import { useState, useRef } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Contact Us Page
   Two-column layout: contact info (left) + form (right).
   Same visual language: dark navy, playbook bg, Montserrat headings,
   ghost buttons, red accents.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SOCIALS = [
  {
    name: "Instagram",
    href: "#",
    d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    name: "Facebook",
    href: "#",
    d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    name: "Twitter / X",
    href: "#",
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    name: "LinkedIn",
    href: "#",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
];

const CONTACT_INFO = [
  {
    label: "Téléphone",
    value: "438-498-0494",
    href: "tel:4384980494",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
  },
  {
    label: "Courriel",
    value: "info@welead.ca",
    href: "mailto:info@welead.ca",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 7L2 7" />
      </svg>
    ),
  },
  {
    label: "Heures",
    value: "Lun – Ven, 9h – 17h (HE)",
    href: null,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    // TODO: integrate with backend / email service
    setSubmitted(true);
  };

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      <MarketingNav />

      {/* ══════════════════════════════════════════
          HERO HEADER
      ══════════════════════════════════════════ */}
      <section className="relative z-10 text-center pt-16 pb-10 px-6">
        <div className="inline-flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-wl-red" />
          <span className={`${label} text-wl-red`}>Nous joindre</span>
          <span className="w-6 h-px bg-wl-red" />
        </div>
        <h1 className="font-head text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
          Contactez-nous
        </h1>
        <p className="font-sans text-sm text-[#9AA3B2] mt-3 max-w-md mx-auto leading-relaxed">
          Une question, une suggestion ou besoin d&apos;aide? Notre équipe est là pour vous.
        </p>
      </section>

      {/* ══════════════════════════════════════════
          TWO-COLUMN LAYOUT
      ══════════════════════════════════════════ */}
      <section className="flex-1 relative z-10 px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-8">

          {/* ── Left: Contact Info Card ── */}
          <div className="md:col-span-2">
            <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 h-full">
              <h2 className="font-head text-lg font-black text-white uppercase tracking-tight mb-6">
                Informations
              </h2>

              <div className="flex flex-col gap-6">
                {CONTACT_INFO.map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="text-wl-red mt-0.5 shrink-0">{item.icon}</div>
                    <div>
                      <p className={`${label} text-[#9AA3B2] mb-1`}>{item.label}</p>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="font-sans text-sm text-white hover:text-wl-red transition-colors duration-300"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="font-sans text-sm text-white">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Social links */}
              <div className="mt-10 pt-6 border-t border-[#1E2D4A]">
                <p className={`${label} text-[#9AA3B2] mb-4`}>Suivez-nous</p>
                <div className="flex items-center gap-5">
                  {SOCIALS.map(({ name, href, d }) => (
                    <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer"
                      className="nx-social-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d={d} />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Contact Form ── */}
          <div className="md:col-span-3">
            <div className="nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-8 sm:p-10">
              <div ref={fadeRef} className="nx-auth-fade">

                {!submitted ? (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* Name + Email row */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Nom complet</label>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Jean Tremblay"
                          required
                          className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Courriel</label>
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="jean@ecole.qc.ca"
                          required
                          className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Sujet</label>
                      <input
                        type="text"
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        placeholder="Question générale"
                        className="nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className={`${label} text-[#9AA3B2] mb-1.5 block`}>Message</label>
                      <textarea
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Comment pouvons-nous vous aider?"
                        required
                        rows={5}
                        className="nx-input w-full px-4 py-3 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      className="nx-ghost-btn h-12 w-full border font-head font-black text-sm uppercase tracking-widest mt-1"
                    >
                      Envoyer le message
                    </button>
                  </form>
                ) : (
                  /* ── Success state ── */
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-wl-red mb-6" style={{ borderRadius: "50%" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>

                    <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-3">
                      Message envoyé
                    </h2>
                    <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6 max-w-xs mx-auto">
                      Merci pour votre message! Notre équipe vous répondra dans les plus brefs délais.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setForm({ name: "", email: "", subject: "", message: "" });
                        const el = fadeRef.current;
                        if (el) {
                          el.classList.remove("nx-auth-fade");
                          void el.offsetWidth;
                          el.classList.add("nx-auth-fade");
                        }
                      }}
                      className="nx-ghost-btn h-11 px-8 border font-head font-black text-xs uppercase tracking-widest"
                    >
                      Envoyer un autre message
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-[#030609]/80 border-t border-[#1E2D4A]">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[#1E2D4A]">

            <div className="flex items-center gap-3">
              <NexusLogo variant="white" height={22} href="/" className="opacity-80" />
              <span className={`${label} text-[#475569]`}>
                Construit pour les étudiants-athlètes québécois
              </span>
            </div>

            <nav className="flex items-center gap-8">
              <Link href="/confidentialite" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Confidentialité</Link>
              <Link href="/conditions" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Conditions</Link>
              <Link href="/contact" className={`${label} text-[#475569] hover:text-[#9AA3B2] transition-colors`}>Contact</Link>
            </nav>

            <div className="flex items-center gap-5">
              {SOCIALS.map(({ name, href, d }) => (
                <a key={name} href={href} aria-label={name} target="_blank" rel="noopener noreferrer"
                  className="nx-social-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={d} />
                  </svg>
                </a>
              ))}
            </div>

          </div>

          <p className={`${label} text-[#2E3D55] text-center pt-5`}>&copy; 2026 Nexus — Propulsé par <img src="/brand/White%20red@4x.png" alt="WeLead" style={{height:16}} /></p>

        </div>
      </footer>

    </div>
  );
}
