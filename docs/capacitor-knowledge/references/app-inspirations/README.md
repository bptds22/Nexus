# App inspirations

Bibliothèque visuelle des apps mobiles dont on s'inspire pour refondre Nexus en mobile-first. Chaque sous-dossier correspond à une app observée — il contient des screenshots + un `notes.md` qui explique ce qui plaît et ce qu'il faut éviter.

## Workflow

1. **Capture** — Bruno-Philippe ouvre l'app sur son téléphone, prend les écrans qu'il trouve intéressants (un par écran, format PNG idéalement).
2. **Range** — drop les images dans le bon sous-dossier (`sorare/`, `strava/`, etc.). Si l'app n'a pas encore son dossier, créer un nouveau dossier kebab-case et son `notes.md` initial.
3. **Annote** — dans le `notes.md` du dossier, ajoute une ligne par screenshot : `- nom-fichier.png : ce qui me plaît dessus (1 ligne)`. Garde les phrases courtes — c'est de la matière brute pour mémoire.
4. **Réutilise** — quand on attaque une page mobile Nexus (ex: redesign `/recruteur/pipeline`), on lit les `notes.md` des apps pertinentes pour piocher des patterns.

## Convention de nommage

- Sous-dossiers : kebab-case minuscule, nom de l'app (`sorare/`, `nhl/`, `linkedin-recruiter/`)
- Screenshots : kebab-case descriptif (`profil-joueur-detail.png`, `feed-activite.png`)
- Date facultative en préfixe si plusieurs versions du même écran (`2026-05-27-profil.png`)
- PNG préféré (JPG accepté pour les screens reçus par Slack/SMS)

## Sous-dossier `_generic/`

Pour les patterns sans app spécifique (vu sur Dribbble, dans un blog Medium, dans une vidéo YouTube, etc.). Pas lié à une app maintenue.

## Voir aussi

- [INDEX.md](INDEX.md) — liste des apps en cours d'observation, par pertinence pour Nexus
- [../../CAPACITOR_PLAYBOOK.md](../../CAPACITOR_PLAYBOOK.md) — synthèse opérationnelle (à générer plus tard)
