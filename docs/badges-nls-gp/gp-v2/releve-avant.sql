-- Badges GP v2 — cible + relevé AVANT, communs au rejeu à blanc, à l'apply et au rollback (\ir).
-- Exige nexus.attendu (posé par le fichier qui l'inclut). Crée _gp (les 5 ids GP) et _avant.
do $$
declare v uuid;
begin
  select mp.id into v from public.media_partners mp join public.users u on u.id = mp.user_id
   where u.email = 'bpdesfosses@gmail.com';
  if v is distinct from current_setting('nexus.attendu')::uuid then
    raise exception 'NEXUS: partenaire de bpdesfosses = %, attendu % — mauvaise base ?', v, current_setting('nexus.attendu');
  end if;
end $$;

create temp table _gp on commit drop as
select b.id from public.partner_badges b
 where b.id in (select jsonb_array_elements_text(details->'badge_ids')::uuid
                  from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS')
   and b.libelle like U&'GP \00B7 %';
do $$
begin
  if (select count(*) from _gp) <> 5 then
    raise exception 'NEXUS: % ligne(s) GP trouvée(s), attendu 5', (select count(*) from _gp);
  end if;
end $$;

create temp table _avant on commit drop as
select (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), ''))
          from public.partner_badges b where b.id not in (select id from _gp)) as autres_badges,
       (select md5(string_agg((to_jsonb(b) - 'icone_path' - 'updated_at')::text, '|' order by b.id))
          from public.partner_badges b where b.id in (select id from _gp)) as gp_hors_icone,
       (select md5(string_agg((to_jsonb(b) - 'updated_at')::text, '|' order by b.id))
          from public.partner_badges b where b.id in (select id from _gp)) as gp_hors_maj,
       (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) as poses,
       (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.media_partners m) as partenaires,
       (select md5(coalesce(string_agg(o.name || ':' || coalesce(o.metadata->>'size', ''), '|' order by o.name), ''))
          from storage.objects o where o.bucket_id = 'partner-badges') as fichiers,
       (select count(*) from public.admin_operations) as nb_ops;

select b.libelle, b.icone_path from public.partner_badges b where b.id in (select id from _gp) order by b.ordre;
