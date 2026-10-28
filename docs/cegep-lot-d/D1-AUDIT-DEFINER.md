# Lot D1 — les fonctions SECURITY DEFINER rendent-elles les universités ? (audit du 2026-10-28)

Question de BP : les règles D1a protègent les lectures directes, mais une fonction SECURITY DEFINER passe
par-dessus la RLS. Lister toutes celles qui renvoient des écoles ou des équipes, dire pour chacune « filtrée
(comment) ou non », et le prouver dans le rejeu D1 en les appelant avec un compte réel de chaque rôle non admin.

**Réponse : une seule fuyait, `public.ids_universites()` (D1a)**, que tout le monde pouvait appeler par /rpc,
visiteur anonyme compris. Elle donnait l'identifiant des 12 universités, pas leur nom. Avec un identifiant, trois
écritures de client acceptées en prod (constat) ou en local auraient fait afficher une université par d'autres
fonctions. **Correctif D1a2** (`20261028020000_cegep_lot_d1a2_definer`) : la fonction quitte l'API (schéma
`nexus_prive`) et un verrou par référence ferme 11 colonnes. Avec D1a2 joué d'abord, le rejeu D1 prod donne
**0 fuite sur 216 appels et 0 écriture acceptée**.

## Méthode
- **Inventaire (prod, lecture seule)** : `pg_proc` du schéma public, `prosecdef`, corps qui nomme `schools` ou
  `teams`, hors triggers : **60 fonctions** ; 39 appelables par un client (anon ou authenticated). Plus les vues
  qui tournent en propriétaire (sans `security_invoker`) : `top_athletes_view`, `trending_athletes_view`.
- **Lecture des 60 corps** : d'où vient l'école ou l'équipe rendue, et qui peut écrire la ligne qui la désigne.
- **Banc dans le rejeu D1** (`d1.gabarit.sql`) : 36 appels (toutes les fonctions appelables qui rendent des
  lignes, jsonb ou texte, et les 2 vues) × 6 rôles (athlète, parent, coach, recruteur collégial, partenaire,
  anonyme), avec les claims d'un vrai compte de chaque rôle, posés comme PostgREST les pose depuis le jeton
  (`request.jwt.claims` et rôle `authenticated` / `anon`). AVANT puis APRÈS la création des 12 universités,
  chaque appel défait aussitôt. Les arguments d'identifiant reçoivent ceux des universités (pire cas). FUITE = un
  id d'université ou d'équipe universitaire dans la réponse, ou plus d'occurrences de leurs noms qu'avant.
  Plus 8 chemins d'écriture qui feraient pointer une ligne vers une université.
- Ce n'est pas un appel HTTP avec un jeton signé : c'est exactement ce que PostgREST exécute pour un tel jeton.

