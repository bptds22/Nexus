/* Profils de réseaux sociaux de l'athlète et normalisation de ses liens (BP 2026-10-18) :
   Instagram, Facebook, TikTok, LinkedIn — pas Snapchat, pas X ; le partenaire les voit. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RESEAUX, normaliserReseau, normaliserLien, lienAffichable, profilsSociaux,
  pourEnregistrerReseau, pourEnregistrerLien,
} from "@/lib/liensSociaux";
import { plateformeDeUrl, PLATEFORME_PAR_COLONNE, TEINTE_PLATEFORME } from "@/lib/config/plateformesLien";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const url = (r: ReturnType<typeof normaliserReseau>): string => (r.ok ? (r.url ?? "(vide)") : `ERREUR: ${r.erreur}`);

test("les 4 réseaux, dans l'ordre, sans Snapchat ni X", () => {
  assert.deepEqual(RESEAUX.map((r) => r.cle), ["instagram", "facebook", "tiktok", "linkedin"]);
  assert.deepEqual(RESEAUX.map((r) => r.colonne), ["instagram_url", "facebook_url", "tiktok_url", "linkedin_url"]);
});

test("pseudo seul → URL du profil", () => {
  assert.equal(url(normaliserReseau("instagram", "@nicho_hebert")), "https://www.instagram.com/nicho_hebert");
  assert.equal(url(normaliserReseau("instagram", "nicho.hebert")), "https://www.instagram.com/nicho.hebert");
  assert.equal(url(normaliserReseau("facebook", "jean.tremblay")), "https://www.facebook.com/jean.tremblay");
  assert.equal(url(normaliserReseau("tiktok", "@jt16")), "https://www.tiktok.com/@jt16");
  assert.equal(url(normaliserReseau("tiktok", "jt16")), "https://www.tiktok.com/@jt16");
  assert.equal(url(normaliserReseau("linkedin", "jean-tremblay-16")), "https://www.linkedin.com/in/jean-tremblay-16");
  assert.equal(url(normaliserReseau("instagram", "  @@nicho  ")), "https://www.instagram.com/nicho");
});

test("domaine sans https, http, URL complète → https:// du profil", () => {
  assert.equal(url(normaliserReseau("instagram", "instagram.com/nicho")), "https://instagram.com/nicho");
  assert.equal(url(normaliserReseau("instagram", "www.instagram.com/nicho/")), "https://www.instagram.com/nicho");
  assert.equal(url(normaliserReseau("instagram", "http://instagram.com/nicho")), "https://instagram.com/nicho");
  assert.equal(url(normaliserReseau("tiktok", "https://www.tiktok.com/@jt16")), "https://www.tiktok.com/@jt16");
  assert.equal(url(normaliserReseau("facebook", "https://m.facebook.com/profile.php?id=123")), "https://m.facebook.com/profile.php?id=123");
  assert.equal(url(normaliserReseau("linkedin", "https://ca.linkedin.com/in/jt")), "https://ca.linkedin.com/in/jt");
});

test("vide → null ; refus : autre plateforme, schéma dangereux, accueil, trop long", () => {
  assert.deepEqual(normaliserReseau("instagram", ""), { ok: true, url: null });
  assert.deepEqual(normaliserReseau("instagram", "   "), { ok: true, url: null });
  assert.deepEqual(normaliserReseau("instagram", null), { ok: true, url: null });
  assert.match(url(normaliserReseau("tiktok", "https://instagram.com/nicho")), /pas un lien TikTok/);
  assert.match(url(normaliserReseau("instagram", "javascript:alert(1)")), /liens web/);
  assert.match(url(normaliserReseau("instagram", "data:text/html,x")), /liens web/);
  assert.match(url(normaliserReseau("instagram", "https://instagram.com")), /accueil/);
  assert.match(url(normaliserReseau("instagram", "pas un pseudo valide !")), /pseudo/);
  assert.match(url(normaliserReseau("linkedin", `https://linkedin.com/in/${"a".repeat(320)}`)), /trop long/);
  assert.match(url(normaliserReseau("linkedin", "ab")), /pseudo/); // LinkedIn : 3 caractères au moins
});

test("liens vidéo : assainis seulement, jamais réécrits quand valides", () => {
  assert.deepEqual(normaliserLien("https://www.hudl.com/video/3/1/abc"), { ok: true, url: "https://www.hudl.com/video/3/1/abc" });
  assert.deepEqual(normaliserLien("https://youtu.be/abc?t=10"), { ok: true, url: "https://youtu.be/abc?t=10" });
  assert.deepEqual(normaliserLien("http://youtube.com/watch?v=x"), { ok: true, url: "https://youtube.com/watch?v=x" });
  assert.deepEqual(normaliserLien("hudl.com/video/1"), { ok: true, url: "https://hudl.com/video/1" });
  assert.deepEqual(normaliserLien(""), { ok: true, url: null });
  assert.equal(normaliserLien("javascript:alert(1)").ok, false);
  assert.equal(normaliserLien("nicho_hebert").ok, false);
  assert.equal(normaliserLien("ftp://exemple.ca/x").ok, false);
});

test("href sûr : une ancienne saisie de pseudo devient le profil ; une vidéo invalide n'est pas cliquable", () => {
  assert.equal(lienAffichable("nicho_hebert", "instagram"), "https://www.instagram.com/nicho_hebert");
  assert.equal(lienAffichable("javascript:alert(1)", "instagram"), null);
  assert.equal(lienAffichable("pas une url"), null);
  assert.equal(lienAffichable(undefined), null);
  assert.deepEqual(
    profilsSociaux({ instagram_url: "@a", facebook_url: "", tiktok_url: "javascript:x", linkedin_url: "https://www.linkedin.com/in/b" }),
    [
      { cle: "instagram", libelle: "Instagram", url: "https://www.instagram.com/a" },
      { cle: "linkedin", libelle: "LinkedIn", url: "https://www.linkedin.com/in/b" },
    ],
  );
});

test("à l'enregistrement : normalisé ou null, jamais une valeur que la base refuserait", () => {
  assert.equal(pourEnregistrerReseau("tiktok", "@jt16"), "https://www.tiktok.com/@jt16");
  assert.equal(pourEnregistrerReseau("tiktok", "http://exemple.ca"), null);
  assert.equal(pourEnregistrerReseau("facebook", 42), null);
  assert.equal(pourEnregistrerLien("http://youtube.com/watch?v=x"), "https://youtube.com/watch?v=x");
  assert.equal(pourEnregistrerLien("n'importe quoi"), null);
});

test("plateformes : LinkedIn reconnu, colonnes nommées et teinte", () => {
  assert.equal(plateformeDeUrl("https://www.linkedin.com/in/jt")?.cle, "linkedin");
  assert.equal(PLATEFORME_PAR_COLONNE.facebook_url.cle, "facebook");
  assert.equal(PLATEFORME_PAR_COLONNE.tiktok_url.cle, "tiktok");
  assert.equal(PLATEFORME_PAR_COLONNE.linkedin_url.cle, "linkedin");
  assert.equal(TEINTE_PLATEFORME.linkedin, "#0A66C2");
});

test("logos officiels : une seule source, LinkedIn compris ; le site les partage", () => {
  const logos = lire("lib/brand/logosMarques.ts");
  for (const k of ["instagram", "facebook", "youtube", "tiktok", "linkedin"]) assert.match(logos, new RegExp(`\\n  ${k}: "M`));
  const icone = lire("components/shared/PlateformeIcone.tsx");
  assert.ok(icone.includes('case "linkedin":') && icone.includes("LOGO_MARQUE.linkedin"));
  assert.ok(lire("components/marketing/SocialIcons.tsx").includes("d: LOGO_MARQUE.instagram"));
});

test("partenaire : les réseaux sociaux viennent de la RPC, plus de null forcé", () => {
  const src = lire("components/shared/athlete/useFicheAthleteDonnees.ts");
  assert.ok(!src.includes("    instagram_url: null,\n"), "instagram_url n'est plus forcé à null");
  for (const c of ["instagram_url", "facebook_url", "tiktok_url", "linkedin_url"]) {
    assert.ok(src.includes(`    ${c}: r.${c} ?? null,`), c);
  }
});

test("saisie : deux blocs « Vidéos » et « Réseaux sociaux » sur chaque écran", () => {
  for (const f of [
    "app/athlete/profil/page.tsx",
    "components/shared/AthleteEditWizardMobile.tsx",
    "components/shared/AthleteWizardMobile.tsx",
    "app/coach/athletes/create/page.tsx",
    "app/coach/athletes/[id]/modifier/PageClient.tsx",
  ]) {
    const src = lire(f);
    assert.ok(src.includes("Vidéos"), `${f} : bloc Vidéos`);
    assert.ok(src.includes("Réseaux sociaux"), `${f} : bloc Réseaux sociaux`);
  }
  assert.ok(lire("app/athlete/onboarding/page.tsx").includes("<ChampsReseauxSociaux"));
});

test("affichage : rangée « Réseaux sociaux » sur la fiche web, l'appli et l'aperçu", () => {
  for (const f of [
    "components/shared/athlete/sectionsFiche.tsx",
    "components/shared/AthleteRecruiterProfileBodyMobile.tsx",
    "components/shared/AthleteProfileView.tsx",
  ]) {
    assert.ok(lire(f).includes("<ReseauxSociaux"), f);
  }
  // Le verrou du palier gratuit reste : la rangée vit dans la branche déverrouillée de la section.
  const fiche = lire("components/shared/athlete/sectionsFiche.tsx");
  assert.ok(fiche.indexOf("<FreeLock />") < fiche.indexOf("<ReseauxSociaux"));
});
