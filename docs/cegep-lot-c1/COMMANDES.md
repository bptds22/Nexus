# Lot C1 cégep — inscription des athlètes collégiaux (web) : base, commandes psql, tests écran

Web derrière l'interrupteur `lancement_collegial` (C0, en prod, OFF). Interrupteur OFF : le web reste
celui d'aujourd'hui pour l'inscription. Interrupteur ON : les cégeps s'ouvrent.

## La base : deux migrations, dans cet ordre (décision 4, vérification automatique)

Une valeur ajoutée à un enum ne peut pas servir dans la transaction qui l'ajoute : C1a doit être EN PROD
avant que C1b puisse être rejouée à blanc.

| Fichier | md5 |
|---|---|
| `supabase/migrations/20261027230000_cegep_lot_c1a_methode_auto_cegep.sql` | `3cfa1d46d1dbe918f3a103d31a6dec6a` |
| `supabase/migrations/20261027230100_cegep_lot_c1b_verification_auto_cegep.sql` | `34cc976b66aac462f185777419a205f6` |
| `supabase/rollback/20261027230100_rollback_cegep_lot_c1b_verification_auto_cegep.sql` | `a71dd22deeb965a80cdd8a8d3fb6c428` |
| `docs/cegep-lot-c1/prod/c1a-rejeu-blanc-20261027.sql` | `96b005c927ebd5be447e2d656955c6b2` |
| `docs/cegep-lot-c1/prod/c1a-apply-20261027.sql` | `73aae2bc7fdb592b4cc3bb52b2a18ff9` |
| `docs/cegep-lot-c1/prod/c1b-rejeu-blanc-20261027.sql` | `047a9b74d68a3dc12af5913e623a1d3e` |
| `docs/cegep-lot-c1/prod/c1b-apply-20261027.sql` | `50fc1a24a94bd95f097bfc329b73a90a` |
| `docs/cegep-lot-c1/prod/c1b-rollback-20261027.sql` | `7e1e5d0d8ddf6d79f8f0d9a8394b5c83` |

- **C1a** : la valeur `auto_cegep` de `verification_method`. Aucune ligne, fonction, policy ni trigger ne
  change. Pas de rollback (une valeur d'enum ne se retire pas ; elle reste inerte tant que C1b n'est pas là).
- **C1b** : trigger `trg_verification_auto_cegep` (BEFORE INSERT OR UPDATE OF school_id sur `athletes`) :
  un NOUVEL ancrage à un cégep d'une fiche non vérifiée → `verified = true`, méthode `auto_cegep`,
  `verified_by` NULL ; une fiche `auto_cegep` qui quitte le cégep repasse en gris ; une fiche vérifiée par
  un humain n'est pas touchée ; une ligne qui garde son école passe telle quelle (le cégépien déjà ancré
  en prod n'est pas vérifié rétroactivement). `notify_athlete_verified` et `log_coach_activity_verified`
  ne disent plus « ton coach a vérifié » pour `auto_cegep` (corps prod gardés par md5). Aucune fiche
  existante modifiée. Sous OFF, le verrou C0 refuse l'ancrage avant que rien ne soit vérifié.

Les fichiers prod sont générés par `scripts/cegep-lot-c1/generer.sh c1a|c1b 20261027 <type>` (LF, md5
gardés). Preuves locales : `docs/cegep-lot-c1/preuves-locales-20261027.txt`.

## Commandes psql (PowerShell, depuis `C:\tmp\nexus-cegep-c1`) — BP seulement, une session prod à la fois

