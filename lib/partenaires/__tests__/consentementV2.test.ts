/* Consentement partenaires v2 (vidéos + réseaux sociaux, BP 2026-10-19).
   La base ne compte comme v2 qu'un accord journalisé avec une politique de sa liste
   (consentement_partenaire_politiques_v2) : ces tests tiennent le client et la base
   d'accord, et vérifient que chaque surface journalise ce qu'elle MONTRE. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVACY_POLICY_VERSION, POLITIQUE_CARTE_SEULE } from "@/lib/legal/policyVersion";
import { PARTNER_MEDIA_COPY, PARTNER_MEDIA_COPY_V1, partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";
import { buildConsentMetadata } from "@/lib/legal/persistInitialConsents";
import { parsePushData } from "@/lib/push/pushIntent";
import { lireEtatV2, repondreV2, ROUTE_CONSENTEMENT_V2 } from "@/lib/partenaires/consentementV2";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const migration = lire("supabase/migrations/20261018150000_athlete_reseaux_sociaux.sql");

test("v2 : la politique du client est celle que la base reconnaît ; « carte seule » ne l'est pas", () => {
  assert.equal(PRIVACY_POLICY_VERSION, "2026-10-v2");
  const liste = /consentement_partenaire_politiques_v2\(\)[\s\S]*?array\[([^\]]*)\]/.exec(migration)?.[1] ?? "";
  const valeurs = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(valeurs, [PRIVACY_POLICY_VERSION]);
  assert.ok(!valeurs.includes(POLITIQUE_CARTE_SEULE));
  assert.equal(POLITIQUE_CARTE_SEULE, "2026-10-v2+carte");
});

test("v2 : le texte nomme les vidéos et les réseaux ; la v1 reste, pour l'historique", () => {
  assert.match(PARTNER_MEDIA_COPY.videosEtReseaux, /vidéos/);
  assert.match(PARTNER_MEDIA_COPY.videosEtReseaux, /Instagram, Facebook, TikTok, LinkedIn/);
  assert.match(partnerResponsibilityText("self"), /tes vidéos et les liens de tes réseaux sociaux/);
  assert.match(partnerResponsibilityText("child"), /ses vidéos et les liens de ses réseaux sociaux/);
  // Honnêteté : les réseaux sont publics, on ne promet plus « aucun contact ».
  assert.ok(!PARTNER_MEDIA_COPY.bullets.some((b) => b.startsWith("Aucun partenaire ne peut te contacter")));
  assert.ok(PARTNER_MEDIA_COPY_V1.bullets.includes("Aucun partenaire ne peut te contacter directement"));
  assert.ok(!PARTNER_MEDIA_COPY_V1.responsabiliteSelf.includes("vidéo"));
  // Le coach enregistre l'autorisation de la CARTE : son texte ne parle pas de vidéos.
  assert.ok(!partnerResponsibilityText("athlete").includes("vidéo"));
});

test("v2 : l'inscription garde la réponse EXPLICITE en texte (GoTrue efface les null)", () => {
  const base = { policy: true, data: true, marketing: false };
  assert.equal(buildConsentMetadata({ ...base, partnerVisibility: true }).choix_partenaires_v2, "OUI");
  assert.equal(buildConsentMetadata({ ...base, partnerVisibility: false }).choix_partenaires_v2, "NON");
  assert.equal(buildConsentMetadata(base).choix_partenaires_v2, undefined);
});

test("v2 : le push de la campagne ouvre la carte, et seulement une route connue", () => {
  const i = parsePushData({ type: "announcement", nx_type: "CONSENTEMENT_PARTENAIRES_V2", route: ROUTE_CONSENTEMENT_V2 });
  assert.deepEqual(i && { kind: i.kind, route: (i as { route?: string }).route }, { kind: "route", route: ROUTE_CONSENTEMENT_V2 });
  const sansRoute = parsePushData({ type: "announcement", nx_type: "CONSENTEMENT_PARTENAIRES_V2" });
  assert.equal((sansRoute as { route?: string } | null)?.route, ROUTE_CONSENTEMENT_V2);
  assert.match(migration, /'route', '\/athlete\/consentement-partenaires'/);
});

test("v2 : chaque surface journalise ce qu'elle montre", () => {
  // Texte v2 affiché → politique v2.
  for (const f of ["app/athlete/parametres/page.tsx", "components/shared/AthleteParametresMobile.tsx", "app/parent/(app)/consentements/page.tsx"]) {
    assert.ok(lire(f).includes("p_policy_version: PRIVACY_POLICY_VERSION"), f);
  }
  // Texte « carte » seulement → carte seule.
  assert.ok(lire("app/api/consentement-partenaires/route.ts").includes("p_policy_version: POLITIQUE_CARTE_SEULE"));
  assert.ok(lire("app/athlete/notifications/page.tsx").includes("accepterVisibilitePartenaire(createClient(), n.id, POLITIQUE_CARTE_SEULE)"));
  const prospect = lire("components/athlete/prospects/CarteProspectReponse.tsx");
  assert.ok(prospect.includes("p_policy_version: POLITIQUE_CARTE_SEULE"));
  assert.ok(prospect.includes("PARTNER_MEDIA_COPY_V1.responsabiliteSelf"));
  assert.ok(lire("app/consentement-partenaires/page.tsx").includes("PARTNER_MEDIA_COPY_V1.responsabiliteChild"));
  // Onboarding : la réponse v2 de l'inscription d'abord ; l'ancien chemin reste « carte seule ».
  const web = lire("app/athlete/onboarding/page.tsx");
  assert.ok(web.includes("await transmettreChoixInscription(supabase, { choix_partenaires_v2: choixPartenairesV2.current });"));
  assert.ok(web.includes("p_policy_version: POLITIQUE_CARTE_SEULE,"));
  const appli = lire("components/shared/AthleteOnboardingMobile.tsx");
  assert.ok(appli.includes("await transmettreChoixInscription(supabase, meta);"));
  assert.ok(appli.includes("p_policy_version: POLITIQUE_CARTE_SEULE,"));
});

test("v2 : la carte plein écran — montée dans le layout athlète, Oui / Non sans défaut, « Plus tard »", () => {
  assert.ok(lire("app/athlete/layout.tsx").includes("<DemandeConsentementPartenairesV2 />"));
  const carte = lire("components/shared/CarteConsentementPartenairesV2.tsx");
  assert.ok(carte.includes('onClick={() => repondre("OUI")} data-consentement-v2-oui'));
  assert.ok(carte.includes('onClick={() => repondre("NON")} data-consentement-v2-non'));
  assert.ok(carte.includes('onClick={() => repondre("PLUS_TARD")} data-consentement-v2-plus-tard'));
  assert.ok(!/aria-checked|defaultChecked/.test(carte), "aucun choix coché d'avance");
  assert.ok(carte.includes("createPortal("));
});

test("v2 : lecture de l'état et réponse — formes de la base", async () => {
  const faux = (data: unknown, error: unknown = null) =>
    ({ rpc: async () => ({ data, error }) }) as unknown as Parameters<typeof lireEtatV2>[0];
  const e = await lireEtatV2(faux({ ok: true, a_afficher: true, statut: "V1", refuse: false, demande_parent: false, plus_tard_nb: 2, peut_seul: true }));
  assert.deepEqual(e, { aAfficher: true, statut: "V1", refuse: false, demandeParent: false, plusTardNb: 2, peutSeul: true });
  assert.equal(await lireEtatV2(faux({ ok: false, reason: "not_found" })), null);
  assert.equal(await lireEtatV2(faux(null, { message: "x" })), null);
  assert.deepEqual(await repondreV2(faux({ ok: true, etat: "DEMANDE_PARENT" }), "OUI"), { issue: "DEMANDE_PARENT" });
  const absent = await repondreV2(faux({ ok: false, reason: "parent_absent" }), "OUI");
  assert.ok("erreur" in absent && absent.erreur.includes("parent"));
});
