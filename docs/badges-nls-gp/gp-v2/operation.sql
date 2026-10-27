-- ════════════════════════════════════════════════════════════════════════════
-- Badges GP v2 — les 5 lignes GP du catalogue « Nexus » pointent sur les NOUVEAUX fichiers
-- « gp-*-v2.png » (nouveaux noms : aucun cache ne ressert l'ancienne image).
-- Mêmes ids, mêmes libellés : les poses (vivantes ou retirées) restent attachées.
-- Les 5 NLS ne sont pas touchés. Données seulement, aucune migration.
--
-- Inclus (\ir) par gp-v2/rejeu-blanc.sql et gp-v2/apply.sql, DANS leur transaction, qui posent
-- nexus.attendu (la cible). Vérifie lui-même : les 5 ids viennent de la trace
-- BADGES_NLS_GP_NEXUS, chaque ligne pointe ENCORE sur l'ancien fichier, le nouveau fichier est
-- déposé (taille, image/png), et la trace BADGES_GP_ICONES_V2 n'existe pas déjà.
-- ════════════════════════════════════════════════════════════════════════════

do $op$
declare
  v_nexus uuid := current_setting('nexus.attendu')::uuid;
  v_ids   uuid[];
  v_id    uuid;
  v_chg   jsonb := '[]'::jsonb;
  r       record;
begin
  select array(select jsonb_array_elements_text(details->'badge_ids')::uuid) into v_ids
    from public.admin_operations
   where operation = 'BADGES_NLS_GP_NEXUS' and details->>'partner_id' = v_nexus::text;
  if coalesce(cardinality(v_ids), 0) <> 10 then
    raise exception 'NEXUS: trace BADGES_NLS_GP_NEXUS du partenaire % absente ou incomplète', v_nexus;
  end if;
  if exists (select 1 from public.admin_operations where operation like 'BADGES_GP_ICONES_V2%') then
    raise exception 'NEXUS: BADGES_GP_ICONES_V2 a déjà laissé une trace dans admin_operations';
  end if;

  for r in
    select * from (values
      (U&'GP \00B7 Prospect', 'gp-prospect.png', 'gp-prospect-v2.png', 58661),
      (U&'GP \00B7 Top 50',   'gp-top50.png',    'gp-top50-v2.png',    70189),
      (U&'GP \00B7 Top 25',   'gp-top25.png',    'gp-top25-v2.png',    65027),
      (U&'GP \00B7 Top 10',   'gp-top10.png',    'gp-top10-v2.png',    95302),
      (U&'GP \00B7 MVP',      'gp-mvp.png',      'gp-mvp-v2.png',      51386)
    ) as t(libelle, ancien, nouveau, taille)
  loop
    select id into v_id from public.partner_badges
     where id = any (v_ids) and partner_id = v_nexus and libelle = r.libelle
       and icone_path = v_nexus::text || '/' || r.ancien;
    if v_id is null then
      raise exception 'NEXUS: « % » introuvable, ou ne pointe plus sur %', r.libelle, r.ancien;
    end if;
    if not exists (select 1 from storage.objects o
                    where o.bucket_id = 'partner-badges'
                      and o.name = v_nexus::text || '/' || r.nouveau
                      and (o.metadata->>'size')::bigint = r.taille
                      and o.metadata->>'mimetype' = 'image/png') then
      raise exception 'NEXUS: nouveau fichier %/% absent, ou pas % octets en image/png — déposer d''abord (--fichiers … --envoyer)',
        v_nexus, r.nouveau, r.taille;
    end if;

    update public.partner_badges
       set icone_path = v_nexus::text || '/' || r.nouveau, updated_at = now()
     where id = v_id;
    v_chg := v_chg || jsonb_build_object('id', v_id, 'libelle', r.libelle,
                                         'avant', v_nexus::text || '/' || r.ancien,
                                         'apres', v_nexus::text || '/' || r.nouveau);
    v_id := null;
  end loop;

  if jsonb_array_length(v_chg) <> 5 then
    raise exception 'NEXUS: % ligne(s) GP mise(s) à jour, attendu 5', jsonb_array_length(v_chg);
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('BADGES_GP_ICONES_V2',
          'Badges GP : les 5 icônes remplacées par la v2 (nouveaux noms de fichier, mêmes ids et libellés). NLS non touchés.',
          jsonb_build_object('partner_id', v_nexus, 'changements', v_chg),
          (select id from public.users where email = 'bptds22@gmail.com' and role = 'ADMIN'));

  raise notice 'NEXUS: 5 badges GP pointent sur les fichiers v2';
end $op$;
