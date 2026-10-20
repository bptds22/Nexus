"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   À propos v2 (BP 2026-10-20) — même langage que l'accueil v2 :
   héros, fondateurs, nos engagements (faits vérifiés : hébergement à
   Montréal, Loi 25 et RPRP, âge minimum 14 ans et volet parental),
   formulaire de contact (inchangé : fonction send-contact, pot de miel).
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="w-10 h-px bg-[#E63946]" />
      <span className={`${label} text-[#E63946]`}>{children}</span>
    </div>
  );
}

function Titre({ id, l1, l2, as = "h2", taille = "text-[44px] sm:text-6xl lg:text-[72px]" }: { id: string; l1: string; l2: string; as?: "h1" | "h2"; taille?: string }) {
  const Tag = as;
  return (
    <Tag id={id} className={`nx-display uppercase leading-[0.92] tracking-tight mt-5 ${taille}`}>
      <span className="block text-white">{l1}</span>
      <span className="block text-[#E63946]">{l2}</span>
    </Tag>
  );
}

const IconeCourriel = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 7L2 7" />
  </svg>
);
const IconeTelephone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const lienContact = "inline-flex items-center gap-3 min-h-[44px] text-[15px] text-white/70 hover:text-[#E63946] transition-colors break-all";
const champ = "w-full h-12 px-4 rounded-md bg-[#111317] border border-white/[0.12] text-white text-[15px] placeholder:text-white/30 focus:border-[#E63946] focus:outline-none transition-colors";
const etiquetteChamp = "text-[11px] font-bold tracking-[0.2em] uppercase text-white/50 mb-1.5 block";

