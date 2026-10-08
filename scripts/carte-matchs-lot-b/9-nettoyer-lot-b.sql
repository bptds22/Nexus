-- Nettoyage des fixtures LOCALES du lot B (carte des matchs).
begin;
delete from public.matchs_ajoutes where game_id in (select id from public.games where id::text like '77770000-0000-0000-0000-0000000000f%')
   or ajoute_par in (select id from public.users where email like '%@preuve.local');
delete from public.games where id in ('77770000-0000-0000-0000-0000000000f1', '77770000-0000-0000-0000-0000000000f2');
delete from public.lieux_geocodes where nom_normalise = public.lieu_normalise('Parc des Bénévoles');
commit;
