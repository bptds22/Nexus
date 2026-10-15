# Invitations coach → joueur sans mention du coach (2026-10-15)

Branche `feat/invitations-sans-coach`, **local seulement**. Rien en prod (attend le GO de BP).

## Ce qui change

| Message | Avant | Après |
|---|---|---|
| Courriel de réclamation (`send-invitation`, trigger `notify_invitation_email`) | « Ton coach t'a invité sur Nexus » ; **nom du coach — école du coach** ; « Sois le NEX » | Objet et titre « Ton profil d'athlète t'attend sur Nexus » ; la phrase selon le **nombre réel** de recruteurs ; présentation de Nexus ; « L'équipe Nexus » ; bouton « Réclamer mon profil » ; pied : pourquoi ce courriel, lien vers nexussports.ca, 30 jours, « ignore si ce n'est pas toi ». Le trigger ne transmet plus que `email`, `nb_recruteurs`, `claim_token`. |
| Courriel d'invitation d'équipe (`send-team-invitation`) | « Un coach t'invite dans son équipe » ; **nom du coach** | Objet « Invitation à rejoindre une équipe sur Nexus » ; titre « Tu es invité à rejoindre une équipe » ; équipe — école, détails ; pied « pourquoi ce courriel / nexussports.ca ». `coach_name` n'est plus transmis ni lu. |
| Notification in-app `TEAM_INVITATION` | « Un coach t'invite à rejoindre son équipe » | « Invitation à rejoindre une équipe » (nouvelles notifications ; les anciennes gardent leur titre). |
| Page `/claim` (lien du courriel) | « Ton entraîneur a préparé ton profil… » | La même phrase que le courriel, selon le nombre réel. |

Le nombre : `recruteurs_suivant_athlete(fiche)` — recruteurs **distincts**, compte RECRUTEUR **actif**,
qui ont la fiche en favori, dans leur pipeline, ou dont une carte prospect a été **fusionnée** avec
elle (fusion active ou définitive). Un rapprochement seulement **proposé** ne compte pas (on ne sait pas
encore si c'est lui) ; une fusion annulée non plus. Jamais qui. La page `/claim` l'obtient par
`invitation_recruteurs_suivent(jeton)`, qui ne répond que pour un jeton d'invitation valide.

## Textes finaux

**Phrase (courriel de réclamation, aperçu de la boîte de réception, page /claim)**
- 0 : « Ton profil d'athlète est prêt sur Nexus, là où les recruteurs de cégep cherchent leurs prochains joueurs. Réclame-le gratuitement. »
- 1 : « 1 recruteur de cégep suit déjà ton profil sur Nexus. Réclame-le pour qu'il voie tout ce que tu as à montrer. »
- n ≥ 2 : « n recruteurs de cégep suivent déjà ton profil sur Nexus. Réclame-le pour qu'ils voient tout ce que tu as à montrer. »

(Accord au singulier pour 1 : « suit », « qu'il voie ».) Valeur absente, négative ou non entière →
ce qu'on sait (0, ou l'entier inférieur) ; jamais arrondi vers le haut.

Aperçus complets (HTML, texte brut, images bureau et mobile) : `apercus/`.

## Pas changé ici — à trancher

Écrans **in-app** (pas des messages envoyés) qui nomment encore le coach :
- carte « Invitations en attente » : « Invité par {nom du coach} » (`app/athlete/notifications/_components/PendingInvitations.tsx`) ;
- fenêtre « On a trouvé un profil pour toi » : « Créé par ton coach », « coach {nom} » (`components/auth/ClaimProfileModal.tsx`) ;
- code d'équipe : « Ton entraîneur te l'a donné… », « Demande un nouveau code à ton entraîneur » (`JoinCodeField`, `/join/[code]`) ; ces codes ne sont générés que par l'admin aujourd'hui.

## Preuves (local)

- `tests-invitations.sql` → `tests-invitations-resultats.txt` : **26/26**, transaction annulée. Le contenu
  réellement transmis aux fonctions d'envoi est lu dans la file de pg_net (faux secret dans la
  transaction, jamais validée : rien ne part). 0 / 1 / 2 / 3 recruteurs, distincts, proposition et
  fusion annulée exclues, recruteur désactivé exclu ; ni coach, ni école du coach, ni recruteur dans ce
  qui part ; /claim par jeton seulement (inconnu ou expiré → rien) ; droits complets.
- `lib/invitations/__tests__/messageRecruteurs.test.ts` : 8/8 (phrases, arrondi, copie identique côté
  fonctions d'envoi, aucun « coach / entraîneur » dans les deux courriels rendus).
- `npm test` 467/467 (1 sauté) ; `tsc` 177 (176 + 1 : le nouvel import du gabarit Deno, même type
  d'erreur que tous les fichiers de `supabase/functions`) ; `next build` OK ; aperçus et page /claim en
  navigateur sans interface, aucune erreur JavaScript.

## Ordre en prod (sur GO)

1. Déployer les fonctions `send-invitation` et `send-team-invitation` (elles acceptent l'ancien et le
   nouveau contenu ; elles ne lisent plus le coach même s'il arrive encore).
2. Migration `20261015114923_invitations_sans_coach.sql` par le connecteur (lot prouvé, comme D1).
3. Fusion dans main et push (la page /claim appelle la nouvelle fonction).
