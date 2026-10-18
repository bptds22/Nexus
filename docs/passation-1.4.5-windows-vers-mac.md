# Passation 1.4.5 — Windows vers Mac (18 octobre 2026)

Branche `fix/1.4.5-recruteur`. Tout le code de la 1.4.5 est commité et poussé. Rien n'est appliqué en prod.

## État

- Fait : migration carte corrigée, P1 à P6 (P6 réduit + portail partenaire natif dans l'appli),
  rapprochement partenaire (le partenaire décide), C1 à C5.
- Android : AAB versionCode 22 construit sur Windows (md5 `460def2fdfa91d7f67f582387bd69f2f`).
- iOS : `CURRENT_PROJECT_VERSION = 24`, `MARKETING_VERSION = 1.4.5` déjà dans le projet. Le build iOS
  reste à faire sur le Mac.
- Contrôles sur Windows : `npm test` 727 / 0 ; `npm run build` OK ; `npm run build:mobile` OK ;
  `test:visuel` 26 réussis, 1 sauté. Rien n'a été vu sur un vrai téléphone.

## Ce qui ne voyage pas par git

- `.env.local` (Supabase de PROD) : déjà copié dans `~/dev/nexus-145` sur le Mac ; à copier dans le
  dossier où la branche est extraite. `build:mobile` met dans l'appli le `.env.local` présent : il doit
  pointer sur le cloud (`nrloizyemulbhujrqhgx`), jamais sur une base locale.
- `ios/App/App/public` (sortie de `cap sync`) : ignoré par git, régénéré par les commandes ci-dessous.
- `android/keystore.properties` : sans objet pour iOS.

## Commandes sur le Mac

```sh
cd ~/dev/nexus-145            # ou le dossier de travail de la branche
git fetch origin
git checkout fix/1.4.5-recruteur
git pull --ff-only
npm ci
npm run build:mobile
npx cap sync ios
npx cap open ios              # Xcode : schéma App, appareil réel, Product > Archive
```

Vérifier dans Xcode : Version 1.4.5, Build 24.

## Migrations à appliquer en prod (par BP, dans cet ordre)

1. `20261017120000_badges_partenaires_athletes_lot`
2. `20261017130000_carte_etablissement_modifiable`
3. `20261017140000_non_contact_retrait_partenaire`
4. `20261018100000_rapprochement_partenaire`

Sans elles, l'appli fonctionne : les lectures nouvelles (badges par lot, correspondances partenaire)
retombent sans erreur visible.

## À tester en priorité sur l'iPhone

- Portail partenaire (nouveau rendu natif) : Accueil, Recherche, Mes évaluations, Mes athlètes
  (menu ⋮, confirmations, « + »), fiche (⋮ → télécharger, évaluer), transitions entre onglets,
  marge sous la barre d'onglets.
- Inscription athlète : choix Oui / Non obligatoire pour la visibilité partenaires.
- Coach : création d'athlète (« Requis » en rouge, validation par étape) ; page d'équipe (Réactiver,
  « Créer un nouvel athlète » avec l'équipe déjà choisie).
- Pastilles de notification : retour d'arrière-plan, lecture d'un message.
- « Envoyer par texto » (partenaire) : Messages s'ouvre avec le texte, sans numéro.

## Restes à trancher (BP)

- C2 : statistiques « Mon cégep », tuiles relances / visites, quota « 48 / 50 cartes actives ».
- Chiffre sur l'icône de l'appli (compte côté serveur, send-push).
- Écrans partenaire du menu « Plus » (Newsroom, Tendances, Classements, Téléchargements, Mon profil) :
  en-tête natif, contenu encore web → registre 1.4.6.
