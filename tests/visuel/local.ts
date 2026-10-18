// Pile Supabase LOCALE des tests visuels — jamais la prod. Autre port local :
// SUPABASE_LOCAL_URL=http://127.0.0.1:55321 npm run test:visuel
export const SUPABASE_LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_LOCAL_URL)) {
  throw new Error(`test:visuel : SUPABASE_LOCAL_URL doit être locale, reçu ${SUPABASE_LOCAL_URL}`);
}
// Clés de démo publiques du CLI Supabase (identiques sur toute pile locale), sans valeur ailleurs.
export const ANON_LOCALE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_LOCALE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
