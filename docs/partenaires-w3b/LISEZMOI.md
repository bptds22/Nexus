# Lot W3b — badges Nexus attribués par un partenaire

Migration `supabase/migrations/20261014180000_w3b_partenaire_badges_nexus.sql`,
rollback `supabase/rollback/20261014180000_rollback_w3b_partenaire_badges_nexus.sql`.
**Local seulement au 2026-10-14. Rien en prod sans le GO de BP.**

## Ce que fait le lot (décisions BP 2026-10-14)

| # | Décision | Où |
|---|---|---|
| 1 | Un partenaire autorisé (`partenaire_peut_evaluer()` + athlète admissible et ACTIF) attribue des badges du catalogue Nexus, en plus des siens | `partenaire_attribuer_badge_nexus` |
| 2 | Admissibles : universel et sport, actifs, sans contexte (17). Jamais honneur | idem + `partenaire_badges_nexus_admissibles` |
| 3 | Un badge de sport seulement pour le sport de l'athlète (`badge_sports` = la taxonomie de /ma-story) | idem, l'admin aussi |
| 4 | Rangés avec les badges partenaire (`partner_athlete_badges.badge_id`) : hors plafond de 5, hors M10 | schéma ; `badge_plafond` et M10 vérifiés par md5 |
| 5 | Affichés dans les Distinctions, icône du badge Nexus, « par <organisation> » dessous | `BadgePartenaireVignette` → `DistinctionBadge` |
| 6 | Déjà porté (coach ou partenaire) : refusé, message qui dit par qui | « … (attribué par son coach / par vous / par <organisation>) » |
| 6b | **Dans l'autre sens** (suite W3b) : le coach qui pose un badge déjà attribué par un partenaire est refusé, même message « (attribué par <partenaire>) ». Un badge masqué bloque aussi (masquer n'est pas retirer). Le masquage reste possible | trigger `trg_badge_deja_partenaire` (BEFORE INSERT OR UPDATE sur `athlete_badges`, fonction `badge_refuser_doublon_partenaire`) : couvre tous les chemins — RPC du coach, admin, suggestion approuvée |
| 7 | Retrait : le partenaire auteur ou l'admin ; masquage : le coach ; l'athlète non. L'admin attribue pour le compte d'un partenaire (`p_partner_id`) | `retirer_badge_partenaire` (propriétaire lu sur `partner_id`), `coach_masquer_badge_partenaire` inchangée |
| 8 | Reflet : badge Nexus par `DistinctionBadge` ; icône partenaire dans `.nx-badge is-metal`, l'icône en `--nx-mask` | voir « CORS » ci-dessous |

**`badges_partenaires_athlete` change de forme** : deux colonnes AJOUTÉES À LA
FIN (`badge_code`, `est_nexus`), les neuf de W3 sont inchangées et dans le même
ordre. Le DROP + CREATE a été fait avec révocation complète et ACL comparée en
entier après (règle du 2026-09-07). Aucun binaire mobile publié n'appelle cette
fonction (W3 est web seulement).

## CORS du stockage `partner-badges` — rien à changer

Relevé le 2026-10-14, en prod (icône réelle) et en local :
`Access-Control-Allow-Origin: *` sur le GET et sur le préflight. Un `mask-image`
venant d'une autre origine est donc chargé ; les captures le prouvent (style
calculé du `::after` : masque = URL du stockage, animation `nxRefletCycle`).

**Condition sur l'icône elle-même** : le masque suit le **canal alpha**. Une
icône détourée (PNG à fond transparent) reflète sa silhouette ; une icône à fond
opaque reflète tout son carré. À dire à l'admin qui dépose les icônes.

## Fins de ligne : ce que le lot a appris (2026-10-14)

Un checkout Windows extrait les `.sql` en **CRLF**. Passés à psql, ils créent
des fonctions dont le corps porte des retours chariot : le md5 brut change.
Conséquences prises en compte, et prouvées en rejouant tout depuis des copies
CRLF :
- toutes les gardes comparent `md5(replace(pg_get_functiondef(…), E'\r', ''))` ;
- le contenu embarqué dans `w3b-gardes-et-enregistrement.sql` est normalisé
  (`replace(…, E'\r', '')`) avant son md5 et son enregistrement — sans cela,
  la garde aurait REFUSÉ une mise en prod lancée depuis Windows ;
- un rollback passé en CRLF restaure les fonctions W3 à l'identique au
  contenu près, avec des retours chariot : sa garde le vérifie sans eux.
- Toujours **`psql -1`** : sans transaction unique, une garde qui échoue
  laisse en place ce qui a déjà tourné (vécu en local, réparé).

## Preuves (local)

- `tests-w3b.sql` → **60/60** (`tests-w3b-resultats-local.txt`). Ajouts : le
  coach bloqué par un badge d'un partenaire, message exact, par l'insertion
  directe ET par la RPC `appliquer_badges_saisie` ; un autre badge passe ;
  masqué, il bloque toujours ; une fois retiré par tous les partenaires, le
  coach peut le poser ; rien de changé côté partenaire ; droits de la
  fonction de trigger `{postgres, service_role}`. Et toujours : badge de sport
  refusé pour un autre sport, doublon coach / soi-même / autre partenaire refusé
  avec son message, honneur refusé, limite de 5 intacte (6e badge du coach
  toujours refusé, `athlete_badges` inchangée), retrait, masquage par le coach,
  admin pour le compte d'un partenaire, ACL complètes, anon refusé.
