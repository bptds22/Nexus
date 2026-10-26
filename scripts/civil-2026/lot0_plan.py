"""
Lot 0 — import civil soccer + basket 2026-27 : PLAN, sans aucune écriture en base.

Lit les fichiers d'inventaire SUR PLACE (jamais copiés dans le dépôt) et produit,
dans un dossier de sortie hors dépôt :
  plan.json                   organisations, équipes, matchs à venir (la seule entrée des lots 1-5)
  organisations-a-creer.csv   liste à valider par BP (décision 9)
  organisations-existantes.csv
  equipes.csv / matchs.csv    vues à plat du plan
  rejets.csv                  tout ce qui n'entre pas dans le plan, avec la raison
  a-trancher.csv              ce que BP doit décider avant le lot 2/3
  resume.md                   les comptes

Décisions BP appliquées (2026-10-26) :
  · saison de toute équipe civile 2026-27 (été comme hiver) = '2026-2027' ;
  · sport = Soccer aussi l'hiver (l'intérieur se lit dans le nom de la ligue) ;
  · matchs À VENIR seulement ; reportés importés et marqués ; annulés ignorés (alerte) ;
  · initiales finales « (XX) » retirées des noms d'équipe (Loi 25) ;
  · -18 (U14-U18) rejoignables ; 18+ (U19, U21, Senior) = destinations, rejoignables par les 18+.

Usage :
  python -I lot0_plan.py --sortie <dossier> [--depuis 2026-10-26]
Aucune connexion réseau, aucune base : lecture de fichiers seulement.
"""
import argparse, csv, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_lecture import read  # noqa: E402

SOURCES = {
    "soccer_xlsx": r"C:\Users\bptds\Documents\Nexus-Imports\civil-2026\soccer-civil-quebec-2026-27.xlsx",
    "basket_xlsx": r"C:\Users\bptds\Documents\Nexus-Imports\civil-2026\basket-civil-quebec-2026-27.xlsx",
    "soccer_json_1": r"C:\Users\bptds\Downloads\soccer-qc-2026.json",
    "soccer_json_2": r"C:\Users\bptds\Downloads\soccer-qc-2026-passe2.json",
}
SAISON = "2026-2027"
ABSENT = "Absent de Nexus"
MOINS_18 = {"U14", "U15", "U16", "U17", "U18"}

