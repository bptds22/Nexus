-- Badges GP v2 — contrôles après la mise à jour, communs au rejeu à blanc et à l'apply (\ir).
-- Seul icone_path (et updated_at) des 5 lignes GP a changé, vers les « -v2.png » ; rien d'autre.
do $$
declare v_nexus text := current_setting('nexus.attendu'); n int;
begin
  if (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), ''))
        from public.partner_badges b where b.id not in (select id from _gp)) is distinct from (select autres_badges from _avant) then
    raise exception 'NEXUS: un badge hors GP a changé (NLS compris)';
  end if;
  if (select md5(string_agg((to_jsonb(b) - 'icone_path' - 'updated_at')::text, '|' order by b.id))
        from public.partner_badges b where b.id in (select id from _gp)) is distinct from (select gp_hors_icone from _avant) then
    raise exception 'NEXUS: une ligne GP a changé ailleurs que dans son icône';
  end if;
  select count(*) into n from public.partner_badges b
   where b.id in (select id from _gp)
     and b.icone_path = v_nexus || '/gp-' || replace(lower(split_part(b.libelle, U&' \00B7 ', 2)), ' ', '') || '-v2.png';
  if n <> 5 then
    raise exception 'NEXUS: % ligne(s) GP sur leur fichier v2, attendu 5', n;
  end if;
  if (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.partner_athlete_badges x) is distinct from (select poses from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.media_partners m) is distinct from (select partenaires from _avant)
     or (select md5(coalesce(string_agg(o.name || ':' || coalesce(o.metadata->>'size', ''), '|' order by o.name), ''))
           from storage.objects o where o.bucket_id = 'partner-badges') is distinct from (select fichiers from _avant) then
    raise exception 'NEXUS: poses, partenaires ou fichiers ont bougé';
  end if;
  if (select count(*) from public.admin_operations) <> (select nb_ops from _avant) + 1 then
    raise exception 'NEXUS: admin_operations : attendu exactement 1 ligne de plus';
  end if;
end $$;

select b.libelle, b.icone_path from public.partner_badges b where b.id in (select id from _gp) order by b.ordre;
