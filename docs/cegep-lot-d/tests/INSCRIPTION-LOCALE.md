# Tester l'inscription en local (lot E7)

Base **locale** seulement (pile Docker de l'arbre partagé). Rien ne touche le cloud.

## 1. Préparer la pile
1. `npx supabase start` dans `C:\Users\bptds\Documents\Nexus` (si elle ne tourne pas déjà).
2. En local, la confirmation du courriel est **désactivée** (`enable_confirmations = false` dans
   `supabase/config.toml`) : le compte est ouvert dès la fin du formulaire.
3. Les courriels partis en local (consentement parental, invitations) arrivent dans **Mailpit** :
   http://127.0.0.1:54324.

## 2. Allumer les interrupteurs
`node docs/cegep-lot-d/tests/preparer-e2e-local.mjs` (depuis le worktree) met `lancement_collegial` et
`lancement_universitaire` à ON et crée les 4 comptes de test (`uni@`, `collegial@`, `cegep@`, `secondaire@d.local`,
mot de passe `NexusLotD-2026!`). `--off` remet les deux interrupteurs à OFF, `--retirer` enlève tout ce que le script a créé.

## 3. Lancer le web
`sh docs/cegep-lot-d/tests/lancer-local.sh` (dev, port 3110) ou `sh docs/cegep-lot-d/tests/lancer-local.sh build`
(build de production). `PORT=3111` pour changer de port. Le script reprend la clé MapTiler de l'arbre partagé :
la carte s'affiche en local au lieu de « Invalid key ».

## 4. S'inscrire comme cégépien
1. http://localhost:3110/auth → **Je suis le NEX** (athlète).
2. Prénom, nom, courriel inventé (ex. `test1@d.local`), date de naissance (14 ans ou plus), mot de passe.
3. **Tu joues pour…** : sous `lancement_collegial` ON, le premier choix se lit **« École secondaire ou cégep »**
   (OFF : « École secondaire »).
4. Consentements, puis (moins de 18 ans) courriel du parent : le courriel de consentement est dans Mailpit.
5. Onboarding : choisir un cégep dans le sélecteur d'école (les cégeps n'y sont que sous `lancement_collegial` ON),
   puis le sport et l'équipe.
6. Sous `lancement_universitaire` ON, le cégépien voit « Trouver mon université », « Ta ligne du temps vers
   l'université », et son profil n'affiche ni « Programme CÉGEP visé » ni « Préférences CÉGEP ».

## 5. Nettoyer
Les comptes créés à la main (étape 4) ne sont pas retirés par `--retirer` : les supprimer dans Studio
(http://127.0.0.1:54323 → Authentication) ou repartir d'une base locale neuve.
