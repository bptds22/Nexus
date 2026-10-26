# Lot B3 cégep — construit la migration et son rollback à partir des textes d'origine (prod) :
#  - les 3 fonctions recruteur : texte du lot A (20261026030400), md5 du corps vérifié = prod ;
#  - top_athletes_view : texte de 20261018150000 ; trending_athletes_view : texte de 20260921173234
#    (md5 de pg_get_viewdef vérifié = prod par la garde de la migration, sous search_path public, extensions).
# Seules des colonnes s'ajoutent EN FIN ; chaque remplacement doit trouver son ancre une seule fois.
# Usage : python scripts/cegep-lot-b3/construire.py
import hashlib
import os

B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'
VERSION = '20261028160000'
NOM = 'cegep_lot_b3_filtres'


def lire(f):
    return open(B + f, encoding='utf-8').read().replace('\r\n', '\n')


def bloc(t, debut, fin):
    i = t.index(debut)
    j = t.index(fin, i) + len(fin)
    return t[i:j]


def rep(t, a, b):
    assert t.count(a) == 1, a[:80]
    return t.replace(a, b)


def md5(t):
    return hashlib.md5(t.encode('utf-8')).hexdigest()


def corps(b):
    return b[b.index('AS $function$') + len('AS $function$'):b.rindex('$function$;')]


SIG = {'recruiter_search_athletes': 'public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)',
       'recruiter_athlete_profile': 'public.recruiter_athlete_profile(uuid)',
       'recruiter_athlete_cards': 'public.recruiter_athlete_cards(uuid[])'}
# md5(prosrc) en prod, relevé le 2026-10-26.
PROD = {'recruiter_search_athletes': 'aba2e501dd8c62f323adfb857150b5a6',
        'recruiter_athlete_profile': '0fccf321625808a8561968231abe85ca',
        'recruiter_athlete_cards': 'ba26d8b8bb57246110388dd63e41ac6d'}
# ACL prod, texte exact (ordre compris) ; l'ordre des GRANT le reproduit.
ACL = {'recruiter_search_athletes': ('{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}', ['service_role', 'authenticated']),
       'recruiter_athlete_profile': ('{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', ['authenticated', 'service_role']),
       'recruiter_athlete_cards': ('{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}', ['authenticated', 'service_role'])}
COMMENTAIRES = {'recruiter_search_athletes': 'e1c17f94928a14a388dc07e03ea4a2fc',
                'recruiter_athlete_profile': '4a6be07c0b1f51c8e7189d525b6e9507',
                'recruiter_athlete_cards': 'a2e22b53f4031df7aa0397bb997c51ba'}
FIN_RESULTAT = {'recruiter_search_athletes': 'cote_partenaire_organisation text, team_age_group text)',
                'recruiter_athlete_profile': 'evaluations jsonb, team_school_type text, team_age_group text)',
                'recruiter_athlete_cards': 'evaluations jsonb, team_school_type text, team_age_group text)'}
VUE_PROD = {'top_athletes_view': 'b677336de698551f2d5b733bc7f70bab',
            'trending_athletes_view': 'b45eb0030c789288a79dddbdd020d060'}
COM_VUE = {'top_athletes_view': 'af7d280ebfb0efef9c6671ef88cab628',
           'trending_athletes_view': '437c56a0178020eb9fed67cccb27c6c1'}
ACL_VUE = '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'

# ── Textes d'origine ──
lota = lire('supabase/migrations/20261026030400_cegep_lot_a_base.sql')
F = {}
for nom in SIG:
    i = lota.index('CREATE OR REPLACE FUNCTION public.' + nom + '(')
    j = lota.index('$function$;', lota.index('AS $function$', i) + 14) + len('$function$;')
    b = lota[i:j]
    assert md5(corps(b)) == PROD[nom], nom
    F[nom] = b.replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION', 1)

top = bloc(lire('supabase/migrations/20261018150000_athlete_reseaux_sociaux.sql'),
           'CREATE OR REPLACE VIEW public.top_athletes_view AS', 'ORDER BY a.cote_globale_entraineur DESC;')
trend = bloc(lire('supabase/migrations/20260921173234_date_naissance_protegee_et_vues_partenaire_actif.sql'),
             'CREATE OR REPLACE VIEW public.trending_athletes_view', 'AND public.is_approved_partner(auth.uid());')

# ── Versions B3 ──
JOIN_EQ = ("  -- Lot B3 cégep : l'équipe de l'athlète. team_athletes est UNIQUE (athlete_id) : au plus une\n"
           "  -- ligne, le jeu de lignes ne change pas.\n"
           "  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id\n"
           "  LEFT JOIN public.teams         tm ON tm.id = ta.team_id\n"
           "  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id\n")
