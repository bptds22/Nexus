"""
Lot 2b — géocodage par VILLE via Nominatim (GO BP 2026-10-26 : noms de villes seulement).

  python -I lot2b_villes.py nominatim --plan <plan.json> --prod <villes-prod-sans-coordonnees.json> --cache <json>
      une requête par ville distincte (1,1 s d'écart, User-Agent identifié) ; le cache permet de reprendre ;
  python -I lot2b_villes.py sql --plan … --prod … --cache … --sortie <dossier>
      génère 1-geocodage-villes.sql (un bloc DO gardé) et 2-rollback.sql.

Ville d'une organisation : celle renseignée en base (relevé prod), sinon la ville principale de
l'inventaire. Seul le NOM de la ville part chez Nominatim — jamais un nom d'organisation.
Un résultat n'est retenu que s'il est une localité (place / boundary) au Québec ou en Ontario.
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lot2_geo import villes_principales  # noqa: E402

ALIAS = {"Mont-Royal": "Ville de Mont-Royal", "NDIP": "Notre-Dame-de-l'Île-Perrot", "Dollard-des Ormeaux": "Dollard-des-Ormeaux",
         "Lasalle": "LaSalle, Montréal", "St-Laurent": "Saint-Laurent, Montréal",
         "Pierrefonds": "Pierrefonds, Montréal", "Lachine": "Lachine, Montréal",
         "Saint-Bruno": "Saint-Bruno-de-Montarville", "L'Étang-du-Nord": "Les Îles-de-la-Madeleine"}
ONTARIO = {"Manotick", "Nepean"}
UA = "Nexus-geocodage-villes/1.0 (confidentialite@nexussports.ca)"


def affectations(plan, prod):
    """nom d'organisation → ville."""
    vp = villes_principales(plan)
    par_nom = {}
    for o in plan["organisations"]["existantes"]:
        par_nom[o["nom"]] = vp.get(o["cle"])
    for o in plan["organisations"]["a_creer"]:
        par_nom[o["nom"]] = vp.get(o["cle"]) or o.get("ville") or None
    a = {n: v for n, v in prod["orgs"]}
    for n in prod["sans_ville_prod"]:
        v = par_nom.get(n)
        if v and "," not in v:
            a[n] = v
    return a


def requete_ville(v):
    q = ALIAS.get(v, v)
    prov = "Ontario" if v in ONTARIO else "Québec"
    return f"{q}, {prov}, Canada"


