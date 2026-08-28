import type { Metadata } from "next";

/* ═══════════════════════════════════════════════════════════════
   /auth — noindex.

   Une page de connexion indexée n'apporte aucun trafic utile et
   dilue le budget de crawl. Search Console la listait pourtant
   parmi les pages indexées : `Disallow: /auth/` dans robots.txt
   ne couvre PAS `/auth` (sans barre finale), qui restait donc
   crawlable et indexable.

   Le robots.txt garde le Disallow sur `/auth/…` — les callbacks
   et invitations sont des endpoints fonctionnels, rien à crawler.
   `/auth` lui-même reste crawlable EXPRÈS : sans cela Google ne
   verrait jamais ce noindex et garderait l'URL au dossier.

   Ce layout couvre aussi les sous-routes, ce qui ne coûte rien.
═══════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
