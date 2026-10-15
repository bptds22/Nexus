# Invitations coach → joueur sans coach — règle RSEQ (2026-10-15)

Branche `feat/invitations-sans-coach`. Décisions BP du 2026-10-15.

**Règle absolue (RSEQ, périodes de non-contact)** : rien de ce que lit un athlète (courriel,
notification, page, écran) ne nomme un cégep, un recruteur, un coach de cégep ni un coach tout court,
ni ne permet de le deviner. Seul argument permis : le **vrai nombre** de recruteurs qui suivent le
profil, jamais lesquels. Une équipe n'est nommée que si c'est l'équipe **secondaire ou civile** du jeune.

## Ce qui change

| Message | Après |
|---|---|
| Courriel de réclamation (`send-invitation`, trigger `notify_invitation_email`) | Objet « Ton profil d'athlète t'attend sur Nexus » ; phrase selon le nombre réel de recruteurs ; « L'équipe Nexus » ; bouton « Réclamer mon profil ». Pied LCAP : raison, **« Ne plus recevoir ces courriels »** (jeton signé `a.<invitation>`), adresse postale. En-tête `List-Unsubscribe` (un clic). Le trigger transmet `email`, `nb_recruteurs`, `claim_token`, `invitation_id` — rien d'autre. |
| Courriel d'équipe (`send-team-invitation`) | Objet « Invitation à rejoindre une équipe sur Nexus ». Équipe — école et détails **seulement** pour une équipe SECONDAIRE ou LIGUE_CIVILE (la base envoie des chaînes vides sinon → texte générique « une nouvelle équipe »). Pied LCAP avec désabonnement du compte (`user_id`). |
| Désinscription respectée | Les deux triggers n'envoient **rien** si l'adresse est au registre `courriel_desabonnements_adresses` (empreinte, casse et espaces ignorés) ou si le compte est dans `courriel_desabonnements`. Courriel d'équipe : rien non plus pour une fiche sans compte (pas de lien de désabonnement possible). Les fonctions refusent d'envoyer (500) sans `DESABONNEMENT_SECRET` ≥ 32 caractères. |
| `/desabonnement` + `/api/desabonnement` | Acceptent le jeton `a.` : l'adresse est relue sur `athlete_invitations`, son empreinte inscrite au registre des adresses. |
| Notification `TEAM_INVITATION` | « Invitation à rejoindre une équipe ». |
| `/claim` | La même phrase que le courriel. |
| Carte « Invitations en attente » (web) | « Invitation de {Équipe} — {École} » + détails si SECONDAIRE/LIGUE_CIVILE ; sinon « Invitation à rejoindre une équipe », sans nom, école ni sport. Plus de « Invité par {coach} ». « Ton école et ton entraîneur changeront » → « Ton école changera aussi ». Même garde pour l'équipe actuelle et le message de succès. |
| « On a trouvé un profil pour toi » | « Ton profil a été préparé pour toi » ; plus de coach ; école seulement si secondaire/civile. |
| Code d'équipe (`JoinCodeField`, `/join/[code]`) | « Le code de ton équipe » ; plus d'entraîneur ; équipe, école et logo masqués si collégiale. |
| Mobile | Registre `docs/fast-follow-1.4.2.md` §93. |

Règle partagée : `lib/invitations/equipeNommable.ts` (miroir de la base).

## Preuves (local)

- `tests-invitations.sql` → `tests-invitations-resultats.txt` : **36/36**, transaction annulée (faux
  secret, file pg_net lue, rien ne part). Compte réel des recruteurs ; aucun coach ni recruteur dans ce
  qui part ; adresse désabonnée, compte désabonné → rien en file (témoin : ça repart après retrait) ;
  équipe SECONDAIRE nommée ; équipe CEGEP : nom, école, sport, catégorie, division, genre vides et
  noms absents ; fiche sans compte → pas de courriel d'équipe ; ACL complètes.
- `lib/invitations/__tests__/` (messageRecruteurs + equipeNommable) et `lib/courriel/__tests__/jetonDesabonnement` :
  règle RSEQ dans les deux courriels (aucun coach, cégep, adresse hors nexussports.ca), lien de
  désabonnement, texte générique pour une équipe collégiale, écrans web sans coach et branchés sur la règle.
- `preuve-desabonnement-resultats.txt` : jeton `a.` signé par le module des fonctions, accepté par la
  page, falsifié refusé, POST un clic → 200, adresse inscrite au registre.
- `npm test` 476/476 (1 sauté) ; `tsc` 176 (référence) ; `next build` OK.
- Captures headless (`apercus/`) : courriels (0, 1, 4 recruteurs ; équipe ; équipe collégiale), `/claim`,
  carte d'invitations (une collégiale, une secondaire). Aucune erreur JavaScript.
- `retrait-local.sql` : retrait local pour rejouer la migration.

## Ordre en prod

1. Déployer `send-invitation` et `send-team-invitation`. Entre ce déploiement et la migration, un
   courriel d'invitation serait refusé (l'ancien trigger n'envoie pas `invitation_id` / `user_id`) :
   fenêtre de quelques minutes.
2. Migration `20261015114923_invitations_sans_coach.sql` par le connecteur (lot prouvé, dossier `prod/`).
3. Fusion dans main et push.
