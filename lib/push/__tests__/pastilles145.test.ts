/* C3 (1.4.5) — les pastilles de notification se mettent à jour : signaux pour tous les rôles, reprise de
   l'appli, intervalle ; chaque lecture émet son signal ; plateau vidé à la reprise. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("C3 : la barre d'onglets écoute les deux signaux pour TOUS les rôles, la reprise et une minuterie", () => {
  const src = lire("app/_components/mobile/MobileTabBar.tsx");
  for (const extrait of [
    'window.addEventListener("activities-updated", handler);\n    window.addEventListener("notifications-updated", handler);',
    "const finReprise = surReprise(() => { void viderNotificationsLivrees(); loadBadges(); });",
    'window.setInterval(() => { if (document.visibilityState === "visible") loadBadges(); }, 60_000);',
  ]) assert.ok(src.includes(extrait), extrait);
  assert.ok(!src.includes('if (role === "coach") window.addEventListener'), "plus d'écoute réservée à un rôle");
});

test("C3 : reprise Capacitor + visibilité, plateau vidé par le plugin déjà installé", () => {
  const src = lire("lib/push/pastillesAppareil.ts");
  assert.ok(src.includes('App.addListener("appStateChange", ({ isActive }) => { if (isActive) rappel(); })'));
  assert.ok(src.includes('document.addEventListener("visibilitychange", visible);'));
  assert.ok(src.includes("await FirebaseMessaging.removeAllDeliveredNotifications();"));
});

test("C3 : chaque lecture signale les compteurs", () => {
  for (const f of [
    "components/shared/AthleteMessagesThreadMobile.tsx",
    "components/shared/CoachAthleteThreadMobile.tsx",
    "components/shared/CoachGroupThreadMobile.tsx",
    "components/shared/AthleteGroupThreadMobile.tsx",
    "components/messaging/NexusThreadView.tsx",
    "lib/queries/coach/useMarkAllCoachActivitiesRead.ts",
    "components/shared/CoachATraiterMobile.tsx",
    "app/parent/(app)/notifications/page.tsx",
  ]) assert.ok(lire(f).includes("signalerCompteursAJour();"), f);
  assert.ok(lire("lib/queries/coach/useMarkAllCoachActivitiesRead.ts").includes('window.dispatchEvent(new Event("activities-updated"))'));
});

test("C3 : web — barre latérale coach et cloche parent suivent les signaux et le retour à l'onglet", () => {
  const coach = lire("app/coach/components/CoachSidebar.tsx");
  assert.ok(coach.includes('window.addEventListener("notifications-updated", handler);'));
  assert.ok(coach.includes("const second = window.setTimeout(handler, 2000);"));
  const parent = lire("app/parent/(app)/layout.tsx");
  assert.ok(parent.includes('window.addEventListener("notifications-updated", handler);'));
  assert.ok(parent.includes("}, [status, pathname]);"));
});
