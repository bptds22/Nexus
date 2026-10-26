"""
Lot 3 — équipes civiles de MOINS DE 18 ANS (U14-U18 soccer, Benjamin / Cadet / Juvénile basket).

  python -I lot3_sql.py --plan <plan.json> --sortie <dossier>

Sorties : 1-equipes.sql (un bloc DO gardé), 2-rollback.sql, donnees.json.
Une équipe : [organisation, type, sport, nom, catégorie, division, sexe, ligue, source, [clés source]].
Clé source SPORDLE = « teamId|ligue » ; MBL / KREEZEE = « ligue|division source|nom source ».
Exige le lot 2 (organisations). Saison '2026-2027', zone '' ; aucun coach n'est rattaché.
"""
import argparse, hashlib, json, os, sys
from collections import Counter

TRANCHE = "-18"
OPERATION = "CIVIL_EQUIPES_MOINS18_CREEES"


def donnees(plan):
    lignes = []
    for e in plan["equipes"]:
        if e["tranche"] != TRANCHE:
            continue
        o = e["organisation"]
        if e["source_nom"] == "SPORDLE":
            cles = e["source_cles"]
        else:
            cles = [f'{e["league"]}|{e["division_source"]}|{e["nom_source"]}']
        lignes.append([o["nom"], o["type_attendu"], e["sport"], e.get("nom_propose_dedoublonne") or e["nom"],
                       e["age_group"], e["division"] or "", e["gender"], e["league"], e["source_nom"], cles])
    ident = Counter((l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7]) for l in lignes)
    assert max(ident.values()) == 1, "deux équipes du lot partagent la même identité"
    cles = Counter((l[8], c) for l in lignes for c in l[9])
    assert max(cles.values()) == 1, "une clé source sert deux équipes"
    return lignes


APPLY = r"""-- Lot 3 civil — équipes de moins de 18 ans. UN SEUL bloc DO : une garde qui échoue annule tout.
-- Données embarquées (donnees.json, md5 {md5}). Prod : sur GO de BP seulement.
do $lot3$
declare
  v_brut text := $donnees${donnees}$donnees$;
  d      jsonb;
  v_op   uuid;
  n_eq   int;
  n_src  int;
  v_txt  text;
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 5) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi avant 5 h';
  end if;
  if md5(v_brut) <> '{md5}' then raise exception 'NEXUS: données du lot 3 altérées (md5 %)', md5(v_brut); end if;
  d := v_brut::jsonb;
  if exists (select 1 from public.admin_operations o where o.operation = '{op}'
              and not exists (select 1 from public.admin_operations a where a.operation = '{op}_ANNULEES'
                                and a.details->>'op' = o.id::text)) then
    raise exception 'NEXUS: lot 3 déjà appliqué (opération non annulée)';
  end if;
  if not exists (select 1 from public.admin_operations o where o.operation = 'CIVIL_ORGANISATIONS_CREEES'
                  and not exists (select 1 from public.admin_operations a where a.operation = 'CIVIL_ORGANISATIONS_ANNULEES'
                                    and a.details->>'op' = o.id::text)) then
    raise exception 'NEXUS: lot 2 (organisations) absent';
  end if;

  create temp table _l3 on commit drop as
    select gen_random_uuid() as id, x.*,
           (select s.id from public.schools s where s.name = x.org and s.type = x.org_type) as school_id,
           (select count(*) from public.schools s where s.name = x.org and s.type = x.org_type) as n_org,
           (select sp.id from public.sports sp where sp.nom = x.sport) as sport_id
      from (select e->>0 as org, e->>1 as org_type, e->>2 as sport, e->>3 as nom, e->>4 as age_group,
                   e->>5 as division, e->>6 as gender, e->>7 as league, e->>8 as source_nom,
                   array(select jsonb_array_elements_text(e->9)) as cles
              from jsonb_array_elements(d) e) x;

  -- Gardes d'avant
  select count(*) into n_eq from _l3;
  if n_eq <> {n} then raise exception 'NEXUS: % équipes, attendu {n}', n_eq; end if;
  select string_agg(distinct org || ' (' || org_type || ')', ' ; ') into v_txt from _l3 where n_org <> 1;
  if v_txt is not null then raise exception 'NEXUS: organisation introuvable ou en double : %', v_txt; end if;
  select string_agg(distinct sport, ' ; ') into v_txt from _l3 where sport_id is null;
  if v_txt is not null then raise exception 'NEXUS: sport inconnu : %', v_txt; end if;
  select string_agg(x.nom || ' / ' || x.org, ' ; ') into v_txt from _l3 x
   where exists (select 1 from public.teams t
                  where t.school_id = x.school_id and t.sport_id = x.sport_id and t.name = x.nom
                    and t.age_group is not distinct from x.age_group and t.division is not distinct from x.division
                    and t.gender is not distinct from x.gender and t.season = '2026-2027'
                    and t.league is not distinct from x.league and t.zone = '');
  if v_txt is not null then raise exception 'NEXUS: équipe déjà présente (même identité) : %', v_txt; end if;
  if exists (select 1 from _l3 x, unnest(x.cles) c
              join public.equipes_sources es on es.source_cle = c where es.source_nom = x.source_nom) then
    raise exception 'NEXUS: une clé source est déjà rattachée à une équipe';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('{op}',
          'Import civil 2026-27, lot 3 : équipes civiles de moins de 18 ans (rejoignables), saison 2026-2027',
          jsonb_build_object('lot', 3, 'tranche', '-18', 'md5_donnees', '{md5}',
                             'ids', (select jsonb_agg(id order by org, nom) from _l3),
                             'par_sport', (select jsonb_object_agg(sport, n) from (select sport, count(*) n from _l3 group by 1) z)),
          (select id from public.users where email = 'bptds22@gmail.com'))
  returning id into v_op;

  insert into public.teams (id, school_id, sport_id, name, division, league, season, is_active, age_group, gender, zone)
  select id, school_id, sport_id, nom, division, league, '2026-2027', true, age_group, gender, '' from _l3;
  get diagnostics n_eq = row_count;

  insert into public.equipes_sources (source_nom, source_cle, team_id, operation_id)
  select x.source_nom, c, x.id, v_op from _l3 x, unnest(x.cles) c;
  get diagnostics n_src = row_count;

  if n_eq <> {n} or n_src <> {n_src} then
    raise exception 'NEXUS: comptes inattendus — % équipes, % clés (attendu {n} / {n_src})', n_eq, n_src;
  end if;
  raise notice 'NEXUS: lot 3 — % équipes de moins de 18 ans créées, % clés source (op %)', n_eq, n_src, v_op;
end $lot3$;
"""