B3 = {}
s = F['recruiter_search_athletes']
s = rep(s, 'cote_partenaire_organisation text)', FIN_RESULTAT['recruiter_search_athletes'])
s = rep(s, "    pe.cote_globale,\n    pe.organisation\n  FROM public.athletes a",
        "    pe.cote_globale,\n    pe.organisation,\n"
        "    -- Lot B3 cégep (filtre Catégorie) : catégorie de l'équipe. Le type de l'école d'ancrage\n"
        "    -- (school_type) et celui de l'école de l'équipe (team_school_type) sont déjà rendus.\n"
        "    tm.age_group\n  FROM public.athletes a")
B3['recruiter_search_athletes'] = s
for nom in ('recruiter_athlete_profile', 'recruiter_athlete_cards'):
    s = F[nom]
    s = rep(s, 'evaluations jsonb)', FIN_RESULTAT[nom])
    s = rep(s, "      WHERE ev.athlete_id = a.id)\n  FROM public.athletes a",
            "      WHERE ev.athlete_id = a.id),\n"
            "    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école de l'équipe et catégorie de\n"
            "    -- l'équipe. Le type de l'école d'ancrage est school_type, plus haut.\n"
            "    tsc.type,\n    tm.age_group\n  FROM public.athletes a")
    s = rep(s, "  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id\n  WHERE",
            "  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id\n" + JOIN_EQ + "  WHERE")
    B3[nom] = s
PROSRC_B3 = {nom: md5(corps(s)) for nom, s in B3.items()}

COLS = ("    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école d'ancrage, type de l'école de\n"
        "    -- l'équipe, catégorie de l'équipe.\n"
        "    sch.type AS school_type,\n    tsc.type AS team_school_type,\n    tm.age_group AS team_age_group\n")
JOINV = ("     LEFT JOIN public.schools sch ON sch.id = a.school_id\n"
         "     -- Lot B3 : team_athletes est UNIQUE (athlete_id), au plus une ligne.\n"
         "     LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id\n"
         "     LEFT JOIN public.teams tm ON tm.id = ta.team_id\n"
         "     LEFT JOIN public.schools tsc ON tsc.id = tm.school_id\n")
top3 = rep(top, "x) AS badges\n   FROM public.athletes a", "x) AS badges,\n" + COLS + "   FROM public.athletes a")
top3 = rep(top3, "     LEFT JOIN public.schools sch ON sch.id = a.school_id\n", JOINV)
trend3 = rep(trend, "    a.genre\n   FROM public.athletes a", "    a.genre,\n" + COLS + "   FROM public.athletes a")
trend3 = rep(trend3, "     LEFT JOIN public.schools sch ON sch.id = a.school_id\n", JOINV)
assert 'WITH (security_barrier = true)' in trend3


# ── Morceaux communs ──
def grants(nom):
    return (f"revoke all on function {SIG[nom]} from public, anon, authenticated, service_role;\n"
            + ''.join(f"grant execute on function {SIG[nom]} to {r};\n" for r in ACL[nom][1]))


def gardes_fonctions(md5s, quand):
    g = ''
    for nom in SIG:
        g += (f"  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('{SIG[nom]}'))\n"
              f"     is distinct from '{md5s[nom]}' then\n"
              f"    raise exception 'NEXUS: {nom} n''est pas {quand}';\n  end if;\n"
              f"  if (select proacl::text from pg_proc where oid = to_regprocedure('{SIG[nom]}'))\n"
              f"     is distinct from '{ACL[nom][0]}' then\n"
              f"    raise exception 'NEXUS: ACL de {nom} inattendue : %',\n"
              f"      (select proacl::text from pg_proc where oid = to_regprocedure('{SIG[nom]}'));\n  end if;\n")
    return g


def gardes_vues(md5s, quand):
    g = ''
    for v in VUE_PROD:
        if md5s:
            g += (f"  if md5(pg_get_viewdef('public.{v}'::regclass)) is distinct from '{md5s[v]}' then\n"
                  f"    raise exception 'NEXUS: {v} n''est pas {quand}';\n  end if;\n")
        g += (f"  if (select relacl::text from pg_class where oid = 'public.{v}'::regclass) is distinct from '{ACL_VUE}' then\n"
              f"    raise exception 'NEXUS: ACL de {v} inattendue : %', (select relacl::text from pg_class where oid = 'public.{v}'::regclass);\n  end if;\n"
              f"  if md5(obj_description('public.{v}'::regclass, 'pg_class')) is distinct from '{COM_VUE[v]}' then\n"
              f"    raise exception 'NEXUS: commentaire de {v} inattendu';\n  end if;\n")
    g += ("  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then\n"
          "    raise exception 'NEXUS: top_athletes_view a des reloptions';\n  end if;\n"
          "  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)\n"
          "     is distinct from '{security_barrier=true}' then\n"
          "    raise exception 'NEXUS: trending_athletes_view sans security_barrier';\n  end if;\n")
    return g


