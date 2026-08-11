-- ═══════════════════════════════════════════════════════════════════════════
-- team_invitations.transfer_token — le jeton PERSONNEL de transfert
--
-- POURQUOI PAS UN team_join_token
-- Le code d'équipe est un SECRET D'ÉQUIPE : il porte une équipe, jamais une
-- personne, et il survit à celui qui l'utilise. L'envoyer par courriel à chaque
-- invitation reviendrait à diffuser la même clé à tout le monde, sans pouvoir
-- la révoquer pour un seul destinataire.
--
-- POURQUOI UNE COLONNE ET PAS UNE TABLE
-- La ligne d'invitation porte DÉJÀ tout ce qu'un jeton personnel demande :
--   · athlete_id           → le lien à une personne
--   · team_id              → l'équipe visée
--   · status               → l'usage unique, gratuitement (voir plus bas)
--   · expires_at           → l'échéance
--   · invited_by_coach_id  → la traçabilité « qui a fait entrer qui »
-- Une table séparée dupliquerait ces cinq colonnes et créerait une seconde
-- vérité à synchroniser avec la première.
--
-- L'USAGE UNIQUE EST GRATUIT
-- Le jeton ne vaut que tant que la ligne est PENDING. Accepter la ferme,
-- refuser la ferme, annuler la ferme. Aucun compteur d'utilisations à tenir,
-- aucune révocation à câbler : la machine à états de l'invitation EST le cycle
-- de vie du jeton.
--
-- ⚠ LE JETON N'AUTORISE RIEN — IL DÉSIGNE
-- Point de conception à ne pas perdre : accepter une invitation est une mise à
-- jour bornée par la policy « Athletes update own invitations »
-- (is_own_athlete + statut clampé à ACCEPTED/REJECTED). L'autorisation vient
-- donc de LA SESSION, pas du jeton. Un jeton qui fuit — journaux serveur,
-- en-tête Referer, courriel transféré — ne permet à personne d'accepter à la
-- place de l'athlète. Il ne sert qu'à désigner QUELLE invitation préremplir.
-- C'est ce qui rend le transport par URL défendable ici, alors que l'auteur du
-- portail l'avait écarté pour le code d'équipe (qui, lui, autorise).
--
-- Même alphabet et même longueur que les codes d'équipe : l'athlète peut le
-- recopier à la main si le lien se perd, et il ne contient ni 0, ni O, ni 1,
-- ni I, ni L.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.team_invitations
  add column if not exists transfer_token text;

comment on column public.team_invitations.transfer_token is
  'Jeton PERSONNEL de transfert, transporté dans le lien du courriel. Désigne '
  'l''invitation à préremplir ; n''autorise RIEN (l''acceptation reste bornée '
  'par is_own_athlete). Vaut tant que status = PENDING.';

-- Unicité globale : le jeton est résolu SANS connaître l'invitation, donc deux
-- lignes ne peuvent pas partager la même valeur. Partiel sur non-NULL, pour ne
-- pas contraindre les invitations créées avant cette colonne.
create unique index if not exists uq_team_invitations_transfer_token
  on public.team_invitations (transfer_token)
  where transfer_token is not null;
