import { defineConfig, devices } from "@playwright/test";
import { ANON_LOCALE, SERVICE_LOCALE, SUPABASE_LOCAL_URL } from "./tests/visuel/local";

// Tests visuels (npm run test:visuel) — navigateur SANS interface seulement (CLAUDE.MD : jamais de
// capture de l'écran de BP). Pages publiques, et pages connectées avec un compte de la pile LOCALE
// (tests/visuel/session.ts) : lectures seulement.
//
// Supabase : JAMAIS la prod. .env.local pointe sur le cloud ; le serveur lancé ici reçoit l'URL et les
// clés de démo de la pile LOCALE, qui priment sur .env.local (Next ne remplace pas une variable déjà
// posée) — voir tests/visuel/local.ts.
const PORT = 3100; // hors de 3000/3001 (dev web, dev mobile d'autres sessions)
const BASE_URL = `http://localhost:${PORT}`;
// Écrans propres à l'appli (IS_CAPACITOR) : même code que `npm run dev:mobile`, servi au navigateur sans
// interface. Seuls les tests de tests/visuel/appli/ l'utilisent.
const PORT_APPLI = 3101;
const BASE_URL_APPLI = `http://localhost:${PORT_APPLI}`;
const ENV_LOCAL = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_LOCAL_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_LOCALE,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_LOCALE,
};

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
  projects: [
    { name: "chromium", testIgnore: "appli/**", use: { ...devices["Desktop Chrome"] } },
    { name: "appli", testMatch: "appli/**/*.spec.ts", use: { ...devices["Desktop Chrome"], baseURL: BASE_URL_APPLI, viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: [{
    // Démarré par Playwright, coupé à la fin du test. Dossier de build à part (.next-web, ignoré par git).
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    timeout: 180_000,
    // Jamais un serveur déjà lancé : il pourrait pointer sur la prod.
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: { ...ENV_LOCAL, NEXT_DIST_DIR: ".next-web", NEXT_PUBLIC_APP_URL: BASE_URL },
  }, {
    command: `npx next dev -p ${PORT_APPLI}`,
    url: BASE_URL_APPLI,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: { ...ENV_LOCAL, NEXT_PUBLIC_CAPACITOR_BUILD: "true", NEXT_DIST_DIR: ".next-mobile", NEXT_PUBLIC_APP_URL: BASE_URL_APPLI },
  }],
});
