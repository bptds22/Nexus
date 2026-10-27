-- ════════════════════════════════════════════════════════════════════════════
-- Badges NLS + GP — AJOUT au catalogue du partenaire « Nexus » (bpdesfosses@gmail.com).
-- Opération de DONNÉES, aucune migration : 10 lignes partner_badges + 1 ligne admin_operations.
--
-- Inclus par prod/rejeu-blanc.sql et prod/apply.sql (\ir), DANS leur transaction : ce fichier
-- n'ouvre ni ne ferme rien. Il vérifie lui-même :
--   · le partenaire : UN seul « Nexus » APPROUVÉ, au compte bpdesfosses@gmail.com ;
--   · l'icône : déposée d'abord (televerser-icones.mjs), à la taille du PNG du dépôt, en image/png ;
--   · aucun des 10 libellés déjà pris, aucune trace BADGES_NLS_GP_NEXUS déjà écrite.
-- Libellés en U&'…' : le « · » (U+00B7) ne dépend pas de l'encodage du client psql.
-- ════════════════════════════════════════════════════════════════════════════

do $op$
declare
  v_nexus uuid;
  v_par   uuid;
  v_id    uuid;
  v_ids   uuid[] := '{}';
  v_noms  text[] := '{}';
  n       int;
  r       record;
begin
  select count(*) into n
    from public.media_partners mp join public.users u on u.id = mp.user_id
   where u.email = 'bpdesfosses@gmail.com';
  if n <> 1 then
    raise exception 'NEXUS: % partenaire(s) au compte bpdesfosses@gmail.com, attendu 1', n;
  end if;
  select mp.id into v_nexus
    from public.media_partners mp join public.users u on u.id = mp.user_id
   where u.email = 'bpdesfosses@gmail.com' and mp.organization_name = 'Nexus' and mp.status = 'APPROVED';
  if v_nexus is null then
    raise exception 'NEXUS: le partenaire de bpdesfosses@gmail.com n''est pas « Nexus » APPROUVÉ';
  end if;

  if exists (select 1 from public.admin_operations where operation in ('BADGES_NLS_GP_NEXUS', 'BADGES_NLS_GP_NEXUS_RETIRES')) then
    raise exception 'NEXUS: BADGES_NLS_GP_NEXUS a déjà laissé une trace dans admin_operations';
  end if;

  -- L'auteur de la trace : le compte admin s'il existe (prod), sinon personne (pile locale).
  select id into v_par from public.users where email = 'bptds22@gmail.com' and role = 'ADMIN';

  for r in
    select * from (values
      (U&'NLS \00B7 Prospect', 'nls-prospect.png', 101, 107964),
      (U&'NLS \00B7 Top 50',   'nls-top50.png',    102, 110187),
      (U&'NLS \00B7 Top 25',   'nls-top25.png',    103, 108613),
      (U&'NLS \00B7 Top 10',   'nls-top10.png',    104,  98450),
      (U&'NLS \00B7 MVP',      'nls-mvp.png',      105,  98892),
      (U&'GP \00B7 Prospect',  'gp-prospect.png',  201,  66746),
      (U&'GP \00B7 Top 50',    'gp-top50.png',     202,  75244),
      (U&'GP \00B7 Top 25',    'gp-top25.png',     203,  68408),
      (U&'GP \00B7 Top 10',    'gp-top10.png',     204,  75764),
      (U&'GP \00B7 MVP',       'gp-mvp.png',       205,  59191)
    ) as t(libelle, fichier, ordre, taille)
    order by ordre
  loop
    if not exists (select 1 from storage.objects o
                    where o.bucket_id = 'partner-badges'
                      and o.name = v_nexus::text || '/' || r.fichier
                      and (o.metadata->>'size')::bigint = r.taille
                      and o.metadata->>'mimetype' = 'image/png') then
      raise exception 'NEXUS: icône %/% absente, ou pas % octets en image/png — lancer televerser-icones.mjs --envoyer d''abord',
        v_nexus, r.fichier, r.taille;
    end if;
    if exists (select 1 from public.partner_badges where partner_id = v_nexus and libelle = r.libelle) then
      raise exception 'NEXUS: le libellé « % » existe déjà chez Nexus', r.libelle;
    end if;

    insert into public.partner_badges (partner_id, libelle, icone_path, actif, ordre, cree_par)
    values (v_nexus, r.libelle, v_nexus::text || '/' || r.fichier, true, r.ordre, v_par)
    returning id into v_id;
    v_ids  := v_ids || v_id;
    v_noms := v_noms || r.libelle;
  end loop;

  if cardinality(v_ids) <> 10 then
    raise exception 'NEXUS: % badge(s) créé(s), attendu 10', cardinality(v_ids);
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('BADGES_NLS_GP_NEXUS',
          'Badges NLS (5) et GP (5) ajoutés au catalogue du partenaire Nexus (bpdesfosses) : NLS en attendant '
          || 'son compte partenaire, GP pour démo sur profils de test seulement. Données, aucune migration.',
          jsonb_build_object('partner_id', v_nexus, 'badge_ids', to_jsonb(v_ids), 'libelles', to_jsonb(v_noms)),
          v_par);

  raise notice 'NEXUS: 10 badges ajoutés au partenaire Nexus %', v_nexus;
end $op$;
