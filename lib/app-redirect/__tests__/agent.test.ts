/* ═══════════════════════════════════════════════════════════════
   /app — classification des visites et liens d'attribution.
   User-Agents RÉELS (relevés publics), pas des chaînes inventées.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classerVisite, sourceDepuisParam } from "@/lib/app-redirect/agent";
import {
  APP_STORE_PROVIDER_TOKEN,
  APP_STORE_URL,
  PLAY_STORE_URL,
  intentionPlayStore,
  lienAppStore,
  lienPlayStore,
} from "@/lib/config/appStores";

const UA = {
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; fr_CA; fr; scale=3.00; 1179x2556; 624498154)",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 Instagram 343.0.0.33.101 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 8; shiba; shiba; fr_CA; 628385541)",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/476.0.0.35.108;FBBV/629046014;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/fr_CA;FBOP/5]",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  facebookexternalhit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  // L'aperçu de lien iMessage se déguise en Mac + facebookexternalhit + Twitterbot.
  imessage:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
  whatsapp: "WhatsApp/2.24.18.80 A",
  // Un vrai téléphone, pas un robot — le piège du motif générique « bot ».
  cubot: "Mozilla/5.0 (Linux; Android 10; CUBOT P40) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
};

test("classerVisite — navigateurs mobiles ordinaires : redirigeables", () => {
  assert.deepEqual(classerVisite(UA.safariIphone), { plateforme: "ios", robot: false, integre: false });
  assert.deepEqual(classerVisite(UA.chromeAndroid), { plateforme: "android", robot: false, integre: false });
  assert.deepEqual(classerVisite(UA.cubot), { plateforme: "android", robot: false, integre: false });
});

test("classerVisite — navigateurs intégrés Meta : plateforme connue, marqués intégrés", () => {
  assert.deepEqual(classerVisite(UA.instagramIos), { plateforme: "ios", robot: false, integre: true });
  assert.deepEqual(classerVisite(UA.instagramAndroid), { plateforme: "android", robot: false, integre: true });
  assert.deepEqual(classerVisite(UA.facebookIos), { plateforme: "ios", robot: false, integre: true });
});

test("classerVisite — ordinateurs : desktop", () => {
  assert.equal(classerVisite(UA.macSafari).plateforme, "desktop");
  assert.equal(classerVisite(UA.windowsChrome).plateforme, "desktop");
  assert.equal(classerVisite("").plateforme, "desktop");
  assert.equal(classerVisite(null).plateforme, "desktop");
});

test("classerVisite — robots d'aperçu : jamais redirigés, jamais intégrés", () => {
  for (const ua of [UA.facebookexternalhit, UA.imessage, UA.whatsapp]) {
    const v = classerVisite(ua);
    assert.equal(v.robot, true, ua);
    assert.equal(v.integre, false, ua);
    assert.equal(v.plateforme, "desktop", ua);
  }
});

test("sourceDepuisParam — liste fermée", () => {
  assert.equal(sourceDepuisParam("ig"), "instagram-bio");
  assert.equal(sourceDepuisParam(undefined), "direct");
  assert.equal(sourceDepuisParam(""), "direct");
  assert.equal(sourceDepuisParam(["ig", "x"]), "instagram-bio");
  assert.equal(sourceDepuisParam("tiktok"), "autre");
  assert.equal(sourceDepuisParam("'; drop table x; --"), "autre");
});

test("lienPlayStore — referrer UTM pour la bio, lien nu sinon", () => {
  assert.equal(
    lienPlayStore("instagram-bio"),
    `${PLAY_STORE_URL}&referrer=utm_source%3Dinstagram%26utm_medium%3Dbio`,
  );
  assert.equal(lienPlayStore("direct"), PLAY_STORE_URL);
  assert.equal(lienPlayStore("autre"), PLAY_STORE_URL);
});

test("lienAppStore — nu tant que le jeton fournisseur (pt) n'est pas renseigné", () => {
  if (APP_STORE_PROVIDER_TOKEN === null) {
    assert.equal(lienAppStore("instagram-bio"), APP_STORE_URL);
  } else {
    const u = new URL(lienAppStore("instagram-bio"));
    assert.equal(u.searchParams.get("pt"), APP_STORE_PROVIDER_TOKEN);
    assert.equal(u.searchParams.get("ct"), "instagram-bio");
    assert.equal(u.searchParams.get("mt"), "8");
  }
  assert.equal(lienAppStore("direct"), APP_STORE_URL);
});

test("intentionPlayStore — schéma market, paquet Play, repli https", () => {
  const i = intentionPlayStore("instagram-bio")!;
  assert.ok(i.startsWith("intent://details?id=ca.nexussports.app&referrer=utm_source%3Dinstagram"), i);
  assert.ok(i.includes("#Intent;scheme=market;package=com.android.vending;"), i);
  assert.ok(i.endsWith(";end"), i);
  const repli = decodeURIComponent(i.split("S.browser_fallback_url=")[1].replace(/;end$/, ""));
  assert.equal(repli, lienPlayStore("instagram-bio"));
});
