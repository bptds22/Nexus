/* A2 de la 1.4.5 — D1b (nom à confirmer) et D1 (doublons) côté MOBILE.
   Même logique que le web, aucune copie : les deux surfaces lisent le même tronc
   (lib/athlete/nomAConfirmer.ts, lib/athlete/doublonInscription.ts,
   lib/queries/coach/athletesMemeIdentite.ts) et les mêmes composants. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nomADemander, nomPresentable, phraseFichesMasquees, TEXTES_NOM } from "@/lib/athlete/nomAConfirmer";
import { PHRASE_PLUSIEURS_SPORTS, TEXTES_DOUBLON } from "@/lib/athlete/doublonInscription";
import { peutInviterMemeIdentite, suggestionExacte } from "@/lib/queries/coach/athletesMemeIdentite";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/* ── Tronc partagé ─────────────────────────────────────────── */

test("nomADemander : champs Nom quand l'un manque ou est à confirmer", () => {
  assert.equal(nomADemander("Léa", "Roy", false), false);
  assert.equal(nomADemander("Léa", "Roy", true), true);
  assert.equal(nomADemander("", "Roy", false), true);
  assert.equal(nomADemander("Léa", "  ", false), true);
});

test("nomPresentable : prénom, nom, et nom confirmé", () => {
  assert.equal(nomPresentable({ firstName: "Léa", lastName: "Roy", nomAConfirmer: false }), true);
  assert.equal(nomPresentable({ firstName: "Léa", lastName: "Roy" }), true);
  assert.equal(nomPresentable({ firstName: "Léa", lastName: "Roy", nomAConfirmer: true }), false);
  assert.equal(nomPresentable({ firstName: "Léa", lastName: "", nomAConfirmer: false }), false);
});

test("phrase du coach : singulier et pluriel, mêmes mots que le web d'avant", () => {
  assert.equal(phraseFichesMasquees(1), "1 fiche de l'école masquée : l'athlète doit confirmer son prénom et son nom.");
  assert.equal(phraseFichesMasquees(3), "3 fiches de l'école masquées : les athlètes doivent confirmer leur prénom et leur nom.");
  assert.equal(TEXTES_NOM.etiquetteCoach, "Nom à confirmer par l'athlète");
});

test("textes du doublon et de « plusieurs sports »", () => {
  assert.equal(TEXTES_DOUBLON.COMPTE.titre, "Tu as peut-être déjà un compte.");
  assert.equal(TEXTES_DOUBLON.FICHE_COACH.titre, "Ton entraîneur a peut-être déjà créé ta fiche.");
  assert.match(PHRASE_PLUSIEURS_SPORTS.phrase, /Ajoute une équipe à ta fiche, pas un 2e compte\./);
});

test("suggestionExacte : courriel exact, casse et espaces ignorés ; préfixe refusé", () => {
  const s = [{ email: "Lea.Roy@gmail.com", id: 1 }, { email: "max@x.ca", id: 2 }];
  assert.equal(suggestionExacte(s, "  lea.roy@GMAIL.com ")?.id, 1);
  assert.equal(suggestionExacte(s, "lea.roy@gmail"), undefined);
  assert.equal(suggestionExacte(s, ""), undefined);
  assert.equal(suggestionExacte(null, "max@x.ca"), undefined);
});

test("peutInviterMemeIdentite : compte, pas à moi, courriel connu", () => {
  const base = { athleteId: "a", prenom: "L", nom: "R", ecole: null, estLeMien: false, aUnCompte: true, courriel: "l@x.ca" };
  assert.equal(peutInviterMemeIdentite(base), true);
  assert.equal(peutInviterMemeIdentite({ ...base, estLeMien: true }), false);
  assert.equal(peutInviterMemeIdentite({ ...base, aUnCompte: false }), false);
  assert.equal(peutInviterMemeIdentite({ ...base, courriel: null }), false);
});

/* ── Aucune copie : le web passe par le tronc ──────────────── */

