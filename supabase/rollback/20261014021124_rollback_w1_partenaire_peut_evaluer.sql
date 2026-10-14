-- Rollback de 20261014021124_w1_partenaire_peut_evaluer.sql : retire la garde,
-- la table des sports permis et la colonne peut_evaluer.
-- ⚠ Après W2+ : défaire d'abord les lots qui appellent partenaire_peut_evaluer().
-- Les sports cochés et les permissions posées par l'admin sont PERDUS (relever avant).

drop function if exists public.partenaire_peut_evaluer(uuid, uuid);
drop table if exists public.partenaire_sports_permis;
alter table public.media_partners drop column if exists peut_evaluer;
