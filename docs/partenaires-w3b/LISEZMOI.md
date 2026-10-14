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

## Preuves (local)

- `tests-w3b.sql` → **51/51** (`tests-w3b-resultats-local.txt`) : badge de sport
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
  un badge Nexus » côté partenaire. « L'Esprit Sportif » = le partenaire local
  de test renommé le temps des captures, puis remis tel quel.

## Mise en prod (sur GO, jamais le mardi ni le mercredi avant 5 h)

Même voie que W3 : une seule transaction, relevé avant + migration + gardes et
enregistrement (version FIXE `20261014180000` dans `schema_migrations`, une
ligne `admin_operations`).

```powershell
$env:PGCLIENTENCODING = "UTF8"
psql "<chaîne session pooler, comme W2/W3>" -v ON_ERROR_STOP=1 -1 `
  -f docs/partenaires-w3b/prod/w3b-releve-avant.sql `
  -f supabase/migrations/20261014180000_w3b_partenaire_badges_nexus.sql `
  -f docs/partenaires-w3b/prod/w3b-gardes-et-enregistrement.sql
```

Puis, en lecture seule : `docs/partenaires-w3b/prod/w3b-verif-apres.sql`.
`w3b-gardes-et-enregistrement.sql` est GÉNÉRÉ (`generer-gardes.mjs`) : il
embarque la migration octet pour octet (LF) et vérifie son md5
(`78db26be73a1964ceccbb5d60a0cfe42`). Si la migration change, régénérer.

Ensuite seulement : push du code d'affichage (la base avant l'app).

## Lot mobile (non fait — protocole web d'abord)

`BadgePartenaireVignette` et `ActionsPartenaireFiche` sont des composants web.
Au lot mobile : rendre les badges Nexus partenaire (`est_nexus`, `badge_code`)
dans les Distinctions mobiles, avec la même signature « par <organisation> ».

## Questions ouvertes

1. **Le coach pose un badge que le partenaire a déjà donné** : rien ne l'en
   empêche (W3b ne touche pas `athlete_badges`), et le badge s'afficherait deux
   fois. Faut-il bloquer le coach, masquer le doublon partenaire, ou laisser ?
2. Les icônes propres d'un partenaire à fond opaque : faut-il exiger un PNG
   détouré à l'upload (contrôle d'alpha côté admin) ?
