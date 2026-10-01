-- Rollback de 20261001014623_carte_invitation_reinitialisee.
-- ⚠ Retire aussi les lignes INVITATION_REINITIALISEE du journal (sinon le
-- contrôle ne se repose pas). Les remises à zéro elles-mêmes restent faites.

delete from public.cartes_prospect_journal where action = 'INVITATION_REINITIALISEE';
alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE','INVITATION_RENVOYEE','INVITATION_RAPPEL'));
