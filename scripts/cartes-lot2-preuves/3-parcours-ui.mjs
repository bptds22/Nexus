// Parcours UI du lot 2 cartes, base LOCALE, serveur de dev du worktree.
//   SUPABASE_SERVICE_ROLE_KEY=… APP=http://localhost:3007 OUT=<dossier captures> node 3-parcours-ui.mjs
// Session RÉELLE du recruteur Pro …003a (lien magique admin → /verify), posée
// en cookie @supabase/ssr — aucun mot de passe lu ni changé. Les captures et
// les relevés en base (service_role) sont imprimés.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const API = "http://127.0.0.1:54321";
const APP = process.env.APP ?? "http://localhost:3007";
const OUT = process.env.OUT ?? ".";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "r3.collegue@preuve.local";
const T = "81e7d45a-e178-421d-82bb-60ffc8049109";
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });

async function session() {
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: EMAIL }) })).json();
  const otp = g.email_otp ?? g.properties?.email_otp;
  const v = await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: EMAIL, token: otp }) });
  const s = await v.json();
  if (!s.access_token) throw new Error("session : " + JSON.stringify(s).slice(0, 200));
  return s;
}

const s = await session();
const jeton = s.access_token;
const rest = async (method, url, body) => {
  const r = await fetch(`${API}/rest/v1/${url}`, {
    method, headers: { apikey: SERVICE, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};
const creer = async (champs) => (await rest("POST", "cartes_prospect?select=id", { team_id: T, prenom: "Ui", ...champs }))[0].id;

// Cartes du parcours (créées sous la session du recruteur, comme par l'interface).
const ids = {
  ajout: await creer({ nom: "Ajoutui" }),
  annule: await creer({ nom: "Annuleui" }),
  inscrit: await creer({ nom: "Inscritui" }),
  change: await creer({ nom: "Changeui", courriel: "change.avant@preuve.local" }),
  tel: await creer({ nom: "Telui", telephone: "438 555-0177" }),
  telAjout: await creer({ nom: "Telajoutui" }),
};
fs.writeFileSync(path.join(OUT, "ids-ui.json"), JSON.stringify(ids, null, 1));

const etat = async (id) => {
  const { data: c } = await svc.from("cartes_prospect").select("nom, courriel, telephone, invitation_etat").eq("id", id).single();
  const { data: inv } = await svc.from("cartes_prospect_invitations").select("statut, motif, signataire").eq("carte_id", id);
  const { data: j } = await svc.from("cartes_prospect_journal").select("action").eq("carte_id", id).order("created_at");
  return `${c.nom} | courriel=${c.courriel ?? "∅"} tel=${c.telephone ?? "∅"} etat=${c.invitation_etat ?? "∅"} | invitations=${JSON.stringify(inv)} | journal=${(j ?? []).map((x) => x.action).join(">")}`;
};

// Cookie @supabase/ssr : sb-<ref>-auth-token = "base64-" + base64url(JSON), découpé à 3180.
const valeur = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
const morceaux = valeur.match(/.{1,3180}/g);
const cookies = morceaux.length === 1
  ? [{ name: "sb-127-auth-token", value: valeur }]
  : morceaux.map((v, i) => ({ name: `sb-127-auth-token.${i}`, value: v }));

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
await ctx.addCookies(cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })));
const page = await ctx.newPage();
const capture = (nom) => page.screenshot({ path: path.join(OUT, `${nom}.png`) });

