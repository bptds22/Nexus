/** CSV RFC 4180 minimal : guillemets doublés, virgules dans les champs, BOM ignoré. */
export function lireCsv(texte) {
  const lignes = [];
  let champ = "", ligne = [], dedans = false;
  const t = texte.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dedans) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') dedans = false;
      else champ += c;
    } else if (c === '"') dedans = true;
    else if (c === ",") { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ.replace(/\r$/, "")); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const [tete, ...corps] = lignes.filter((l) => l.some((v) => v.trim()));
  return corps.map((l) => Object.fromEntries(tete.map((k, i) => [k.trim(), (l[i] ?? "").trim()])));
}
