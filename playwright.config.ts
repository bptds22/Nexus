import { defineConfig, devices } from "@playwright/test";

// Tests visuels (npm run test:visuel) — navigateur SANS interface seulement (CLAUDE.MD : jamais de
// capture de l'écran de BP). Lectures de pages publiques, rien d'autre.
//
// Supabase : JAMAIS la prod. .env.local pointe sur le cloud ; le serveur lancé ici reçoit l'URL et les
// clés de démo de la pile LOCALE, qui priment sur .env.local (Next ne remplace pas une variable déjà
// posée). Autre port local : SUPABASE_LOCAL_URL=http://127.0.0.1:55321 npm run test:visuel
const SUPABASE_LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_LOCAL_URL)) {
  throw new Error(`test:visuel : SUPABASE_LOCAL_URL doit être locale, reçu ${SUPABASE_LOCAL_URL}`);
}
// Clés de démo publiques du CLI Supabase (identiques sur toute pile locale), sans valeur ailleurs.
const ANON_LOCALE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_LOCALE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const PORT = 3100; // hors de 3000/3001 (dev web, dev mobile d'autres sessions)
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/visuel",
  outputDir: "test-results/artefacts",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: BASE_URL,
    headless: true,
    locale: "fr-CA",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Démarré par Playwright, coupé à la fin du test. Dossier de build à part (.next-web, ignoré par git).
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    // Jamais un serveur déjà lancé : il pourrait pointer sur la prod.
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_DIST_DIR: ".next-web",
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_LOCAL_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_LOCALE,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_LOCALE,
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