test("web : plus d'appel en ligne aux RPC D1/D1b, le tronc à la place", () => {
  const onb = lire("app/athlete/onboarding/page.tsx");
  assert.doesNotMatch(onb, /rpc\("inscription_doublon_possible"/);
  assert.doesNotMatch(onb, /rpc\("confirmer_mon_nom"/);
  assert.match(onb, /verifierDoublonInscription\(supabase, firstName, lastName/);
  assert.match(onb, /confirmerNomSiAConfirmer\(supabase, firstName, lastName\)/);
  assert.match(onb, /<AvertissementDoublonInscription/);
  const bandeau = lire("components/athlete/BandeauNomAConfirmer.tsx");
  assert.match(bandeau, /lireEtatNom\(createClient\(\)\)/);
  assert.match(bandeau, /confirmerMonNom\(createClient\(\), p, n\)/);
  const coach = lire("app/coach/athletes/page.tsx");
  assert.doesNotMatch(coach, /function nomPresentable/);
  assert.match(coach, /phraseFichesMasquees\(nbNomsEnAttente\)/);
  const creer = lire("app/coach/athletes/create/page.tsx");
  assert.match(creer, /suggestionExacte\(emailAutocomplete\?\.suggestions, form\.identity\.email\)/);
  assert.match(creer, /<MemeIdentiteAvertissement/);
  const auth = lire("app/auth/page.tsx");
  assert.match(auth, /useSuggestionCourriel\(sf\.email\)/);
});

/* ── Mobile ────────────────────────────────────────────────── */

test("onboarding mobile : Prénom / Nom conditionnels, doublon avant le 1er enregistrement, nom confirmé après", () => {
  const src = lire("components/shared/AthleteOnboardingMobile.tsx");
  assert.match(src, /\.select\("first_name, last_name, context, onboarding_complete, nom_a_confirmer"\)/);
  assert.match(src, /setAfficherNom\(nomADemander\(prenomVu, nomVu, nomFlag\)\)/);
  assert.match(src, /\(!afficherNom \|\| \(firstName\.trim\(\) && lastName\.trim\(\)\)\)/);
  assert.match(src, /\{p\.afficherNom && \(/);
  // L'ordre : vérification → enregistrement → confirmation.
  const i = src.indexOf("verifierDoublonInscription(supabase, firstName, lastName");
  const j = src.indexOf("const id = await enregistrerFiche(supabase, false);");
  const k = src.indexOf("await confirmerNomSiAConfirmer(supabase, firstName, lastName)");
  assert.ok(i > 0 && j > i && k > j, "vérification, puis enregistrement, puis confirmation");
  assert.match(src, /<PlusieursSports className="mt-2 mb-2" \/>/);
  assert.match(src, /<AvertissementDoublonInscription/);
});

test("bandeau « Est-ce bien toi ? » monté dans l'appli (tableau de bord athlète)", () => {
  const src = lire("components/shared/AthleteDashboardMobile.tsx");
  assert.match(src, /import BandeauNomAConfirmer from "@\/components\/athlete\/BandeauNomAConfirmer";/);
  assert.match(src, /<BandeauNomAConfirmer className="mb-3" \/>/);
});

test("liste coach mobile : nom_a_confirmer lu, effectif gardé, sections hors liste filtrées", () => {
  const src = lire("components/shared/CoachAthletesMobile.tsx");
  assert.match(src, /\s+nom_a_confirmer,\s/);
  assert.match(src, /nomAConfirmer: a\.nom_a_confirmer === true/);
  assert.match(src, /a\.coachId == null && nomPresentable\(a\)/);
  assert.match(src, /a\.coachId !== currentUserId && a\.coachId != null && nomPresentable\(a\)/);
  assert.match(src, /\(\) => athletes\.filter\(\(a\) => a\.coachId === currentUserId\)/); // effectif non filtré
  assert.match(src, /<EtiquetteNomAConfirmer a=\{a\} \/>/);
  assert.match(src, /phraseFichesMasquees\(nbNomsEnAttente\)/);
});

test("inscription mobile : suggestion de courriel aux écrans 1 et 2, avant de continuer et de créer", () => {
  const src = lire("components/mobile/auth/SignupMobile.tsx");
  assert.match(src, /const sugg = useSuggestionCourriel\(email\);/);
  assert.match(src, /if \(\(step === 1 \|\| step === 2\) && sugg\.enAttente\) \{ sugg\.montrer\(\); return; \}/);
  assert.match(src, /if \(sugg\.enAttente\) \{ sugg\.montrer\(\); return; \}/);
  assert.equal((src.match(/<SuggestionCourriel /g) ?? []).length, 2);
});

test("assistant coach mobile : courriel exact → invitation, même identité avant création", () => {
  const src = lire("components/shared/AthleteWizardMobile.tsx");
  const i = src.indexOf("suggestionExacte(emailAutocomplete?.suggestions, form.identity.email)");
  const j = src.indexOf("athletesMemeIdentite(supabase, firstName, lastName, dateOfBirth)");
  const k = src.indexOf("await saveAthleteCreate(");
  assert.ok(i > 0 && j > i && k > j, "les deux contrôles précèdent la création");
  assert.match(src, /<MemeIdentiteAvertissement/);
  assert.match(src, /messageErreurSauvegarde\(/); // l'unicité du courriel garde son message
});

test("onboarding mobile : l'avertissement de doublon vient à l'écran (sous le pli sinon)", () => {
  const src = lire("components/shared/AthleteOnboardingMobile.tsx");
  assert.match(src, /<div className="pt-4" id="nx-doublon-inscription">\{p\.doublon\}<\/div>/);
  assert.match(src, /document\.getElementById\("nx-doublon-inscription"\)\?\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\);/);
  assert.match(src, /\}, \[doublonPossible\]\);/);
});
