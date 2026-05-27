# Capacitor Knowledge Base — Nexus mobile

Référence permanente pour le projet de portage mobile (Capacitor + static export Next.js) du SaaS Nexus. C'est ici qu'on accumule la matière brute (skills, transcripts, notes, références) qui servira à construire la stratégie d'implémentation.

## Sous-dossiers

| Dossier | Rôle |
|---|---|
| [`skills/`](skills/) | Fichiers `SKILL.md` provenant de repos GitHub spécialisés Capacitor / Ionic / Next.js export. Un fichier par skill. |
| [`transcripts/`](transcripts/) | Transcripts de vidéos YouTube (tutos, talks, démos) convertis en markdown pour recherche et citation. |
| [`notes-perso/`](notes-perso/) | Notes manuelles de Bruno-Philippe — décisions, intuitions, brainstorms, questions ouvertes. |
| [`references/`](references/) | Liens externes, repos d'exemple, articles, threads. Pas de contenu inline — juste des pointeurs commentés. |

## Playbook synthétique (à générer)

Une fois ces quatre dossiers remplis, un `CAPACITOR_PLAYBOOK.md` synthétique sera généré à partir du contenu accumulé. Il vivra à :

```
docs/capacitor-knowledge/CAPACITOR_PLAYBOOK.md
```

Ce playbook condensera les décisions, conventions et étapes concrètes pour l'implémentation Capacitor — il sera la source vérité opérationnelle, alors que les sous-dossiers resteront la matière brute archivée.

## Lien associé

Audit initial du codebase Next.js pour la migration Capacitor : [`docs/capacitor-audit.md`](../capacitor-audit.md).
