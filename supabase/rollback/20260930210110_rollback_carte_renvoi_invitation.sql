-- Rollback de 20260930210110_carte_renvoi_invitation.
-- Retire la fonction, les lignes INVITATION_RENVOYEE et la valeur du contrôle
-- (qui revient à celui de 20260930210059_carte_invitation_etat).
-- La dernière activité rafraîchie par un renvoi n'est pas remise en arrière.

drop function public.journaliser_renvoi_invitation(uuid);
delete from public.cartes_prospect_journal where action = 'INVITATION_RENVOYEE';
alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE'));
