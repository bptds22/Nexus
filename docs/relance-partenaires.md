# Relance des parents — visibilité partenaires

Construite le 2026-09-29 sur GO BP (construction seulement). **Aucun courriel
n'est parti. Rien n'est en prod.** Registre : `fast-follow-1.4.2.md` §44, §46, §48.

## Qui reçoit

Le **parent** d'un athlète mineur (14–17 ans) ACTIF, non visible des
partenaires, à qui la question n'a jamais été posée. Règle (fonction
`relance_partenaires_cibles`) :

- mineur 14–17, `status = 'ACTIF'`, `partner_visibility_opt_in = false` ;
- aucune trace « oui » (metadata ou `privacy_preferences`) ;
- aucun choix déjà journalisé (`consent_audit_trail`, clé `image_partenaire`) ;
- courriel parent plausible, pas désabonné, pas déjà relancé pour la campagne ;
- **exclus : les inscrits par courriel passés par l'écran parental** (ils ont
  vu la case — décision BP). Restent les inscrits Google/Apple et les cas isolés.

Relevé prod du 2026-09-29 avec cette règle : **33 parents** (12 Apple, 20
Google, 1 compte courriel créé hors de l'écran parental). Deux autres cibles
n'ont pas de courriel parent : injoignables.

## Ce que fait le parent

Courriel → bouton « Donner ma réponse » → `/consentement-partenaires?t=…` (sans
connexion) → **J'accepte** / **Je refuse**. Les deux réponses sont journalisées
(`GRANTED` / `REFUSED`, `acting_role = 'PARENT_LIEN'`, `policy_version`, IP,
empreinte du courriel). Lien à usage unique, 60 jours. Si l'athlète a eu 18 ans
entre-temps, le lien est refusé (c'est à lui de décider). Ne rien faire ne
change rien.

## Sécurité

- Jeton aléatoire 32 octets, stocké **haché** (sha256) ; usage unique garanti
  en base (UPDATE conditionnel).
- Toutes les fonctions sont `service_role` seulement : la page et les routes
  web les appellent côté serveur. Gates d'ACL par comparaison complète.
- Désabonnement : jeton HMAC sur l'athlete_id, préfixe `desabonnement-parent:v1:`
  (jamais interchangeable avec celui d'un compte) ; registre
  `parent_courriel_desabonnements` par empreinte, aucune adresse en clair.
- Aucun GET n'écrit (les messageries ouvrent les liens).

## Preuves locales (2026-09-29)

- SQL, transaction annulée : `anon` et `authenticated` refusés sur les 6
  fonctions et les 3 tables ; cycle complet sous `service_role` (réserver,
  lire, accepter, second clic → `deja_utilise`, refuser, expiré, majeur, jeton
  inconnu, désabonnement idempotent qui exclut, `ECHEC` qui libère).
- Rollback testé, réapplication identique.
- Web, Playwright contre la base locale : aperçu (boutons inactifs), lien
  valide → J'accepte → fiche éligible + journal ; revisite → « déjà
  enregistrée » ; rejeu du POST → `deja_utilise` ; désabonnement (formulaire,
  un clic RFC 8058 → 200, jeton faux → 400, GET → 405).
- **Non exécuté** : la fonction Deno (pas de Deno local) — le gabarit a été
  rendu sous Node (échappement vérifié).

## Mise en prod — chaque étape sur GO de BP

1. Migration `20260929035825_relance_partenaires_parents` (`apply_migration`),
   **après** `20260929034823_set_my_partner_visibility`. Vérifier le NOTICE
   « ACL exactes » et `select count(*) from relance_partenaires_cibles('partenaires_parents_v1')`
   sous service_role ≈ 33.
2. Secrets Supabase : `RELANCE_PARTENAIRES_SECRET` (nouveau, dédié). Déjà
   présents : `DESABONNEMENT_SECRET` (même valeur que Vercel),
   `RELANCE_TEST_DESTINATAIRES`, `RESEND_API_KEY`, `APP_URL`.
3. Web → `main` : `/consentement-partenaires` et `/desabonnement-parent`
   doivent être EN LIGNE avant qu'un seul lien parte.
4. Déployer `send-relance-partenaires`.
5. **Test** (écrit seulement à la liste blanche, lien `?t=apercu`, aucun
   consentement possible) :
   ```bash
   F=https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-relance-partenaires
   H=(-H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "x-relance-secret: $RELANCE_PARTENAIRES_SECRET" -H "Content-Type: application/json")
   curl -s "${H[@]}" -d '{"mode":"test","a":"bptds22@gmail.com"}' $F
   ```
6. **Aperçu** : `{"mode":"apercu","campagne":"partenaires_parents_v1"}` → le
   nombre exact.
7. **Envoi — GO séparé de BP, avec le nombre recopié** :
   `{"mode":"envoi","campagne":"partenaires_parents_v1","confirmer":"ENVOYER <nombre>"}`.

Une ligne restée `RESERVE` bloque ce parent (voulu). La libérer :
`update relances_partenaires set statut='ECHEC', erreur='libéré à la main' where id='…'`
— le jeton associé reste valide ; en supprimer la ligne dans
`consentement_partenaire_jetons` si le courriel n'est jamais parti.
