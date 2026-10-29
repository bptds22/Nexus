"""Banc A5 (docs/push-a5/tests-push-a5-base-migree.sql) adapté au schéma prod du 2026-10-29.

Le banc A5 n'est pas modifié : ce script en écrit une copie, avec des substitutions EXACTES
(chacune doit trouver son texte une seule fois, sinon arrêt).

  avant  — adaptations au schéma d'aujourd'hui, sans lien avec ce chantier :
    1. le verrou de lancement collégial (lot C0, 2026-10-27, postérieur à A5) refuse de
       rattacher A1 au cégep de Luc (section K) : l'interrupteur est mis à ON dans la
       transaction du banc, comme la base d'A5 le permettait.
    3. D3 trie par `order by 1` — une CONSTANTE dans un agrégat, donc un ordre physique :
       le cas passait ou échouait selon l'ordre des lignes. Tri explicite (Félix, caduque, Mathis).
    4. K2 / K3 : la porte B1 (porte_coach_cegep, 2026-10-27) interdit désormais à un coach
       rattaché à un cégep de prendre un athlète en charge. Le geste du banc est refusé :
       K2 attend ce refus, K3 l'absence de notification et de push. K1 (texte de la fonction)
       et K4–K6 (coach du secondaire) restent inchangés.
  apres  — avant + ce que la migration 20261029170000 change VOLONTAIREMENT :
    2. H3 : la fenêtre calme passe de 21 h – 8 h à 22 h 00 – 7 h 59. 21 h n'est plus calme ;
       7 h 59 l'est toujours, 8 h et 20 h 59 non. H1 (22 h 30) et H2 (7 h 59) restent vrais
       tels quels.

Usage : python docs/notif-interet/adapter-banc-a5.py avant|apres SORTIE.sql
"""
import pathlib
import sys

SOURCE = pathlib.Path(__file__).resolve().parents[1] / "push-a5" / "tests-push-a5-base-migree.sql"

AVANT = [
    (
        "-- ── K. Prise en charge par un coach ─────────────────────────────────────────\n",
        "-- ── K. Prise en charge par un coach ─────────────────────────────────────────\n"
        "-- [adaptation 1] verrou de lancement collégial (C0) : ON dans la transaction du banc.\n"
        "update app_settings set value = 'true' where key = 'lancement_collegial';\n",
    ),
    (
        "|| '=' || case when n.message like 'Réponds dans%' then 'nouveau' else 'ancien' end, ',' order by 1)\n",
        "|| '=' || case when n.message like 'Réponds dans%' then 'nouveau' else 'ancien' end, ','\n"
        "                     -- [adaptation 3] tri explicite (« order by 1 » triait par une constante).\n"
        "                     order by case when a.id = current_setting('t.felix')::uuid then 0 else 1 end,\n"
        "                              coalesce((n.metadata->>'caduque')::boolean, false) desc)\n",
    ),
    (
        "select pg_temp.essai('K2 le coach collégial prend en charge A1', current_setting('t.luc'),\n"
        "  format('select public.claim_school_athletes(array[%L]::uuid[])::text', current_setting('t.a1')), '1');\n",
        "-- [adaptation 4] porte B1 : un coach rattaché à un cégep ne prend plus personne en charge.\n"
        "select pg_temp.essai('K2 le coach collégial ne peut plus prendre A1 en charge (porte B1)', current_setting('t.luc'),\n"
        "  format('select public.claim_school_athletes(array[%L]::uuid[])::text', current_setting('t.a1')), 'ERR:P0001');\n",
    ),
    (
        "select pg_temp.verif('K3 notification et push : « Ton entraîneur t''a pris en charge. », sans nom ni école',",
        "select pg_temp.verif('K3 refus B1 : ni notification ni push de prise en charge',",
    ),
    (
        "  'Ton entraîneur t''a pris en charge. Ouvre l''app pour voir ton profil. Il peut maintenant gérer ton profil et répondre aux recruteurs pour toi. || Ton entraîneur t''a pris en charge. Ouvre l''app pour voir ton profil.');\n",
        "  null);\n",
    ),
]

APRES = AVANT + [
    (
        "select pg_temp.verif('H3 les heures calmes : 21 h et 7 h 59 oui, 8 h et 20 h 59 non',",
        "-- [adaptation 2] fenêtre calme 22 h 00 – 7 h 59 (20261029170000).\n"
        "select pg_temp.verif('H3 les heures calmes : 7 h 59 oui ; 21 h, 8 h et 20 h 59 non',",
    ),
    (
        "  'truetruefalsefalse');\n",
        "  'falsetruefalsefalse');\n",
    ),
]


def main() -> None:
    mode, sortie = sys.argv[1], pathlib.Path(sys.argv[2])
    texte = SOURCE.read_text(encoding="utf-8")
    for ancien, nouveau in {"avant": AVANT, "apres": APRES}[mode]:
        n = texte.count(ancien)
        if n != 1:
            raise SystemExit(f"substitution introuvable ou ambiguë ({n}) : {ancien[:70]!r}")
        texte = texte.replace(ancien, nouveau)
    sortie.write_text(texte, encoding="utf-8", newline="\n")
    print(f"{mode} : {sortie}")


if __name__ == "__main__":
    main()
