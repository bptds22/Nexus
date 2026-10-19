/* evenementVisite — une source pour l'export agenda d'une visite (BP 2026-10-19). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evenementVisite, liensVisite, nomFichierVisite } from "@/lib/calendar/evenementVisite";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const ISO = "2026-10-21T18:30:00Z";

test("en personne : LIEU = adresse ; DESCRIPTION = format, responsable, adresse, note", () => {
  const ev = evenementVisite({
    visitAtIso: ISO, athleteName: "Marie Côté", sport: "Football", schoolName: "Cégep X",
    details: { format: "EN_PERSONNE", adresse: " 175 rue Principale, Granby ", lien: null, responsable_nom: "Marc Tremblay", note: "Avec les parents" },
  })!;
  assert.equal(ev.title, "Visite — Marie Côté (Football)");
  assert.equal(ev.location, "175 rue Principale, Granby");
  assert.equal(ev.description, [
    "Visite planifiée avec Marie Côté via Nexus.",
    "Format : En personne",
    "Responsable : Marc Tremblay",
    "Adresse : 175 rue Principale, Granby",
    "Avec les parents",
  ].join("\n"));
  assert.equal(ev.durationMinutes, 60);
});

test("Zoom : LIEU = lien https ; un lien non https est ignoré", () => {
  const z = evenementVisite({ visitAtIso: ISO, athleteName: "A B", details: { format: "ZOOM", adresse: "ignorée", lien: "https://zoom.us/j/1", responsable_nom: null, note: null } })!;
  assert.equal(z.location, "https://zoom.us/j/1");
  assert.ok(z.description.includes("Zoom : https://zoom.us/j/1"));
  assert.ok(!z.description.includes("ignorée"));
  const mauvais = evenementVisite({ visitAtIso: ISO, athleteName: "A B", schoolName: "École", details: { format: "ZOOM", adresse: null, lien: "http://x", responsable_nom: null, note: null } })!;
  assert.equal(mauvais.location, "École");
});

test("téléphone : le format est dit ; sans détails, l'école reste le lieu (comportement d'avant)", () => {
  const t = evenementVisite({ visitAtIso: ISO, athleteName: "A B", schoolName: "École", details: { format: "TELEPHONE", adresse: null, lien: null, responsable_nom: "Julie", note: null } })!;
  assert.ok(t.description.includes("Format : Téléphone"));
  assert.equal(t.location, "École");
  const sans = evenementVisite({ visitAtIso: ISO, athleteName: "A B", schoolName: "École" })!;
  assert.equal(sans.location, "École");
  assert.equal(sans.description, "Visite planifiée avec A B via Nexus.");
});

test("instant illisible → null ; minuit local (sans heure) → 12 h", () => {
  assert.equal(evenementVisite({ visitAtIso: "pas une date", athleteName: "A" }), null);
  const minuit = new Date(2026, 9, 21, 0, 0, 0, 0).toISOString();
  const ev = evenementVisite({ visitAtIso: minuit, athleteName: "A" })!;
  assert.equal(ev.start.getHours(), 12);
});

test("Google : location et details encodés ; .ics : LOCATION / DESCRIPTION échappées", () => {
  const l = liensVisite({
    visitAtIso: ISO, athleteName: "Marie Côté",
    details: { format: "EN_PERSONNE", adresse: "175 rue Principale; Granby, QC", lien: null, responsable_nom: "Marc", note: "Ligne 1\nLigne 2" },
  })!;
  const u = new URL(l.googleUrl);
  assert.equal(u.searchParams.get("location"), "175 rue Principale; Granby, QC");
  assert.ok(u.searchParams.get("details")!.includes("Responsable : Marc"));
  assert.ok(u.searchParams.get("details")!.includes("Ligne 1\nLigne 2"));
  const ics = l.icsContent.replace(/\r\n /g, "");
  assert.ok(ics.includes(String.raw`LOCATION:175 rue Principale\; Granby\, QC`), ics);
  assert.ok(ics.includes(String.raw`Ligne 1\nLigne 2`));
  assert.ok(ics.includes("Format : En personne"));
  assert.equal(l.icsName, "visite-marie-cote.ics");
  assert.equal(nomFichierVisite("!!!"), "visite-nexus.ics");
});

test("une seule fonction : Mon processus (web), la carte de visite et Détails passent par evenementVisite", () => {
  const pipeline = lire("app/recruteur/pipeline/page.tsx");
  assert.ok(pipeline.includes("liensVisite({"));
  assert.ok(!pipeline.includes("generateCalendarLinks({"));
  assert.ok(pipeline.includes("details: detailsVisite"));
  const carte = lire("components/shared/VisitCalendarCard.tsx");
  assert.ok(carte.includes("liensVisite(entree)"));
  assert.ok(carte.includes("description: evenement.description"));
  assert.ok(carte.includes("location: evenement.location || undefined"));
  assert.ok(lire("components/recruteur/visites/DetailsVisite.tsx").includes("<BoutonsAgendaVisite compact entree={{ visitAtIso: visite.visitAt, athleteName: visite.fullName, details }} />"));
  for (const f of ["components/shared/AthleteRecruiterProfileBody.tsx", "components/shared/AthleteRecruiterProfileBodyMobile.tsx", "components/shared/RecruteurPipelineMobile.tsx"]) {
    assert.ok(lire(f).includes("cible={{ id"), f);
  }
});

test("calendrier : la source n'est plus sur la carte fermée, seulement au dépli", () => {
  const web = lire("app/recruteur/calendrier/page.tsx");
  assert.ok(web.includes('{open && <SourceMatchLigne source={m.game.source} className="bg-[#171A20] px-4 py-[9px]" />}'));
  assert.equal(web.split("<SourceMatchLigne").length - 1, 1);
  const appli = lire("components/shared/RecruteurCalendrierMobile.tsx");
  const iOuvert = appli.indexOf("{open && (\n        <div className=\"bg-[#171A20]\">");
  const iSource = appli.indexOf('<SourceMatchLigne source={m.game.source} className="px-4 py-2.5" />');
  assert.ok(iOuvert > 0 && iSource > iOuvert, "la source de l'appli est dans le dépli");
});
