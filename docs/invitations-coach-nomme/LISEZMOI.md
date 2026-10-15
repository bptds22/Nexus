# Invitations : le coach du secondaire ou du civil est nommé (correction BP, 2026-10-15)

Branche `feat/invitations-coach-nomme` (depuis main `947b6332`). Migration `20261015125824_invitations_coach_nomme.sql`.

**Règle RSEQ, précisée** : les recruteurs, les cégeps et les coachs d'équipes collégiales ne sont jamais
nommés à un athlète. Un coach du **secondaire** ou du **civil** peut l'être. Le nombre de recruteurs reste
le seul fait sur eux, jamais lesquels. Le désabonnement est conservé.

## La détection (en base, une seule)

`coach_nommable(coach)` rend `{ nom, ecole }` seulement si le compte est un COACH, que **son école**
(`users.school_id`) est SECONDAIRE ou LIGUE_CIVILE, et qu'il n'entraîne **aucune** équipe collégiale ou
d'école inconnue. Sinon null : collégial **ou indéterminé** = jamais nommé. Relevé prod : 8 coachs
secondaires, 8 civils, 14 sans école (jamais nommés). Serveur seulement (postgres, service_role).

## Ce qui change

| Message | Coach secondaire/civil | Coach collégial ou indéterminé |
|---|---|---|
| Courriel de réclamation | « {Coach} ({École}) a préparé ton profil sur Nexus. » puis la phrase du nombre | inchangé, aucun nom |
| `/claim` | même ligne (`invitation_coach_nomme(jeton)`, jeton valide seulement) | inchangé |
| Courriel d'équipe (équipe secondaire/civile) | « {Coach} t'invite à rejoindre cette équipe… » | « Tu es invité… » ; équipe collégiale : texte générique |
| Notification `TEAM_INVITATION` | « {Coach} t'invite à rejoindre {Équipe} » | « Invitation à rejoindre une équipe » |
| Carte « Invitations en attente » | « Invité par {Coach} » (`invitation_equipe_coach`, destinataire seulement) | aucun nom |

Non touché : `ClaimProfileModal` (chemin inatteignable sur le web, CLAUDE.md) et `/join` (codes générés par
l'admin, sans coach). Mobile : registre §93.

## Preuves (local)

- `tests-coach-nomme.sql` → `tests-coach-nomme-resultats.txt` : **32/32**, transaction annulée. Coach
  secondaire nommé, civil nommé, collégial jamais, sans école jamais, secondaire qui entraîne aussi une
  équipe collégiale jamais, recruteur jamais ; ce qui part réellement dans la file pg_net ; `/claim` et
  carte (destinataire seulement) ; équipe collégiale sans aucun nom ; désabonnement respecté ; droits complets.
- Tests unitaires (`lib/invitations/__tests__`) : phrase du coach, échappement HTML, courriels avec et sans
  coach, écrans. `npm test` 485/485 ; `tsc` 176 ; `next build` OK.
- `captures-resultats.txt` et `apercus/` (navigateur sans interface) : courriels (coach secondaire, civil,
  collégial ; équipe), `/claim` avec Marc (secondaire, nommé) et Luc (collégial, absent), carte avec trois
  invitations — seul Marc est nommé. Aucune erreur JavaScript.
- `prod/preuve-locale.txt` : garde fausse → tout annulé ; envoi séparé → arrêt avant écriture ; lot réel →
  OK ; 2ᵉ envoi refusé ; banc 32/32 sur la base issue du lot.

## Ordre en prod (sur GO)

1. Déployer `send-invitation` et `send-team-invitation` (elles acceptent les deux formes : sans coach
   transmis, elles n'en nomment aucun — pas de fenêtre de rupture).
2. `prod/lot-prod.sql` par le connecteur, en un appel ; vérification en lecture seule.
3. Fetch, intégrer origin/main, tests, fusion dans main, `origin/main..main`, push.
