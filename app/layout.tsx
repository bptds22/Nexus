import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed, Bebas_Neue, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { GrainOverlay } from "@/components/editorial";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { MobileToastProvider } from "@/components/mobile/MobileToast";
import { QueryProvider } from "./_providers/QueryProvider";
import { SubscriptionProvider } from "@/lib/context/SubscriptionProvider";
import { PushRegistrar } from "@/components/push/PushRegistrar";
import { StatusBarBootstrap } from "@/components/mobile/StatusBarBootstrap";
import { KeyboardInset } from "@/components/mobile/KeyboardInset";
import { SplashGate } from "@/components/mobile/auth/SplashGate";
import { ForceUpdateGate } from "@/components/mobile/ForceUpdateGate";
import { SocialLoginInit } from "@/components/auth/SocialLoginInit";
import { OAuthDeepLinkHandler } from "@/components/mobile/auth/OAuthDeepLinkHandler";
import { AuthSync } from "@/components/auth/AuthSync";

const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nexus",
  alternateName: "Nexus Sports — Recrutement sportif",
  url: "https://nexussports.ca",
  logo: "https://nexussports.ca/brand/logo-white-red.png",
  description:
    "Plateforme québécoise de recrutement sportif connectant les athlètes du secondaire aux programmes Sport-Études des CÉGEP.",
  foundingDate: "2025",
  areaServed: {
    "@type": "Country",
    name: "Canada",
  },
  address: {
    "@type": "PostalAddress",
    addressRegion: "Québec",
    addressCountry: "CA",
  },
  // TODO SEO : ajouter les URL des réseaux sociaux quand disponibles
  // sameAs: ["https://www.linkedin.com/company/nexussports", ...]
};

// WebSite schema — aide Google à générer des sitelinks et identifier la marque
const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Nexus",
  alternateName: "Nexus Sports",
  url: "https://nexussports.ca",
  inLanguage: "fr-CA",
  publisher: {
    "@type": "Organization",
    name: "Nexus",
    logo: {
      "@type": "ImageObject",
      url: "https://nexussports.ca/brand/logo-white-red.png",
    },
  },
};

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

// Anton (titres/KPIs) et Bebas Neue (labels/kickers) complètent Outfit : ce
// sont les 3 polices du système. Elles n'étaient chargées que par les routes
// de dev via un <link>, si bien qu'une page rendue DANS la coquille de l'app
// (ex. /athlete/recherche) retombait en serif. Chargées ici, elles sont
// disponibles partout — et aucune police hors système n'est ajoutée.
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-heading",
  display: "swap",
});

