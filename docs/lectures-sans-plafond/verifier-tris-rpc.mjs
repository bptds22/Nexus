// Contrôle statique — lectures sans plafond (2026-10-16).
// Sur le résultat d'une FONCTION (.rpc), PostgREST refuse de trier sur une colonne non sélectionnée
// (select("team_id").order("id") → 400 « column team_athletes.id does not exist »). Ce script parcourt
// les fichiers donnés et signale toute chaîne .rpc(...)...select(X)...order(Y) où Y n'est pas dans X.
// Un select absent (toutes les colonnes) ou « * » est accepté. Les constantes de select sont résolues
// dans le même fichier (const NOM = "…" ou `…`).
//   node docs/lectures-sans-plafond/verifier-tris-rpc.mjs <fichiers…>   → code 1 si un tri est fautif
import fs from "node:fs";

let fautes = 0;
let vues = 0;
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, "utf8");
  const constantes = new Map();
  for (const m of s.matchAll(/const\s+([A-Z_]+)\s*=\s*(["`])([\s\S]*?)\2/g)) constantes.set(m[1], m[3]);
  for (const m of s.matchAll(/\.rpc\(\s*"([a-z_]+)"/g)) {
    // La chaîne d'appels jusqu'au prochain .range( / .limit( / ; (bornée).
    const reste = s.slice(m.index, m.index + 900);
    const fin = reste.search(/\.range\(|\.limit\(|;\s*$/m);
    const chaine = fin > 0 ? reste.slice(0, fin) : reste;
    const ordres = [...chaine.matchAll(/\.order\(\s*"([a-z_]+)"/g)].map((x) => x[1]);
    if (ordres.length === 0) continue;
    vues++;
    const sel = chaine.match(/\.select\(\s*(?:(["`])([\s\S]*?)\1|([A-Z_]+))/);
    if (!sel) continue; // pas de select : toutes les colonnes
    const texte = sel[2] ?? constantes.get(sel[3]) ?? "";
    if (!texte) { console.log(`?? ${f} : ${m[1]} — select ${sel[3]} introuvable`); fautes++; continue; }
    if (texte.trim() === "*") continue;
    // Colonnes de premier niveau seulement (hors tables imbriquées entre parenthèses).
    let profondeur = 0, courant = "";
    const colonnes = [];
    for (const c of texte) {
      if (c === "(") profondeur++;
      if (c === ")") profondeur--;
      if (c === "," && profondeur === 0) { colonnes.push(courant); courant = ""; continue; }
      if (profondeur === 0 || c === "(") courant += c === "(" ? "" : c;
    }
    colonnes.push(courant);
    const noms = new Set(colonnes.map((c) => c.trim().split(/[:!(]/)[0].trim()).filter(Boolean));
    const manquants = ordres.filter((o) => !noms.has(o));
    if (manquants.length) {
      fautes++;
      const ligne = s.slice(0, m.index).split("\n").length;
      console.log(`FAUTE ${f}:${ligne} ${m[1]} — tri sur ${manquants.join(", ")} absent du select (${[...noms].join(", ")})`);
    }
  }
}
console.log(`${vues} lecture(s) .rpc triée(s) vérifiée(s), ${fautes} faute(s)`);
process.exit(fautes ? 1 : 0);
