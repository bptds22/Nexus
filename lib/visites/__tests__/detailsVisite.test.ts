/* Détails d'une visite (BP 2026-10-18) — règles pures, fusion de la lecture, branchement
   dans le calendrier web et l'appli. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  brouillonDepuis, cleVisite, fonctionAbsente, indexerDetails, lienCarteAdresse, resumeVisite, validerVisite,
  type BrouillonVisite, type DetailsVisite,
} from "@/lib/visites/detailsVisite";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const vide: BrouillonVisite = { format: "EN_PERSONNE", adresse: "", lien: "", responsableId: null, responsableNom: "", note: "" };
const ligne = (o: Partial<DetailsVisite>): DetailsVisite => ({
  athlete_id: null, carte_id: null, format: "EN_PERSONNE", adresse: null, lien: null, responsable_id: null,
  responsable_nom: null, note: null, modifie_par: null, modifie_le: null, ...o,
});

test("validation : en personne → adresse seulement, nettoyée ; cible athlète", () => {
  const v = validerVisite({ ...vide, adresse: "  175 rue Principale ", lien: "https://zoom.us/j/1", note: " parents " }, { id: "a1" });
  assert.ok(v.ok);
  assert.deepEqual(v.params, {
    p_athlete_id: "a1", p_carte_id: null, p_format: "EN_PERSONNE", p_adresse: "175 rue Principale",
    p_lien: null, p_responsable_id: null, p_responsable_nom: null, p_note: "parents",
  });
});

test("validation : Zoom → lien https:// exigé, l'adresse n'est pas envoyée ; cible carte", () => {
  assert.deepEqual(validerVisite({ ...vide, format: "ZOOM", lien: "http://zoom.us/j/1" }, { id: "c1", prospect: true }),
    { ok: false, erreur: "Le lien Zoom doit commencer par https://" });
  const v = validerVisite({ ...vide, format: "ZOOM", lien: "https://zoom.us/j/1", adresse: "cachée" }, { id: "c1", prospect: true });
  assert.ok(v.ok);
  assert.equal(v.params.p_carte_id, "c1");
  assert.equal(v.params.p_athlete_id, null);
  assert.equal(v.params.p_adresse, null);
  assert.equal(v.params.p_lien, "https://zoom.us/j/1");
});

test("validation : un seul responsable, longueurs bornées", () => {
  assert.equal(validerVisite({ ...vide, responsableId: "r1", responsableNom: "Marc" }, { id: "a1" }).ok, false);
  assert.equal(validerVisite({ ...vide, note: "x".repeat(501) }, { id: "a1" }).ok, false);
  assert.equal(validerVisite({ ...vide, adresse: "x".repeat(301) }, { id: "a1" }).ok, false);
  const v = validerVisite({ ...vide, format: "TELEPHONE", responsableNom: " Marc Tremblay " }, { id: "a1" });
  assert.ok(v.ok);
  assert.equal(v.params.p_responsable_nom, "Marc Tremblay");
  assert.equal(v.params.p_responsable_id, null);
});

test("lecture : indexée par athlète OU carte, sans collision entre les deux", () => {
  const m = indexerDetails([ligne({ athlete_id: "x", format: "ZOOM" }), ligne({ carte_id: "x", format: "TELEPHONE" })]);
  assert.equal(m.get(cleVisite("x"))?.format, "ZOOM");
  assert.equal(m.get(cleVisite("x", true))?.format, "TELEPHONE");
  assert.equal(m.size, 2);
});

test("brouillon : un responsable Nexus n'est pas un nom tapé", () => {
  assert.equal(brouillonDepuis(ligne({ responsable_id: "r1", responsable_nom: "Julie Roy" })).responsableNom, "");
  assert.equal(brouillonDepuis(ligne({ responsable_nom: "Marc" })).responsableNom, "Marc");
  assert.deepEqual(brouillonDepuis(null), vide);
});

test("résumé de la carte, lien de carte, fonction absente", () => {
  assert.equal(resumeVisite(ligne({ adresse: "175 rue Principale", responsable_nom: "Marc" })), "En personne · Marc · 175 rue Principale");
  assert.equal(resumeVisite(ligne({ format: "ZOOM", adresse: "ignorée" })), "Zoom");
  assert.equal(resumeVisite(null), "");
  assert.equal(lienCarteAdresse(" 1 rue A, Lévis "), "https://www.google.com/maps/search/?api=1&query=1%20rue%20A%2C%20L%C3%A9vis");
  assert.equal(fonctionAbsente({ code: "PGRST202" }), true);
  assert.equal(fonctionAbsente({ message: "Could not find the function public.visites_details_unite" }), true);
  assert.equal(fonctionAbsente({ code: "42501", message: "NEXUS: refusé" }), false);
});

test("calendrier web et appli : bouton « Détails » seulement si la lecture existe, fenêtre web / feuille", () => {
  const web = lire("app/recruteur/calendrier/page.tsx");
  const appli = lire("components/shared/RecruteurCalendrierMobile.tsx");
  for (const src of [web, appli]) {
    assert.ok(src.includes("const { data: detailsData } = useDetailsVisites(true);"));
    assert.ok(src.includes("detailsData?.parCle.get(cleVisite(v.athleteId, v.prospect))"));
    assert.ok(src.includes("{detailsData?.disponible && "));
  }
  assert.ok(web.includes("<FenetreDetailsVisite visite={v} details={details} onFermer={() => setOuverte(false)} />"));
  assert.ok(appli.includes("<FenetreDetailsVisite appli visite={v} details={details} onFermer={() => setOuverte(false)} />"));
  const hook = lire("lib/queries/recruiter/useDetailsVisites.ts");
  assert.ok(hook.includes("if (fonctionAbsente(error)) return { disponible: false, parCle: new Map() };"));
  // Les refus « NEXUS: » de la base s'affichent, sans le préfixe.
  assert.ok(lire("components/recruteur/visites/DetailsVisite.tsx").includes("messageErreurNexus((e as { message?: string })?.message)"));
});