```powershell
cd C:\tmp\nexus-cegep-c1
$env:PGCLIENTENCODING = "UTF8"
$psql = "$HOME\scoop\apps\postgresql\current\bin\psql.exe"
# Sans mot de passe : psql le demande. Jamais dans un fichier ni dans le chat.
$env:NEXUS_PROD_DB = "postgresql://postgres.nrloizyemulbhujrqhgx@aws-1-ca-central-1.pooler.supabase.com:5432/postgres"

# 1. C1a — rejeu à blanc (finit par ROLLBACK)
$f = "docs\cegep-lot-c1\prod\c1a-rejeu-blanc-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 96B005C927EBD5BE447E2D656955C6B2
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c1\prod\c1a-rejeu-blanc-20261027.sortie.txt"

# 2. C1a — apply (sur GO)
$f = "docs\cegep-lot-c1\prod\c1a-apply-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 73AAE2BC7FDB592B4CC3BB52B2A18FF9
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c1\prod\c1a-apply-20261027.sortie.txt"

# 3. C1b — rejeu à blanc (exige C1a inscrite ; finit par ROLLBACK)
$f = "docs\cegep-lot-c1\prod\c1b-rejeu-blanc-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 047A9B74D68A3DC12AF5913E623A1D3E
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c1\prod\c1b-rejeu-blanc-20261027.sortie.txt"

# 4. C1b — apply (sur GO, après lecture du rejeu)
$f = "docs\cegep-lot-c1\prod\c1b-apply-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 50FC1A24A94BD95F097BFC329B73A90A
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c1\prod\c1b-apply-20261027.sortie.txt"

# 5. C1b — rollback (sur GO seulement)
$f = "docs\cegep-lot-c1\prod\c1b-rollback-20261027.sql"
(Get-FileHash -Algorithm MD5 $f).Hash   # attendu : 7E1E5D0D8DDF6D79F8F0D9A8394B5C83
& $psql $env:NEXUS_PROD_DB -X -v ON_ERROR_STOP=1 -f $f 2>&1 | Tee-Object -FilePath "docs\cegep-lot-c1\prod\c1b-rollback-20261027.sortie.txt"

Remove-Item Env:NEXUS_PROD_DB
```

**Ce qu'il faut voir :**
- C1a rejeu : `valeurs_apres` = `auto,manuel_coach,manuel_directeur,auto_cegep`, empreinte 0 / 0, VERDICT,
  puis hors transaction les 3 valeurs d'avant et `derniere_version` = `20261027210000`.
- C1a apply : COMMIT, puis `valeur_utilisable` = `auto_cegep`, `fiches_auto_cegep` = 0.
- C1b rejeu (interrupteur passé ON dans la transaction seulement) : cas 1 et 2 en `CHANGE` vers
  `CEGEP / vérifié / auto_cegep / par personne` avec les MÊMES avis qu'avant ; cas 3 à 7 en `=` ; sous OFF
  le rattachement à une équipe de cégep est refusé par le verrou ; empreinte 0 / 0 / 0 ; VERDICT ;
  compteurs identiques ; `verifiees_avant` = `verifiees_apres` ; `interrupteur` = `false`.
- C1b apply : AVANT `non vérifié / ·`, APRÈS `vérifié / auto_cegep`, interrupteur `false`, COMMIT.

## Pile locale et comptes de test

- Base Docker `supabase_db_Nexus` (127.0.0.1:54322), C0 + C1a + C1b appliqués, masquage du lot A aligné
  (`docs/cegep-lot-c1/tests/aligner-local-lot-a.sql`).
- Dev : `sh <scratchpad>/dev-c1.sh` → http://localhost:3109 (variables de la pile locale, jamais le cloud).
- Comptes : `node docs/cegep-lot-c1/tests/preparer-local.mjs` (`--retirer` pour tout enlever). Mot de passe
  commun : `Cegep-C1-2026!x`.
- Interrupteur : `node docs/cegep-lot-c1/tests/preparer-local.mjs --on` / `--off` (ou /admin/settings).

