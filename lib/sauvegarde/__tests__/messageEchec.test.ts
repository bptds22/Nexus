/* « Mis à jour » seulement après une écriture SANS erreur (BP 2026-10-19).
   Le message d'échec, et des gardes sur les écrans corrigés : plus d'écriture de profil dont le résultat
   est ignoré, plus de succès annoncé après un échec. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ECHEC_SAUVEGARDE, messageEchecSauvegarde } from "@/lib/sauvegarde/messageEchec";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const muet = () => {
  const c = console.error;
  console.error = () => {};
  return () => { console.error = c; };
};

test("message d'échec : générique, format refusé, champ protégé", () => {
  const retablir = muet();
  try {
    assert.equal(messageEchecSauvegarde({ code: "PGRST000", message: "x" }, "t"), ECHEC_SAUVEGARDE);
    assert.match(messageEchecSauvegarde({ code: "23514", message: "check" }, "t"), /https:\/\//);
    assert.equal(messageEchecSauvegarde({ code: "P0001", message: "NEXUS: champ protégé" }, "t"), "Tu ne peux pas modifier ce champ ici.");
    assert.equal(messageEchecSauvegarde({ code: "42501", message: "rls" }, "t"), "Tu ne peux pas modifier ce champ ici.");
  } finally { retablir(); }
});

// Écriture de profil dont le résultat n'est pas lu : `await x.from("…").update(` en tête d'instruction.
const ECRITURE_IGNOREE = /^\s*(if \([^)]*\) )?await [a-zA-Z_]+(\(\))?\.from\("(athletes|users|school_coaches|recruiter_preferences|coach_career_preferences)"\)\s*\.(update|insert|upsert)\(/m;

test("profil : aucune écriture de profil au résultat ignoré sur les écrans corrigés", () => {
  for (const f of [
    "app/athlete/profil/page.tsx",
    "app/athlete/onboarding/page.tsx",
    "components/shared/AthleteOnboardingMobile.tsx",
  ]) {
    const src = lire(f).split("\n").filter((l) => !l.includes("profile_completion")).join("\n");
    assert.ok(!ECRITURE_IGNOREE.test(src), f);
  }
  // Onboarding coach / recruteur web : seule l'ancienne mise à jour de la photo de l'aperçu est tolérée… et elle est lue.
  assert.ok(!ECRITURE_IGNOREE.test(lire("app/onboarding/page.tsx")), "app/onboarding/page.tsx");
});

test("profil : « Mis à jour » n'est plus dit après un échec", () => {
  const profil = lire("app/athlete/profil/page.tsx");
  assert.ok(profil.includes('if (error) { showToast(messageEchecSauvegarde(error, "Profil lien")); await reloadProfile(); return; }'));
  assert.ok(profil.includes('if (error) { showToast(messageEchecSauvegarde(error, "Profile save")); setEditSaving(false); return; }'));
  assert.ok(profil.includes('if (errPhoto) { showToast(messageEchecSauvegarde(errPhoto, "Photo profil")); return; }'));
  assert.ok(profil.includes('if (error) { setErreurParcours(messageEchecSauvegarde(error, "Parcours équipes")); return; }'));
  assert.ok(lire("app/athlete/parametres/page.tsx").includes('if (error) { showToast(messageEchecSauvegarde(error, "Langue")); return; }'));
  assert.ok(lire("app/coach/settings/_components/ProfileSection.tsx").includes("if (langErr) { setPreferredLanguage(avant);"));
  assert.ok(lire("app/recruteur/parametres/_components/CompteSection.tsx").includes("setErreurLangue(messageEchecSauvegarde(error"));
  assert.ok(lire("components/reputation/CareerToggle.tsx").includes('setErreurSave(messageEchecSauvegarde(error, "CareerToggle"))'));
});

test("demande d'accès Loi 25 : plus d'insert refusé par la RLS, « envoyée » seulement en cas de succès", () => {
  const s = lire("app/recruteur/parametres/_components/ConfidentialiteSection.tsx");
  assert.ok(!s.includes('from("admin_notifications")'));
  assert.ok(s.includes('rpc("demander_acces_mes_donnees")'));
  assert.ok(s.indexOf("if (error || !r?.ok)") < s.indexOf("setRequestSent(true)"));
});

test("création d'athlète : un rattachement d'équipe échoué est dit, pas « Profil créé » seul", () => {
  assert.ok(lire("app/coach/athletes/_data/saveAthlete.ts").includes("return { id: athleteId, avertissement:"));
  assert.ok(lire("components/shared/AthleteWizardMobile.tsx").includes('if (result.avertissement) toast.warning({ message: "Profil créé", detail: result.avertissement });'));
});