ROLLBACK = r"""-- Rollback du lot 3 : supprime les équipes de la dernière opération {op} non annulée.
-- Refuse si UNE ligne, n'importe où, vise une de ces équipes (athlète, coach, match, code, page…),
-- y compris par une clé en cascade : on ne détruit jamais une donnée posée depuis. UN SEUL bloc DO.
do $rb3$
declare
  o     public.admin_operations;
  v_ids uuid[];
  r     record;
  n     bigint;
  n_del int;
begin
  select * into o from public.admin_operations a
   where a.operation = '{op}'
     and not exists (select 1 from public.admin_operations b where b.operation = '{op}_ANNULEES'
                       and b.details->>'op' = a.id::text)
   order by a.le desc limit 1;
  if not found then raise exception 'NEXUS: aucune opération du lot 3 à défaire'; end if;
  v_ids := array(select jsonb_array_elements_text(o.details->'ids')::uuid);
  for r in select c.conrelid::regclass as t, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.confrelid = 'public.teams'::regclass
              and c.conrelid <> 'public.equipes_sources'::regclass loop
    execute format('select count(*) from %s where %I = any($1)', r.t, r.col) into n using v_ids;
    if n > 0 then
      raise exception 'NEXUS: % ligne(s) de % visent une équipe du lot 3 — rien n''est défait', n, r.t;
    end if;
  end loop;
  delete from public.teams where id = any(v_ids);        -- equipes_sources suit (cascade)
  get diagnostics n_del = row_count;
  if n_del <> cardinality(v_ids) then
    raise exception 'NEXUS: % équipes supprimées, attendu %', n_del, cardinality(v_ids);
  end if;
  insert into public.admin_operations (operation, motif, details, par)
  values ('{op}_ANNULEES', 'Annulation du lot 3 civil (équipes de moins de 18 ans)',
          jsonb_build_object('op', o.id, 'supprimees', n_del),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: lot 3 défait — % équipes supprimées (op %)', n_del, o.id;
end $rb3$;
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--sortie", required=True)
    a = ap.parse_args()
    lignes = donnees(json.load(open(a.plan, encoding="utf-8")))
    texte = json.dumps(lignes, ensure_ascii=False, separators=(",", ":"))
    assert "$donnees$" not in texte
    md5 = hashlib.md5(texte.encode()).hexdigest()
    n_src = sum(len(l[9]) for l in lignes)
    os.makedirs(a.sortie, exist_ok=True)
    open(os.path.join(a.sortie, "donnees.json"), "w", encoding="utf-8").write(texte)
    open(os.path.join(a.sortie, "1-equipes.sql"), "w", encoding="utf-8", newline="\n").write(
        APPLY.replace("{donnees}", texte).replace("{md5}", md5).replace("{n}", str(len(lignes)))
             .replace("{n_src}", str(n_src)).replace("{op}", OPERATION))
    open(os.path.join(a.sortie, "2-rollback.sql"), "w", encoding="utf-8", newline="\n").write(
        ROLLBACK.replace("{op}", OPERATION))
    par = Counter((l[2], l[4]) for l in lignes)
    print(f"{len(lignes)} équipes, {n_src} clés source, md5 {md5}")
    print("  " + ", ".join(f"{s} {a_}: {n}" for (s, a_), n in sorted(par.items())))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