// Iter 7.21 Section A — viewport meta TOTALEMENT ABSENT auparavant → Capacitor
// Android WebView rendait la page comme un site desktop, contenu "zoomed in"
// avec débordement à droite + bas non visible. Next 13+ pattern :
// width=device-width, initial-scale=1, viewport-fit=cover (safe-area iOS),
// maximumScale=1 + userScalable=false pour empêcher le pinch-zoom natif WebView
// qui casse le layout d'app mobile (accepté trade-off vs a11y : c'est une app
// native, pas un site web).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#111317",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://nexussports.ca"),
  title: {
    default: "Nexus — Recrutement sportif au Québec | RSEQ & CÉGEP",
    template: "%s | Nexus",
  },
  description:
    "Fais-toi voir, fais-toi recruter. La plateforme québécoise qui connecte les athlètes du secondaire aux programmes Sport-Études des CÉGEP. Loi 25 conforme.",
  keywords: [
    "recrutement sportif",
    "recrutement sportif Québec",
    "Sport-Études CÉGEP",
    "RSEQ",
    "athlètes Québec",
    "plateforme recrutement athlètes",
    "Loi 25",
  ],
  authors: [{ name: "Nexus", url: "https://nexussports.ca" }],
  creator: "Nexus",
  publisher: "Nexus",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/brand/icon-red.svg", type: "image/svg+xml" },
      { url: "/brand/icon-red.png", type: "image/png" },
    ],
    apple: "/brand/icon-red.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: "https://nexussports.ca",
    siteName: "Nexus",
    title: "Nexus — Recrutement sportif au Québec",
    description:
      "Fais-toi voir, fais-toi recruter. La plateforme québécoise du recrutement sportif RSEQ × CÉGEP.",
    images: [
      {
        // TODO SEO : créer /public/og-image.png 1200×630 dédié (logo + slogan)
        // En attendant, on sert le logo brand existant.
        url: "/brand/logo-white-red.png",
        width: 1200,
        height: 630,
        alt: "Nexus — Recrutement sportif Québec",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus — Recrutement sportif au Québec",
    description:
      "Fais-toi voir, fais-toi recruter. Plateforme québécoise du recrutement sportif.",
    images: ["/brand/logo-white-red.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://nexussports.ca",
  },
};

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // .is-capacitor → app-shell scroll lock (globals.css). Native build only ;
    // web renders without the class and keeps normal document scroll.
    <html lang="fr" data-theme="dark" className={IS_CAPACITOR ? "is-capacitor" : undefined}>
      <body className={`${outfit.variable} ${barlowCondensed.variable} ${anton.variable} ${bebasNeue.variable} antialiased`}>
        {/* Zéro-flash splash : AVANT tout paint, si le splash a déjà joué cette
            session (sessionStorage), on injecte une règle qui masque l'overlay
            prérendu → aucun flash du splash statique sur un reboot de nav MPA.
            No-op sur web (clé jamais posée) et au vrai cold start (clé absente). */}
        <Script
          id="nx-splash-skip"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('nx-splash-played')==='1'){var s=document.createElement('style');s.textContent='.nx-splash-overlay{display:none!important}';(document.head||document.documentElement).appendChild(s);}}catch(e){}",
          }}
        />
        {/* JSON-LD Organization — données structurées pour Google Knowledge Graph */}
        <Script
          id="nx-jsonld-organization"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
        />
        {/* JSON-LD WebSite — aide Google à générer des sitelinks (Fix 7 iter SEO) */}
        <Script
          id="nx-jsonld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        <GrainOverlay />
        <LanguageProvider>
          <QueryProvider>
            <SubscriptionProvider>
              {/* Phase 2B push — déclencheur d'enregistrement natif post-auth
                  (no-op sur web). Timing provisoire pour le test. */}
              {/* Status bar overlay (WebView sous l'island) — runtime,
                  native-only, no-op web. Fiabilise overlaysWebView. */}
              <StatusBarBootstrap />
              <KeyboardInset />
              {/* Listener auth racine (additif) : ré-invalide ["currentUser"]
                  dès que la session redevient dispo (boot/resume) → recovery
                  sans cold restart. Single-instance, dans QueryProvider. */}
              <AuthSync />
              <PushRegistrar />
              <MobileToastProvider>
                {/* Init unique du plugin social login (idempotent, native-only). */}
                <SocialLoginInit />
                {/* Retour du flow web OAuth Android (deep-link → session → dispatch).
                    Android-only ; no-op iOS/web. */}
                <OAuthDeepLinkHandler />
                {/* Iter 7.47 — SplashGate joue l'anim X→logo UNE FOIS par
                    cold start Capacitor. Desktop : passthrough immédiat
                    (IS_CAPACITOR=false → children direct, jamais d'anim). */}
                {/* AU-DESSUS du SplashGate : la lecture des réglages part
                    pendant l'animation, qui attend déjà 2 s au démarrage à
                    froid — donc coût perçu nul. Le mur, lui, est un overlay
                    z-[100] : il couvre le splash comme le reste. */}
                <ForceUpdateGate />
                <SplashGate>{children}</SplashGate>
              </MobileToastProvider>
            </SubscriptionProvider>
          </QueryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
