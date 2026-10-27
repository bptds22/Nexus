/* ═══════════════════════════════════════════════════════════════
   Badges NLS + GP au catalogue du partenaire « Nexus » — les 10 icônes.

   Dépose les PNG de docs/badges-nls-gp/images/ dans le bucket
   partner-badges, sous « <id du partenaire Nexus>/ ». C'est l'étape 1 :
   les lignes partner_badges (étape 2, operation.sql) vérifient que les
   10 fichiers sont là, à la bonne taille, avant d'écrire quoi que ce soit.
   Un fichier déposé sans ligne qui le cite n'est affiché nulle part.

   La cible est TOUJOURS donnée à la main — le script ne lit jamais
   .env.local (qui pointe sur la prod) :
     NEXUS_URL=<url API> NEXUS_SERVICE_KEY=<clé service_role> \
       node docs/badges-nls-gp/televerser-icones.mjs --partenaire <uuid> [--envoyer | --retirer]

   Sans --envoyer ni --retirer : constat seulement (rien n'est écrit).
   --envoyer : dépose les fichiers absents (jamais d'écrasement : upsert
               false), puis relit CHAQUE fichier par son URL publique et
               compare le md5 au fichier du dépôt.
   --retirer : supprime les 10 fichiers (après le rollback SQL en mode
               suppression seulement — sinon des lignes les citent encore).
═══════════════════════════════════════════════════════════════ */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "partner-badges";
const FICHIERS = [
  "nls-prospect.png", "nls-top50.png", "nls-top25.png", "nls-top10.png", "nls-mvp.png",
  "gp-prospect.png", "gp-top50.png", "gp-top25.png", "gp-top10.png", "gp-mvp.png",
];

const args = process.argv.slice(2);
const partenaire = args[args.indexOf("--partenaire") + 1];
const envoyer = args.includes("--envoyer");
const retirer = args.includes("--retirer");
const url = process.env.NEXUS_URL;
const cle = process.env.NEXUS_SERVICE_KEY;

if (!url || !cle) throw new Error("NEXUS_URL et NEXUS_SERVICE_KEY sont requis (jamais lus de .env.local).");
if (!/^[0-9a-f-]{36}$/.test(partenaire ?? "")) throw new Error("--partenaire <uuid du partenaire Nexus> requis.");
if (envoyer && retirer) throw new Error("--envoyer OU --retirer, pas les deux.");

const dossierImages = join(dirname(fileURLToPath(import.meta.url)), "images");
const md5 = (b) => createHash("md5").update(b).digest("hex");
const supabase = createClient(url, cle, { auth: { persistSession: false } });

console.log(`Cible : ${url} — ${BUCKET}/${partenaire}/ — mode ${envoyer ? "ENVOYER" : retirer ? "RETIRER" : "constat"}`);

const { data: presents, error: errListe } = await supabase.storage.from(BUCKET).list(partenaire, { limit: 1000 });
if (errListe) throw errListe;
const parNom = new Map(presents.map((o) => [o.name, o]));

let ecarts = 0;
for (const nom of FICHIERS) {
  const local = readFileSync(join(dossierImages, nom));
  const chemin = `${partenaire}/${nom}`;
  const present = parNom.get(nom);

  if (retirer) {
    if (!present) { console.log(`  ${nom} : absent, rien à retirer`); continue; }
    const { error } = await supabase.storage.from(BUCKET).remove([chemin]);
    if (error) throw error;
    console.log(`  ${nom} : retiré`);
    continue;
  }

  if (!present && envoyer) {
    const { error } = await supabase.storage.from(BUCKET)
      .upload(chemin, local, { contentType: "image/png", upsert: false, cacheControl: "3600" });
    if (error) throw error;
  }
  if (!present && !envoyer) { console.log(`  ${nom} : ABSENT (${local.length} o, md5 ${md5(local)})`); continue; }

  // Relecture par l'URL publique : c'est elle que les fiches chargeront.
  const publique = supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
  const rep = await fetch(`${publique}?v=${Date.now()}`);
  const servi = Buffer.from(await rep.arrayBuffer());
  const ok = rep.ok && md5(servi) === md5(local) && rep.headers.get("content-type") === "image/png";
  if (!ok) ecarts++;
  console.log(`  ${nom} : ${present ? "déjà là" : "déposé"} — servi ${rep.status} ${rep.headers.get("content-type")} `
    + `${servi.length} o md5 ${md5(servi)} ${ok ? "= dépôt" : "≠ DÉPÔT (" + md5(local) + ")"}`);
}

if (ecarts > 0) {
  console.error(`ARRÊT : ${ecarts} fichier(s) différent(s) du dépôt. Ne pas lancer operation.sql.`);
  process.exit(1);
}
console.log(retirer ? "Fait." : "OK : les fichiers présents sont identiques au dépôt.");
