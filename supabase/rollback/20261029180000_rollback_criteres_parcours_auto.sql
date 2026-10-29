-- Rollback de 20261029180000_criteres_parcours_auto : retire la fonction des critères, le trigger de date
-- et la colonne video_faits_saillants_maj_le (les dates posées depuis sont perdues ; les liens restent).
drop function if exists public.mes_criteres_parcours();
drop trigger if exists trg_athletes_video_faits_saillants_date on public.athletes;
drop function if exists public.athletes_video_faits_saillants_date();
alter table public.athletes drop column if exists video_faits_saillants_maj_le;