def nominatim(villes, cache_f):
    cache = json.load(open(cache_f, encoding="utf-8")) if os.path.exists(cache_f) else {}
    for v in sorted(villes):
        if v in cache:
            continue
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {"q": requete_ville(v), "format": "jsonv2", "limit": 1, "countrycodes": "ca",
             "addressdetails": 1, "accept-language": "fr"})
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.load(r)
        cache[v] = res[0] if res else None
        json.dump(cache, open(cache_f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1.1)
    return cache


def valide(r):
    if not r:
        return False, "aucun résultat"
    lat, lng = float(r["lat"]), float(r["lon"])
    etat = (r.get("address") or {}).get("state", "")
    if etat not in ("Québec", "Ontario"):
        return False, f"province {etat!r}"
    if not (44 <= lat <= 63 and -80 <= lng <= -57):
        return False, "hors zone"
    if r.get("category") not in ("place", "boundary"):
        return False, f"pas une localité ({r.get('category')}/{r.get('type')})"
    return True, ""


SQL = r"""-- Lot 2b civil — géocodage des organisations par VILLE (Nominatim, centre de la localité).
-- UN SEUL bloc DO. Données embarquées (md5 {md5}) : [organisation, ville, lat, lng].
-- Ne touche QUE des organisations LIGUE_CIVILE sans coordonnée (jamais d'écrasement).
do $lot2b$
declare
  v_brut text := $donnees${donnees}$donnees$;
  d      jsonb;
  v_op   uuid;
  n      int;
  v_txt  text;
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 5) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi avant 5 h';
  end if;
  if md5(v_brut) <> '{md5}' then raise exception 'NEXUS: données du lot 2b altérées (md5 %)', md5(v_brut); end if;
  d := v_brut::jsonb;
  if exists (select 1 from public.admin_operations o where o.operation = 'CIVIL_GEOCODAGE_VILLES'
              and not exists (select 1 from public.admin_operations a where a.operation = 'CIVIL_GEOCODAGE_VILLES_ANNULE'
                                and a.details->>'op' = o.id::text)) then
    raise exception 'NEXUS: lot 2b déjà appliqué (opération non annulée)';
  end if;

  create temp table _l2b on commit drop as
    select x.nom, x.ville, x.lat, x.lng, s.id, s.lat as lat_avant
      from (select e->>0 as nom, e->>1 as ville, (e->>2)::float8 as lat, (e->>3)::float8 as lng
              from jsonb_array_elements(d) e) x
      left join public.schools s on s.name = x.nom and s.type = 'LIGUE_CIVILE';

  select string_agg(nom, ' ; ') into v_txt from _l2b x
   where (select count(*) from public.schools s where s.name = x.nom and s.type = 'LIGUE_CIVILE') <> 1;
  if v_txt is not null then raise exception 'NEXUS: organisation introuvable ou en double : %', v_txt; end if;
  select string_agg(nom, ' ; ') into v_txt from _l2b where lat_avant is not null;
  if v_txt is not null then raise exception 'NEXUS: déjà géocodée (jamais d''écrasement) : %', v_txt; end if;
  if exists (select 1 from _l2b where not (lat between 44 and 63 and lng between -80 and -57)) then
    raise exception 'NEXUS: coordonnée hors Québec–Ontario dans les données';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_GEOCODAGE_VILLES',
          'Import civil 2026-27, lot 2b : organisations sans coordonnée géocodées par ville (Nominatim, GO BP)',
          jsonb_build_object('lot', '2b', 'md5_donnees', '{md5}',
                             'methode', 'Nominatim (OpenStreetMap), centre de la localité, nom de ville seulement',
                             'poses', (select jsonb_agg(jsonb_build_object('id', id, 'lat', lat, 'lng', lng, 'ville', ville)
                                                        order by nom) from _l2b)),
          (select id from public.users where email = 'bptds22@gmail.com'))
  returning id into v_op;

  update public.schools s set lat = x.lat, lng = x.lng, geo_source = 'approx', updated_at = now()
    from _l2b x where s.id = x.id and s.lat is null;
  get diagnostics n = row_count;
  if n <> {n} then raise exception 'NEXUS: % organisations géocodées, attendu {n}', n; end if;
  raise notice 'NEXUS: lot 2b — % organisations géocodées par ville (op %)', n, v_op;
end $lot2b$;
"""

ROLLBACK = r"""-- Rollback du lot 2b : remet à vide les coordonnées posées par la dernière opération non annulée,
-- seulement si elles n'ont pas bougé depuis. UN SEUL bloc DO.
do $rb2b$
declare
  o public.admin_operations;
  n int;
begin
  select * into o from public.admin_operations a
   where a.operation = 'CIVIL_GEOCODAGE_VILLES'
     and not exists (select 1 from public.admin_operations b where b.operation = 'CIVIL_GEOCODAGE_VILLES_ANNULE'
                       and b.details->>'op' = a.id::text)
   order by a.le desc limit 1;
  if not found then raise exception 'NEXUS: aucune opération du lot 2b à défaire'; end if;
  if exists (select 1 from jsonb_array_elements(o.details->'poses') p join public.schools s on s.id = (p->>'id')::uuid
              where s.lat is distinct from (p->>'lat')::float8 or s.lng is distinct from (p->>'lng')::float8
                 or s.geo_source is distinct from 'approx') then
    raise exception 'NEXUS: une coordonnée du lot 2b a été modifiée depuis — rien n''est défait';
  end if;
  update public.schools s set lat = null, lng = null, geo_source = null, updated_at = now()
    from jsonb_array_elements(o.details->'poses') p where s.id = (p->>'id')::uuid;
  get diagnostics n = row_count;
  if n <> jsonb_array_length(o.details->'poses') then
    raise exception 'NEXUS: % coordonnées remises à vide, attendu %', n, jsonb_array_length(o.details->'poses');
  end if;
  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_GEOCODAGE_VILLES_ANNULE', 'Annulation du lot 2b civil (géocodage par ville)',
          jsonb_build_object('op', o.id, 'remises_a_vide', n),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: lot 2b défait — % coordonnées remises à vide (op %)', n, o.id;
end $rb2b$;
"""


def main():
    import hashlib
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["nominatim", "sql"])
    ap.add_argument("--plan", required=True)
    ap.add_argument("--prod", required=True)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--sortie")
    a = ap.parse_args()
    plan = json.load(open(a.plan, encoding="utf-8"))
    prod = json.load(open(a.prod, encoding="utf-8"))
    aff = affectations(plan, prod)
    villes = set(aff.values())
    if a.action == "nominatim":
        cache = nominatim(villes, a.cache)
        ok = sum(1 for v in villes if valide(cache.get(v))[0])
        print(f"{len(aff)} organisations avec une ville, {len(villes)} villes distinctes, {ok} villes géocodées")
        for v in sorted(villes):
            bon, raison = valide(cache.get(v))
            r = cache.get(v) or {}
            print(f"  {'OK ' if bon else 'NON'} {v:35} → {r.get('display_name', '')[:70]} {raison}")
        return
    cache = json.load(open(a.cache, encoding="utf-8"))
    lignes = []
    for nom, v in sorted(aff.items()):
        r = cache.get(v)
        if valide(r)[0]:
            lignes.append([nom, v, round(float(r["lat"]), 5), round(float(r["lon"]), 5)])
    texte = json.dumps(lignes, ensure_ascii=False, separators=(",", ":"))
    md5 = hashlib.md5(texte.encode()).hexdigest()
    os.makedirs(a.sortie, exist_ok=True)
    open(os.path.join(a.sortie, "1-geocodage-villes.sql"), "w", encoding="utf-8", newline="\n").write(
        SQL.replace("{donnees}", texte).replace("{md5}", md5).replace("{n}", str(len(lignes))))
    open(os.path.join(a.sortie, "2-rollback.sql"), "w", encoding="utf-8", newline="\n").write(ROLLBACK)
    print(f"{len(lignes)} organisations à géocoder, md5 {md5}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
