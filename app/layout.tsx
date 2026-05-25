import type { Metadata } from "next";
import { Barlow_Condensed, Outfit } from "next/font/google";
import "./globals.css";
import { GrainOverlay } from "@/components/editorial";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus — Recrutement sportif",
  description: "Plateforme de recrutement sportif au Québec",
  icons: {
    icon: [
      { url: "/brand/icon-red.svg", type: "image/svg+xml" },
      { url: "/brand/icon-red.png", type: "image/png" },
    ],
    apple: "/brand/icon-red.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="dark">
      <body className={`${outfit.variable} ${barlowCondensed.variable} antialiased`}>
        <GrainOverlay />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
