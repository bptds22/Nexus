-- Badges NLS + GP — contrôles après l'AJOUT, communs au rejeu à blanc et à l'apply (\ir).
-- Lit _avant (relevé AVANT) et nexus.attendu (la cible), posés par le fichier qui l'inclut.
-- Toute différence hors des 10 nouvelles lignes et de la trace = exception = rien n'est gardé.
do $$
declare v_ids uuid[]; n int; v_nexus uuid := current_setting('nexus.attendu')::uuid;
begin
  select array(select jsonb_array_elements_text(details->'badge_ids')::uuid) into v_ids
    from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS';
  if coalesce(cardinality(v_ids), 0) <> 10 then
    raise exception 'NEXUS: trace BADGES_NLS_GP_NEXUS absente ou incomplète';
  end if;
  if (select count(*) from public.partner_badges) <> (select nb_catalogue from _avant) + 10 then
    raise exception 'NEXUS: catalogue : nombre de lignes inattendu';
  end if;
  if (select md5(coalesce(string_agg(to_jsonb(b)::text, '|' order by b.id), '')) from public.partner_badges b where b.id <> all (v_ids))
     is distinct from (select catalogue from _avant) then
    raise exception 'NEXUS: un badge existant a changé';
  end if;
  select count(*) into n from public.partner_badges b
   where b.id = any (v_ids) and b.actif and b.partner_id = v_nexus
     and b.libelle in (U&'NLS \00B7 Prospect', U&'NLS \00B7 Top 50', U&'NLS \00B7 Top 25', U&'NLS \00B7 Top 10', U&'NLS \00B7 MVP',
                       U&'GP \00B7 Prospect',  U&'GP \00B7 Top 50',  U&'GP \00B7 Top 25',  U&'GP \00B7 Top 10',  U&'GP \00B7 MVP')
     and b.icone_path = v_nexus::text || '/' || lower(split_part(b.libelle, U&' \00B7 ', 1)) || '-'
                        || replace(lower(split_part(b.libelle, U&' \00B7 ', 2)), ' ', '') || '.png';
  if n <> 10 then
    raise exception 'NEXUS: % badge(s) conforme(s) (libellé exact, icône, partenaire, actif), attendu 10', n;
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
