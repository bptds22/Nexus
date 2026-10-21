# Avis au parent au premier contact d'un recruteur (2026-10-20)

Migration `20261020170000_avis_parent_contact_recruteur.sql`, fonction edge
`send-parent-contact`, libellé portail `CHILD_RECRUITER_CONTACT`.

## Ce qui part, et quand

Premier message d'une **unité** (cégep du recruteur ; sans cégep : le
recruteur) à un athlète **mineur à la date du message** :

| Canal | Condition | Contenu |
|---|---|---|
| Courriel (`info@nexussports.ca`) | `parent_email` déclaré, sinon adresse du compte parent réclamé | « Un recruteur d'un programme collégial a contacté votre enfant. » + lien portail (ou lien de réclamation si le compte n'est pas réclamé) |
| Portail | compte parent réclamé (`parent_athletes`) ; sinon écrit à la réclamation | « Un recruteur a contacté votre enfant. » — metadata `{"event":"recruiter_contact"}` |
| Push | compte parent réclamé ; hors 21 h – 8 h (`push_heure_calme`), sinon cron `parent-contact-push` | même phrase |

Jamais le recruteur, le cégep, le sport, le programme ni le message. La clé
d'unité vit dans `parent_contact_avis` (RLS sans policy, révoquée à
`anon`/`authenticated`).

Rien ne part : majeur, période sans contact (le message est refusé en amont),
unité déjà avisée. Journalisé sans envoi : `AGE_INCONNU`, `SANS_DESTINATAIRE`.
Le `CONTACTE` posé par ce message n'écrit plus « progressé : Contacté » ; posé
à la main, il reste.

## Mise en ligne — ce que la prod doit avoir

1. Vault : `EDGE_FUNCTIONS_URL` = `https://<projet>.supabase.co/functions/v1`
   et `PARENT_CONTACT_SECRET` (nouveau). Sans eux : `courriel_statut =
   NON_CONFIGURE`, rien ne part.
2. Secrets de fonctions : `PARENT_CONTACT_SECRET` (même valeur),
   `RESEND_API_KEY` et `PUSH_DISPATCH_SECRET` (déjà présents). Ne PAS poser
   `EMAIL_TRANSPORT`.
3. `supabase functions deploy send-parent-contact` (verify_jwt = false, dans
   `config.toml`).

## Registre — adresses prod codées en dur (constat 2026-10-20, lot séparé)

Les triggers et fonctions suivants appellent `https://nrloizyemulbhujrqhgx…`
écrit en dur ; une base locale qui porte leur secret appelle donc la PROD :

| Fonction edge visée | Appelants (migrations) |
|---|---|
| send-push | `push_to_user`, `notify_first_recruiter_contact`, `notify_on_message`, rejet/réclamation école… (7 occurrences) |
| send-parent-notice | `notify_parent_on_minor` (3) |
| rseq-weekly-sync | cron `rseq-veille-hebdo` (4) |
| send-announcement (3), send-invitation-carte (2), send-invitation, send-team-invitation, send-avis-parent-partenaires | une chacune |

**Constat local, lecture seule :** les deux bases locales (`Nexus`,
`NexusCegepA`) n'ont qu'un secret au Vault, `RSEQ_SYNC_SECRET`. Les triggers
de notification (push, parent, invitations) n'ont donc rien pu envoyer. Mais
le cron **`rseq-veille-hebdo` a tourné en local les 2026-09-23 et 2026-09-30
à 07:55 UTC** et a fait un `net.http_post` vers la fonction PROD
`rseq-weekly-sync`, avec le secret LOCAL. Les journaux prod ne remontent qu'à
24 h : la réponse (401 si les secrets diffèrent, exécution réelle sinon) n'est
plus vérifiable.

**Proposition (lot séparé, GO BP) :** même mécanisme que `parent_contact_appeler`
— adresse au Vault (`EDGE_FUNCTIONS_URL`), absente en local par défaut — pour
les 8 fonctions ; et en local, désactiver le cron `rseq-veille-hebdo`.

Ordre : secrets et fonction AVANT la migration. Le trigger vérifie la
configuration avant d'occuper la place AVISE (`parent_contact_configure`) :
sans secrets, rien n'est journalisé et le rattrapage reste possible.

## Identifiants de recruteur dans `parent_notifications` (corrigé, 2026-10-20)

`CHILD_FAVORITED`, `CHILD_PIPELINE_STAGE` et `CHILD_VISIT_PLANNED` portaient
`recruiter_id` dans `metadata`, que la policy « parent reads own
notifications » laisse lire au parent (l'écran ne l'affichait pas, l'API le
renvoyait).

- Nouvelles lignes : migration `20261020180000` — trigger BEFORE INSERT OR
  UPDATE OF metadata qui retire la liste fermée `parent_notif_cles_retirees()`.
- Anciennes lignes : `scripts/parent-notif-sans-recruteur/` — `0-releve.sql`
  (compte + empreinte des ids), `1-anciennes-lignes.sql` (copie d'origine dans
  `parent_notifications_metadata_avant`, puis retrait ; gardes nombre +
  empreinte), `2-rollback.sql` (remise à l'identique, trigger suspendu le
  temps de la transaction). Ordre de rollback : script 2, puis la migration.
- Personne ne lit `metadata` : portail (`id, type, title, message, read,
  created_at`), admin (aucune lecture), SQL (deux lectures, `type`/`read`).

## Rattrapage des contacts antérieurs

`scripts/avis-parent-rattrapage/` — `0-releve.sql` (lecture seule, même
règle que le trigger), `1-envoi.sql` (gardes : admin, lot unique, Vault
configuré, nombre attendu, aucun cas sous période sans contact ; journal
`AVIS_PARENT_RATTRAPAGE`). Un courriel envoyé ne se rappelle pas.
