// MÊME règle que public.lieu_normalise (migration 20261008134823) :
// minuscules, accents retirés, « (Main) » retiré, tout ce qui n'est ni lettre
// ni chiffre → une espace. Partagée par le géocodeur et l'écriture.
export function lieuNormalise(nom) {
  const s = (nom ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(main\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  return s || null;
}
