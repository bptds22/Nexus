-- ═══════════════════════════════════════════════════════════════
-- 20261019103000 — partenaire : plus de plafond de 50 cartes prospects (BP 2026-10-18, 6.3 :
-- « aucun maximum » côté partenaire).
--
-- UN seul geste : partenaire_prospect_enregistrer perd son bloc
--     if (select count(*) … partner_id = v_mp.id) >= 50 then raise … '54000'
-- Tout le reste du corps est INCHANGÉ : la fonction est réécrite à partir de sa
-- définition en base (pg_get_functiondef), le bloc retiré mot pour mot, puis
-- recréée par CREATE OR REPLACE (signature, SECURITY DEFINER, ACL conservés).
--
-- Gardes :
--   · déjà appliquée (le bloc n'est plus là) → refus ;
--   · empreinte du corps ≠ celle relevée en prod et en local le 2026-10-18
--     (f5bef21b6e03bdab879904c315dd1238, sans \r) → refus, rien n'est touché ;
--   · après : bloc absent, empreinte attendue, ACL inchangée (liste triée complète).
-- Rollback : supabase/rollback/20261019103000_rollback_partenaire_cartes_sans_plafond.sql
-- Le client tolère les deux états (message « limite de 50 » tant que la migration n'est pas passée).
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  v_oid oid := 'public.partenaire_prospect_enregistrer(uuid,text,text,uuid,uuid,uuid,uuid,integer,boolean,numeric,jsonb,uuid[],uuid[])'::regprocedure;
  v_src text;
  v_def text;
  v_neuf text;
  v_acl_avant text[];
  v_acl_apres text[];
  v_bloc constant text :=
    E'    if (select count(*) from public.partenaire_prospects where partner_id = v_mp.id) >= 50 then\n'
    || E'      raise exception ''NEXUS: limite de 50 cartes prospects actives atteinte'' using errcode = ''54000'';\n'
    || E'    end if;\n';
begin
  select replace(prosrc, E'\r', ''), (select array_agg(x::text order by x::text) from unnest(coalesce(proacl, '{}')) x)
    into v_src, v_acl_avant from pg_proc where oid = v_oid;
  if position('limite de 50 cartes' in v_src) = 0 then
    raise exception 'NEXUS: 20261019103000 déjà appliquée (plus de plafond dans partenaire_prospect_enregistrer)';
  end if;
  if md5(v_src) <> 'f5bef21b6e03bdab879904c315dd1238' then
    raise exception 'NEXUS: partenaire_prospect_enregistrer a changé depuis le relevé (md5 %) — rien n''est touché', md5(v_src);
  end if;
  if v_acl_avant is distinct from array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres'] then
    raise exception 'NEXUS: ACL inattendue sur partenaire_prospect_enregistrer : %', v_acl_avant;
  end if;

  v_def := replace(pg_get_functiondef(v_oid), E'\r', '');
  v_neuf := replace(v_def, v_bloc, '');
  if v_neuf = v_def or (length(v_def) - length(v_neuf)) <> length(v_bloc) then
    raise exception 'NEXUS: bloc du plafond introuvable mot pour mot — rien n''est touché';
  end if;
  execute v_neuf;

  select replace(prosrc, E'\r', ''), (select array_agg(x::text order by x::text) from unnest(coalesce(proacl, '{}')) x)
    into v_src, v_acl_apres from pg_proc where oid = v_oid;
  if md5(v_src) <> '38a6a81e3bb47e193d1645f89b1bb890' or position('54000' in v_src) > 0 then
    raise exception 'NEXUS: corps inattendu après la réécriture (md5 %)', md5(v_src);
  end if;
  if v_acl_apres is distinct from v_acl_avant then
    raise exception 'NEXUS: ACL modifiée par la réécriture : % → %', v_acl_avant, v_acl_apres;
  end if;
  raise notice 'NEXUS: plafond de 50 cartes retiré de partenaire_prospect_enregistrer';
end $$;
