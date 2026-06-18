# Trello (mobile)

## Pourquoi cette app

Trello mobile est LA référence du kanban sur petit écran. Critique pour refondre `/recruteur/pipeline` — la page identifiée comme cassée dans l'audit visuel mobile (overflow horizontal franc, kanban 6 colonnes inutilisable). Trello résout exactement ce problème.

## Écrans capturés

(aucun pour l'instant — drop tes screens ici et annote ci-dessous)

- screen-name.png : ce qui me plaît dessus (1 ligne)

## Patterns à reprendre

- **Une colonne à la fois** : swipe horizontal entre colonnes (snap au centre)
- Titre de colonne fixe en haut avec compteur de cards
- Card simple : titre + 2-3 metadata (labels, due date) + thumbnail si visuel
- Drag & drop pour déplacer une card entre colonnes (long press)
- "Add card" CTA toujours en bas
- Toggle list/board view

## Patterns à éviter

- Trop d'options de personnalisation (labels colorés, custom fields) — Nexus a 6 stages prédéfinis
- Power-ups / intégrations — pas applicable
- Vue calendrier — hors scope pipeline recruteur
