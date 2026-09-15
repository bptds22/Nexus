/* Sondes des cartes de palier — athlète JETABLE, base locale Docker.
   Ne touche PAS au compte de test de BP. Nettoie derrière lui. */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const SP = process.argv[2];
const BASE = "http://192.168.2.30:3007";
const SB = "http://192.168.2.30:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ID = "cccccccc-1111-1111-1111-111111111111";

const psql = (sql) =>
  execFileSync("docker", ["exec", "-e", "PGCLIENTENCODING=UTF8", "supabase_db_Nexus",
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
    { encoding: "utf8" });

// ── Fixture jetable ──────────────────────────────────────────────────────
psql(`
delete from public.athletes where email = 'cartes@demo.local';
delete from auth.users where email = 'cartes@demo.local';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('${ID}', '00000000-0000-0000-0000-000000000000', 'authenticated','authenticated',
        'cartes@demo.local', crypt('demo1234', gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"ATHLETE"}'::jsonb,
        '', '', '', '');
update public.users set role='ATHLETE', first_name='Cartes', last_name='Sonde',
       onboarding_complete=true where id='${ID}';
insert into public.athletes (id, user_id, first_name, last_name, email, school_id,
                             status, date_naissance, verified, profile_completion)
values ('${ID}', '${ID}', 'Cartes', 'Sonde', 'cartes@demo.local',
        'dddddddd-0000-0000-0000-000000000001', 'ACTIF', date '2006-01-01', true, 60);
`);

const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "cartes@demo.local", password: "demo1234" }),
});
const s = await r.json();
if (!s.access_token) { console.log("AUTH KO", s); process.exit(1); }

const payload = JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token,
  expires_in: s.expires_in, expires_at: Math.floor(Date.now()/1000)+s.expires_in,
  token_type: "bearer", user: s.user });
const brut = "base64-" + Buffer.from(payload, "utf8").toString("base64");
const T = 3180, ck = [];
for (let i = 0, k = 0; i < brut.length; i += T, k++)
  ck.push({ name: `sb-192-auth-token.${k}`, value: brut.slice(i, i+T), domain: "192.168.2.30", path: "/" });

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 430, height: 1700 }, deviceScaleFactor: 2 });
await ctx.addCookies(ck);
const p = await ctx.newPage();

const cartes = async () => {
  await p.goto(`${BASE}/athlete/ambassadeur`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  return p.evaluate(() =>
    [...document.querySelectorAll("section h2")].map((h) => h.textContent.trim()));
};

let ok = true;
const verifie = (etape, vues, attendues) => {
  const manquantes = attendues.filter((a) => !vues.some((v) => v.includes(a)));
  const surplus = vues.filter((v) => !attendues.some((a) => v.includes(a)) && v !== "Déclarer une recrue" && v !== "Mes déclarations");
  const verdict = manquantes.length === 0 && surplus.length === 0;
  if (!verdict) ok = false;
  console.log(`${verdict ? "OK " : "KO "} ${etape} -> [${vues.join(" | ")}]`
    + (manquantes.length ? `  MANQUE: ${manquantes}` : "")
    + (surplus.length ? `  EN TROP: ${surplus}` : ""));
};

// ── S21 : rien avant le palier 3 ──
verifie("S21 aucun palier", await cartes(), []);

// ── S22 : palier 3 ──
psql(`insert into public.ambassadeur_paliers (athlete_id, palier) values ('${ID}',3);`);
verifie("S22 palier 3", await cartes(), ["Tes stories d'ambassadeur"]);
await p.screenshot({ path: `${SP}/shots/cartes-palier3.png`, fullPage: true });

// ── S23 : palier 5 — la carte 3 DOIT rester ──
psql(`insert into public.ambassadeur_paliers (athlete_id, palier) values ('${ID}',5);`);
verifie("S23 palier 5 (la 3 reste)", await cartes(),
  ["Tes stories d'ambassadeur", "Badge Ambassadeur"]);
await p.screenshot({ path: `${SP}/shots/cartes-palier5.png`, fullPage: true });

// ── S24 : palier 10 — les trois ──
psql(`insert into public.ambassadeur_paliers (athlete_id, palier) values ('${ID}',10);`);
verifie("S24 palier 10 (les trois)", await cartes(),
  ["Tes stories d'ambassadeur", "Badge Ambassadeur", "Ambassadeur Élite"]);
await p.screenshot({ path: `${SP}/shots/cartes-palier10.png`, fullPage: true });

// ── S25 : l'ordre a l'ecran ──
const ordre = await p.evaluate(() =>
  [...document.querySelectorAll("section h2")].map((h) => h.textContent.trim()));
const attenduOrdre = ["Tes stories d'ambassadeur", "Badge Ambassadeur", "Ambassadeur Élite 🏆",
                      "Déclarer une recrue", "Mes déclarations"];
const bonOrdre = JSON.stringify(ordre) === JSON.stringify(attenduOrdre);
if (!bonOrdre) ok = false;
console.log(`${bonOrdre ? "OK " : "KO "} S25 ordre -> ${ordre.join(" > ")}`);

// ── S26 : le lien de la story est ABSOLU (il finit dans une bio IG) ──
const href = await p.evaluate(() =>
  [...document.querySelectorAll("a")].find((a) => /Créer ma story/.test(a.textContent))?.href);
const bonLien = href === "https://nexussports.ca/ma-story";
if (!bonLien) ok = false;
console.log(`${bonLien ? "OK " : "KO "} S26 lien story -> ${href}`);

await nav.close();
psql(`delete from public.athletes where email='cartes@demo.local';
      delete from auth.users where email='cartes@demo.local';`);
const reste = psql(`select count(*) from public.athletes where email='cartes@demo.local';`);
console.log("\nfixture jetable supprimee :", reste.includes("0") ? "OK" : "KO");
console.log(ok ? "\n==== SONDES CARTES : TOUTES PASSEES ====" : "\n==== ECHEC ====");
process.exit(ok ? 0 : 1);
