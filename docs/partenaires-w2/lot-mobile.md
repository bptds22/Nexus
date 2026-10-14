# W2 — ce que le lot mobile devra reprendre (rien fait côté mobile : protocole web d'abord)

Le tronc partagé est prêt : `lib/evaluations/partenaire.ts` (lecture / contexte / écriture),
`coteAffichee()` dans `lib/queries/recruiter/useAthleteSearch.ts`.

| Surface mobile | À faire |
|---|---|
| `components/shared/AthleteRecruiterProfileBodyMobile.tsx` | Section « Évaluation de <organisation> » sous le rapport de l'entraîneur. Ce composant sert la fiche recruteur mobile, la fiche coach mobile (`viewer="coach"`) et l'aperçu athlète (`app/athlete/profil/apercu`). |
| `components/shared/RecruteurRechercheMobile.tsx` | Cartes : `coteAffichee(a)` à la place de `a.stars`, avec le nom de l'organisation à côté des étoiles quand la note vient du partenaire. **ET passer `inclurePartenaires: true` à `useAthleteSearch`** (→ `p_inclure_partenaires: true` à la RPC) — dans le MÊME lot que le libellé, jamais avant : sans libellé, un athlète noté par le partenaire seul remonterait dans « 4+ étoiles » avec 0 étoile affichée. |
| `components/shared/MonParcoursMobile.tsx` (profil athlète mobile) | Section en lecture seule, comme `app/athlete/profil`. |
| Portail partenaire mobile | Aucun écran fiche partenaire mobile repéré ; le bouton « Évaluer » (`EvaluerAthleteModal`) sera à porter si le portail partenaire passe au mobile. |

## Comportement des binaires DÉJÀ publiés, d'ici là

- `recruiter_search_athletes.cote_globale` garde son sens (coach seul) : aucune note partenaire
  ne s'affiche sans libellé sur un vieux binaire.
- Le filtre « 4+ étoiles » et le tri par cote ne tiennent compte du partenaire QUE si
  l'appelant envoie `p_inclure_partenaires = true` (16e paramètre, `DEFAULT false`). Les
  binaires publiés ne l'envoient pas : leur résultat est identique à celui d'avant W2
  (prouvé en local : `equivalence-avant-w2.sql`, 16 appels × 2 paliers, empreintes
  identiques avant/après W2 avec une note partenaire sur chaque athlète ACTIF). Seule la
  page web `/recruteur/recherche` envoie `true` aujourd'hui. **Le lot mobile devra envoyer
  `true`** (ligne `RecruteurRechercheMobile` ci-dessus).
- Le tableau de bord recruteur (web et mobile, « nouveaux ») n'envoie pas le paramètre :
  cote du coach seule, comme avant.
- Hors périmètre W2 (non modifiés) : favoris, pipeline, tableau de bord recruteur,
  `recruiter_athlete_cards`, roster coach (filtre « 4+ » client, cote coach seule),
  newsroom « 5★ » (décision BP en attente).
