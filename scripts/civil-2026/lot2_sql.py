"""
Lot 2 — organisations civiles + géocodage approximatif : génère le SQL d'apply et de rollback.

Entrées : plan.json (lot 0 v2) et geocodage-prod.json (relevé prod en lecture seule).
Sorties (docs/civil-2026/lot2/) :
  1-organisations.sql   un seul bloc DO gardé : crée les 201 organisations, géocode (lat IS NULL
                        seulement, jamais d'écrasement), inscrit les correspondances INVENTAIRE,
                        journalise CIVIL_ORGANISATIONS_CREEES (ids créés + coordonnées d'avant) ;
  2-rollback.sql        défait la dernière opération non annulée ; refuse si une organisation
                        créée est référencée (équipe, athlète, coach…) ou si une coordonnée a bougé.
  donnees.json          les données embarquées, pour relecture.

  python -I lot2_sql.py --plan <plan.json> --geo <geocodage-prod.json> --sortie <dossier>
"""
import argparse, hashlib, json, os, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lot2_geo import villes_principales  # noqa: E402

# Lignes LIGUE_CIVILE qui ne sont pas des clubs (test, placeholder) : jamais géocodées.
EXCLUES_GEO = {"Nexus Civil", "jdjdhd", "RSEQ"}


def donnees(plan, geo):
    coords = {k: (lat, lng) for k, lat, lng, _n in geo["resultats"]}
    vp = villes_principales(plan)
    nouvelles, cles_vues = [], defaultdict(set)
    for o in plan["organisations"]["a_creer"]:
        ville = vp.get(o["cle"]) or o["ville"] or None
        if ville and "," in ville:          # « Candiac, Delson et La Prairie » : pas une ville
            ville = None
        lat, lng = coords.get("n:" + o["cle"], (None, None))
        sources = sorted({o["nom"], *o["noms_source"]})
        for s in sources:
            cles_vues[s].add(("n", o["nom"]))
        nouvelles.append({"nom": o["nom"], "region": o["region"] or None, "city": ville,
                          "lat": lat, "lng": lng, "sport": o["sport"], "sources": sources})
    # Correspondances INVENTAIRE des organisations existantes : nom du club dans l'inventaire
    sources_ex = set()
    for e in plan["equipes"]:
        org = e["organisation"]
        if org["statut"] == "existante" and e.get("club_source") and e["club_source"] not in ("?", ""):
            sources_ex.add((org["nom"], org["type_attendu"], e["club_source"]))
            cles_vues[e["club_source"]].add(("e", org["nom"]))
    conflits = {k: v for k, v in cles_vues.items() if len(v) > 1}
    assert not conflits, f"une clé source désigne deux organisations : {conflits}"
    geo_ex = []
    for k, lat, lng, _n in geo["resultats"]:
        if k.startswith("e:") and k[2:] not in EXCLUES_GEO:
            geo_ex.append({"nom": k[2:], "type": "LIGUE_CIVILE", "lat": lat, "lng": lng})
    return {"nouvelles": nouvelles,
            "sources_existantes": [{"nom": n, "type": t, "source_cle": c} for n, t, c in sorted(sources_ex)],
            "geo_existantes": sorted(geo_ex, key=lambda x: x["nom"])}