- Banc W3 (`docs/partenaires-w3/tests-w3.sql`) rejoué après W3b : **70/70**.
- Rollback : retour EXACT à W3 (md5 des fonctions, ACL, colonnes, index,
  contraintes comparés au relevé d'avant).
- Chaîne de prod jouée en local dans une transaction annulée, y compris le
  rattachement d'une pose W3 existante (la prod en porte une, retirée).
- Captures (`captures/`), sur serveur local branché sur `.env.local.docker` :
  01 rangée Distinctions (badge propre + « Vitesse — par L'Esprit Sportif ») ;
  02 reflet figé à mi-balayage ; 03 différence ×6 : la bande reste dans la
  silhouette, 0 pixel changé dans les coins transparents ; 04 choix « Attribuer
  un badge Nexus » côté partenaire ; 05 refus côté coach dans l'assistant
  « Modifier » (étape Évaluation, « Enregistrer »). L'app affiche ce refus par
  `window.alert()` : la boîte native n'apparaît dans aucune capture de
  navigateur, l'encadré de 05 REPRODUIT donc le texte exact passé à l'alerte
  (« Erreur lors de la sauvegarde: NEXUS: cet athlète a déjà le badge
  « Vitesse » (attribué par Média Preuve) ») et le dit dans son en-tête.
  06 (même jour, après correction) : le même refus dans un encadré de la
  page, « Cet athlète a déjà le badge Vitesse, attribué par L'Esprit
  Sportif. » ; `alert()` jamais appelé (le script échoue sinon). Outil :
  `outils/capture-refus-coach-encadre.cjs`, navigateur sans interface.
  « L'Esprit Sportif » (01–04, 06) = le partenaire local de test renommé le temps
  des captures, puis remis tel quel.

## Mise en prod (sur GO, jamais le mardi ni le mercredi avant 5 h)

Même voie que W3 : une seule transaction, relevé avant + migration + gardes et
enregistrement (version FIXE `20261014180000` dans `schema_migrations`, une
ligne `admin_operations`).

Depuis la racine du dépôt (`C:\Users\bptds\Documents\Nexus`), en PowerShell :

```powershell
# 1. Les fichiers sont-ils ceux qui ont été testés ? (empreintes du checkout
#    Windows, fins de ligne CRLF : elles diffèrent du blob git en LF)
Get-FileHash -Algorithm MD5 docs\partenaires-w3b\prod\w3b-releve-avant.sql, supabase\migrations\20261014180000_w3b_partenaire_badges_nexus.sql, docs\partenaires-w3b\prod\w3b-gardes-et-enregistrement.sql, docs\partenaires-w3b\prod\w3b-verif-apres.sql
#   w3b-releve-avant.sql                            7C99B3EBA27EDDAFB2E049BF166D9F17
#   20261014180000_w3b_partenaire_badges_nexus.sql  1F4791949B4D56311C7D14AEC9CB1D60
#   w3b-gardes-et-enregistrement.sql                103FD96C4E464338079E0C6C70A3BA84
#   w3b-verif-apres.sql                             F42D405E3C97B0B25E7FC4C473E67963

# 2. Une seule transaction (-1) : une garde qui échoue annule TOUT.
#    Pas de mot de passe dans la commande : psql le demande.
$env:PGCLIENTENCODING = "UTF8"
& "C:\Users\bptds\scoop\apps\postgresql\18.6-5\bin\psql.exe" "host=aws-1-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.nrloizyemulbhujrqhgx sslmode=require" -v ON_ERROR_STOP=1 -1 `
  -f docs/partenaires-w3b/prod/w3b-releve-avant.sql `
  -f supabase/migrations/20261014180000_w3b_partenaire_badges_nexus.sql `
  -f docs/partenaires-w3b/prod/w3b-gardes-et-enregistrement.sql
```

Hôte vérifié le 2026-10-14, sans mot de passe : `aws-1-ca-central-1` connaît
le projet, `aws-0-ca-central-1` répond « tenant not found ».

Puis, en lecture seule : `docs/partenaires-w3b/prod/w3b-verif-apres.sql`.
`w3b-gardes-et-enregistrement.sql` est GÉNÉRÉ (`generer-gardes.mjs`) : il
embarque la migration octet pour octet (LF) et vérifie son md5
(`3ef008c5cf636f6095e99755425935cd`, blob git en LF). Si la migration change,
régénérer. Version inchangée : `20261014180000` (prod au 2026-10-14 :
`20261014164451`).

Ensuite seulement : push du code d'affichage (la base avant l'app).

## Lot mobile (non fait — protocole web d'abord)

Le refus du coach vient de la base : il s'applique aussi au mobile publié,
qui recevra l'erreur telle quelle. Au lot mobile : passer les erreurs de
`AthleteWizardMobile` par `lib/erreurs/messageErreurNexus.ts` et les afficher
dans l'interface (registre `docs/fast-follow-1.4.2.md` §84).

`BadgePartenaireVignette` et `ActionsPartenaireFiche` sont des composants web.
Au lot mobile : rendre les badges Nexus partenaire (`est_nexus`, `badge_code`)
dans les Distinctions mobiles, avec la même signature « par <organisation> ».

## Questions ouvertes

1. ~~Le coach pose un badge déjà donné par un partenaire~~ : **tranché** — refusé
   (6b).
2. ~~Icônes opaques~~ : **tranché** — aucun contrôle ; BP dépose des PNG détourés.
3. ~~Message brut « Erreur lors de la sauvegarde: NEXUS: » en boîte native~~ :
   **fait (web)** — encadré dans la page, phrase mise en forme
   (`lib/erreurs/messageErreurNexus.ts`, `components/shared/ErreurSauvegarde.tsx`),
   sur « Créer un profil » et « Modifier ». Mobile : §84.
