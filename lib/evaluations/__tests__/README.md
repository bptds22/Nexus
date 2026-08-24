# Suites — `lib/evaluations/grilles.ts`

```
npm test
```

48 assertions, 4 suites, **aucune dépendance ajoutée**.

## Pourquoi ces suites existent

`grilles.ts` est la source de vérité des 14 libellés d'évaluation pour **11 écrans** :
les 3 formulaires de saisie coach, les 5 surfaces d'affichage, le formulaire admin
et les 2 surfaces de suggestion athlète. Une régression dessus casse toutes les
surfaces d'évaluation d'un coup, et rien d'autre ne l'attraperait — le dépôt n'a
pas de CI qui exécute l'application.

## Ce que chaque suite couvre

| fichier | ce qui casserait sans elle |
|---|---|
| `grilles.resolution.test.ts` | libellés fixes qui bougeraient avec la grille ; `grille_id` figé à tort ; dégradation silencieuse quand le référentiel est injoignable |
| `grilles.groupes.test.ts` | retour au découpage en 3 groupes (« Protection de passe » sous « Caractère ») ; frontière fixe/variable rendue visible ; ordre à plat divergeant de l'ordre groupé |
| `grilles.regle-lecture.test.ts` | `grille_id > position > GENERIQUE` inversée ; résolution partenaire par nom **sans** filtre sport — fausse une fois sur six, 18 abréviations étant partagées entre sports |
| `grilles.champ.test.ts` | rupture de l'app mobile **1.2 en magasin**, qui émet des libellés FR |

La dernière est la plus sensible. `CHAMPS_DU_TRIGGER` y recopie les 14 littéraux
du `CASE` de `apply_approved_suggestion` relevés dans le corps **déployé**
(`pg_get_functiondef`, 2026-08-24). Si une assertion y tombe, vérifier d'abord la
base : c'est probablement le trigger qui a changé, pas le test.

## Comment ça tourne sans dépendance

Node 22.15 : `--experimental-strip-types` exécute le TypeScript directement.
Il restait l'alias `@/` de `tsconfig.json`, que Node ne connaît pas —
`alias-hooks.mjs` (enregistré par `register-alias.mjs`) le résout vers la racine
et ajoute l'extension qu'ESM exige.

`@/lib/supabase/client` est redirigé vers `supabaseClient.stub.ts`. Les suites ne
couvrent que des **fonctions pures** ; `grilles.ts` importe le client au niveau
module pour le défaut de `loadGrilles`, mais aucun test ne l'appelle. Charger le
vrai client ferait entrer `@supabase/ssr` et la lecture des variables
d'environnement dans une suite qui n'en a pas besoin.

**Conséquence à connaître : `loadGrilles` n'est PAS couvert.** Le chargement, la
mémorisation de la promesse et la journalisation d'un référentiel vide restent à
vérifier à la main. Tout ce qui est en aval — résolution, groupes, libellés,
traduction du champ — l'est.

## Ajouter une suite

Un fichier `*.test.ts` dans ce dossier suffit ; le glob de `npm test` le prend.
Le jeu d'essai de `fixtures.ts` reproduit des lignes réelles de
`evaluation_grilles` (codes et libellés relevés en base) : tester des libellés
inventés ne dirait rien du comportement en production.
