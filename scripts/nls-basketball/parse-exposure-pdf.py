# scripts/nls-basketball/parse-exposure-pdf.py
# ============================================================================
# Lecteur des PDF « Schedule » d'Exposure Events — NLS Premier League S02.
#
# SOURCE (décision BP 2026-10-14) : JAMAIS de lecture automatique du site
# (robots.txt + conditions d'utilisation d'Exposure). Chaque mercredi, BP
# enregistre à la main, depuis son navigateur, la page Schedule de chacune
# des 10 divisions en PDF, dans data/nls/pdf/AAAA-MM-JJ/. Ce script les lit
# (pdftotext -layout) et écrit le JSON normalisé que consomme
# scripts/plan-nls-basketball-games.mjs :
#
#   { "source", "collecte_le", "fichiers": [...],
#     "matchs": [ { division_exposure, date, heure, equipe_domicile,
#                   equipe_visiteur, lieu, score_dom, score_vis, statut } ] }
#
# Heures : celles du PDF (« 6:00 PM EST »), heure de Montréal, rendues en
# 24 h « HH:MM ». collecte_le : l'horodatage d'impression le plus ancien
# des PDF (« 10/14/26, 11:14 AM », heure de Montréal).
#
# IL NE DEVINE RIEN. Arrêt si : un bloc de match est illisible ; le nombre
# de matchs lus diffère du nombre de lignes « @ » ; il manque une page ;
# un PDF porte plusieurs divisions ; les 10 divisions ne sont pas là
# exactement une fois ; une date ne se lit pas ; un pointage n'a qu'un côté.
#
# Prérequis : pdftotext (poppler) dans le PATH.
# Run (depuis la racine du dépôt) :
#   python -I scripts/nls-basketball/parse-exposure-pdf.py 2026-10-14
#     → lit  data/nls/pdf/2026-10-14/*.pdf
#     → écrit data/nls/matchs-2026-10-14.json
# ============================================================================
import json, pathlib, re, subprocess, sys
from datetime import date, datetime, timedelta

RACINE = pathlib.Path(__file__).resolve().parents[2]

DIVISIONS = {
    "Benjamin Féminin", "BENJAMIN M - DIAMOND", "BENJAMIN M - GOLD",
    "CADET FÉMININ", "CADET M - DIAMOND", "CADET M - GOLD",
    "JUVÉNILE F - DIAMOND", "JUVÉNILE F - GOLD", "JUVÉNILE M - DIAMOND", "JUVÉNILE M - GOLD",
}

MOIS = {m: i + 1 for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July",
                                         "August", "September", "October", "November", "December"])}
# La ligne de date porte une icône (caractère privé) devant le jour.
RE_DATE = re.compile(r"^\s*\S?\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\w+) (\d{1,2}), (\d{4})\s*$")
RE_HEURE = re.compile(r"^\s*(\d{1,2}):(\d{2}) (AM|PM) (EDT|EST) @ (.+?\))\s*$")
RE_EQUIPE = re.compile(r"^\s*(\S.*?)\s{2,}(?:(\d+)\s+)?\((A|H)\)\s*$")
RE_DIV = re.compile(r"^\s*(\S.*?), Pool [\w/]+\s*$")
RE_IMPRIME = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/(\d{2}), (\d{1,2}):(\d{2}) (AM|PM)\b")
RE_PAGE = re.compile(r"\s(\d+)/(\d+)\s*$")
BRUIT = re.compile(r"^\s*(https://basketball\.exposureevents\.com|\d{1,2}/\d{1,2}/\d{2}, \d{1,2}:\d{2} [AP]M)")


def arret(msg):
    sys.exit(f"ARRÊT : {msg}")


def h24(h, mn, ampm):
    return f"{int(h) % 12 + (12 if ampm == 'PM' else 0):02d}:{mn}"


def decalage_montreal(j: date) -> str:
    """America/Toronto : HAE (-04:00) du 2e dimanche de mars au 1er dimanche de
    novembre, HNE (-05:00) sinon. Évite zoneinfo, absent de Windows sans tzdata.
    (Le changement à 2 h du matin n'importe pas : on n'imprime pas la nuit.)"""
    def dimanche(annee, mois, rang):
        d = date(annee, mois, 1)
        d += timedelta(days=(6 - d.weekday()) % 7)
        return d + timedelta(weeks=rang - 1)
    return "-04:00" if dimanche(j.year, 3, 2) <= j < dimanche(j.year, 11, 1) else "-05:00"


