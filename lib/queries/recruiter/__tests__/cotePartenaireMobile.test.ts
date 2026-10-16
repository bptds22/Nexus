/* B3 de la 1.4.5 — recherche partenaire dans l'appli, et cote partenaire dans la
   recherche RECRUTEUR mobile (p_inclure_partenaires = true), toujours avec son
   libellé : jamais le paramètre sans le nom de l'organisation (registre W2). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { coteAffichee } from "@/lib/queries/recruiter/useAthleteSearch";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("coteAffichee : le coach d'abord, sinon le partenaire AVEC son nom", () => {
  assert.deepEqual(coteAffichee({ stars: 4, starsPartenaire: 2, starsPartenaireOrg: "Club" }), { valeur: 4, organisation: null });
  assert.deepEqual(coteAffichee({ stars: 0, starsPartenaire: 3.5, starsPartenaireOrg: "Club" }), { valeur: 3.5, organisation: "Club" });
  assert.deepEqual(coteAffichee({ stars: 0, starsPartenaire: 3, starsPartenaireOrg: null }), { valeur: 3, organisation: "Partenaire" });
  assert.deepEqual(coteAffichee({ stars: 0, starsPartenaire: null, starsPartenaireOrg: null }), { valeur: 0, organisation: null });
});

test("recherche recruteur mobile : p_inclure_partenaires ET le libellé, dans le même lot", () => {
  const src = lire("components/shared/RecruteurRechercheMobile.tsx");
  assert.match(src, /inclurePartenaires: true,/);
  assert.equal((src.match(/const cote = coteAffichee\(\{ stars: a\.stars, starsPartenaire: a\.starsPartenaire \?\? null, starsPartenaireOrg: a\.starsPartenaireOrg \?\? null \}\);/g) ?? []).length, 2);
  assert.equal((src.match(/\{cote\.valeur\.toFixed\(1\)\}/g) ?? []).length, 2);
  assert.doesNotMatch(src, /\{a\.stars\.toFixed\(1\)\}/);
  assert.equal((src.match(/data-cote-partenaire/g) ?? []).length, 2);
  // La RPC reçoit bien le 16e paramètre.
  assert.match(lire("lib/queries/recruiter/useAthleteSearch.ts"), /p_inclure_partenaires: filters\.inclurePartenaires \?\? false,/);
});

test("recherche partenaire : la page est dans l'appli, rendue côté client", () => {
  const page = lire("app/partenaire/athletes/page.tsx");
  assert.match(page, /^"use client";/);
  assert.match(page, /<PartnerAthletesSearch/);
  assert.match(page, /return <PageChargee rendre=\{rendre\} \/>;/);
  assert.match(lire("app/_components/mobile/MobileTabBar.tsx"), /href: "\/partenaire\/athletes", icon: Icons\.search/);
  assert.match(lire("components/partenaire/PartnerAthletesSearch.tsx"), /text-\[16px\] sm:text-\[14px\]/);
});
