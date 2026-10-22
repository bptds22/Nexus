# QG admin — /admin/qg, lot 1 (preuves locales, 2026-10-22)

Base Docker locale (`supabase_db_Nexus`), joignable depuis l'hôte par un relais socat
jetable sur 127.0.0.1:56431 (Windows réserve 54238–54337). Serveur de production du
worktree (`next build` + `next start -p 3012`) ; ancien code de main (`nexus-ecran`,
`next start -p 3011`) pour la preuve d'identité de l'écran mural. Navigateur Playwright
SANS INTERFACE — aucune capture de l'écran du poste de BP. Session admin : lien magique
généré avec la clé de service LOCALE (`scripts/qg-admin/session-locale.mjs`, qui refuse
toute adresse non locale) — aucun mot de passe touché.

| Fichier | Contenu |
|---|---|
| `qg-<onglet>-<période>-3440x1440.png` | Les 3 onglets à 3440×1440 (Aujourd'hui/jour, Croissance/mois, Recruteurs/semaine). |
| `qg-<onglet>-<période>-1366x768.png` | Les mêmes à 1366×768 (portable) : aucun défilement horizontal. |
| `qg-infobulle-1366x768.png` | Infobulle au survol de la barre du mois en cours. |
| `qg-plein-ecran-3440x1440.png` | Après le bouton « Plein écran » (Fullscreen API) : le QG seul. |
| `ecran-1920x1080.png` | L'écran mural, tuile consentements v2 en 4 cases. |
| `reponse-qg-{jour,semaine,mois}.json` | Réponses exactes de `GET /api/admin/qg` pour l'admin. |
| `controle-{jour,semaine,mois}.txt` | Chaque chiffre recalculé à la main en SQL (`scripts/qg-admin/controle-main.sql`). |
| `controle-resultat.txt` | Comparaison clé par clé : 668 chiffres, 0 écart. |
| `ecran-ancien.json` / `ecran-nouveau.json` | `/api/admin/ecran`, ancien code vs nouveau, mêmes données. |
| `preuves-api.txt` | Identité de l'écran ; 401 / 403 avec le corps exact sur les deux routes. |
| `balayage.txt` | @ / UUID / courriels / noms dans les réponses : 0. |
| `acces-journal.txt` | Captures, mesures (largeur, défilement), bascule, plein écran, coach → `/`, anonyme → `/auth`. |

Preuves des 2 migrations (par rôle, sabotage d'ACL) : `scripts/qg-admin/preuves-par-role-resultat.txt`.

## Définitions

- **Périodes « à date vs même moment »**, heure de Montréal : jour = aujourd'hui 0 h →
  maintenant vs hier 0 h → même heure ; semaine = lundi 0 h → maintenant vs lundi d'avant →
  même jour, même heure ; mois = le 1er → maintenant vs le 1er du mois d'avant → même jour,
  même heure, **borné à la fin de ce mois** (le 31 mars se compare à tout février). Une heure
  qui n'existe pas (2 h 30 le jour du saut de printemps) s'arrête au saut (3 h 00 HAE).
- **Séries** : 30 jours, 12 semaines du lundi, 12 mois ; la dernière est « en cours ».
- **Consentements v2, 4 cases** : acceptés ; refusés ; en attente = question posée, sans
  réponse (une ligne `consentement_partenaire_v2` : « plus tard », demande au parent, push) ;
  jamais demandé = aucune ligne. La somme fait les athlètes admissibles.
- **Comptes connectés** : `auth.users.last_sign_in_at` dans la période, par rôle
  (`admin_comptes_connectes`). LIMITE : c'est la DERNIÈRE connexion ; un compte revenu
  depuis n'est plus compté dans la période d'avant, qui est donc sous-estimée (la page le
  dit en note sous la tuile).
- **Loi 25** : demandes ouvertes ; échéance = `deadline` (accès / portabilité, dépôt + 30 j)
  ou dépôt + 30 jours (suppression) ; en retard, sous 7 jours, prochaine échéance.
- **Recruteurs** : mêmes définitions que l'écran mural (`lib/admin/indicateurs.ts`).

## Écart local connu

La pile Docker locale coupe parfois des connexions (Kong → PostgREST, « invalid response
from upstream ») sous la rafale d'un chargement complet : le script de captures recharge
jusqu'à un 200 (les essais ratés sont notés dans `acces-journal.txt`). La page elle-même
réessaie après 30 s tant qu'aucun chiffre n'est arrivé.
