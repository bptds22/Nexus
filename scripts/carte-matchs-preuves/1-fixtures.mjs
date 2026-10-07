// Fixtures LOCALES de la carte des matchs (lot A) — unité du recruteur Pro
// …003a (Cégep Preuve Lot1 × Football). Cartes prospect créées par PostgREST
// sous son JWT (comme l'interface) ; l'athlète masqué et son suivi, sous
// service_role. Tout porte le suffixe « Cmatchs » (nettoyage : 9-nettoyer.sql).
//   SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node 1-fixtures.mjs
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const API = "http://127.0.0.1:54321";
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const R3 = "22222222-0000-0000-0000-00000000003a";
const FOOT = "4b859bf1-5832-4258-897c-e094062926af";
const svc = createClient(API, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ sub: R3, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
const jwt = `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;

const equipes = [
  ["Alma Juv", "c3e58603-178e-49e0-9703-53682c8588bc"],   // 10-10 18:00 Collège d'Alma
  ["Alma Cad", "d899091e-ab57-4ac2-8540-8a6f5c551486"],   // 10-10 14:30 Collège d'Alma (même terrain)
  ["Laval Cad", "57c594e7-fae7-4dd5-a133-e73453e5d251"],  // 10-10 15:30 Collège Laval
  ["Laval Ben", "2727e13d-1941-41c5-add8-6f87176d439e"],  // 10-10 09:30 Collège Laval (même terrain)
  ["Frontieres", "348df7f0-2b01-4c95-b42e-a41fe70a3884"], // 10-10 13:30 Collège Nouvelles Frontières
  ["Herons", "d3a00000-0000-4000-8000-0000000b1003"],     // 11-07 13:00 civil, SANS coordonnées
];
for (const [prenom, team] of equipes) {
  const r = await fetch(`${API}/rest/v1/cartes_prospect?select=id,prenom,nom`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ prenom, nom: "Cmatchs", team_id: team }),
  });
  console.log(`carte ${prenom} → HTTP ${r.status}`, (await r.text()).slice(0, 120));
}

// Athlète MINEUR fictif sans consentement → identité masquée ; suivi par l'unité.
const ATH = "77770000-0000-0000-0000-0000000000c1";
const LEVIS = "87742731-f29a-46c4-a0b7-1b0204d30e77"; // 10-10 13:00 Collège de Lévis
const a = await svc.from("athletes").insert({ id: ATH, first_name: "Masque", last_name: "Cmatchs", status: "ACTIF", date_naissance: "2011-03-01", consentement_parental: false, sport_id: FOOT }).select("id");
console.log("athlète masqué :", a.error?.message ?? "ok");
const ta = await svc.from("team_athletes").insert({ team_id: LEVIS, athlete_id: ATH, sport_id: FOOT });
console.log("équipe :", ta.error?.message ?? "ok");
const pl = await svc.from("recruiter_pipeline").insert({ recruiter_id: R3, athlete_id: ATH, stage: "IDENTIFIE" });
console.log("processus :", pl.error?.message ?? "ok");
const { data: ok } = await svc.rpc("athlete_identity_ok", { p_dob: "2011-03-01", p_consent: false });
console.log("athlete_identity_ok(15 ans, sans consentement) =", ok);