def gardes_commentaires():
    return ''.join(f"  if md5(obj_description(to_regprocedure('{SIG[n]}'), 'pg_proc')) is distinct from '{m}' then\n"
                   f"    raise exception 'NEXUS: commentaire de {n} inattendu';\n  end if;\n" for n, m in COMMENTAIRES.items())


SAUVER_COM = ("create temp table _b3_com (sig text primary key, texte text);\ninsert into _b3_com\n"
              + "\nunion all\n".join(f"select '{SIG[n]}', obj_description(to_regprocedure('{SIG[n]}'), 'pg_proc')" for n in SIG)
              + ";\n")
RESTAURER_COM = ("do $$\ndeclare c record;\nbegin\n  for c in select * from _b3_com where texte is not null loop\n"
                 "    execute format('comment on function %s is %L', c.sig, c.texte);\n  end loop;\nend $$;\n"
                 "drop table _b3_com;\n")
SANS_DEPENDANT = (
    "  if exists (select 1 from pg_depend d join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass\n"
    "              where d.refobjid in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)\n"
    "                and r.ev_class not in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)) then\n"
    "    raise exception 'NEXUS: un objet dépend d''une des 2 vues';\n  end if;\n")

# ── Migration ──
mig = f"""-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B3 « base des filtres » Type + Catégorie (GO BP 2026-10-26).
-- NON APPLIQUÉE EN PROD. Apply par la voie psql, sur GO BP seulement (au plus tôt mercredi 12 h).
--
-- Rend, en COLONNES AJOUTÉES EN FIN, le type de l'école d'ancrage, le type de l'école de l'équipe
-- et la catégorie de l'équipe (teams.age_group), pour que B4 (web) et B5 (mobile) filtrent sans
-- autre changement de base :
--   · recruiter_search_athletes : + team_age_group (school_type et team_school_type existent déjà) ;
--   · recruiter_athlete_profile, recruiter_athlete_cards : + team_school_type, team_age_group ;
--   · top_athletes_view, trending_athletes_view : + school_type, team_school_type, team_age_group.
-- L'équipe d'un athlète vient de team_athletes, UNIQUE (athlete_id) : au plus une ligne, aucune
-- ligne ajoutée ni retirée (gardé ci-dessous).
--
-- Rien d'autre ne change : corps d'origine (prod) repris À LA LETTRE, seules les colonnes de fin et
-- la jointure d'équipe s'ajoutent. Masquage du lot A intact (peut_voir_cegepiens /
-- athlete_est_cegepien dans les 3 fonctions) ; les 2 vues restent réservées aux partenaires admis,
-- qui voient les cégépiens par décision. Aucune règle Collégial dans la carte des matchs (BP 1).
--
-- Les 3 fonctions changent de type de retour : DROP + CREATE. ACL rétablies À L'IDENTIQUE (texte
-- exact, ordre compris), commentaires reposés. Aucun objet n'en dépend (relevé prod 2026-10-26).
-- Les 2 vues : CREATE OR REPLACE (colonnes ajoutées en fin) ; ACL et commentaires conservés ;
-- top_athletes_view sans reloptions, trending_athletes_view avec security_barrier (restatée).
--
-- Rollback : supabase/rollback/{VERSION}_rollback_{NOM}.sql
-- ════════════════════════════════════════════════════════════════════════════

-- pg_get_viewdef dépend du search_path : les md5 des vues sont relevés sous celui-ci.
set local search_path = public, extensions;

-- ── 0. Gardes : les 5 objets sont ceux relevés en prod le 2026-10-26 ────────────
do $$
begin
{gardes_fonctions(PROD, 'le corps prod relevé le 2026-10-26')}{gardes_vues(VUE_PROD, 'la définition prod relevée le 2026-10-26')}{gardes_commentaires()}{SANS_DEPENDANT}  if not exists (select 1 from pg_constraint where conrelid = 'public.team_athletes'::regclass and contype = 'u'
                    and pg_get_constraintdef(oid) = 'UNIQUE (athlete_id)') then
    raise exception 'NEXUS: team_athletes n''est plus UNIQUE (athlete_id) : la jointure d''équipe multiplierait des lignes';
  end if;
end $$;

{SAUVER_COM}
"""
for nom in SIG:
    mig += f"-- ── {nom} ──\ndrop function {SIG[nom]};\n{B3[nom]}\n{grants(nom)}\n"