| Compte | Rôle |
|---|---|
| `c1.athlete18@c1.local` | nouvel athlète, 20 ans, consentement Loi 25 déjà donné, onboarding à faire |
| `c1.athlete17@c1.local` | nouvel athlète, 17 ans, parcours réel (/consentements d'abord) |
| `c1.bandeau.texte@c1.local` | athlète inscrit, « Cégep de Saint-Jérôme » tapé à la main, sans école |
| `c1.bandeau.ancre@c1.local` | athlète inscrit, ancré au Cégep de Saint-Jérôme, sans équipe, non vérifié |
| `c1.recruteur@c1.local` | recruteur collégial Pro (Cégep de Saint-Jérôme, Basketball) |
| `c1.partenaire@c1.local` | partenaire approuvé (Basketball) |
| `c1.admin@c1.local` | admin |

## Tests écran (OFF d'abord, puis ON)

**OFF** (`--off`)
1. `c1.athlete17` → `/athlete/onboarding` (après /consentements), « École / Cégep » : la recherche « Saint-Jérôme »
   ne propose AUCUN cégep ; question « Année où tu finis ton Sec 5 » (2027 → 2031).
2. Même écran, « Mon école n'est pas listée » → « Cégep de Saint-Jérôme » : phrase orange d'aujourd'hui
   (« Nexus ne couvre pas encore les équipes de cégep… »).
3. `c1.bandeau.texte` → `/athlete/dashboard` : pas de bandeau cégep.
4. `c1.bandeau.ancre` → `/athlete/transfert` : pas de bloc « Année où tu finis ton cégep » ; choisir le Cégep de
   Saint-Jérôme et une équipe → « Les cégeps ne sont pas encore ouverts sur Nexus. Ça arrive bientôt. »

**ON** (`--on`)
5. `c1.athlete18` → `/athlete/onboarding` : « Rechercher ton école ou ton cégep… », le Cégep de Saint-Jérôme est
   proposé ; le choisir → « Année où tu finis ton cégep » (2027 → 2030, rien de présélectionné) ; étape 4
   Basketball → équipes du cégep ; « Compléter mon profil » → tableau de bord, crochet BLEU, aucune
   notification « Ton coach a vérifié ton profil ».
6. `c1.athlete17` : même parcours ; parent / consentement parental exactement comme aujourd'hui ; crochet bleu.
7. `c1.bandeau.texte` → `/athlete/dashboard` : bandeau « Les cégeps sont maintenant sur Nexus ! … » → « Choisir mon
   cégep » mène à `/athlete/transfert` ; rejoindre une équipe du Cégep de Saint-Jérôme → le bloc « Année où tu
   finis ton cégep » apparaît, confirmer 2029 ; le bandeau disparaît du tableau de bord.
8. `c1.bandeau.ancre` → `/athlete/dashboard` : bandeau ; `/athlete/transfert` : bloc année visible.
9. `c1.athlete18` → `/athlete/mon-parcours` : « Saison » avec « Cégep 2028 », jamais « Sec N ».
10. `c1.recruteur` → `/recruteur/recherche` : aucun des cégépiens ci-dessus ; leur fiche en lien direct reste
    introuvable (lot A) ; aucun favori, pipeline ni message possible (C0).
11. `c1.partenaire` → `/partenaire/athletes` : Promotion « Secondaire ou Cégep AAAA » sans Type, « Cégep AAAA »
    avec Type Collégial ; `/partenaire/newsroom` : Organisme « École secondaire ou cégep ».
12. `c1.admin` → `/admin/athletes/<fiche de c1.athlete18>` : méthode « Automatique — cégep ».

Fin : `--off`.

## Hors C1 (pour C2 et plus tard)

- **Mobile (C2, 1.4.6)** : `AthleteOnboardingMobile` envoie encore `verified: false` à chaque étape — sur une
  fiche vérifiée `auto_cegep`, la garde de périmètre refuserait l'étape. À retirer en C2, comme ici au web.
  Le bloc année de `/athlete/transfert` et le bandeau sont web seulement (`IS_CAPACITOR`).
- Le cégépien déjà ancré en prod (témoin du lot A) n'est PAS vérifié par C1b (décision 5 : rien en base pour lui).
- L'étape « Académique » de l'onboarding (programmes visés au cégep, régions de cégep) et « Trouver mon cégep »
  restent montrés au cégépien.
- Newsroom partenaire : un vrai Type Collégial demande la RPC `partner_newsroom_events` (p_org).
- Libellés « Cégep AAAA » (décision 3) et écrans corrigés (décision 6) ne sont pas derrière l'interrupteur :
  ils ne changent que l'affichage d'un cégépien, et le menu Promotion du partenaire.
