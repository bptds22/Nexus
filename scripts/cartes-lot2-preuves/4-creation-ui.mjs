// Message de CRÉATION web aligné sur l'app (BP 2026-10-07, 16 h 05) — trois
// créations par « Ajouter un prospect », base LOCALE, serveur de dev du worktree.
//   SUPABASE_SERVICE_ROLE_KEY=… APP=http://localhost:3007 OUT=<captures> node 4-creation-ui.mjs
// Prérequis : athlète local portant deja.inscrit.ui@preuve.local (voir LISEZMOI).
// Session réelle du recruteur Pro …003a (lien magique admin → /verify), en cookie.
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const API = "http://127.0.0.1:54321";
const APP = process.env.APP ?? "http://localhost:3007";
const OUT = process.env.OUT ?? ".";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "r3.collegue@preuve.local";
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });

const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: EMAIL }) })).json();
const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: EMAIL, token: g.email_otp ?? g.properties?.email_otp }) })).json();
if (!s.access_token) throw new Error("session : " + JSON.stringify(s).slice(0, 200));
const valeur = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
const morceaux = valeur.match(/.{1,3180}/g);
const cookies = morceaux.length === 1 ? [{ name: "sb-127-auth-token", value: valeur }] : morceaux.map((v, i) => ({ name: `sb-127-auth-token.${i}`, value: v }));

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
await ctx.addCookies(cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })));
const page = await ctx.newPage();

async function creer(nom, { courriel, telephone }) {
  await page.goto(`${APP}/recruteur/pipeline`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Ajouter un prospect/ }).first().click();
  await page.locator("#carte-prenom").fill("Ui");
  await page.locator("#carte-nom").fill(nom);
  await page.locator("#carte-etablissement").fill("estacades");
  await page.getByRole("listbox", { name: "Écoles" }).getByRole("option").first().click();
  await page.locator("#carte-sport").waitFor();
  if (await page.locator("#carte-sport").inputValue() === "") await page.locator("#carte-sport").selectOption({ label: "Football" });
  // Les équipes se chargent après le choix du sport : attendre les options, puis choisir.
  await page.waitForFunction(() => (document.querySelector("#carte-equipe")?.querySelectorAll("option").length ?? 0) > 1, null, { timeout: 15000 });
  if (await page.locator("#carte-equipe").inputValue() === "") await page.locator("#carte-equipe").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Créer la carte" }).waitFor({ state: "visible" });
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Créer la carte")?.hasAttribute("disabled"), null, { timeout: 15000 });
  if (courriel) await page.locator("#carte-courriel").fill(courriel);
  if (telephone) await page.locator("#carte-telephone").fill(telephone);
  await page.getByRole("button", { name: "Créer la carte" }).click();
  // Doublon (courriel d'un athlète Nexus) : l'avertissement de création, puis « Créer quand même ».
  const quandMeme = page.getByRole("button", { name: "Créer quand même" });
  await Promise.race([quandMeme.waitFor({ timeout: 8000 }).catch(() => {}), page.getByRole("dialog").waitFor({ state: "detached", timeout: 8000 }).catch(() => {})]);
  if (await quandMeme.count()) await quandMeme.click();
}
const etat = async (nom) => {
  const { data: c } = await svc.from("cartes_prospect").select("id, courriel, telephone, invitation_etat").eq("nom", nom).order("created_at", { ascending: false }).limit(1).single();
  const { data: inv } = await svc.from("cartes_prospect_invitations").select("statut, motif").eq("carte_id", c.id);
  return `courriel=${c.courriel ?? "∅"} tel=${c.telephone ?? "∅"} etat=${c.invitation_etat ?? "∅"} invitations=${JSON.stringify(inv)}`;
};

// 1. Courriel inconnu → « … Nexus envoie l'invitation à … »
await creer("Creaconnuui", { courriel: "inconnu.creation.ui@preuve.local" });
const t1 = page.getByText(/^Carte prospect créée : /);
await t1.waitFor({ timeout: 15000 });
console.log("1. toast :", await t1.innerText());
await page.screenshot({ path: path.join(OUT, "c1-courriel-inconnu.png") });
console.log("1. base  :", await etat("Creaconnuui"));

// 2. Courriel déjà inscrit → mention neutre
await creer("Creainscritui", { courriel: "deja.inscrit.ui@preuve.local" });
const t2 = page.getByText(/^Carte prospect créée : /);
await t2.waitFor({ timeout: 15000 });
console.log("2. toast :", await t2.innerText());
await page.screenshot({ path: path.join(OUT, "c2-courriel-inscrit.png") });
console.log("2. base  :", await etat("Creainscritui"));

// 3. Téléphone seulement → message + encadré « Copier le texte »
await creer("Createlui", { telephone: "450 555-0124" });
await page.getByTestId("carte-creee-telephone").waitFor({ timeout: 15000 });
console.log("3. modale :", (await page.getByTestId("carte-creee-telephone").innerText()).replace(/\s+/g, " ").slice(0, 330));
await page.screenshot({ path: path.join(OUT, "c3-telephone-seul.png") });
console.log("3. base  :", await etat("Createlui"));

await nav.close();