APPLY = r"""-- Lot 2 civil — organisations + géocodage approximatif. UN SEUL bloc DO : une garde qui échoue
-- annule tout. Données embarquées (donnees.json, md5 {md5}). Prod : sur GO de BP seulement.
do $lot2$
declare
  v_brut   text := $donnees${donnees}$donnees$;
  d        jsonb;
  v_op     uuid;
  n_new    int;
  n_geo    int;
  n_src    int;
  v_avant  jsonb;
  v_txt    text;
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 5) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi avant 5 h';
  end if;
  if md5(v_brut) <> '{md5}' then
    raise exception 'NEXUS: données du lot 2 altérées (md5 %)', md5(v_brut);
  end if;
  d := v_brut::jsonb;
  if to_regclass('public.organisations_sources') is null then
    raise exception 'NEXUS: lot 1 civil absent (organisations_sources)';
  end if;
  if exists (select 1 from public.admin_operations o where o.operation = 'CIVIL_ORGANISATIONS_CREEES'
              and not exists (select 1 from public.admin_operations a where a.operation = 'CIVIL_ORGANISATIONS_ANNULEES'
                                and a.details->>'op' = o.id::text)) then
    raise exception 'NEXUS: lot 2 déjà appliqué (opération non annulée)';
  end if;

  create temp table _l2_new on commit drop as
    select gen_random_uuid() as id, x.* from jsonb_to_recordset(d->'nouvelles')
      as x(nom text, region text, city text, lat float8, lng float8, sport text, sources text[]);
  create temp table _l2_geo on commit drop as
    select x.*, s.id, s.lat as lat_avant, s.lng as lng_avant, s.geo_source as geo_avant
      from jsonb_to_recordset(d->'geo_existantes') as x(nom text, type text, lat float8, lng float8)
      left join public.schools s on s.name = x.nom and s.type = x.type;
  create temp table _l2_src on commit drop as
    select x.*, s.id as school_id
      from jsonb_to_recordset(d->'sources_existantes') as x(nom text, type text, source_cle text)
      left join public.schools s on s.name = x.nom and s.type = x.type;

  -- Gardes d'avant
  select count(*) into n_new from _l2_new;
  if n_new <> {n_new} then raise exception 'NEXUS: % organisations à créer, attendu {n_new}', n_new; end if;
  select string_agg(n.nom, ' ; ') into v_txt from _l2_new n
   where exists (select 1 from public.schools s where lower(s.name) = lower(n.nom));
  if v_txt is not null then raise exception 'NEXUS: existe déjà : %', v_txt; end if;
  select string_agg(nom, ' ; ') into v_txt from (
    select x.nom from jsonb_to_recordset(d->'geo_existantes') as x(nom text, type text)
     where (select count(*) from public.schools s where s.name = x.nom and s.type = x.type) <> 1
    union
    select x.nom from jsonb_to_recordset(d->'sources_existantes') as x(nom text, type text)
     where (select count(*) from public.schools s where s.name = x.nom and s.type = x.type) <> 1) z;
  if v_txt is not null then raise exception 'NEXUS: organisation existante introuvable ou en double : %', v_txt; end if;
  select string_agg(nom, ' ; ') into v_txt from _l2_geo where lat_avant is not null;
  if v_txt is not null then raise exception 'NEXUS: déjà géocodée (jamais d''écrasement) : %', v_txt; end if;

  -- Journal d'abord : les correspondances le référencent
  select jsonb_agg(jsonb_build_object('id', id, 'lat', lat_avant, 'lng', lng_avant, 'geo_source', geo_avant,
                                      'lat_pose', lat, 'lng_pose', lng) order by nom)
    into v_avant from _l2_geo;
  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_ORGANISATIONS_CREEES',
          'Import civil 2026-27, lot 2 : organisations civiles créées (liste validée par BP) + géocodage approximatif par ville',
          jsonb_build_object('lot', 2, 'md5_donnees', '{md5}',
                             'nouvelles_ids', (select jsonb_agg(id order by nom) from _l2_new),
                             'nouvelles_geocodees', (select count(*) from _l2_new where lat is not null),
                             'geo_existantes', v_avant,
                             'methode_geo', 'moyenne des écoles / cégeps géocodés de la ville (prod, relevé du 2026-10-26)'),
          (select id from public.users where email = 'bptds22@gmail.com'))
  returning id into v_op;

  insert into public.schools (id, name, type, region, city, lat, lng, geo_source)
  select id, nom, 'LIGUE_CIVILE', region, city, lat, lng, case when lat is not null then 'approx' end from _l2_new;
  get diagnostics n_new = row_count;

  update public.schools s set lat = g.lat, lng = g.lng, geo_source = 'approx', updated_at = now()
    from _l2_geo g where s.id = g.id and s.lat is null;
  get diagnostics n_geo = row_count;

  insert into public.organisations_sources (source_nom, source_cle, school_id, operation_id)
  select 'INVENTAIRE', unnest(sources), id, v_op from _l2_new
  union all
  select 'INVENTAIRE', source_cle, school_id, v_op from _l2_src;
  get diagnostics n_src = row_count;

  -- Gardes d'après
  if n_new <> {n_new} or n_geo <> {n_geo} or n_src <> {n_src} then
    raise exception 'NEXUS: comptes inattendus — créées %, géocodées %, correspondances % (attendu {n_new} / {n_geo} / {n_src})',
      n_new, n_geo, n_src;
  end if;
  if (select count(*) from public.schools where id in (select id from _l2_new) and type = 'LIGUE_CIVILE') <> {n_new} then
    raise exception 'NEXUS: organisations créées introuvables';
  end if;
  raise notice 'NEXUS: lot 2 — % organisations créées (% géocodées), % existantes géocodées, % correspondances (op %)',
    n_new, (select count(*) from _l2_new where lat is not null), n_geo, n_src, v_op;
end $lot2$;
"""

