-- Nettoyage des fixtures du lot 2 (base LOCALE) : cartes « …ui » / « …preuve2 »
-- du jour, leurs invitations et propositions, l'athlète 77770000-…-0007.
begin;
create temp table mc as select id from public.cartes_prospect
 where created_at::date = current_date and (nom like '%ui' or nom like '%preuve2');
select count(*) as cartes from mc;
delete from public.cartes_prospect_invitations where carte_id in (select id from mc);
delete from public.rapprochements where carte_id in (select id from mc) or athlete_id::text like '77770000%';
delete from public.cartes_prospect where id in (select id from mc);
delete from public.athletes where id = '77770000-0000-0000-0000-000000000007';
commit;
