---
name: journal-session
description: Écrire ou compléter le journal du jour (docs/journal/AAAA-MM-JJ.md) à la fin d'une session Nexus, et ajouter à docs/lecons.md toute façon de faire corrigée par BP. À appeler avant le rapport final de chaque session, ou quand BP dit « journal », « note la session » ou « fin de session ».
---

# Journal de session

## Quand l'appeler
- À la fin de chaque session, avant le rapport final à BP, même si la session a été courte.
- Quand un chantier change d'état (passe à « À tester », est bloqué ou terminé).
- Quand BP le demande.

## Étapes
1. Date du jour, heure de Montréal : `AAAA-MM-JJ`.
2. Ouvrir `docs/journal/AAAA-MM-JJ.md`. S'il n'existe pas, le créer avec le titre `# Journal — AAAA-MM-JJ`.
3. Pour chaque chantier touché pendant la session :
   - si la section `## <chantier>` existe déjà, la mettre à jour (garder les décisions déjà notées et ajouter les nouvelles) ;
   - sinon, l'ajouter à la fin du fichier.
   - Nom du chantier : le même d'une session à l'autre (par exemple « Partenaires W4b/W4c », « NLS basketball »). Reprendre le nom déjà utilisé dans les journaux précédents.
4. Format exact, sans changer les libellés :

   ```markdown
   ## <nom du chantier>
   - État : En cours | À tester | Prêt | Bloqué | Fait
   - Fait : une ou deux phrases
   - Reste : une ou deux phrases
   - Décisions de BP : liste courte, ou « aucune »
   - Migrations : appliquées en prod | en local seulement | aucune (nommer les fichiers de migration s'il y en a)
   - Branche : nom de la branche (et dossier worktree s'il n'est pas le dossier principal)
   ```

   Sens des états :
   - En cours = travail pas fini ;
   - À tester = BP doit tester ;
   - Prêt = testé, attend le GO de BP pour pousser ou appliquer ;
   - Bloqué = attend une décision ou un élément externe (dire lequel dans « Reste ») ;
   - Fait = poussé ou appliqué, rien ne reste.
5. Si BP a corrigé une façon de faire pendant la session, ajouter une ligne à `docs/lecons.md` : `- AAAA-MM-JJ — règle`. Une seule règle par ligne, et seulement si elle n'est ni déjà dans le fichier ni dans CLAUDE.md.
6. Relire le texte pour la Loi 25 : aucun nom de personne, courriel, téléphone ni UUID de personne. Écrire « un athlète », « le compte parent de test ».
7. Commiter le journal sur la branche du chantier, avec un `git add` fichier par fichier. Ne jamais pousser sans le GO de BP.
