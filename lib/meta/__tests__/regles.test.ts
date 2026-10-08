/* Gardes Meta : ce qui peut partir chez Meta, et depuis quelle URL.
   Nos utilisateurs sont en partie mineurs — ces tests verrouillent la
   liste blanche de user_data et le refus des URL porteuses d'identifiants. */

import test from "node:test";
import assert from "node:assert/strict";
import {
  ROLES_META, construireCorpsCapi, estRoutePublique, eventIdValide, leadDemoAutorise,
  pixelPermisSurPage, roleMeta, urlSansIdentifiant, urlSourceAssainie,
} from "@/lib/meta/regles";

const BASE = {
  evenement: "CompleteRegistration" as const,
  eventId: "3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f",
  contentName: "recruiter" as const,
  eventSourceUrl: "https://nexussports.ca/auth",
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  fbp: "fb.1.1700000000000.123456789",
  fbc: null,
  maintenant: 1_700_000_000_000,
};

test("user_data ne porte QUE ip, user agent, fbp, fbc", () => {
  const corps = construireCorpsCapi(BASE);
  const ud = corps.data[0].user_data;
  assert.deepEqual(Object.keys(ud).sort(), ["client_ip_address", "client_user_agent", "fbp"]);
  for (const k of Object.keys(ud)) {
    assert.ok(["client_ip_address", "client_user_agent", "fbp", "fbc"].includes(k), k);
  }
});

test("le corps a la forme Conversions API attendue, sans test_event_code par défaut", () => {
  const corps = construireCorpsCapi(BASE);
  const e = corps.data[0];
  assert.equal(e.event_name, "CompleteRegistration");
  assert.equal(e.event_time, 1_700_000_000);
  assert.equal(e.event_id, BASE.eventId);
  assert.equal(e.action_source, "website");
  assert.deepEqual(e.custom_data, { content_name: "recruiter" });
  assert.equal("test_event_code" in corps, false);
  assert.equal(construireCorpsCapi({ ...BASE, testEventCode: "TEST123" }).test_event_code, "TEST123");
});

test("rôles : coach / recruiter seulement — aucun athlète, aucun parent", () => {
  assert.equal(roleMeta("COACH"), "coach");
  assert.equal(roleMeta("RECRUTEUR"), "recruiter");
  // Verrou 4 : athlètes (majorité mineurs) et parents ne produisent RIEN.
  for (const r of ["ATHLETE", "PARENT", "ADMIN", "PARTNER", "", null, undefined]) assert.equal(roleMeta(r), null);
  assert.deepEqual([...ROLES_META].sort(), ["coach", "recruiter"]);
  assert.equal((ROLES_META as readonly string[]).includes("athlete"), false);
});

test("Lead /12octobre : personnel de cégep seulement", () => {
  for (const r of ["RECRUTEUR", "ENTRAINEUR_CHEF", "DIRECTEUR_SPORTS"]) assert.equal(leadDemoAutorise(r), true, r);
  for (const r of ["AUTRE", "ATHLETE", "", null, undefined]) assert.equal(leadDemoAutorise(r), false, String(r));
});

test("pixel jamais chargé sur les pages pour athlètes", () => {
  assert.equal(pixelPermisSurPage("/pour-les-etudiant-athlete"), false);
  assert.equal(pixelPermisSurPage("/pour-les-etudiant-athlete/"), false);
  assert.equal(pixelPermisSurPage("/claim", "?token=abc"), false);
  assert.equal(pixelPermisSurPage("/athlete/onboarding"), false);
  assert.equal(pixelPermisSurPage("/auth", "?screen=compte&role=athlete"), false);
  assert.equal(pixelPermisSurPage("/auth", "?role=recruiter"), true);
  assert.equal(pixelPermisSurPage("/auth"), true);
  assert.equal(pixelPermisSurPage("/auth/pro"), true);
  assert.equal(pixelPermisSurPage("/pour-les-recruteurs"), true);
  assert.equal(pixelPermisSurPage("/"), true);
  assert.equal(pixelPermisSurPage("/recruteur/recherche"), false);
});

test("URL navigateur : identifiants et jetons refusés", () => {
  assert.equal(urlSansIdentifiant("https://nexussports.ca/"), true);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/pour-les-etudiant-athlete"), true);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/12octobre?utm_source=meta&fbclid=AbC123"), true);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/recruteur/athletes/1d06342e-a138-4a88-97ed-d8a9a102428f"), false);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/12octobre/merci?choix=DIRECT&id=1d06342e-a138-4a88-97ed-d8a9a102428f"), false);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/claim?token=abc"), false);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/i/k3J9xQ2mZ7pL4wR8"), false);
  assert.equal(urlSansIdentifiant("https://nexussports.ca/auth?email=x@y.ca"), false);
  assert.equal(urlSansIdentifiant("pas une url"), false);
});

test("event_source_url serveur : origine + chemin, même origine seulement", () => {
  const o = "https://nexussports.ca";
  assert.equal(urlSourceAssainie("https://nexussports.ca/claim?token=secret", o), "https://nexussports.ca/claim");
  assert.equal(urlSourceAssainie("https://evil.example/auth", o), null);
  assert.equal(urlSourceAssainie(undefined, o), null);
});

test("routes publiques : portails exclus", () => {
  assert.equal(estRoutePublique("/"), true);
  assert.equal(estRoutePublique("/auth/"), true);
  assert.equal(estRoutePublique("/12octobre"), true);
  assert.equal(estRoutePublique("/12octobre/merci"), false);
  assert.equal(estRoutePublique("/claim"), false);
  assert.equal(estRoutePublique("/pour-les-etudiant-athlete"), false);
  assert.equal(estRoutePublique("/athlete/onboarding"), false);
  assert.equal(estRoutePublique("/recruteur/recherche"), false);
});

test("event_id : UUID v4 seulement", () => {
  assert.equal(eventIdValide(BASE.eventId), true);
  assert.equal(eventIdValide("1d06342e-a138-1a88-97ed-d8a9a102428f"), false);
  assert.equal(eventIdValide(42), false);
});
