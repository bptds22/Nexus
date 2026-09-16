/* ═══════════════════════════════════════════════════════════════
   La garde qui manquait le 2026-09-16.

   `ambassadeur` avait été ajouté à `public.badges` (DB) et à
   `public/badges/` (asset) sans être ajouté à `CATALOGUE_BADGE_CODES`.
   Conséquence : `badgeSvgPath()` rendait `null`, et les deux composants
   qui l'interrogent — DistinctionBadge (l.126) et BadgeVignette (l.51) —
   retournent `null` SANS RIEN AFFICHER. Le badge était posé en base,
   visible sur /athlete/ambassadeur (qui code son chemin en dur), et
   absent de la ligne du profil comme de l'aperçu recruteur.

   Un badge qui ne s'affiche pas ne lève aucune erreur. D'où ce test.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { badgeSvgPath, CATALOGUE_BADGE_CODES, LEGACY_BADGE_TO_CATALOGUE } from "@/lib/config/badges";

test("badges — chaque code du catalogue résout un chemin d'asset", () => {
  const sansChemin = CATALOGUE_BADGE_CODES.filter((c) => !badgeSvgPath(c));
  assert.deepEqual(sansChemin, [],
    `codes sans chemin : ${sansChemin.join(", ")} — manquent à CATALOGUE_BADGE_CODES`);
});

test("badges — chaque code du catalogue a son FICHIER sur le disque", () => {
  const racine = join(import.meta.dirname, "..", "..", "..", "public");
  const manquants = CATALOGUE_BADGE_CODES
    .map((c) => ({ code: c, chemin: badgeSvgPath(c)! }))
    .filter(({ chemin }) => !existsSync(join(racine, chemin)));
  assert.deepEqual(manquants.map((m) => m.code), [],
    `assets absents de public/badges/ : ${manquants.map((m) => m.chemin).join(", ")}`);
});

test("badges — chaque ancien code pointe vers un code du catalogue", () => {
  const orphelins = Object.entries(LEGACY_BADGE_TO_CATALOGUE)
    .filter(([, cat]) => !(CATALOGUE_BADGE_CODES as readonly string[]).includes(cat))
    .map(([legacy, cat]) => `${legacy} → ${cat}`);
  assert.deepEqual(orphelins, []);
});