mig += RESTAURER_COM + "\n"
mig += "-- ── Les 2 vues partenaire ──\n" + top3 + "\n\n" + trend3 + "\n\n"
mig += ("-- ── Gardes APRÈS ─────────────────────────────────────────────────────────────\ndo $$\nbegin\n"
        + gardes_fonctions(PROSRC_B3, 'la version B3')
        + gardes_vues(None, '')
        + gardes_commentaires()
        + ''.join(f"  if pg_get_function_result(to_regprocedure('{SIG[n]}')) not like '%, {FIN_RESULTAT[n]}' then\n"
                  f"    raise exception 'NEXUS: colonnes de fin de {n} inattendues';\n  end if;\n" for n in SIG)
        + ''.join(f"  if (select string_agg(attname, ',' order by attnum) from (select attname, attnum from pg_attribute\n"
                  f"        where attrelid = 'public.{v}'::regclass and attnum > 0 order by attnum desc limit 3) x)\n"
                  f"     is distinct from 'school_type,team_school_type,team_age_group' then\n"
                  f"    raise exception 'NEXUS: colonnes de fin de {v} inattendues';\n  end if;\n" for v in VUE_PROD)
        + "end $$;\n\nnotify pgrst, 'reload schema';\n")

# ── Rollback ──
rb = f"""-- ════════════════════════════════════════════════════════════════════════════
-- Rollback du lot B3 cégep ({VERSION}_{NOM}). Sur GO BP seulement.
-- Remet les 3 fonctions recruteur et les 2 vues partenaire dans leur état prod du 2026-10-26 :
-- corps d'origine à la lettre, ACL au texte exact, commentaires reposés, reloptions identiques.
-- Les vues perdent des colonnes : DROP + CREATE (aucun objet n'en dépend, gardé ci-dessous).
-- ════════════════════════════════════════════════════════════════════════════

set local search_path = public, extensions;

do $$
begin
{gardes_fonctions(PROSRC_B3, 'la version B3 — ne pas écraser une version inconnue')}{gardes_vues(None, '')}{SANS_DEPENDANT}end $$;

{SAUVER_COM}create temp table _b3_com_vues (vue text primary key, texte text);
insert into _b3_com_vues
select 'public.top_athletes_view', obj_description('public.top_athletes_view'::regclass, 'pg_class')
union all
select 'public.trending_athletes_view', obj_description('public.trending_athletes_view'::regclass, 'pg_class');

"""
for nom in SIG:
    rb += f"-- ── {nom} ──\ndrop function {SIG[nom]};\n{F[nom]}\n{grants(nom)}\n"
rb += RESTAURER_COM + "\n"
rb += ("-- ── Les 2 vues ──\ndrop view public.top_athletes_view;\ndrop view public.trending_athletes_view;\n"
       + top.replace('CREATE OR REPLACE VIEW', 'CREATE VIEW', 1) + "\n\n"
       + trend.replace('CREATE OR REPLACE VIEW', 'CREATE VIEW', 1) + "\n\n"
       + "revoke all on table public.top_athletes_view, public.trending_athletes_view from public, anon, authenticated, service_role;\n"
       + "grant all on table public.top_athletes_view, public.trending_athletes_view to authenticated;\n"
       + "grant all on table public.top_athletes_view, public.trending_athletes_view to service_role;\n"
       + "do $$\ndeclare c record;\nbegin\n  for c in select * from _b3_com_vues where texte is not null loop\n"
       + "    execute format('comment on view %s is %L', c.vue, c.texte);\n  end loop;\nend $$;\ndrop table _b3_com_vues;\n\n"
       + "-- ── Gardes APRÈS : état prod du 2026-10-26 ──\ndo $$\nbegin\n"
       + gardes_fonctions(PROD, 'revenue au corps prod du 2026-10-26')
       + gardes_vues(VUE_PROD, 'revenue à la définition prod du 2026-10-26')
       + gardes_commentaires()
       + "end $$;\n\nnotify pgrst, 'reload schema';\n")

for t in (mig, rb):
    assert '$nexus_mig$' not in t and '$nexus_rb$' not in t
open(B + f'supabase/migrations/{VERSION}_{NOM}.sql', 'w', encoding='utf-8', newline='\n').write(mig)
open(B + f'supabase/rollback/{VERSION}_rollback_{NOM}.sql', 'w', encoding='utf-8', newline='\n').write(rb)
print('prosrc B3 :', PROSRC_B3)
print('migration', md5(mig), ' rollback', md5(rb))
