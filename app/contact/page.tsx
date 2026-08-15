"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "../components/PlaybookBackground";
import Footer from "@/components/marketing/Footer";
import { createClient } from "@/lib/supabase/client";

import { notFound } from "next/navigation";
/* ─────────────────────────────────────────────────────────────────
   Nexus — Contact Us Page
   Two-column layout: contact info (left) + form (right).
   Same visual language: dark navy, playbook bg, Montserrat headings,
   ghost buttons, red accents.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

// Used by the in-page "Suivez-nous" widget. The page footer is the
// shared <Footer /> which has its own SOCIALS list.
const SOCIALS = [
  { name: "Instagram", href: "#", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { name: "Facebook", href: "#", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { name: "YouTube", href: "#", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { name: "TikTok", href: "#", d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
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
    value: "info@nexussports.ca",
    href: "mailto:info@nexussports.ca",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 7L2 7" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  // nx_ref = honeypot. Nom volontairement neutre : un champ nommé "company" est
  // mappé par Chrome sur autocomplete="organization" et rempli par 1Password, ce
  // qui piège de vrais utilisateurs. Il part vers la fonction sous la clé
  // `company`, qui est ce qu'elle attend.
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", nx_ref: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [errored, setErrored] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
          source: "contact",
        },
      });
      if (error || !data?.ok) throw error ?? new Error("send-contact failed");

      setSubmitted(true);
    } catch {
      setErrored(true);
      setTimeout(() => setErrored(false), 8000);
    } finally {
      setSending(false);
    }
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
        <h1 className="nx-display text-4xl sm:text-5xl font-black text-white uppercase leading-[0.92] tracking-tight">
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
              <h2 className="nx-display text-lg font-black text-white uppercase tracking-tight mb-6">
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
                      className="nx-ghost-btn h-12 w-full border font-head font-black text-sm uppercase tracking-widest mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {sending ? "Envoi en cours…" : "Envoyer le message"}
                    </button>

                    {/* Échec : porte de sortie explicite, sinon le formulaire
                        mort ne vaut pas mieux que l'ancien stub. */}
                    {errored && (
                      <div
                        role="alert"
                        className="flex items-start gap-3 border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4" />
                          <path d="M12 16h.01" />
                        </svg>
                        <p className="font-sans text-[13px] text-white leading-relaxed">
                          Échec de l&apos;envoi. Réessayez ou écrivez-nous directement à{" "}
                          <a href="mailto:info@nexussports.ca" className="text-wl-red hover:underline">
                            info@nexussports.ca
                          </a>
                          .
                        </p>
                      </div>
                    )}
                  </form>
                ) : (
                  /* ── Success state ── */
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-wl-red mb-6" style={{ borderRadius: "50%" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>

                    <h2 className="nx-display text-2xl font-black text-white uppercase tracking-tight mb-3">
                      Message envoyé
                    </h2>
                    <p className="font-sans text-sm text-[#9AA3B2] leading-relaxed mb-6 max-w-xs mx-auto">
                      Merci pour votre message! Notre équipe vous répondra dans les plus brefs délais.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setErrored(false);
                        setForm({ name: "", email: "", subject: "", message: "", nx_ref: "" });
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

      <Footer />

    </div>
  );
}