async function ouvrirInfos(id) {
  await page.goto(`${APP}/recruteur/pipeline?athlete=${id}`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Infos" }).click({ timeout: 30000 });
  await page.getByTestId("ligne-courriel").waitFor({ timeout: 15000 });
}
async function saisirCourriel(adresse) {
  await page.getByTestId("ligne-courriel").getByRole("button", { name: "Modifier : Courriel" }).click();
  await page.locator("#carte-courriel-edition").fill(adresse);
  await page.locator("#carte-courriel-edition").press("Enter");
}

// 1. Ajout → fenêtre → « Enregistrer et inviter »
await ouvrirInfos(ids.ajout);
await saisirCourriel("ajout.ui@preuve.local");
await page.getByTestId("fenetre-envoyer-invitation").waitFor();
console.log("1. fenêtre :", (await page.getByTestId("fenetre-envoyer-invitation").innerText()).replace(/\s+/g, " "));
await capture("1-fenetre-envoyer-invitation");
await page.getByRole("button", { name: "Enregistrer et inviter" }).click();
await page.getByTestId("message-ajout-courriel").waitFor();
console.log("1. message :", await page.getByTestId("message-ajout-courriel").innerText());
await capture("1-apres-ajout");
console.log("1. base   :", await etat(ids.ajout));

// 2. Même chose, Annuler → rien en base
await ouvrirInfos(ids.annule);
await saisirCourriel("annule.ui@preuve.local");
await page.getByTestId("fenetre-envoyer-invitation").waitFor();
await page.getByTestId("fenetre-envoyer-invitation").getByRole("button", { name: "Annuler" }).click();
await page.waitForTimeout(800);
await capture("2-apres-annuler");
console.log("2. base   :", await etat(ids.annule));

// 3. Adresse déjà inscrite → mention neutre
await ouvrirInfos(ids.inscrit);
await saisirCourriel("deja.inscrit.ui@preuve.local");
// Un athlète Nexus porte cette adresse : l'avertissement de la création d'abord.
await page.getByRole("button", { name: "Enregistrer quand même" }).waitFor({ timeout: 15000 });
console.log("3. avertissement :", (await page.locator("[role=alert]").filter({ hasText: "déjà sur Nexus" }).innerText()).replace(/\s+/g, " "));
await capture("3-avertissement-doublon");
await page.getByRole("button", { name: "Enregistrer quand même" }).click();
await page.getByTestId("fenetre-envoyer-invitation").waitFor();
await page.getByRole("button", { name: "Enregistrer et inviter" }).click();
await page.getByTestId("message-ajout-courriel").waitFor();
console.log("3. message :", await page.getByTestId("message-ajout-courriel").innerText());
await capture("3-mention-neutre");
console.log("3. base   :", await etat(ids.inscrit));

// 4. Changement d'un courriel existant → pas de fenêtre, ligne d'aide, aucune nouvelle invitation
await ouvrirInfos(ids.change);
await page.getByTestId("ligne-courriel").getByRole("button", { name: "Modifier : Courriel" }).click();
await page.locator("#carte-courriel-edition").fill("change.apres@preuve.local");
console.log("4. aide   :", await page.getByTestId("aide-courriel-change").innerText());
await capture("4-ligne-aide");
await page.locator("#carte-courriel-edition").press("Enter");
await page.waitForTimeout(1200);
console.log("4. fenêtre affichée ?", await page.getByTestId("fenetre-envoyer-invitation").count() > 0);
console.log("4. base   :", await etat(ids.change));

// 5. Carte téléphone seulement, dans le panneau → « Copier le texte » sans bouton d'envoi
await page.goto(`${APP}/recruteur/pipeline?athlete=${ids.tel}`, { waitUntil: "networkidle" });
await page.getByTestId("renvoyer-invitation").waitFor({ timeout: 30000 });
console.log("5. bouton « Renvoyer l'invitation » présent ?", await page.getByRole("button", { name: "Renvoyer l'invitation" }).count() > 0);
await page.getByTestId("renvoyer-invitation").getByTestId("copier-texte").click();
await page.getByText("Texte copié").waitFor();
console.log("5. presse-papiers :", await page.evaluate(() => navigator.clipboard.readText()));
await capture("5-copie-seule-panneau");
console.log("5. base   :", await etat(ids.tel));

// 6. Téléphone ajouté plus tard à une carte sans courriel → encadré
await ouvrirInfos(ids.telAjout);
await page.getByTestId("ligne-telephone").getByRole("button", { name: "Modifier" }).click();
await page.locator("#carte-telephone-edition").fill("514 555-0142");
await page.locator("#carte-telephone-edition").press("Enter");
await page.getByTestId("encadre-copier-texte").waitFor();
await page.getByTestId("encadre-copier-texte").getByTestId("copier-texte").click();
await page.getByText("Texte copié").waitFor();
console.log("6. texte  :", await page.getByTestId("texte-a-copier").innerText());
await capture("6-encadre-telephone-ajoute");
console.log("6. base   :", await etat(ids.telAjout));

// 7. Création d'une carte téléphone seulement (CreerCarteModal) → encadré
await page.goto(`${APP}/recruteur/pipeline`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Ajouter un prospect/ }).first().click();
await page.locator("#carte-prenom").fill("Ui");
await page.locator("#carte-nom").fill("Creationtelui");
await page.locator("#carte-etablissement").fill("estacades");
await page.getByRole("listbox", { name: "Écoles" }).getByRole("option").first().click();
await page.locator("#carte-sport").waitFor();
const sports = await page.locator("#carte-sport option").allInnerTexts();
if (await page.locator("#carte-sport").inputValue() === "") await page.locator("#carte-sport").selectOption({ label: "Football" });
await page.locator("#carte-equipe").waitFor();
if (await page.locator("#carte-equipe").inputValue() === "") await page.locator("#carte-equipe").selectOption({ index: 1 });
await page.locator("#carte-telephone").fill("450 555-0123");
await page.getByRole("button", { name: /Créer la carte|Créer quand même/ }).click();
if (await page.getByRole("button", { name: "Créer quand même" }).count()) await page.getByRole("button", { name: "Créer quand même" }).click();
await page.getByTestId("carte-creee-telephone").waitFor({ timeout: 20000 });
await page.getByTestId("carte-creee-telephone").getByTestId("copier-texte").click();
await page.getByText("Texte copié").waitFor();
console.log("7. modale :", (await page.getByTestId("carte-creee-telephone").innerText()).replace(/\s+/g, " ").slice(0, 400));
await capture("7-creation-telephone-seul");
const { data: c7 } = await svc.from("cartes_prospect").select("id").eq("nom", "Creationtelui").single();
console.log("7. base   :", await etat(c7.id), "| sports proposés :", sports.join(","));

await nav.close();
