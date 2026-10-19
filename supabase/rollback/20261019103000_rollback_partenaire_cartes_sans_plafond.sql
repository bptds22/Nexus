-- Rollback de 20261019103000 : remet le plafond de 50 cartes dans partenaire_prospect_enregistrer,
-- au même endroit (juste après le verrou consultatif de la création), corps EXACT d'avant
-- (md5 f5bef21b6e03bdab879904c315dd1238, sans \r). Refuse si le corps n'est pas celui laissé par la migration.
do $$
declare
  v_oid oid := 'public.partenaire_prospect_enregistrer(uuid,text,text,uuid,uuid,uuid,uuid,integer,boolean,numeric,jsonb,uuid[],uuid[])'::regprocedure;
  v_src text;
  v_def text;
  v_neuf text;
  v_acl_avant text[];
  v_acl_apres text[];
  v_ancre constant text := E'    perform pg_advisory_xact_lock(hashtext(''w4-prospects:'' || v_mp.id::text));\n';
  v_bloc constant text :=
    E'    if (select count(*) from public.partenaire_prospects where partner_id = v_mp.id) >= 50 then\n'
    || E'      raise exception ''NEXUS: limite de 50 cartes prospects actives atteinte'' using errcode = ''54000'';\n'
    || E'    end if;\n';
begin
  select replace(prosrc, E'\r', ''), (select array_agg(x::text order by x::text) from unnest(coalesce(proacl, '{}')) x)
    into v_src, v_acl_avant from pg_proc where oid = v_oid;
  if md5(v_src) <> '38a6a81e3bb47e193d1645f89b1bb890' then
    raise exception 'NEXUS: corps inattendu (md5 %) — 20261019103000 absente ou modifiée depuis, rien n''est touché', md5(v_src);
  end if;
  v_def := replace(pg_get_functiondef(v_oid), E'\r', '');
  if (length(v_def) - length(replace(v_def, v_ancre, ''))) <> length(v_ancre) then
    raise exception 'NEXUS: ancre du verrou introuvable une seule fois — rien n''est touché';
  end if;
  v_neuf := replace(v_def, v_ancre, v_ancre || v_bloc);
  execute v_neuf;
  select replace(prosrc, E'\r', ''), (select array_agg(x::text order by x::text) from unnest(coalesce(proacl, '{}')) x)
    into v_src, v_acl_apres from pg_proc where oid = v_oid;
  if md5(v_src) <> 'f5bef21b6e03bdab879904c315dd1238' then
    raise exception 'NEXUS: corps inattendu après le rollback (md5 %)', md5(v_src);
  end if;
  if v_acl_apres is distinct from v_acl_avant then
    raise exception 'NEXUS: ACL modifiée par le rollback : % → %', v_acl_avant, v_acl_apres;
  end if;
  raise notice 'NEXUS: plafond de 50 cartes remis dans partenaire_prospect_enregistrer';
end $$;
