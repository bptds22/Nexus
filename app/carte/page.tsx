import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Anton, IBM_Plex_Mono } from "next/font/google";
import { BRUNO, type SocialKind } from "@/lib/carte/contact";
import styles from "./carte.module.css";

/* ═══════════════════════════════════════════════════════════════
   /carte — Carte de contact scannable ("2B · Tabloïd sombre").
   Landing atteinte via QR : sauvegarder le contact (.vcf hébergé),
   suivre les réseaux, ouvrir les stores. Statique, sans état.

   Fidélité pixel : app/carte/carte.module.css (repro de
   design_handoff_nexus_scan_card/nexus-scan-card-2b.html, sans le
   phone frame). Contenu piloté par lib/carte/contact.ts.

   Web-only : exclue du build Capacitor (même garde que les pages
   légales). robots: noindex — on y arrive par QR, jamais par
   recherche → évite l'indexation du cell/courriel exposés en HTML.
═══════════════════════════════════════════════════════════════ */

// Outfit est déjà chargé globalement (app/layout.tsx → --font-outfit).
// On ajoute seulement Anton (display) + IBM Plex Mono (labels tactiques).
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"], // Anton n'a qu'un seul style → italique synthétique en CSS
  variable: "--font-anton",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bruno-Philippe Desfosses — Nexus",
  // Page atteinte par QR uniquement : pas d'indexation (anti-scraping du
  // téléphone / courriel exposés dans le HTML).
  robots: { index: false, follow: false },
};

/* Style helper pour l'échelonnement du load-in (--i * 70ms). */
const reveal = (i: number) =>
  ({ ["--i"]: String(i) }) as React.CSSProperties;

/* Icônes sociales — reprises VERBATIM du prototype (monochrome currentColor). */
const SOCIAL_SVG: Record<SocialKind, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 5.8a4.4 4.4 0 0 1-1-2.9h-3.35v13.2a2.45 2.45 0 1 1-2.45-2.45c.24 0 .48.04.7.1v-3.42a5.9 5.9 0 1 0 5.1 5.85V9.85a7.5 7.5 0 0 0 4.35 1.4V7.85a4.35 4.35 0 0 1-3.35-2.05z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.4.53A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.9.53 9.4.53 9.4.53s7.5 0 9.4-.53a3 3 0 0 0 2.1-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.55 15.55v-7.1L15.7 12z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.24 2.68.24v2.95H15.8c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12z" />
    </svg>
  ),
};

const PHONE_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 16.9v2.9a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.62 4.1 2 2 0 0 1 3.6 1.9h2.9a2 2 0 0 1 2 1.72c.13.8.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L7.5 9.32a16 16 0 0 0 6 6l1.25-1.25a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7a2 2 0 0 1 1.7 2.02z" />
  </svg>
);

/* Classe de hover par réseau (colore icône + bordure au survol). */
const SOC_CLASS: Record<SocialKind, string> = {
  instagram: styles.ig,
  tiktok: styles.tt,
  youtube: styles.yt,
  facebook: styles.fb,
};

const SOC_LABEL: Record<SocialKind, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

export default function CartePage() {
  // Web-only : la landing QR n'a pas sa place dans l'APK.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  const c = BRUNO;

  return (
    <div className={`${anton.variable} ${plexMono.variable} ${styles.page}`}>
      <div className={styles.card}>
        <img
          className={styles.watermark}
          src="/carte/nexus-icon-red.png"
          alt=""
          aria-hidden="true"
        />

        {/* Masthead */}
        <div className={`${styles.masthead} ${styles.reveal}`} style={reveal(0)}>
          <img
            className={styles.logo}
            src="/carte/nexus-wordmark-white-red.png"
            alt="Nexus"
          />
        </div>
        <div className={styles.rule1} />
        <div className={styles.rule2} />

        {/* "EST. 2017" tape */}
        <div className={`${styles.tape} ${styles.reveal}`} style={reveal(1)}>
          EST. 2017
        </div>

        {/* Name */}
        <h1 className={`${styles.name} ${styles.reveal}`} style={reveal(2)}>
          {c.nameLines[0]}
          <br />
          {c.nameLines[1]}
        </h1>

        {/* Eyebrow + lead */}
        <p className={`${styles.eyebrow} ${styles.reveal}`} style={reveal(3)}>
          {c.title}
        </p>
        <p className={`${styles.lead} ${styles.reveal}`} style={reveal(4)}>
          {c.headline}
        </p>

        {/* Stat block */}
        <div className={`${styles.stats} ${styles.reveal}`} style={reveal(5)}>
          <div className={styles.stat}>
            <span className={styles.k}>WEB</span>
            <a
              className={`${styles.v} ${styles.statLink}`}
              href={c.websiteHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.websiteDisplay}
            </a>
          </div>
          <div className={styles.stat}>
            <span className={styles.k}>TÉL</span>
            <a className={`${styles.v} ${styles.statLink}`} href={`tel:${c.phoneHref}`}>
              {c.phoneDisplay}
            </a>
          </div>
          <div className={styles.stat}>
            <span className={styles.k}>COURRIEL</span>
            <a className={`${styles.v} ${styles.statLink}`} href={`mailto:${c.email}`}>
              {c.email}
            </a>
          </div>
        </div>

        {/* Primary CTA — ancre statique vers le .vcf hébergé (fiable iOS/Android) */}
        <a
          className={`${styles.cta} ${styles.reveal}`}
          style={reveal(6)}
          href={c.vcardHref}
          download={c.vcardDownloadName}
        >
          Enregistrer le contact →
        </a>

        {/* Socials row (4 réseaux + tuile téléphone) */}
        <div className={`${styles.socials} ${styles.reveal}`} style={reveal(7)}>
          {c.socials.map((s) => (
            <a
              key={s.kind}
              className={`${styles.soc} ${SOC_CLASS[s.kind]}`}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={SOC_LABEL[s.kind]}
              title={SOC_LABEL[s.kind]}
            >
              {SOCIAL_SVG[s.kind]}
            </a>
          ))}
          <a
            className={`${styles.soc} ${styles.ph}`}
            href={`tel:${c.phoneHref}`}
            aria-label="Téléphone"
            title="Téléphone"
          >
            {PHONE_SVG}
          </a>
        </div>

        {/* App store badges — App Store seul (Play masqué tant que non publié) */}
        <div className={`${styles.stores} ${styles.reveal}`} style={reveal(8)}>
          <a
            className={styles.storeLink}
            href={c.appStore}
            target="_blank"
            rel="noopener noreferrer"
            title="Télécharger dans l'App Store"
          >
            <img
              className={styles.storeImg}
              src="/carte/app-store-fr.png"
              alt="Télécharger dans l'App Store"
            />
          </a>
          {c.playStore && (
            <a
              className={styles.storeLink}
              href={c.playStore}
              target="_blank"
              rel="noopener noreferrer"
              title="Disponible sur Google Play"
            >
              <img
                className={styles.storeImg}
                src="/carte/google-play-fr.webp"
                alt="Disponible sur Google Play"
              />
            </a>
          )}
        </div>

        {/* Hashtag */}
        <div className={`${styles.hashtag} ${styles.reveal}`} style={reveal(9)}>
          <span>#SoisLeNext</span>
        </div>
      </div>
    </div>
  );
}
