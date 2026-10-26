"""
Lot 2 — préparation du géocodage approximatif (lecture seule).

Pour chaque organisation civile, une ville : la plus fréquente parmi les villes à domicile de
ses équipes dans l'inventaire (organisations du plan), sinon sa ville en base (relue en prod).
La coordonnée = moyenne des écoles et cégeps GÉOCODÉS de cette ville en prod (geo_source
'approx'). Sans ville reconnue : pas de coordonnée (jamais de centre de région).

  python -I lot2_geo.py requete --plan <plan.json> --sortie <requete.sql>
      écrit la requête de lecture à lancer en prod (connecteur, lecture seule) ;
  le résultat JSON de la requête est enregistré à la main dans geocodage-prod.json.
"""
import argparse, json, re, sys
from collections import Counter, defaultdict


def villes_principales(plan):
    """cle d'organisation → ville la plus fréquente à domicile (équipes de l'inventaire)."""
    v = defaultdict(Counter)
    for e in plan["equipes"]:
        o = e.get("organisation") or {}
        for ville in (e.get("villes_domicile") or "").split(","):
            if ville.strip():
                v[o.get("cle")][ville.strip()] += 1
    return {k: c.most_common(1)[0][0] for k, c in v.items() if k}


def requete(plan):
    vp = villes_principales(plan)
    q = lambda x: "'" + (x or "").replace("'", "''") + "'"
    lignes = []
    for o in plan["organisations"]["a_creer"]:
        lignes.append(f"({q('n:' + o['cle'])},{q(o['nom'])},'LIGUE_CIVILE',{q(vp.get(o['cle']) or o['ville'])})")
    for o in plan["organisations"]["existantes"]:
        if o["type_attendu"] == "LIGUE_CIVILE":
            lignes.append(f"({q('e:' + o['nom'])},{q(o['nom'])},'LIGUE_CIVILE',{q(vp.get(o['cle'], ''))})")
    # Clé de ville : minuscules, sans accents, St/Ste développés, tirets et espaces unifiés.
    nv = lambda col: (f"regexp_replace(regexp_replace(regexp_replace(replace(lower(extensions.unaccent(coalesce({col},''))), 'sainte', 'saint'),"
                      f"'(^|[ -])st[e]?[ -]', '\\1saint-', 'g'), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')")
    return f"""-- Lecture seule : coordonnées approximatives par ville (moyenne des écoles / cégeps géocodés).
with cible(k, nom, typ, ville_inv) as (values {",".join(lignes)}),
-- Organisations civiles existantes hors plan : leur ville en base.
autres as (
  select 'e:' || s.name as k, s.name as nom, 'LIGUE_CIVILE' as typ, '' as ville_inv
    from public.schools s
   where s.type = 'LIGUE_CIVILE' and s.lat is null
     and not exists (select 1 from cible c where c.nom = s.name and c.typ = 'LIGUE_CIVILE')),
tout as (select * from cible union all select * from autres),
avec_ville as (
  select t.k, coalesce(nullif(t.ville_inv, ''), s.city) as ville
    from tout t left join public.schools s on t.k like 'e:%' and s.name = t.nom and s.type = t.typ),
villes as (
  select {nv('city')} as cv, avg(lat) as lat, avg(lng) as lng, count(*) as n
    from public.schools where lat is not null and type in ('SECONDAIRE', 'CEGEP') group by 1)
select json_agg(json_build_array(a.k, round(v.lat::numeric, 5), round(v.lng::numeric, 5), v.n) order by a.k)
  from avec_ville a join villes v on v.cv = {nv('a.ville')} and a.ville is not null;
-- (les organisations sans ville reconnue ne sortent pas : elles restent sans coordonnée)
"""


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["requete"])
    ap.add_argument("--plan", required=True)
    ap.add_argument("--sortie", required=True)
    a = ap.parse_args()
    plan = json.load(open(a.plan, encoding="utf-8"))
    open(a.sortie, "w", encoding="utf-8").write(requete(plan))
    print("requête écrite :", a.sortie)
