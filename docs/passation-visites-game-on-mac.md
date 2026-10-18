# Passation — visites, Game On, Retiré, réseaux sociaux — Windows vers Mac (18 octobre 2026)

Branche `feat/visites-mode-match`, partie de `fix/1.4.5-recruteur` (1d6fd407). Elle contient TOUTE la 1.4.5
plus : le correctif NLS, les détails de visite, le mode match « Game On » (couleurs des chandails), la
barre recruteur Accueil · Calendrier · Game On · Messages · Plus, « Retiré » qui ne supprime plus
(raison obligatoire), et les profils de réseaux sociaux de l'athlète. Rien n'est appliqué en prod.

## 1. Migrations à appliquer en prod AVANT la démo (par BP, psql, dans cet ordre)

Si la 1.4.5 n'est pas encore en prod, d'abord ses 4 migrations :

1. `20261017120000_badges_partenaires_athletes_lot`
2. `20261017130000_carte_etablissement_modifiable`
3. `20261017140000_non_contact_retrait_partenaire`
4. `20261018100000_rapprochement_partenaire`

Puis les deux nouvelles :

5. `20261018120000_visites_details` — détails de visite + flux d'agenda.
6. `20261018130000_mode_match` — Game On.
7. `20261018140000_retrait_garde_la_carte` — « Retiré » garde le dossier + raison ; carte des matchs sans les retirés.
8. `20261018150000_athlete_reseaux_sociaux` — Facebook, TikTok, LinkedIn ; le partenaire voit les réseaux sociaux.

Chacune a ses gardes (refuse si déjà appliquée, vérifie les ACL) et son rollback dans `supabase/rollback/`.
Commande type (voie psql habituelle) :

```sh
psql "host=aws-1-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nrloizyemulbhujrqhgx sslmode=require" \
  -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261018120000_visites_details.sql
```

Sans les migrations 5 à 8, l'appli ne plante pas : « Détails » est caché, Game On dit « arrive bientôt »,
« Retiré » dit « Mise à jour requise côté serveur » (jamais de suppression), les fiches s'affichent sans
réseaux sociaux.

**Avant la migration 8 en prod : décision BP sur le texte de consentement partenaire** (il ne nomme ni
les vidéos ni les réseaux sociaux).

## 2. Build iOS sur le Mac

```sh
cd ~/dev/nexus-145
git fetch origin
git checkout feat/visites-mode-match
git pull --ff-only
npm ci
npm run build:mobile          # .env.local doit pointer sur la Supabase de PROD (nrloizyemulbhujrqhgx)
npx cap sync ios
npx cap open ios              # Xcode : schéma App, iPhone branché, Run (▶) pour la démo
```

Le projet est à Version 1.4.5, Build 24. Pour un envoi TestFlight, monte le Build (25) dans Xcode :
le 24 est réservé à la 1.4.5.

## 3. À tester en démo

- **Game On** (menu « Plus » de l'appli recruteur, compte Pro) : choisir un match du jour ou « Autre match »,
  noter #16 / #1 en alternance, mode avion pendant quelques notes puis retour du réseau (« Tout est envoyé »),
  deuxième recruteur de la même unité sur le même match (notes signées), « Terminer », « Trier mes notes »
  (Lier à une carte, Créer une carte, Garder sans lier).
- **Visites** : calendrier → « Détails » sur une visite → responsable (collègue ou nom tapé), format, adresse ou
  lien Zoom, note ; vérifier ensuite l'événement dans Google / Outlook (flux d'agenda) : lieu et description.
- **NLS** : inscription athlète ou coach, club « No Limits Showcases » → chaque équipe se lit
  « NOM — Catégorie · Division · Genre », sans « No Limits Showcases » répété.
- **Retiré** : processus (web et appli) → retirer un joueur → « Pourquoi ? » (Pas intéressé, Pas le niveau,
  Erreur / pas scouté, Autre) → il reste dans la colonne / l'onglet « Retiré » avec sa raison ; remettre
  dans le processus en choisissant une étape ; retirer un favori → même fenêtre.
- **Réseaux sociaux** : profil athlète → « Réseaux sociaux », taper `@pseudo` → le lien se construit ;
  fiche recruteur et partenaire → rangée de logos.
- **Barre du bas recruteur** : Accueil, Calendrier, Game On, Messages, Plus (Recherche et Mon processus dans Plus).