## Résultat mesuré en prod (rejeux à blanc, ROLLBACK)
| Rejeu | Appels qui fuient | Écritures acceptées |
|---|---|---|
| `d1-rejeu-constat` (état actuel, sans D1a2) | **6** : `ids_universites()` × 6 rôles (12 ids chacun) | **1** : coach → `users.primary_team_id` d'une équipe universitaire |
| `d1-rejeu-blanc-d1a2` (D1a2 joué d'abord) | **0** / 216 | **0** / 8 |

En local, le constat accepte aussi `team_coaches` et une carte prospect vers une équipe universitaire. En prod,
`team_coaches` est déjà refusé par la porte du lot B (`NEXUS_COACH_CEGEP`).

## Fonction par fonction
| Fonctions | Ce qu'elles rendent | Filtrée ? (comment) |
|---|---|---|
| `ids_universites` | ids des universités | **NON — fuite** → D1a2 la retire de l'API |
| `recruiter_athlete_cards`, `recruiter_athlete_profile`, `recruiter_search_athletes`, `partner_athlete_profile`, `partenaire_mes_athletes`, `partenaire_prospects_terminees`, `partenaire_rapprochements`, `partenaire_rapprochements_refuses`, `get_my_children`, `athletes_nom_proche`, vues `top_athletes_view` / `trending_athletes_view` | école / équipe d'une fiche athlète, école d'engagement | oui : partent des fiches. `athletes.school_id` et `team_athletes` sont verrouillés (D0), `committed_school_id` l'est par la règle de profil et par D1a2 |
| `list_team_commits` | école de provenance des engagés | oui : fiches (D0) ; `commitment_requests.school_id` verrouillé par D1a2 |
| `partner_newsroom_events` | école de l'événement / de la fiche | oui : événements de fiches (D0) |
| `lookup_civil_unclaimed_by_email` | sport, école civile | oui : liste blanche `LIGUE_CIVILE` |
| `cartes_par_ids`, `processus_cartes` | équipe et école d'une carte prospect | oui : cartes de l'unité ; `cartes_prospect.team_id` verrouillé par D1a2 (et « l'établissement suit l'équipe ») |
| `partenaire_depistage_cartes`, `prospect_partenaire_contenu`, `prospect_partenaire_candidats`, `rapprochement_candidats`, `rapprochements_unite`, `rapprochements_refuses_unite` | école / équipe d'une carte partenaire | oui : `partenaire_prospects.school_id` et `team_id` verrouillés par D1a2 |
| `matchs_recherche`, `matchs_suggestions`, `agenda_matchs_partenaire`, `agenda_matchs_unite`, `depistage_profils_match`, `team_record_hint` | équipes d'un match | oui : partent des matchs. 0 match relié à une équipe universitaire ; la veille ne charge pas le secteur Universitaire ; `rseq_creer_equipes_proposees` est réservée à l'admin |
| `coach_nommable`, `coachs_nommables_equipe`, `invitation_equipe_coach` | coachs et leur école | oui : liste blanche `SECONDAIRE` / `LIGUE_CIVILE` |
| `create_group`, `create_custom_group`, `_messageable_staff_ids`, `is_group_school_authority`, `fn_resolve_team_referent` | école / équipe du coach | oui : `team_coaches` / `school_coaches` fermés par la porte du lot B, et par D1a2 |
| `resolve_invitation_token`, `resolve_team_join_token`, `resolve_transfer_token` | école / équipe d'un jeton | oui : il faut le jeton ; `invitations`, `team_join_tokens`, `team_invitations` verrouillés par D1a2 ; `create_team_join_token` exige un coach de l'équipe |
| `list_interested_recruiters` | cégep du recruteur | oui : rattachement validé `CEGEP` (`finish_recruiter_onboarding`, `changer_rattachement_recruteur`) et verrou D0 sur `users` |
| `admin_cegeps_sans_programme` | cégeps sans programme | oui : liste blanche `CEGEP` |
| `finish_coach_civil_onboarding`, `finish_coach_school_onboarding`, `finish_recruiter_onboarding`, `changer_rattachement_recruteur`, `demo_access_demander`, `inscrire_demo` | écritures | oui : type validé (`CEGEP`, `ecole_ouverte_aux_coachs`, civil) |
| `partenaire_prospect_enregistrer` | id de carte | ne validait pas le type : D1a2 refuse l'université (verrou sur `partenaire_prospects`) |
| `can_edit_team_page`, `coach_manages_team`, `is_director_of_team_school`, `athlete_est_cegepien`, `ecole_ouverte_aux_coachs`, `unite_voit_cegepiens`, `prospect_partenaire_sport_concorde` | booléen | ne rendent aucune école |
| `deactivate_stale_orphan_teams`, `create_team_join_token`, `rseq_creer_equipes_proposees`, `_apply_team_attachment_core`, `admin_demo_access_liste` | nombre, jeton, admin, interne | ne rendent aucune école universitaire (saisons passées seulement ; coach de l'équipe ; admin ; `team_athletes` verrouillé D0) |

## Le correctif D1a2
1. `ids_universites()` passe dans le schéma `nexus_prive`. PostgREST ne sert que `public` et GraphQL ne la
   connaît pas (vérifié dans le rejeu, rôles anon et athlète). La policy `universites_masquees` de `teams` la lit
   là, et `public.ids_universites` est supprimée.
2. `verrou_reference_universite()` : refuse, pour un compte non admin, toute ligne qui pointe une université ou
   une équipe universitaire. Colonnes : `athletes.committed_school_id`, `users.primary_team_id`,
   `cartes_prospect.school_id` et `team_id`, `partenaire_prospects.school_id` et `team_id`,
   `commitment_requests.school_id`, `invitations.school_id`, `team_invitations.team_id`,
   `team_join_tokens.team_id`, `team_coaches.team_id`, `school_coaches.school_id`. L'admin et le service
   (auth.uid() nul) sont exemptés.
3. **Rejeu prod D1a2 :**
   - AVANT : les 7 rôles reçoivent l'id de l'université témoin par /rpc.
   - APRÈS : la fonction est « absente » pour les 7 rôles ; non-admins 0 / 0, admin 1 / 1 ; 1 408 écoles et
     10 349 équipes ordinaires inchangées pour chaque rôle.
   - Le verrou refuse 7 colonnes sur 12 essais ; 3 essais sont refusés par une règle existante ;
     `commitment_requests` et `invitations` sont vides en prod, donc non exercés.
   - Recruteur, lecture de toutes les équipes : 135 ms.
   - Rollback vérifié.
4. **D2** devra relâcher ce verrou (et les policies D1a) pour le recruteur universitaire, sous
   `lancement_universitaire`.