ROLLBACK = r"""-- Rollback du lot 2 civil : défait la dernière opération CIVIL_ORGANISATIONS_CREEES non annulée.
-- Refuse si une organisation créée est référencée ailleurs (équipe, athlète, coach, cible…) ou si
-- une coordonnée posée a été modifiée depuis. UN SEUL bloc DO.
do $rb2$
declare
  o       public.admin_operations;
  v_ids   uuid[];
  r       record;
  n       bigint;
  n_del   int;
  n_src   int;
  n_geo   int;
begin
  select * into o from public.admin_operations a
   where a.operation = 'CIVIL_ORGANISATIONS_CREEES'
     and not exists (select 1 from public.admin_operations b where b.operation = 'CIVIL_ORGANISATIONS_ANNULEES'
                       and b.details->>'op' = a.id::text)
   order by a.le desc limit 1;
  if not found then raise exception 'NEXUS: aucune opération du lot 2 à défaire'; end if;
  v_ids := array(select jsonb_array_elements_text(o.details->'nouvelles_ids')::uuid);

  -- Toute clé étrangère vers schools, sauf organisations_sources : aucune ligne ne doit viser les créées
  for r in select c.conrelid::regclass as t, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.confrelid = 'public.schools'::regclass
              and c.conrelid <> 'public.organisations_sources'::regclass loop
    execute format('select count(*) from %s where %I = any($1)', r.t, r.col) into n using v_ids;
    if n > 0 then
      raise exception 'NEXUS: % ligne(s) de % visent une organisation du lot 2 — défaire les lots suivants d''abord', n, r.t;
    end if;
  end loop;

  -- Coordonnées : on ne restaure que ce que le lot a posé, inchangé depuis
  if exists (select 1 from jsonb_array_elements(o.details->'geo_existantes') g
               join public.schools s on s.id = (g->>'id')::uuid
              where s.lat is distinct from (g->>'lat_pose')::float8 or s.lng is distinct from (g->>'lng_pose')::float8
                 or s.geo_source is distinct from 'approx') then
    raise exception 'NEXUS: une coordonnée posée par le lot 2 a été modifiée depuis — rien n''est défait';
  end if;
  update public.schools s set lat = (g->>'lat')::float8, lng = (g->>'lng')::float8, geo_source = g->>'geo_source',
                              updated_at = now()
    from jsonb_array_elements(o.details->'geo_existantes') g where s.id = (g->>'id')::uuid;
  get diagnostics n_geo = row_count;

  delete from public.organisations_sources where operation_id = o.id;
  get diagnostics n_src = row_count;
  delete from public.schools where id = any(v_ids);
  get diagnostics n_del = row_count;
  if n_del <> cardinality(v_ids) or n_geo <> jsonb_array_length(o.details->'geo_existantes') then
    raise exception 'NEXUS: rollback incomplet (% / % supprimées, % / % coordonnées)', n_del, cardinality(v_ids),
      n_geo, jsonb_array_length(o.details->'geo_existantes');
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_ORGANISATIONS_ANNULEES', 'Annulation du lot 2 civil (organisations + géocodage)',
          jsonb_build_object('op', o.id, 'supprimees', n_del, 'coordonnees_restaurees', n_geo, 'correspondances', n_src),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: lot 2 défait — % organisations supprimées, % coordonnées restaurées, % correspondances (op %)',
    n_del, n_geo, n_src, o.id;
end $rb2$;
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--geo", required=True)
    ap.add_argument("--sortie", required=True)
    a = ap.parse_args()
    plan = json.load(open(a.plan, encoding="utf-8"))
    geo = json.load(open(a.geo, encoding="utf-8"))
    d = donnees(plan, geo)
    os.makedirs(a.sortie, exist_ok=True)
    texte = json.dumps(d, ensure_ascii=False, sort_keys=True, separators=(", ", ": "))
    assert "$donnees$" not in texte
    open(os.path.join(a.sortie, "donnees.json"), "w", encoding="utf-8").write(texte)
    md5 = hashlib.md5(texte.encode()).hexdigest()
    n_src = sum(len(n["sources"]) for n in d["nouvelles"]) + len(d["sources_existantes"])
    sql = (APPLY.replace("{donnees}", texte).replace("{md5}", md5)
           .replace("{n_new}", str(len(d["nouvelles"]))).replace("{n_geo}", str(len(d["geo_existantes"])))
           .replace("{n_src}", str(n_src)))
    open(os.path.join(a.sortie, "1-organisations.sql"), "w", encoding="utf-8", newline="\n").write(sql)
    open(os.path.join(a.sortie, "2-rollback.sql"), "w", encoding="utf-8", newline="\n").write(ROLLBACK)
    print(f"organisations à créer {len(d['nouvelles'])} (géocodées {sum(1 for n in d['nouvelles'] if n['lat'])}), "
          f"existantes à géocoder {len(d['geo_existantes'])}, correspondances {n_src}, md5 données {md5}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
