# Lot D4 — recruteur universitaire dans l'app mobile (1.4.6) : liste complète (2026-10-28)

À livrer DANS la 1.4.6, avec C2 (cégep côté athlète). Règle : l'interrupteur `lancement_universitaire` ne passe à
ON qu'après la publication de la 1.4.6 (iOS et Android) et la mise en place des points 6 et 7.
Rien de la base ne change : tout ce qui suit est du code mobile (Capacitor), avec ce que le web a déjà (D2b, D3b, D3d).

## 1. Inscription du recruteur universitaire
- `RolePickerMobile` / `SignupMobile` : carte « Recruteur universitaire ». Sous OFF, grisée « Recruteur universitaire
  — bientôt disponible », non cliquable ; sous ON, sélectionnable (lecture `lireLancementUniversitaire`).
- Inscription par courriel : stash `RECRUTEUR` + `universitaire` (`stashSignupRole`), puis
  `claim_signup_role('RECRUTEUR', 'universitaire')` au premier écran connecté. Le trigger d'inscription ne pose pas
  ce contexte. Refus de la base sous OFF → message « Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive
  bientôt. »
- Google / Apple (`SocialButtonsMobile`, `OAuthDeepLinkHandler`, `RoleGateMobile`) : même stash, même claim.
- `RecruiterOnboardingMobile`, branche universitaire, sur le modèle du web :
  - étape Université : RPC `universites_inscription` ;
  - étape Programme : RPC `equipes_universite_inscription`, filtrée sur le sport du profil ;
  - étape responsable : libellés « université » (« Cette université n'a pas encore de responsable… ») ;
  - confirmation : ligne « Université » ;
  - `finish_recruiter_onboarding` avec l'id venu de la RPC (jamais de relecture par nom) ; messages
    `INVALID_UNIVERSITE`, `INVALID_TEAM`, universités fermées (`lib/auth/recruteurUniversitaire.ts`).

## 2. Portail mobile du recruteur universitaire (`users.context = 'universitaire'`)
- `MorePanel` : pas de « Ma page » ; section « Gestion université » au lieu de « Gestion CÉGEP » (note : la gestion
  se fait sur le web — Recruteurs, Réassignation).
- Garde des pages fermées (`pageFermeeUniversitaire`) : Ma page, Mon CÉGEP, Stats, Recrues → tableau de bord.
- `RecruteurDashboardMobile` : pas de tuile « Athlètes qui te ciblent » (`useCiblesSurMonCegep` la coupe déjà).
- `RecruteurRechercheMobile` : option Type « Collégial » offerte (pas de `sansCollegial`), promotions « Secondaire ou
  Cégep AAAA », pas de filtre « Te ciblent » ni « Programme offert chez nous ».
- `RecruteurCalendrierMobile` : Type avec « Collégial », promotions « Secondaire ou Cégep AAAA ».
- `CarteMatchsMobile` : défaut commun (Secondaire + Civil), rien à changer.
- Sous-titre du profil : « Recruteur universitaire — <université> ».
- Partout : « recruteur universitaire » / « recruteur collégial », jamais « recruteur » seul dans un nouveau texte.

## 3. Le nom de l'université chez l'athlète et le coach (Q4, après D3d en prod)
- Liste des messages de l'athlète et conversations du coach : déjà branchées, crochets partagés
  (`useAthleteConversations`, `useCoachConversations`, `useCoachThreadContext`, D3d).
- `AthleteMessagesThreadMobile` : à brancher sur `ecoles_recruteurs` (même règle que `app/athlete/messages/[id]`).

## 4. Listes d'écoles
- Les listes partagées (`useSchoolsList`, `loadSchools`) excluent déjà les universités (D3b). Vérifier les copies
  mobiles de la recherche d'école (C2) : `.neq("type", "UNIVERSITE")` partout où la liste est ouverte.

## 5. Catégorie « Universitaire »
- Déjà dans la liste canonique (`lib/config/categories.ts`, D3b) : rien à faire si le mobile lit le même module ;
  vérifier les filtres mobiles qui auraient une liste maison.

## 6. Version minimale (Q7 — décision BP 2026-10-28)
- Pas de version minimale propre aux recruteurs universitaires.
- Au lancement (passage à ON) : la version minimale COMMUNE (`min_version_ios` / `min_version_android`,
  `lib/config/versionGate.ts`) passe à 1.4.6 pour tout le monde (écran « Mets ton app à jour » de la 1.4.5).

## 7. Avant ON (hors mobile, rappel)
- Textes Loi 25 tranchés et publiés (avis aux athlètes et, à trancher, aux parents des moins de 18 ans ; ligne dans la
  politique de confidentialité) — `docs/cegep-lot-d/D3-TEXTES-LOI25.md`.
- Web D3d (nom de l'école du recruteur dans les messages) : fusionné main c3ba485c, à promouvoir.

## 8. Essais à prévoir (émulateur, comptes locaux)
- OFF : carte grisée, claim refusé, aucun cégépien visible.
- ON : inscription complète (courriel et Google), portail adapté, recherche = tous les athlètes plus les cégépiens,
  messages athlète / coach avec le nom de l'université.
- Recruteur collégial mobile : inchangé (régression).
- 1.4.5 face au plancher 1.4.6 : écran de mise à jour.

## Ajouts du lot D5b (2026-10-28)
- « Ma page » rouverte au recruteur universitaire (lib/auth/recruteurUniversitaire.ts, partagé web et appli) : dans
  l'appli, l'entrée « Ma page » du panneau Plus renvoie au web (MaPageMobile), comme pour le cégep. À vérifier dans la 1.4.6.
- Page publique universitaire : web seulement (/universite/[école]) ; dans le bundle Capacitor la route rend un renvoi
  vers le web. Q4 : RPC de lecture sous ON + rendu natif (ProgramPageMobile) à faire dans la 1.4.6.
