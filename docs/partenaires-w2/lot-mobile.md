# W2 — ce que le lot mobile devra reprendre (rien fait côté mobile : protocole web d'abord)

Le tronc partagé est prêt : `lib/evaluations/partenaire.ts` (lecture / contexte / écriture),
`coteAffichee()` dans `lib/queries/recruiter/useAthleteSearch.ts`.

| Surface mobile | À faire |
|---|---|
| `components/shared/AthleteRecruiterProfileBodyMobile.tsx` | Section « Évaluation de <organisation> » sous le rapport de l'entraîneur. Ce composant sert la fiche recruteur mobile, la fiche coach mobile (`viewer="coach"`) et l'aperçu athlète (`app/athlete/profil/apercu`). |
| `components/shared/RecruteurRechercheMobile.tsx` | Cartes : `coteAffichee(a)` à la place de `a.stars`, avec le nom de l'organisation à côté des étoiles quand la note vient du partenaire. |
| `components/shared/MonParcoursMobile.tsx` (profil athlète mobile) | Section en lecture seule, comme `app/athlete/profil`. |
| Portail partenaire mobile | Aucun écran fiche partenaire mobile repéré ; le bouton « Évaluer » (`EvaluerAthleteModal`) sera à porter si le portail partenaire passe au mobile. |

## Comportement des binaires DÉJÀ publiés, d'ici là

- `recruiter_search_athletes.cote_globale` garde son sens (coach seul) : aucune note partenaire
  ne s'affiche sans libellé sur un vieux binaire.
- Mais le filtre « 4+ étoiles » et le tri par cote sont serveur : un athlète noté par le
  partenaire SEUL y remonte, affiché avec 0 étoile sur un vieux binaire (honnête, mais
  surprenant). Disparaît avec la mise à jour mobile.
- Hors périmètre W2 (non modifiés) : favoris, pipeline, tableau de bord recruteur,
  `recruiter_athlete_cards`, roster coach (filtre « 4+ » client, cote coach seule),
  newsroom « 5★ » (décision BP en attente).
