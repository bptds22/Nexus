# notes-perso/

Notes manuelles de Bruno-Philippe : décisions architecturales, intuitions, brainstorms, questions ouvertes, comparaisons rapides, idées à creuser. Espace libre — pas de structure imposée.

## Convention de nommage

```
notes-perso/YYYY-MM-DD-sujet.md
```

- `YYYY-MM-DD` = date d'écriture de la note
- Slug court et descriptif, en kebab-case

Exemples :
- `notes-perso/2026-05-27-pourquoi-capacitor-pas-react-native.md`
- `notes-perso/2026-06-01-questions-pour-cody.md`
- `notes-perso/2026-06-10-strategie-deploiement-ios.md`

Pour les notes vivantes (sans date fixe), nom thématique direct accepté :
- `notes-perso/decisions-architecturales.md`
- `notes-perso/questions-ouvertes.md`

## Format attendu

Markdown libre. Frontmatter **optionnel** :

```markdown
---
date: 2026-05-27
status: draft | active | resolved | archived
tags: [auth, deployment]
---

# Sujet

(notes en vrac, bullet points, questions, hypothèses…)
```

Champ `status` utile pour distinguer :
- `draft` — note en cours
- `active` — décision en vigueur
- `resolved` — question tranchée (ajouter un lien vers la décision si elle vit ailleurs)
- `archived` — gardée pour historique mais plus pertinente

Pas de pression sur le format — privilégier la vitesse d'écriture, on nettoiera au moment de générer le `CAPACITOR_PLAYBOOK.md`.
