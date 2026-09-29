import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { estRoleFige, ROLES_FIGES } from "@/lib/auth/rolesFiges";
import { computeDispatchDestination } from "@/lib/auth/computeDispatchDestination";

test("PARENT, PARTNER, ADMIN sont figés ; les rôles d'inscription ne le sont pas", () => {
  for (const r of ["PARENT", "PARTNER", "ADMIN"]) assert.equal(estRoleFige(r), true, r);
  for (const r of ["ATHLETE", "COACH", "RECRUTEUR", null, undefined, ""]) assert.equal(estRoleFige(r as string), false, String(r));
});

test("un PARENT à l'onboarding non terminé est aiguillé vers /parent", () => {
  const d = computeDispatchDestination({ role: "PARENT", onboarding_complete: false, status: "ACTIF", privacy_preferences: {} } as never, {} as never);
  assert.equal(d.path, "/parent");
});

test("la base porte EXACTEMENT la même liste (needs_signup_role et claim_signup_role)", () => {
  const dossier = join(process.cwd(), "supabase/migrations");
  const f = readdirSync(dossier).find((n) => n.endsWith("_roles_figes_parent_partner_admin.sql"));
  assert.ok(f, "migration des rôles figés introuvable");
  const sql = readFileSync(join(dossier, f!), "utf8");
  const attendu = `array[${ROLES_FIGES.map((r) => `'${r}'`).join(", ")}]`;
  assert.equal(sql.split(attendu).length - 1 >= 2, true, `la liste ${attendu} doit figurer dans les deux fonctions`);
});
