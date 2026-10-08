-- Rollback 1/4 : retire la table des codes de sport (la fonction v2 ne peut plus tourner sans elle).
begin;
drop table if exists public.rseq_codes_sport;
commit;
