-- ════════════════════════════════════════════════════════════════════════════
-- JOURNAL DE CARTE — « INVITATION REMISE À ZÉRO » (décision BP 2026-09-30).
--
-- Une remise à zéro d'invitation (opération d'admin : les lignes d'invitation
-- d'une adresse retirées, pour la traiter comme jamais invitée) laisse une
-- trace au journal de chaque carte concernée : action INVITATION_REINITIALISEE,
-- sans acteur (opération plateforme), details = { motif, lignes_retirees }.
-- L'Historique la rend sans sujet : « Invitation remise à zéro (motif) ».
--
-- ADDITIVE : une valeur ajoutée au contrôle d'action du journal. Rien d'autre.
-- Rollback : supabase/rollback/20261001014623_rollback_carte_invitation_reinitialisee.sql
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE','INVITATION_RENVOYEE','INVITATION_RAPPEL',
                    'INVITATION_REINITIALISEE'));