# ── Utilitaires ────────────────────────────────────────────────────────────────
def norm(s):
    """Clé de comparaison : minuscules, sans accents, espaces réduits."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


def heure_montreal(iso_utc):
    """'2026-04-18T15:00:00.000Z' → ('2026-04-18', '11:00'), heure de l'Est (HAE/HNE).
    Règle nord-américaine : HAE du 2e dimanche de mars au 1er dimanche de novembre, à 2 h."""
    t = datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))

    def dimanche(annee, mois, n):
        d = date(annee, mois, 1)
        d += timedelta(days=(6 - d.weekday()) % 7)
        return d + timedelta(weeks=n - 1)

    a = t.year
    debut = datetime.combine(dimanche(a, 3, 2), datetime.min.time(), timezone.utc) + timedelta(hours=7)
    fin = datetime.combine(dimanche(a, 11, 1), datetime.min.time(), timezone.utc) + timedelta(hours=6)
    decal = -4 if debut <= t < fin else -5
    loc = t + timedelta(hours=decal)
    return loc.strftime("%Y-%m-%d"), loc.strftime("%H:%M")


# Initiales finales « (XX) » / « (XYZ) » : retirées (Loi 25). Les suffixes qui ne
# sont PAS des initiales (points cardinaux, niveaux) sont gardés.
GARDER_SUFFIXE = {"EST", "SUD", "NORD", "AAA", "AA", "LDP", "LDIR", "PLSJQ", "U", "SR", "JR", "FC", "CS", "AS", "SC"}
RE_INITIALES = re.compile(r"\s*\(([A-ZÀ-Ý]{2,3})\)\s*$")


def nettoyer_nom(nom, journal):
    if not nom:
        return nom
    nom = nom.strip()
    while True:  # « X (AB) (CD) » : on retire toutes les paires finales
        m = RE_INITIALES.search(nom)
        if not m or m.group(1) in GARDER_SUFFIXE:
            return nom
        journal["initiales_retirees"] += 1
        nom = nom[: m.start()].rstrip(" -")


def titre(nom):
    """Proposition de casse pour un nom Spordle tout en majuscules (BP valide)."""
    if not nom or nom != nom.upper():
        return nom
    petits = {"de", "du", "des", "la", "le", "les", "et", "d'", "l'", "à", "en", "sur"}
    sigles = {"AS", "CS", "FC", "SC", "CF", "ASM", "ARS", "AC", "US", "LL", "UL", "CSRQ"}
    mots = []
    for i, w in enumerate(nom.split(" ")):
        if w in sigles:
            mots.append(w)
            continue
        lw = w.lower()
        if i and lw in petits:
            mots.append(lw)
            continue
        lw = re.sub(r"^(d'|l')(.)", lambda m: m.group(1) + m.group(2).upper(), lw)
        mots.append("-".join(p[:1].upper() + p[1:] for p in lw.split("-")))
    return " ".join(mots)


SUSPECT_ORG = re.compile(r"JEUX|TOURNOI|FESTIVAL|COUPE|\bCUP\b|S[ÉE]LECTION|CAMP|CHAMPIONNAT|STAGE|"
                         r"[ÉE]QUIPE DU QU[ÉE]BEC|PROGRAMME D|EXCELLENCE|RSEQ|LIGUE|AMICA|ADMIN|"
                         r"CLUB R[ÉE]GIONAL|\bARSQ?\b|\(ARSC\)|OTTAWA|ONTARIO|SPORT[- ][ÉE]TUDES|REGROUPEMENT", re.I)


def cle_floue(nom):
    """Nom réduit à ses mots distinctifs, pour repérer les quasi-doublons (YMHA / YM-YWHA…)."""
    generiques = {"club", "de", "du", "des", "la", "le", "les", "association", "basketball", "basket",
                  "ball", "soccer", "inc", "academy", "academie", "programme", "program", "sport", "sports",
                  "montreal", "saint", "sainte", "regional", "elite", "canada", "hoops",
                  "quebec", "centre", "sportif", "nord", "rive"}
    mots = re.findall(r"[a-z0-9]+", norm(nom))
    return {m for m in mots if m not in generiques and len(m) > 2}

# Niveau Soccer (libellé de l'inventaire) → teams.division. Ordre = du plus haut au plus bas.
NIVEAUX_SOCCER = [
    ("Ligue 1 QC", "Ligue 1 QC"), ("Ligue 2 QC", "Ligue 2 QC"), ("Ligue 3 QC", "Ligue 3 QC"),
    ("Espoirs (U19/U21 réserve L1-L2)", "Espoirs"),
    ("PLSJQ (provincial élite)", "PLSJQ"), ("LDP (développement provincial)", "LDP"),
    ("LDIR (interrégional)", "LDIR"), ("Régional (AA)", "Régional AA"), ("Local (A)", "Local A"),
]
NIVEAU_DIVISION = dict(NIVEAUX_SOCCER)
GENRE_SOCCER = {"Male": "Masculin", "Female": "Féminin", "Integrated": "Mixte"}


def age_de_categorie(cat):
    """'U-14 LDIR' → 'U14' ; 'U19+ ESPOIR' → 'U19' ; 'SENIOR LOCAL' → 'Senior' ; sinon None."""
    c = (cat or "").upper()
    if c.startswith("SENIOR"):
        return "Senior"
    m = re.match(r"U-?(\d+)", c)
    return f"U{int(m.group(1))}" if m else None


def niveau_de_categorie(cat):
    """'U-14 LDIR' → 'LDIR' ; 'SENIOR LOCAL' → 'Local A' ; 'U19+ ESPOIR' → 'Espoirs' ; sinon None."""
    c = (cat or "").upper()
    for jeton, div in (("LIGUE 1", "Ligue 1 QC"), ("LIGUE 2", "Ligue 2 QC"), ("LIGUE 3", "Ligue 3 QC"),
                       ("ESPOIR", "Espoirs"), ("PLSJQ", "PLSJQ"), ("LDP", "LDP"), ("LDIR", "LDIR"),
                       ("REGIONAL", "Régional AA"), ("LOCAL", "Local A")):
        if jeton in c:
            return div
    return None


def categorie_u14_plus(cat):
    a = age_de_categorie(cat)
    return a == "Senior" or (a is not None and int(a[1:]) >= 14)


# ── Lecture ────────────────────────────────────────────────────────────────────
def charger():
    S = read(SOURCES["soccer_xlsx"])
    B = read(SOURCES["basket_xlsx"])
    j1 = json.load(open(SOURCES["soccer_json_1"], encoding="utf-8"))
    j2 = json.load(open(SOURCES["soccer_json_2"], encoding="utf-8"))
    assert j1["cols"] == j2["cols"], "colonnes JSON soccer divergentes"
    return S, B, j1, j2


def lignes(feuille):
    """Feuille → liste de dicts par en-tête (ligne 1)."""
    tete = feuille[0]
    return [{tete[i]: (r[i] if i < len(r) else None) for i in range(len(tete))} for r in feuille[1:]]


# ── Soccer ─────────────────────────────────────────────────────────────────────
def soccer(S, j1, j2, depuis, rejets, journal):
    cols = j1["cols"]
    I = {n: i for i, n in enumerate(cols)}
    matchs_json = j1["rows"] + j2["rows"]
    ids = Counter(r[I["gameId"]] for r in matchs_json)
    assert max(ids.values()) == 1, "gameId en double entre les deux passes"
    offices = {o[0]: o for o in j2["offices"]}  # id → [id, nom, type, parent, chemin, …]

    # Équipes Spordle vues dans les matchs : teamId → attributs (la dernière variante gagne)
    equipe_json = {}
    variantes = defaultdict(set)
    for r in matchs_json:
        for cote in ("home", "away"):
            tid = r[I[cote + "TeamId"]]
            if tid is None:
                continue
            att = (r[I[cote]], r[I[cote + "ClubOffice"]], r[I["category"]], r[I["gender"]], r[I["league"]])
            variantes[tid].add(att)
            equipe_json[tid] = att
    bornes = {}  # (teamId, ligue) → (premier, dernier) : départage des homonymes de l'inventaire
    for r in matchs_json:
        d = r[I["date"]]
        for cote in ("home", "away"):
            tid = r[I[cote + "TeamId"]]
            if tid is None or not categorie_u14_plus(r[I["category"]]):
                continue
            k = (tid, r[I["league"]])
            a, b = bornes.get(k, (d, d))
            bornes[k] = (min(a, d), max(b, d))
    par_nom = defaultdict(set)
    for tid, vs in variantes.items():
        for v in vs:
            par_nom[v[0]].add(tid)

    # Ligue de l'inventaire ↔ clés de ligue JSON : vote par nom d'équipe non ambigu
    eq_x = lignes(S["Équipes U14+"])
    vote = defaultdict(Counter)
    for e in eq_x:
        t = par_nom.get(e["Équipe"], set())
        if len(t) == 1:
            vote[e["Ligue"]][equipe_json[next(iter(t))][4]] += 1
    cles_ligue = {lg: {k for k, n in c.items() if n >= max(2, c.most_common(1)[0][1] // 10)} for lg, c in vote.items()}

    # Clubs : nom Spordle → nom Nexus validé par BP (colonne « Dans Nexus ? »)
    clubs = {c["Club"]: c for c in lignes(S["Clubs"])}

    equipes, pris = [], {}
    homonymes = Counter((e["Équipe"], e["Ligue"], e["Âge"], e["Genre"], e["Niveau"]) for e in eq_x)
    for e in eq_x:
        age = e["Âge"]
        division = NIVEAU_DIVISION.get(e["Niveau"])
        if division is None:
            rejets.append(("soccer", "equipe", "niveau_inconnu", e["Équipe"], e["Ligue"], e["Niveau"]))
            continue
        genre = e["Genre"]
        if genre not in ("Masculin", "Féminin", "Mixte"):
            rejets.append(("soccer", "equipe", "genre_inconnu", e["Équipe"], e["Ligue"], genre))
            continue
        # Une équipe de l'inventaire = un ou plusieurs couples (teamId, ligue JSON) : Spordle
        # réutilise parfois un teamId d'été en hiver, ou en crée un second pour la même équipe.
        cles = cles_ligue.get(e["Ligue"], set())
        paires = {(t, v[4]) for t in par_nom.get(e["Équipe"], set()) for v in variantes[t]
                  if v[0] == e["Équipe"] and v[4] in cles and GENRE_SOCCER.get(v[3]) == genre
                  and age_de_categorie(v[2]) == age
                  and niveau_de_categorie(v[2]) in (division, None)}
        if not paires:
            vu_030 = any(v[0] == e["Équipe"] and (v[2] or "").upper().startswith("0-30")
                         for t in par_nom.get(e["Équipe"], set()) for v in variantes[t])
            rejets.append(("soccer", "equipe", "categorie_0-30_ecartee_veterans" if vu_030 else "id_spordle_absent",
                           e["Équipe"], e["Ligue"], age + " " + genre))
            continue
        if homonymes[(e["Équipe"], e["Ligue"], age, genre, e["Niveau"])] > 1:
            # Plusieurs lignes de l'inventaire pour le même nom : une ligne = un teamId ;
            # on garde les couples dont les bornes de dates sont celles de la ligne.
            paires = {p_ for p_ in paires if bornes.get(p_) == (e["Premier match"], e["Dernier match"])}
            if not paires:
                rejets.append(("soccer", "equipe", "homonyme_non_departage", e["Équipe"], e["Ligue"],
                               f'{e["Premier match"]}..{e["Dernier match"]}'))
                continue
        deja = [p_ for p_ in paires if p_ in pris]
        if deja:
            rejets.append(("soccer", "equipe", "id_spordle_deja_pris", e["Équipe"], e["Ligue"],
                           ", ".join(f"{t}|{k}" for t, k in sorted(deja))))
            continue
        for p_ in paires:
            pris[p_] = True
        tids = sorted({t for t, _ in paires})
        if len(tids) > 1:
            journal["soccer_equipes_plusieurs_teamid"] += 1
        club_src = e["Club"] or ""
        nexus = (e["Club dans Nexus ?"] or "").strip()
        if club_src.startswith("Équipes de ligue locale") or club_src in ("", "?"):
            org = {"cle": None, "statut": "sans_club"}
        elif nexus and nexus != ABSENT:
            org = {"cle": "nexus:" + nexus, "statut": "existante", "nom": nexus}
        else:
            org = {"cle": "creer:soccer:" + norm(club_src), "statut": "a_creer", "nom_source": club_src}
        equipes.append({
            "sport": "Soccer", "source_nom": "SPORDLE", "source_team_id": ",".join(map(str, tids)),
            "source_cles": sorted(f"{t}|{k}" for t, k in paires),
            "nom_source": e["Équipe"], "nom": nettoyer_nom(e["Équipe"], journal),
            "organisation": org, "club_source": club_src,
            "age_group": age, "division": division, "league": e["Ligue"], "gender": genre,
            "season": SAISON, "zone": "", "saison_source": e["Saison"],
            "tranche": "-18" if age in MOINS_18 else "18+",
            "region_source": e["Région (ARS)"], "villes_domicile": e["Villes (à domicile)"],
        })

    # Matchs à venir (JSON = id source + heure UTC)
    par_cle = {c: e for e in equipes for c in e["source_cles"]}
    matchs = []
    for r in matchs_json:
        cat = r[I["category"]]
        if not categorie_u14_plus(cat):
            continue
        d_loc, h_loc = heure_montreal(r[I["startTime"]])
        if d_loc < depuis:
            continue
        statut = r[I["status"]]
        gid = str(r[I["gameId"]])
        if statut == "Cancelled":
            rejets.append(("soccer", "match", "annule_alerte", gid, d_loc, cat))
            continue
        if statut not in ("Active", "Postponed"):
            rejets.append(("soccer", "match", "statut_a_trancher:" + statut, gid, d_loc, cat))
            continue
        dom, vis = r[I["home"]], r[I["away"]]
        if not dom or not vis:
            rejets.append(("soccer", "match", "equipe_a_determiner", gid, d_loc, cat))
            continue
        hid, aid = str(r[I["homeTeamId"]]), str(r[I["awayTeamId"]])
        lk = r[I["league"]]
        eq_h, eq_a = par_cle.get(f"{hid}|{lk}"), par_cle.get(f"{aid}|{lk}")
        lieu = r[I["venue"]] or ""
        surf = r[I["surface"]] or ""
        matchs.append({
            "sport": "Soccer", "source_nom": "SPORDLE", "source_match_id": gid,
            "game_date": d_loc, "game_time": h_loc, "season": SAISON, "phase": "regular",
            "home_source_team_id": hid, "visitor_source_team_id": aid,
            "home_name_raw": nettoyer_nom(dom, journal), "visitor_name_raw": nettoyer_nom(vis, journal),
            "home_dans_plan": eq_h is not None, "visitor_dans_plan": eq_a is not None,
            "ligue_source": lk,
            "league_name": (eq_h or eq_a or {}).get("league"),
            "category": age_de_categorie(cat),
            "division": (eq_h or eq_a or {}).get("division"),
            "sex_type": GENRE_SOCCER.get(r[I["gender"]]),
            "venue": lieu + (f" — {surf}" if surf and norm(surf) not in norm(lieu) else ""),
            "ville": r[I["city"]], "code_postal": r[I["postal"]],
            "statut": "REPORTE" if statut == "Postponed" else "ACTIF",
            "categorie_source": cat,
        })

    # Clubs sans calendrier U14+ (décision 9 : on crée aussi, sur liste validée)
    sans_cal = lignes(S["Clubs sans calendrier U14+"])
    region_office = {}
    for o in offices.values():
        if o[2] == "Region":
            region_office[str(o[0])] = o[1]
    return equipes, matchs, clubs, sans_cal, region_office, offices, equipe_json


# ── Basket ─────────────────────────────────────────────────────────────────────
AGE_BASKET = {"U13-U14 (sec. 1-2)": "Benjamin", "U14": "Benjamin",
              "U15-U16": "Cadet", "U15-U16 (sec. 3-4)": "Cadet",
              "U17": "Juvénile", "U17 (sec. 5)": "Juvénile", "U17 (juvénile)": "Juvénile"}


def division_basket(lib):
    """'Cadet Girls AAA' → ('AAA', 'Féminin') ; 'Cadet Majeur Masculin' → ('Majeur', 'Masculin') ;
    sans mention du sexe (MBL sans « Girls », Circuit Élite) → Masculin (décision BP 2026-10-26)."""
    l = lib or ""
    if re.search(r"F[ée]minin|Girls", l, re.I):
        genre = "Féminin"
    else:
        genre = "Masculin"
    niv = next((n for n in ("AAA", "AA", "Majeur", "Élite") if re.search(rf"\b{n}\b", l)), "")
    return niv, genre


def basket(B, rejets, journal):
    eq = lignes(B["Équipes U14+"])
    clubs = {c["Club / programme"]: c for c in lignes(B["Clubs"])}
    equipes = []
    ligue_nom = {"MBL": "Montreal Basketball League (MBL)"}
    for e in eq:
        age = AGE_BASKET.get(e["Âge"])
        niv, genre = division_basket(e["Division"])
        dn = e["Dans Nexus ?"] or ""
        ligue = ligue_nom.get(e["Ligue / circuit"], e["Ligue / circuit"])
        base = {"sport": "Basketball", "source_nom": "MBL" if ligue.startswith("Montreal") else "KREEZEE",
                "source_team_id": None, "nom_source": e["Équipe"], "nom": nettoyer_nom(e["Équipe"], journal),
                "age_group": age, "division": niv, "league": ligue, "gender": (genre or "").rstrip("*") or None,
                "genre_hypothese": bool(genre and genre.endswith("*")), "season": SAISON, "zone": "",
                "tranche": "-18", "division_source": e["Division"]}
        if age is None:
            rejets.append(("basket", "equipe", "age_inconnu", e["Équipe"], ligue, e["Âge"]))
            continue
        if dn.startswith("École"):
            rejets.append(("basket", "equipe", "ecole_rseq_liaison_a_faire", e["Équipe"], ligue,
                           e["Organisation Nexus"] or ""))
            continue
        if genre is None:
            base["organisation"] = None
            rejets.append(("basket", "equipe", "sexe_a_trancher", e["Équipe"], ligue, e["Division"]))
            continue
        if dn == ABSENT:
            # Le club d'une équipe absente : le nom d'équipe, sans suffixe « (1) » / « (MATRIX) », s'il
            # figure dans l'onglet Clubs ; sinon le nom d'équipe lui-même (signalé).
            court = re.sub(r"\s*\([^)]*\)\s*$", "", e["Équipe"]).strip()
            club_nom = next((c for c in clubs if norm(c) in (norm(e["Équipe"]), norm(court))), None)
            if club_nom is None:
                journal["basket_club_deduit_du_nom_equipe"] += 1
            base["organisation"] = {"cle": "creer:basket:" + norm(club_nom or court), "statut": "a_creer",
                                    "nom_source": club_nom or court, "deduit": club_nom is None}
        else:
            base["organisation"] = {"cle": "nexus:" + (e["Organisation Nexus"] or ""), "statut": "existante",
                                    "nom": e["Organisation Nexus"]}
        base["club_source"] = (base["organisation"] or {}).get("nom_source") or e["Équipe"]
        equipes.append(base)

    # Matchs à venir : l'inventaire (pas d'id source → clé naturelle, comme NLS)
    par_nom = defaultdict(list)
    for e in equipes:
        par_nom[(e["league"], e["nom_source"], e["division_source"])].append(e)
    matchs = []
    for m in lignes(B["À venir (U14+)"]):
        st = (m["Statut"] or "").strip()
        cle = f'{m["Date"]}|{m["Heure"]}|{m["Division"]}|{m["Âge"]}|{m["Domicile"]}|{m["Visiteur"]}'
        if st == "Canceled/Postponed":
            rejets.append(("basket", "match", "annule_ou_reporte_a_trancher", cle, m["Date"], m["Division"]))
            continue
        niv, genre = division_basket(m["Division"])
        lg = m["Ligue / circuit"]
        adr = re.sub(r"\s*T[ée]l[ée]phone\s*:.*$", "", m["Adresse"] or "", flags=re.I).strip(" ,")
        matchs.append({
            "sport": "Basketball", "source_nom": "MBL" if lg.startswith("Montreal") else "KREEZEE",
            "source_match_id": None, "cle_naturelle": cle,
            "game_date": m["Date"], "game_time": m["Heure"], "season": SAISON, "phase": "regular",
            "home_name_raw": m["Domicile"], "visitor_name_raw": m["Visiteur"],
            "home_dans_plan": bool(par_nom.get((lg, m["Domicile"], m["Division"]))),
            "visitor_dans_plan": bool(par_nom.get((lg, m["Visiteur"], m["Division"]))),
            "league_name": lg, "category": AGE_BASKET.get(m["Âge"]), "division": niv,
            "sex_type": (genre or "").rstrip("*") or None,
            "venue": m["Lieu"], "adresse": adr, "statut": "ACTIF",
        })
    return equipes, matchs, clubs, lignes(B["Organisations affiliées"])


# ── Organisations ──────────────────────────────────────────────────────────────
def organisations(eq_s, eq_b, clubs_s, sans_cal, region_office, clubs_b, aff_b, matchs_s, rejets):
    existantes, a_creer = {}, {}

    def compter(eqs):
        for e in eqs:
            o = e.get("organisation") or {}
            if o.get("statut") == "existante":
                x = existantes.setdefault(o["cle"], {"nom": o["nom"], "sports": Counter(), "equipes": 0})
                x["sports"][e["sport"]] += 1
                x["equipes"] += 1
            elif o.get("statut") == "a_creer":
                x = a_creer.setdefault(o["cle"], {"nom_source": o["nom_source"], "sport": e["sport"],
                                                  "equipes": 0, "avec_calendrier": True, "regions": Counter(),
                                                  "villes": Counter()})
                x["equipes"] += 1
                if e.get("region_source"):
                    x["regions"][e["region_source"]] += 1
                for v in (e.get("villes_domicile") or "").split(","):
                    if v.strip():
                        x["villes"][v.strip()] += 1
    compter(eq_s)
    compter(eq_b)

    # Soccer sans calendrier
    for c in sans_cal:
        nom, dn = c["Club (Spordle)"], (c["Dans Nexus ?"] or "")
        if dn and dn != ABSENT:
            continue
        cle = "creer:soccer:" + norm(nom)
        a_creer.setdefault(cle, {"nom_source": nom, "sport": "Soccer", "equipes": 0, "avec_calendrier": False,
                                 "regions": Counter({region_office.get(str(c["Région"]), str(c["Région"])): 1}),
                                 "villes": Counter(), "note": c.get("Note") or ""})
    # Basket : clubs absents du calendrier + clubs civils affiliés absents
    for c in clubs_b.values():
        if c["Dans Nexus ?"] == ABSENT:
            a_creer.setdefault("creer:basket:" + norm(c["Club / programme"]),
                               {"nom_source": c["Club / programme"], "sport": "Basketball", "equipes": 0,
                                "avec_calendrier": True, "regions": Counter(), "villes": Counter()})
    for o in aff_b:
        if o["Type"] == "Club civil" and o["Dans Nexus ?"] == ABSENT:
            cle = "creer:basket:" + norm(o["Organisation"])
            x = a_creer.setdefault(cle, {"nom_source": o["Organisation"], "sport": "Basketball", "equipes": 0,
                                         "avec_calendrier": o["Vue dans un calendrier (MBL / circuits) ?"] == "Oui",
                                         "regions": Counter(), "villes": Counter()})
            if o["Région"]:
                x["regions"][o["Région"]] += 1
            if o["Ville"]:
                x["villes"][o["Ville"]] += 3

    # Ville/code postal le plus fréquent des matchs à domicile (soccer) → géocodage approx. (lot 2)
    dom_ville = defaultdict(Counter)
    for m in matchs_s:
        pass  # les matchs à venir seuls sont trop peu ; la ville vient de l'inventaire (Villes à domicile)
    lignes_out = []
    # Quasi-doublons à l'intérieur de la liste (un mot distinctif commun, même sport)
    toutes = list(a_creer.items())
    voisins = defaultdict(list)
    for i, (c1, x1) in enumerate(toutes):
        for c2, x2 in toutes[i + 1:]:
            if x1["sport"] == x2["sport"] and cle_floue(x1["nom_source"]) & cle_floue(x2["nom_source"]):
                voisins[c1].append(x2["nom_source"])
                voisins[c2].append(x1["nom_source"])
    for cle, x in sorted(a_creer.items(), key=lambda kv: (kv[1]["sport"], norm(kv[1]["nom_source"]))):
        suspect = bool(SUSPECT_ORG.search(x["nom_source"]))
        lignes_out.append({
            "cle": cle, "sport": x["sport"], "nom_source": x["nom_source"], "nom_propose": titre(x["nom_source"]),
            "region_proposee": x["regions"].most_common(1)[0][0] if x["regions"] else "",
            "ville_proposee": x["villes"].most_common(1)[0][0] if x["villes"] else "",
            "equipes_u14_plus": x["equipes"], "avec_calendrier": x["avec_calendrier"],
            "signal": "SUSPECT (événement / sélection / stage / ligue / hors Québec ?)" if suspect else "",
            "doublon_interne_possible": " | ".join(sorted(set(voisins.get(cle, [])))),
            "note": x.get("note", ""),
            "decision_bp": "",
        })
    return existantes, lignes_out


# ── Collisions d'identité (teams_identity_unique) après nettoyage des noms ─────
def collisions(equipes, rejets):
    cle = lambda e: (e["organisation"]["cle"] if e.get("organisation") else None, e["sport"], e["nom"],
                     e["age_group"], e["division"], e["gender"], e["season"], e["league"], e["zone"])
    groupes = defaultdict(list)
    for e in equipes:
        e.pop("nom_propose_dedoublonne", None)
        groupes[cle(e)].append(e)
    n = 0
    for g in groupes.values():
        if len(g) > 1:
            # Proposition : suffixe « #2 », « #3 »… dans l'ordre de l'id source ; BP tranche.
            for i, e in enumerate(sorted(g, key=lambda e: e.get("source_team_id") or e["nom_source"])[1:], start=2):
                e["nom_propose_dedoublonne"] = f'{e["nom"]} #{i}'
                n += 1
    return n


# ── Décisions BP sur le lot 0 (2026-10-26) ─────────────────────────────────────
# Arbitrages donnés EN PLUS des colonnes reco_claude (qui portaient « À TOI »).
DECISIONS_BP_ORG = {
    "OTTAWA SOUTH UNITED": ("CREER", None, "Ontario"),
    "WEST OTTAWA SOCCER CLUB": ("CREER", None, "Ontario"),
    "Parc Ex": ("CREER", "Parc-Ex", None),
    "Centre des loisirs du Parc": ("CREER", None, None),
}
REGION_FORCEE = {"Escadron Sport-Études": "Laurentides"}
# Noms annotés de l'inventaire → organisation existante (propositions acceptées)
NOMS_ANNOTES = {
    "AS Laval (Alliance Soccer Laval)": ("AS Laval", "LIGUE_CIVILE"),
    "Association de basketball de Gatineau (programme Dragons)": ("Association de basketball de Gatineau", "LIGUE_CIVILE"),
    "Basketball Laval (programme Nobel)": ("Basketball Laval", "LIGUE_CIVILE"),
    "Comité de basketball Saint-Laurent (Basketball St-Laurent)": ("Comité de basketball Saint-Laurent", "LIGUE_CIVILE"),
    "Révolution (Rosemère)": ("Révolution", "LIGUE_CIVILE"),
}
# Écoles nommées par la reco → nom exact en prod (relevé du 26 oct.) ; None = absente de la base
ECOLES = {
    "École secondaire Cardinal-Roy": "École Cardinal-Roy",
    "École polyvalente Saint-Jérôme": "École polyvalente Saint-Jérôme",
    "École Saint-Gabriel (Escadron)": "École Saint-Gabriel",
    "École secondaire Marie-Victorin": None,
}
# Coquilles de la reco Sport-études, corrigées (casse et « Soccerontréal »)
NOMS_CORRIGES = {
    "Sport-études soccer Soccerontréal": "Sport-études soccer Montréal",
    "Sport-études soccer Arsq": "Sport-études soccer ARSQ",
    "Sport-études soccer Centre-Du-Québec": "Sport-études soccer Centre-du-Québec",
    "Sport-études soccer Est-Du-Québec": "Sport-études soccer Est-du-Québec",
}
REGION_SPORT_ETUDES = {
    "ARSQ": "Québec", "Montréal": "Montréal", "Abitibi": "Abitibi-Témiscamingue",
    "Saguenay Lac-Saint-Jean": "Saguenay-Lac-Saint-Jean",
}


# Région source → vocabulaire des LIGUE_CIVILE existantes (relevé prod du 26 oct.). Absent = à compléter.
REGIONS = {
    "Soccer Montréal": "Montréal", "Soccer Laval": "Laval", "De L'Est-Du-Québec": "Est-du-Québec",
    "Centre-Du-Québec": "Centre-du-Québec", "Saguenay Lac St-Jean Chibougamau-Chapais": "Saguenay-Lac-Saint-Jean",
    "Saguenay–Lac-St-Jean": "Saguenay-Lac-Saint-Jean", "Québec / Chaudière-Appalaches": "Québec",
}
REGIONS_VALIDES = {"Abitibi-Témiscamingue", "Bourassa", "Centre-du-Québec", "Côte-Nord", "Est-du-Québec", "Estrie",
                   "Lac St-Louis", "Lanaudière", "Laurentides", "Laval", "Mauricie", "Montréal", "Ontario",
                   "Outaouais", "Québec", "Richelieu-Yamaska", "Rive-Sud", "Saguenay-Lac-Saint-Jean", "Sud-Ouest"}


def region_nexus(r):
    r = REGIONS.get((r or "").strip(), (r or "").strip())
    return r if r in REGIONS_VALIDES else ""


def action_org(reco):
    r = (reco or "").strip()
    m = re.match(r"CR[ÉE]ER sous le nom « (.+?) »", r, re.I)
    if m:
        return "CREER", m.group(1)
    if re.match(r"cr[ée]er\b", r, re.I):
        return "CREER", None
    m = re.match(r"NE PAS CR[ÉE]ER : existe déjà sous « (.+?) »", r)
    if m:
        return "EXISTANTE", re.sub(r"\s*\(à confirmer\)\s*$", "", m.group(1)).strip()
    if r.startswith("NE PAS CRÉER (école"):
        return "ECOLE", None
    if r.startswith("NE PAS CRÉER"):
        return "NON_RETENUE", None
    m = re.match(r"FUSIONNER dans « (.+?) »", r)
    if m:
        return "FUSION", m.group(1)
    raise ValueError(f"reco illisible : {r!r}")


# Clés apparues après la décision « Circuit Élite = Masculin » (équipes jusque-là rejetées) et qui
# désignent une organisation déjà dans la liste reco sous une autre graphie.
ALIAS_CLES = {"creer:basket:parc-ex": "creer:basket:parc ex"}


def appliquer_decisions(eqs, sans_club, matchs, org_brut, f_orgs, f_trancher, rejets, journal):
    reco = {r["cle"]: r for r in csv.DictReader(open(f_orgs, encoding="utf-8-sig"))}
    for e in eqs:
        o = e.get("organisation") or {}
        if o.get("cle") in ALIAS_CLES:
            o["cle"] = ALIAS_CLES[o["cle"]]
    org_brut = [o for o in org_brut if o["cle"] not in ALIAS_CLES]
    ecart = set(reco) ^ {o["cle"] for o in org_brut}
    assert not ecart, f"la liste reco ne correspond pas au plan brut : {sorted(ecart)}"
    brut = {o["cle"]: o for o in org_brut}

    # 1. Une action par organisation proposée
    act, journal_dec = {}, []
    for cle, r in reco.items():
        if r["nom_source"] in DECISIONS_BP_ORG:
            a_, nom, region = DECISIONS_BP_ORG[r["nom_source"]]
            act[cle] = {"action": a_, "nom": nom or r["nom_propose"], "region": region}
        else:
            a_, nom = action_org(r["reco_claude"])
            act[cle] = {"action": a_, "nom": nom or (r["nom_propose"] if a_ == "CREER" else None), "region": None}
        journal_dec.append({"cle": cle, "sport": r["sport"], "nom_source": r["nom_source"],
                            "action": act[cle]["action"], "cible": act[cle]["nom"] or ""})
    par_nom_cree = {norm(v["nom"]): c for c, v in act.items() if v["action"] == "CREER"}
    for c, v in act.items():
        if v["action"] == "FUSION":
            cible = par_nom_cree.get(norm(v["nom"]))
            assert cible, f"cible de fusion introuvable : {v['nom']}"
            v["cible_cle"] = cible

    # 2. Organisations créées (avec leurs variantes de nom source, pour organisations_sources)
    finales = {}
    for c, v in act.items():
        if v["action"] == "CREER":
            o = brut[c]
            finales[c] = {"cle": c, "sport": o["sport"], "nom": v["nom"],
                          "region": v["region"] or REGION_FORCEE.get(v["nom"]) or o["region_proposee"],
                          "ville": o["ville_proposee"], "noms_source": [o["nom_source"]],
                          "avec_calendrier": o["avec_calendrier"]}
    for c, v in act.items():
        if v["action"] == "FUSION":
            finales[v["cible_cle"]]["noms_source"].append(brut[c]["nom_source"])

    def rattacher(e, cle_source):
        v = act[cle_source]
        if v["action"] == "CREER":
            e["organisation"] = {"cle": cle_source, "statut": "a_creer", "nom": v["nom"], "type_attendu": "LIGUE_CIVILE"}
        elif v["action"] == "FUSION":
            e["organisation"] = {"cle": v["cible_cle"], "statut": "a_creer", "nom": act[v["cible_cle"]]["nom"],
                                 "type_attendu": "LIGUE_CIVILE"}
        elif v["action"] == "EXISTANTE":
            e["organisation"] = {"cle": "nexus:" + v["nom"], "statut": "existante", "nom": v["nom"],
                                 "type_attendu": "LIGUE_CIVILE"}
        else:
            return v["action"]
        return None

    # 3. Équipes : organisation finale
    garde = []
    for e in eqs:
        o = e.get("organisation") or {}
        if o.get("statut") == "a_creer":
            refus = rattacher(e, o["cle"])
            if refus:
                rejets.append((e["sport"].lower(), "equipe", "ecole_rseq_liaison_a_faire" if refus == "ECOLE"
                               else "organisation_non_retenue", e["nom"], e["league"], o.get("nom_source", "")))
                continue
        elif o.get("statut") == "nom_a_trancher":
            nom, typ = NOMS_ANNOTES[o["nom"]]
            e["organisation"] = {"cle": "nexus:" + nom, "statut": "existante", "nom": nom, "type_attendu": typ}
        elif o.get("statut") == "existante":
            o["type_attendu"] = "LIGUE_CIVILE"
        garde.append(e)

    # 4. Sport-études « sans club » : école existante ou organisation régionale à créer
    reco_t = list(csv.DictReader(open(f_trancher, encoding="utf-8-sig")))
    par_equipe = defaultdict(set)
    for r in reco_t:
        if r["sujet"] == "sport_etudes_sans_club":
            par_equipe[r["nom"]].add(r["reco_claude"])
    a_trancher = []
    for e in sans_club:
        recos = par_equipe.get(e["nom"])
        assert recos and len(recos) == 1, f"reco Sport-études absente ou multiple : {e['nom']}"
        rc = next(iter(recos))
        m = re.match(r"Rattacher à l'école « (.+?) »", rc)
        if m:
            ecole = ECOLES[m.group(1)]
            if ecole is None:
                rejets.append(("soccer", "equipe", "ecole_absente_de_nexus_a_trancher", e["nom"], e["league"], m.group(1)))
                a_trancher.append({"sujet": "sport_etudes_ecole_absente", "nom": e["nom"], "ligue": e["league"],
                                   "age": e["age_group"], "genre": e["gender"], "division": e["division"],
                                   "club_office_spordle": "",
                                   "proposition": f"« {m.group(1)} » n'existe pas dans Nexus (seul le Cégep Marie-Victorin y est). "
                                                  "Rattacher à « Sport-études soccer Montréal » ? (aucune école créée sans GO)",
                                   "decision_bp": ""})
                continue
            e["organisation"] = {"cle": "nexus:" + ecole, "statut": "existante", "nom": ecole, "type_attendu": "SECONDAIRE"}
        else:
            m = re.match(r"Créer UNE organisation « (.+?) »", rc)
            assert m, f"reco Sport-études illisible : {rc!r}"
            nom = NOMS_CORRIGES.get(m.group(1), m.group(1))
            cle = "creer:soccer:" + norm(nom)
            suffixe = nom.replace("Sport-études soccer ", "")
            finales.setdefault(cle, {"cle": cle, "sport": "Soccer", "nom": nom,
                                     "region": REGION_SPORT_ETUDES.get(suffixe, suffixe), "ville": "",
                                     "noms_source": [], "avec_calendrier": True})
            e["organisation"] = {"cle": cle, "statut": "a_creer", "nom": nom, "type_attendu": "LIGUE_CIVILE"}
        garde.append(e)

    # 5. Futsal : sport « Futsal » pour les ligues de futsal ; le reste du soccer d'hiver reste « Soccer »
    for e in garde:
        if "FUTSAL" in (e["league"] or "").upper():
            e["sport"] = "Futsal"
            journal["equipes_futsal"] += 1
    for m_ in matchs:
        if "FUTSAL" in (m_.get("league_name") or "").upper():
            m_["sport"] = "Futsal"
            journal["matchs_futsal"] += 1

    # 6. Match basket « Canceled/Postponed » : traité comme annulé (ignoré, alerte)
    rejets[:] = [(r[0], r[1], "annule_ou_reporte_ignore_alerte" if r[2] == "annule_ou_reporte_a_trancher" else r[2],
                  *r[3:]) for r in rejets]

    # 7. Régions normalisées et comptes des organisations finales
    for f in finales.values():
        f["region_source"] = f["region"]
        f["region"] = region_nexus(f["region"])
        if not f["region"]:
            journal["orgs_region_a_completer"] += 1
        f["equipes_u14_plus"] = sum(1 for e in garde if (e.get("organisation") or {}).get("cle") == f["cle"])
        f["sports_equipes"] = dict(Counter(e["sport"] for e in garde if (e.get("organisation") or {}).get("cle") == f["cle"]))
    existantes = {}
    for e in garde:
        o = e["organisation"]
        if o["statut"] == "existante":
            x = existantes.setdefault(o["cle"], {"nom": o["nom"], "type_attendu": o["type_attendu"],
                                                 "sports": Counter(), "equipes": 0})
            x["sports"][e["sport"]] += 1
            x["equipes"] += 1
    return garde, sorted(finales.values(), key=lambda f: (f["sport"], norm(f["nom"]))), existantes, a_trancher, journal_dec


def ecrire_csv(chemin, lignes_, entetes=None):
    if not lignes_:
        open(chemin, "w", encoding="utf-8-sig").close()
        return
    entetes = entetes or list(lignes_[0].keys())
    with open(chemin, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=entetes, extrasaction="ignore")
        w.writeheader()
        for l in lignes_:
            w.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v)
                        for k, v in l.items()})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--depuis", default="2026-10-26")
    ap.add_argument("--controle-prod", default=None,
                    help="JSON {nom_source: constat} relevé en lecture seule sur la prod (optionnel)")
    ap.add_argument("--decisions-orgs", default=None, help="organisations-a-creer-reco-claude.csv validé par BP")
    ap.add_argument("--decisions-trancher", default=None, help="a-trancher-reco-claude.csv validé par BP")
    a = ap.parse_args()
    os.makedirs(a.sortie, exist_ok=True)
    rejets, journal = [], Counter()

    S, B, j1, j2 = charger()
    eq_s, m_s, clubs_s, sans_cal, region_office, offices, equipe_json = soccer(S, j1, j2, a.depuis, rejets, journal)
    eq_b, m_b, clubs_b, aff_b = basket(B, rejets, journal)

    # 40 équipes « sans club rattaché » (Sport-études) : à trancher, hors plan
    a_trancher = []
    garde, sans_club = [], []
    for e in eq_s:
        if e["organisation"]["statut"] == "sans_club":
            sans_club.append(e)
            a_trancher.append({"sujet": "sport_etudes_sans_club", "nom": e["nom"], "ligue": e["league"],
                               "age": e["age_group"], "genre": e["gender"], "division": e["division"],
                               "club_office_spordle": (offices.get(equipe_json.get(int(e["source_team_id"].split(",")[0]), (None, None))[1]) or [None, ""])[1],
                               "proposition": "", "decision_bp": ""})
        else:
            garde.append(e)
    eq_s = garde

    # Noms « Dans Nexus » annotés, sans correspondance exacte (relevé du 26 oct.)
    for nom, prop in [
        ("AS Laval (Alliance Soccer Laval)", "AS Laval (existe, LIGUE_CIVILE, Laval)"),
        ("Association de basketball de Gatineau (programme Dragons)", "Association de basketball de Gatineau (existe)"),
        ("Basketball Laval (programme Nobel)", "Basketball Laval (existe)"),
        ("Comité de basketball Saint-Laurent (Basketball St-Laurent)", "Comité de basketball Saint-Laurent (existe)"),
        ("Révolution (Rosemère)", "Révolution (existe, Rosemère)"),
        ("Polyvalente de Beloeil (Polybel)", "École secondaire Polybel (SECONDAIRE, Beloeil) : équipe d'école, liaison RSEQ, pas d'équipe civile"),
        ("Programme Escadron Sport-Études (son école partenaire, École Saint-Gabriel, est dans Nexus)", "École Saint-Gabriel (SECONDAIRE, Sainte-Thérèse) : équipe d'école, ou organisation civile « Escadron » à créer ?"),
        ("Programme Escadron Sport-Études — pas d'organisation dans Nexus", "Créer une organisation civile « Escadron » (cf. 4 variantes dans organisations-a-creer.csv) ?"),
        ("École Jeanne-Mance", "2 écoles SECONDAIRE : Montréal ou Drummondville (le Circuit Élite joue à Longueuil → Montréal probable)"),
    ]:
        n = sum(1 for e in eq_s + eq_b if (e.get("organisation") or {}).get("nom") == nom)
        a_trancher.append({"sujet": "nom_nexus_annote", "nom": nom, "ligue": "", "age": "", "genre": "",
                           "division": "", "club_office_spordle": f"{n} équipe(s) du plan", "proposition": prop,
                           "decision_bp": ""})
        for e in eq_s + eq_b:
            if (e.get("organisation") or {}).get("nom") == nom:
                e["organisation"]["statut"] = "nom_a_trancher"

    eqs = eq_s + eq_b
    n_coll = collisions(eqs, rejets)
    existantes, org_a_creer = organisations(eq_s, eq_b, clubs_s, sans_cal, region_office, clubs_b, aff_b, m_s, rejets)
    controle = json.load(open(a.controle_prod, encoding="utf-8")) if a.controle_prod else {}
    for o in org_a_creer:
        o["controle_prod"] = controle.get(o["nom_source"], "")

    matchs = m_s + m_b
    decisions = []
    if a.decisions_orgs and a.decisions_trancher:
        eqs, org_a_creer, existantes, a_trancher, decisions = appliquer_decisions(
            eqs, sans_club, matchs, org_a_creer, a.decisions_orgs, a.decisions_trancher, rejets, journal)
        n_coll = collisions(eqs, rejets)
    else:
        for lg in sorted({e["league"] for e in eq_s if "FUTSAL" in (e["league"] or "").upper()}):
            a_trancher.append({"sujet": "futsal_sport_soccer", "nom": lg, "ligue": lg, "age": "", "genre": "",
                               "division": "", "club_office_spordle": "",
                               "proposition": "Décision 8 : sport = Soccer. Confirmer pour les ligues de FUTSAL (sport « Futsal » existe dans Nexus).",
                               "decision_bp": ""})
    plan = {
        "meta": {"genere_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                 "depuis": a.depuis, "saison": SAISON, "sources": SOURCES,
                 "ordre_divisions_soccer": [d for _, d in NIVEAUX_SOCCER],
                 "ordre_divisions_basket": ["Élite", "AAA", "Majeur", "AA", ""]},
        "organisations": {"existantes": [{"cle": k, **{kk: (dict(vv) if isinstance(vv, Counter) else vv)
                                                       for kk, vv in v.items()}} for k, v in sorted(existantes.items())],
                          "a_creer": org_a_creer},
        "equipes": eqs, "matchs": matchs,
    }
    json.dump(plan, open(os.path.join(a.sortie, "plan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    ecrire_csv(os.path.join(a.sortie, "organisations-a-creer.csv"), org_a_creer)
    if decisions:
        ecrire_csv(os.path.join(a.sortie, "decisions-appliquees.csv"), decisions)
    ecrire_csv(os.path.join(a.sortie, "organisations-existantes.csv"),
               [{"organisation": v["nom"], "type_attendu": v.get("type_attendu", ""), "equipes": v["equipes"],
                 "sports": dict(v["sports"])}
                for v in sorted(existantes.values(), key=lambda v: norm(v["nom"]))])
    ecrire_csv(os.path.join(a.sortie, "equipes.csv"),
               [{"sport": e["sport"], "organisation": (e.get("organisation") or {}).get("nom") or (e.get("organisation") or {}).get("nom_source"),
                 "statut_org": (e.get("organisation") or {}).get("statut"), "nom": e["nom"],
                 "nom_dedoublonne": e.get("nom_propose_dedoublonne", ""), "age_group": e["age_group"],
                 "division": e["division"], "gender": e["gender"], "league": e["league"], "tranche": e["tranche"],
                 "season": e["season"], "source": e["source_nom"], "source_team_id": e.get("source_team_id")}
                for e in eqs])
    ecrire_csv(os.path.join(a.sortie, "matchs.csv"), matchs,
               ["sport", "source_nom", "source_match_id", "cle_naturelle", "game_date", "game_time", "league_name",
                "category", "division", "sex_type", "home_name_raw", "visitor_name_raw", "home_dans_plan",
                "visitor_dans_plan", "venue", "statut"])
    ecrire_csv(os.path.join(a.sortie, "rejets.csv"),
               [dict(zip(["sport", "objet", "raison", "ref", "contexte", "detail"], r)) for r in rejets])
    ecrire_csv(os.path.join(a.sortie, "a-trancher.csv"), a_trancher)

    # ── Résumé ────────────────────────────────────────────────────────────────
    C = Counter
    rz = C((r[0], r[1], r[2].split(":")[0]) for r in rejets)
    tr = C((e["sport"], e["tranche"]) for e in eqs)
    st = C((e["sport"], (e.get("organisation") or {}).get("statut")) for e in eqs)
    ms = C((m["sport"], m["statut"]) for m in matchs)
    lien = C((m["sport"], m["home_dans_plan"] and m["visitor_dans_plan"]) for m in matchs)
    oc = C((o["sport"], o["avec_calendrier"]) for o in org_a_creer)
    sus = sum(1 for o in org_a_creer if o.get("signal"))
    with open(os.path.join(a.sortie, "resume.md"), "w", encoding="utf-8") as f:
        p = lambda *x: print(*x, file=f)
        p(f"# Lot 0 — plan d'import civil 2026-27 (aucune écriture)\n\nGénéré le {plan['meta']['genere_le']}, matchs à partir du {a.depuis}.\n")
        p("## Équipes du plan\n")
        for (sp, t), n in sorted(tr.items()):
            p(f"- {sp} {t} : {n}")
        p("\nPar statut d'organisation :")
        for (sp, s_), n in sorted(st.items(), key=lambda kv: str(kv[0])):
            p(f"- {sp} / {s_} : {n}")
        p(f"\nCollisions d'identité après nettoyage (suffixe « #n » proposé) : {n_coll}")
        p(f"Initiales « (XX) » retirées (équipes + noms dans les matchs) : {journal['initiales_retirees']}")
        p(f"Basket : sexe « Masculin » supposé (division MBL sans « Girls ») : {journal['basket_genre_masculin_suppose']}")
        p(f"Basket : équipes dont le club est déduit du nom d'équipe (absent de l'onglet Clubs) : {journal['basket_club_deduit_du_nom_equipe']}")
        p(f"Soccer : équipes de l'inventaire portées par plusieurs teamId Spordle (fusionnés) : {journal['soccer_equipes_plusieurs_teamid']}")
        p("\n## Matchs à venir du plan\n")
        for (sp, s_), n in sorted(ms.items()):
            p(f"- {sp} {s_} : {n}")
        for (sp, ok), n in sorted(lien.items()):
            p(f"- {sp}, deux équipes dans le plan = {ok} : {n}")
        p("\n## Organisations\n")
        p(f"- existantes réutilisées : {len(existantes)}"
          + (" (" + ", ".join(f"{t} {n}" for t, n in sorted(C(v.get('type_attendu') for v in existantes.values()).items())) + ")"
             if decisions else ""))
        if decisions:
            p("- décisions appliquées aux " + str(len(decisions)) + " propositions : "
              + ", ".join(f"{k} {n}" for k, n in sorted(C(d['action'] for d in decisions).items())))
            p(f"- organisations finales à créer : {len(org_a_creer)} ; dont sans équipe dans le plan : "
              f"{sum(1 for o in org_a_creer if not o['equipes_u14_plus'])}")
            p(f"- Futsal : {journal['equipes_futsal']} équipes, {journal['matchs_futsal']} matchs")
            p(f"- organisations à créer sans région déductible (région laissée vide) : {journal['orgs_region_a_completer']}")
        for (sp, cal), n in sorted(oc.items(), key=str):
            p(f"- à créer, {sp}, avec calendrier = {cal} : {n}")
        p(f"- dont signalées SUSPECTES (événement, sélection, stage, ligue, hors Québec…) : {sus}")
        p(f"- avec un quasi-doublon possible dans la liste : {sum(1 for o in org_a_creer if o.get('doublon_interne_possible'))}")
        p(f"- avec un signal du contrôle prod : {sum(1 for o in org_a_creer if o.get('controle_prod'))}")
        p("\n## Rejets (rejets.csv)\n")
        for (sp, ob, rs), n in sorted(rz.items()):
            p(f"- {sp} / {ob} / {rs} : {n}")
        p(f"\n## À trancher (a-trancher.csv) : {len(a_trancher)} lignes\n")
        for k, n in sorted(C(x["sujet"] for x in a_trancher).items()):
            p(f"- {k} : {n}")
    print(open(os.path.join(a.sortie, "resume.md"), encoding="utf-8").read())


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
