# Vérification émulateur — lot mobile 1.4.5 (feat/mobile-145)

## 0. Avant la séance

1. **L'émulateur doit viser la base LOCALE.** `.env.local` de ce worktree pointe sur le CLOUD
   (prod) et un build mobile l'embarque tel quel. Lancer `dev:mobile` avec
   `NEXT_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321` et la clé anon locale
   (`npx supabase status` dans `C:\Users\bptds\Documents\Nexus`), puis `npm run cap:dev`
   (docs/mobile-dev-loop.md). Vérifier dans la console WebView l'URL Supabase avant tout geste.
2. **Migration locale** `20261016150000_partenaire_journal` : déjà appliquée en local.
3. **Données** : `node docs/emulateur-1.4.5/preparer-local.mjs` (crée), `--retirer` (retire tout).
   Comptes `*@emulateur.local`, mot de passe commun **`Emul-145-2026!x`**.
   ⚠ Écrit dans la base locale partagée (annoncé avant le geste) : +60 cartes dans l'unité
   Saint-Hyacinthe × Football — prévenir une autre session qui compte ces cartes.

## 1. Comptes et données, point par point

| # | Point à vérifier | Compte | Données |
|---|---|---|---|
| A2-1 | Onboarding Google : Prénom/Nom pré-remplis, obligatoires, plus de bandeau après | `e.athlete.google` | compte « Google » neuf, nom coupé « Léa-Rose / Tremblay Roy », à confirmer |
| A2-2 | Bandeau « Est-ce bien toi ? » : Oui, Corriger, rechargement | `e.athlete.aconfirmer` | fiche finie, nom à confirmer |
| A2-3 | Doublon à l'inscription (COMPTE) : avertissement, Continuer, Autre adresse → /auth | nouvelle inscription courriel, **Félix Doublon-Emul, 2008-03-03** | fiche `e.athlete.existant` |
| A2-4 | « Plusieurs sports » sous la grille ; suggestion `gmail.con` aux écrans 1 et 2 | nouvelle inscription | — |
| A2-5 | Assistant coach : courriel exact sans clic → invitation | `e.coach` | taper `e.athlete.existant@emulateur.local` en entier |
| A2-6 | Assistant coach : même identité, Voir sa fiche, Ce n'est pas lui | `e.coach` | **Noah Orphelin-Emul, 2008-04-04** (effectif) ; **Félix Doublon-Emul, 2008-03-03** |
| A2-7 | Liste coach : étiquette, « à réclamer »/« école » filtrés, « 1 fiche masquée » | `e.coach` | `e.athlete.aconfirmer` (à lui), `…aconfirmer.autre` (à e.coach.autre) |
| A6 | Filtres École/Club, Équipe, Type, clavier dans la recherche du menu, compteurs | `e.recruteur` | unité ≥ 1000 cartes (952 + 60) : volume, prospects et « Sur Nexus » |
| A6-vol | Ouverture et défilement de Mon processus à ≥ 1000 cartes, tranches | `e.recruteur` | idem |
| A7 | Bandeau, lien sur la carte, feuille côte à côte, Accepter / Refuser, Annuler la fusion | `e.recruteur` | une proposition (le script dit laquelle) ; refaire le script pour la 2e branche |
| A7-free | Démo gratuite : aucun bandeau | `e.recruteur.gratuit` | — |
| B1-1 | Onglets partenaire (Mes athlètes, Prospects visibles), panneau Plus, Déconnexion | `e.partenaire` | `peut_evaluer`, APPROVED |
| B1-2 | Garde : sans conditions → bienvenue, sans barre d'onglets | `e.partenaire.bienvenue` | conditions et mot de passe non posés |
| B1-3 | Partenaire suspendu : refus propres | `e.partenaire.suspendu` | SUSPENDED |
| B1-4 | Autre rôle sur /partenaire → son portail | `e.coach` | — |
| B1-5 | Newsroom, Tendances, Classements (filtres d'URL), Téléchargements, Carte des matchs | `e.partenaire` | athlètes admissibles locaux : Thomas Boucher, Alexis Caron |
| B1-6 | Fiche : placeholder, Évaluer, badges, Télécharger la carte (feuille, image non blanche) | `e.partenaire` | Thomas Boucher ; puis vérifier `partner_profile_views` / `partner_card_downloads` |
| B1-7 | Mes athlètes après une évaluation | `e.partenaire` | évaluer Thomas Boucher d'abord (B1-6) |
| B1-8 | Mon profil → page publique dans le navigateur intégré ; barre sur /college | `e.partenaire` | — |
| B1-9 | Mon parcours athlète : export de carte inchangé | un athlète à carte (ex. `e.athlete.existant`) | — |
| B2 | Créer/modifier (clavier), case 14 ans, **49e et 50e carte puis refus**, texto (feuille, lien `nexussports.ca/p/…`), copier, nouveau lien, révoquer, supprimer | `e.partenaire` | 48 cartes partenaire |
| B2-T | Terminées et « Voir sa fiche » | `e.partenaire` | ⚠ aucune carte terminée préparée : ouvrir un lien, le réclamer avec `e.athlete.existant` sur le web, puis confirmer |
| B3-1 | Recherche partenaire : filtres, saisie sans zoom, pagination | `e.partenaire` | — |
| B3-2 | Recherche recruteur : note partenaire + nom de l'organisation, « 4+ étoiles », tri | `e.recruteur` | après B1-6 (Thomas Boucher évalué, si le coach ne l'a pas coté) |

## 2. Après la séance

`node docs/emulateur-1.4.5/preparer-local.mjs --retirer` — retire comptes, fiches, cartes,
partenaires et rattachements créés. Les lignes de journal partenaire de la séance partent avec
le partenaire (ON DELETE CASCADE).

## 3. Banc local du vrai build (APK sans rechargement à chaud)

La base locale n'est joignable qu'en `http://127.0.0.1:54321`, et le vrai build refuse le HTTP en
clair (`cleartext: false`, `net::ERR_CLEARTEXT_NOT_PERMITTED`). Pour le banc local SEULEMENT, sur
autorisation de BP : `android:usesCleartextTraffic="true"` dans
`android/capacitor-cordova-android-plugins/src/main/AndroidManifest.xml` (généré, non suivi), puis
recompiler l'APK de test. À retirer dès la fin du banc (`npx cap sync android` ou à la main), puis
`gradlew clean`, et le prouver : `grep -rn usesCleartextTraffic android/` = aucun résultat.

**Le build de publication ne doit JAMAIS contenir usesCleartextTraffic. Vérifier par grep avant chaque bundleRelease.**