def lire(nom, txt):
    pages = txt.count("\f")
    totaux = {int(m[2]) for m in (RE_PAGE.search(l) for l in txt.splitlines()) if m}
    if len(totaux) != 1 or totaux.pop() != pages:
        arret(f"{nom} : pages incomplètes ({pages} lues, repères {sorted({int(m[2]) for m in (RE_PAGE.search(l) for l in txt.splitlines()) if m})})")

    imprimes = []
    for l in txt.splitlines():
        m = RE_IMPRIME.match(l)
        if m:
            d = date(2000 + int(m[3]), int(m[1]), int(m[2]))
            imprimes.append(datetime.fromisoformat(f"{d.isoformat()}T{h24(m[4], m[5], m[6])}:00{decalage_montreal(d)}"))
    if not imprimes:
        arret(f"{nom} : horodatage d'impression introuvable")

    # Le numéro de page « 15/23 » peut se coller en fin de ligne.
    lignes = [re.sub(r"\s{3,}\d+/\d+\s*$", "", l) for l in txt.splitlines() if l.strip() and not BRUIT.match(l)]
    matchs, jour, i = [], None, 0
    while i < len(lignes):
        l = lignes[i]
        m = RE_DATE.match(l)
        if m:
            if m[2] not in MOIS:
                arret(f"{nom} : mois illisible « {l.strip()} »")
            jour = date(int(m[4]), MOIS[m[2]], int(m[3])).isoformat()
            i += 1
            continue
        m = RE_HEURE.match(l)
        if m:
            bloc = lignes[i + 1:i + 4]
            a = RE_EQUIPE.match(bloc[0]) if len(bloc) > 0 else None
            h = RE_EQUIPE.match(bloc[1]) if len(bloc) > 1 else None
            d = RE_DIV.match(bloc[2]) if len(bloc) > 2 else None
            if not (jour and a and h and d and a[3] == "A" and h[3] == "H"):
                arret(f"{nom} : bloc illisible près de « {l.strip()} » / {[b.strip() for b in bloc]}")
            if (a[2] is None) != (h[2] is None):
                arret(f"{nom} : un seul pointage sur deux près de « {l.strip()} »")
            joue = a[2] is not None
            matchs.append({
                "division_exposure": d[1].strip(), "date": jour, "heure": h24(m[1], m[2], m[3]),
                "equipe_domicile": h[1].strip(), "equipe_visiteur": a[1].strip(), "lieu": m[5].strip(),
                "score_dom": int(h[2]) if joue else None, "score_vis": int(a[2]) if joue else None,
                "statut": "joue" if joue else "prevu",
            })
            i += 4
            continue
        i += 1

    attendu = len(re.findall(r" @ ", txt))
    if len(matchs) != attendu:
        arret(f"{nom} : {len(matchs)} matchs lus pour {attendu} lignes « @ »")
    divs = {x["division_exposure"] for x in matchs}
    if len(divs) != 1:
        arret(f"{nom} : {len(divs)} divisions dans un seul PDF : {sorted(divs)}")
    return matchs, min(imprimes)


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", sys.argv[1]):
        arret("usage : parse-exposure-pdf.py AAAA-MM-JJ")
    lot = sys.argv[1]
    dossier = RACINE / "data" / "nls" / "pdf" / lot
    pdfs = sorted(dossier.glob("*.pdf"))
    if not pdfs:
        arret(f"aucun PDF dans {dossier}")

    tous, imprimes, fichiers, vues = [], [], [], {}
    for f in pdfs:
        r = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", str(f), "-"], capture_output=True)
        if r.returncode != 0:
            arret(f"pdftotext a échoué sur {f.name} : {r.stderr.decode(errors='replace')}")
        matchs, imprime = lire(f.name, r.stdout.decode("utf-8"))
        div = matchs[0]["division_exposure"]
        if div in vues:
            arret(f"division « {div} » dans deux PDF : {vues[div]} et {f.name}")
        vues[div] = f.name
        fichiers.append({"fichier": f.name, "division_exposure": div, "matchs": len(matchs)})
        imprimes.append(imprime)
        tous += matchs

    manquantes, inconnues = DIVISIONS - set(vues), set(vues) - DIVISIONS
    if manquantes or inconnues:
        arret(f"divisions manquantes {sorted(manquantes)} / inconnues {sorted(inconnues)}")

    sortie = RACINE / "data" / "nls" / f"matchs-{lot}.json"
    doc = {
        "source": f"PDF Exposure « Schedule » enregistrés par BP — data/nls/pdf/{lot}/",
        "collecte_le": min(imprimes).isoformat(timespec="minutes"),
        "fichiers": fichiers,
        "matchs": tous,
    }
    sortie.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    for x in sorted(fichiers, key=lambda x: x["division_exposure"]):
        print(f"  {x['division_exposure']:<22} {x['matchs']:>3}  {x['fichier']}")
    dates = sorted(x["date"] for x in tous)
    print(f"total {len(tous)} · du {dates[0]} au {dates[-1]} · joués {sum(x['statut'] == 'joue' for x in tous)}"
          f" · collecte {doc['collecte_le']}")
    print(f"écrit : {sortie.relative_to(RACINE).as_posix()}")


if __name__ == "__main__":
    main()