export default function AProposPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = useTranslation();
  const T = t.about;

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

  const fondateurs = [
    { cle: "bp", f: T.founders.bp, photo: "/brand/profile-bruno.jpg", initiales: "BP", courriel: "bpdesfosses@nexussports.ca", tel: { href: "tel:4384980494", texte: "438-498-0494" } },
    { cle: "chuck", f: T.founders.chuck, photo: undefined, initiales: "C", courriel: "c.guitard@nexussports.ca", tel: undefined },
  ];

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* ── Héros ─────────────────────────────────────── */}
        <section aria-labelledby="apropos-heros" className="border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 py-16 lg:py-24">
            <Etiquette>{T.hero.eyebrow}</Etiquette>
            <Titre id="apropos-heros" as="h1" l1={T.hero.title1} l2={T.hero.title2} taille="text-[44px] sm:text-7xl lg:text-[88px]" />
            <p className="text-[17px] sm:text-[19px] text-white/75 leading-relaxed mt-6 max-w-[680px]">{T.hero.lede}</p>
          </div>
        </section>

        {/* ── Fondateurs ────────────────────────────────── */}
        <section aria-labelledby="apropos-fondateurs" className="py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
            <Etiquette>{T.founders.eyebrow}</Etiquette>
            <Titre id="apropos-fondateurs" l1={T.founders.title1} l2={T.founders.title2} />
            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {fondateurs.map(({ cle, f, photo, initiales, courriel, tel }) => (
                <article key={cle} className="rounded-md border border-white/[0.07] border-t-[3px] border-t-[#E63946] bg-[#1A1D24] p-6 sm:p-8">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-full overflow-hidden bg-[#E63946]/15 border-2 border-[#E63946]/30 flex items-center justify-center">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- export statique : pas d'optimiseur d'images
                        <img src={photo} alt={f.photoAlt} className="w-full h-full object-cover object-[center_15%]" />
                      ) : (
                        <span aria-hidden className="font-head text-[32px] font-black text-[#E63946]/70">{initiales}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="nx-display uppercase text-[26px] sm:text-[30px] leading-none text-white">{f.name}</h3>
                      <p className={`${label} text-[#E63946] mt-2`}>{f.role}</p>
                    </div>
                  </div>
                  <p className="mt-6 text-[16px] text-[#9CA3AF] leading-relaxed">{f.bio}</p>
                  <div className="mt-5 pt-4 border-t border-white/[0.07] flex flex-col">
                    <a href={`mailto:${courriel}`} className={lienContact}><IconeCourriel />{courriel}</a>
                    {tel && <a href={tel.href} className={lienContact}><IconeTelephone />{tel.texte}</a>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Nos engagements ───────────────────────────── */}
        <section aria-labelledby="apropos-engagements" className="pb-24 lg:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
            <Etiquette>{T.engagements.eyebrow}</Etiquette>
            <Titre id="apropos-engagements" l1={T.engagements.title1} l2={T.engagements.title2} />
            <p className="text-[17px] text-white/75 leading-relaxed mt-6 max-w-[680px]">{T.engagements.lede}</p>
            <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {T.engagements.items.map((it, i) => (
                <div key={it.title} className="rounded-md border border-white/[0.07] bg-[#1A1D24] px-6 py-7">
                  <div className="nx-display text-[40px] leading-none text-[#E63946]/40">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="nx-display uppercase text-[24px] leading-none mt-3 text-white">{it.title}</h3>
                  <p className="mt-3 text-[15px] text-[#9CA3AF] leading-relaxed">{it.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
              <Link href="/confidentialite" className="inline-flex items-center gap-2 min-h-[44px] font-head font-black text-[13px] uppercase tracking-widest text-[#E63946] hover:text-white transition-colors">
                {T.engagements.privacyLink} <span aria-hidden>→</span>
              </Link>
              <a href="mailto:confidentialite@nexussports.ca" className="inline-flex items-center gap-2 min-h-[44px] text-[15px] text-white/70 hover:text-white break-all">
                confidentialite@nexussports.ca
              </a>
            </div>
          </div>
        </section>

        {/* ── Nous écrire ───────────────────────────────── */}
        <section id="contact" aria-labelledby="apropos-contact" className="pb-28 lg:pb-36 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14">
            <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-[#1A1D24] px-5 py-10 sm:px-8 lg:p-14 grid gap-10 lg:grid-cols-12">
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 260px at 15% 20%, rgba(230,57,70,0.14), transparent 60%)" }} />
              <div className="relative lg:col-span-5">
                <Etiquette>{T.contact.eyebrow}</Etiquette>
                <Titre id="apropos-contact" l1={T.contact.title1} l2={T.contact.title2} taille="text-4xl sm:text-5xl lg:text-6xl" />
                <p className="mt-5 text-[16px] text-[#D1D5DB] leading-relaxed">{T.contact.lede}</p>
              </div>

              <form onSubmit={handleSubmit} className="relative lg:col-span-7 flex flex-col gap-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="apropos-nom" className={etiquetteChamp}>{T.contact.labelName}</label>
                    <input id="apropos-nom" type="text" name="name" value={form.name} onChange={handleChange} placeholder={T.contact.placeholderName} required autoComplete="name" className={champ} />
                  </div>
                  <div>
                    <label htmlFor="apropos-courriel" className={etiquetteChamp}>{T.contact.labelEmail}</label>
                    <input id="apropos-courriel" type="email" name="email" value={form.email} onChange={handleChange} placeholder={T.contact.placeholderEmail} required autoComplete="email" className={champ} />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-subject" className={etiquetteChamp}>{T.contact.labelSubject}</label>
                  <select id="contact-subject" name="subject" value={form.subject} onChange={handleChange} className={`${champ} appearance-none cursor-pointer`}>
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="apropos-message" className={etiquetteChamp}>{T.contact.labelMessage}</label>
                  <textarea id="apropos-message" name="message" value={form.message} onChange={handleChange} placeholder={T.contact.placeholderMessage} required rows={5} className={`${champ} h-auto py-3 resize-none`} />
                </div>

                {/* Honeypot anti-spam — hors écran, jamais display:none ni
                    sr-only (les deux sont détectés et évités par les bots
                    sérieux). aria-hidden + tabIndex={-1} le retirent du
                    parcours clavier et des lecteurs d'écran. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <input type="text" name="nx_ref" value={form.nx_ref} onChange={handleChange} tabIndex={-1} autoComplete="off" />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center justify-center gap-3 h-12 px-7 bg-[#E63946] text-white font-head font-black text-sm uppercase tracking-widest hover:bg-[#D42B22] transition-colors rounded disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? T.contact.submitting : T.contact.submit} {!sending && <span aria-hidden>→</span>}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Success toast */}
        {submitted && (
          <div role="status" className="fixed bottom-6 right-6 left-6 sm:left-auto bg-[#1A1D24] border border-[#22C55E]/50 rounded-lg px-5 py-3.5 shadow-2xl flex items-center gap-3 z-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-[13px] text-white">{T.contact.toast}</span>
          </div>
        )}

        {/* Error toast */}
        {errored && (
          <div role="alert" className="fixed bottom-6 right-6 left-6 sm:left-auto bg-[#1A1D24] border border-[#EF4444]/50 rounded-lg px-5 py-3.5 shadow-2xl flex items-center gap-3 z-50 sm:max-w-[360px]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
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
