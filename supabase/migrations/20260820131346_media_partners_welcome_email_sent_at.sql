-- 20260820131346_media_partners_welcome_email_sent_at
--
-- Appliquee en PROD le 2026-08-20 via MCP apply_migration (jamais db push).
-- Nom de fichier aligne sur la version REELLE. Chercher par `name`, jamais par
-- `version` : apply_migration pose son propre horodatage.
--
-- ── POURQUOI ELLE EXISTE ─────────────────────────────────────────────────────
-- send-partner-welcome etait deployee depuis le 2026-08-13 sans AUCUN appelant.
-- La route de creation affichait le mot de passe temporaire a l'ecran et
-- n'envoyait rien. Resultat : Jules Regimbald (lespritsportifmedia@gmail.com),
-- cree le 13 aout, APPROVED, n'a jamais recu ses acces et ne s'est jamais
-- connecte — et RIEN en base ne permettait de le savoir. Six jours de silence
-- que personne ne pouvait detecter autrement qu'en regardant last_sign_in_at.
--
-- Cette colonne comble l'angle mort : sans trace, on ne peut pas repondre a
-- « ce partenaire a-t-il recu son acces ? ».
--
-- ── CE QU'ELLE SIGNIFIE EXACTEMENT ───────────────────────────────────────────
-- Posee UNIQUEMENT quand l'API Resend a repondu 2xx, c'est-a-dire quand le
-- courriel a ete ACCEPTE par la passerelle. Ce n'est PAS une preuve de
-- livraison ni de lecture : un rebond ulterieur ne la remet pas a NULL.
--
-- Elle vaut « la passerelle a accepte l'envoi a cette date », rien de plus.
-- Deliberement plus faible que ce qu'on aimerait, mais HONNETE — la dette
-- inverse existe deja ailleurs dans le projet (un marqueur pose apres un POST
-- asynchrone, qui marque la TENTATIVE et non la livraison, et masque un echec
-- de passerelle). On ne la reproduit pas : en cas d'echec la colonne reste
-- NULL et l'ecran admin affiche le mot de passe avec un bandeau d'echec.
--
-- ── ADDITIVE ─────────────────────────────────────────────────────────────────
-- Nullable, sans defaut, sans backfill. NULL = « aucun envoi reussi connu »,
-- ce qui est VRAI pour les deux partenaires existants : aucun n'a jamais recu
-- d'accueil automatise.
--
-- Appliquee AVANT le code qui l'ecrit (routes create + resend), conformement a
-- la regle expand-then-contract de la checklist — et a la lecon du lot 5b, ou
-- l'ordre inverse avait casse la fiche partenaire en production.
--
-- Aucun changement de policy : media_partners est deja couverte par
-- « Partners read own profile », « Partners update own profile » (dont le
-- WITH CHECK partner_privileged_cols_unchanged ne porte que sur status et
-- show_on_homepage — cette colonne n'en fait pas partie), et les policies
-- admin. L'ecriture se fait de toute facon en service-role depuis les routes.

alter table public.media_partners
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.media_partners.welcome_email_sent_at is
$c$Date a laquelle l'API Resend a ACCEPTE (2xx) le courriel de bienvenue
contenant les acces du partenaire.

N'EST PAS une preuve de livraison ni de lecture — un rebond ulterieur ne la
remet pas a NULL. Elle repond a « a-t-on envoye ? », pas a « a-t-il recu ? ».

NULL = aucun envoi reussi connu. En cas d'echec d'envoi, elle RESTE NULL et
l'ecran admin affiche le mot de passe temporaire avec un bandeau d'echec :
l'echec doit rester visible, jamais silencieux.

Ajoutee le 2026-08-20 apres le cas Jules Regimbald — cree le 13 aout, APPROVED,
jamais prevenu, et rien en base ne permettait de le detecter.$c$;
