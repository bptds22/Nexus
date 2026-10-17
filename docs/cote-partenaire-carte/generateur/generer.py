"""Génère la migration 20261016170000 et son rollback à partir du gabarit et des définitions
d'origine relevées en local (= prod, empreinte sans CR vérifiée). Remplacements EXACTS, vérifiés."""
import io, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(ICI, "orig")
DEPOT = sys.argv[1]  # racine du dépôt ; ex. python docs/cote-partenaire-carte/generateur/generer.py .


def lire(nom):
    s = io.open(os.path.join(ORIG, nom + ".sql"), encoding="utf-8-sig").read().replace("\r\n", "\n").replace("\r", "")
    s = s.rstrip("\n")
    assert s.startswith("CREATE OR REPLACE FUNCTION") and s.endswith("$function$"), nom
    return s + ";"


def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:80], s.count(a))
    return s.replace(a, b)


orig = {n: lire(n) for n in ["evaluations_partenaires_athlete", "badges_partenaires_athlete",
                             "partenaire_badges_nexus_admissibles", "recruiter_search_athletes",
                             "push_textes", "push_traiter_file"]}
LOI25 = "-- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin."

ev = orig["evaluations_partenaires_athlete"]
ev = rep(ev, "    ) as tout\n  )\n", "    ) as tout,\n    public.is_admin() as admin,\n    " + LOI25 + "\n"
         "    coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) as admissible\n  )\n")
ev = rep(ev, "     and (lecteur.tout or mp.user_id = auth.uid())\n",
         "     and (lecteur.tout or mp.user_id = auth.uid())\n     and (lecteur.admin or lecteur.admissible)\n")

ba = orig["badges_partenaires_athlete"]
ba = rep(ba, "      ) as tout\n  )\n", "      ) as tout,\n      " + LOI25 + "\n"
         "      coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) as admissible\n  )\n")
ba = rep(ba, "     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())\n",
         "     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())\n"
         "     and (lecteur.admin or lecteur.admissible)\n")

ad = orig["partenaire_badges_nexus_admissibles"]
ad = rep(ad, "    end if;\n  end if;\n\n  return query\n",
         "    end if;\n  end if;\n  " + LOI25 + "\n"
         "  if not public.is_admin() and not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then\n"
         "    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';\n"
         "  end if;\n\n  return query\n")

rs = orig["recruiter_search_athletes"]
m = re.findall(r"\n( +)WHERE pev\.athlete_id = a\.id\n", rs)
assert len(m) == 1, m
rs = rep(rs, "\n%sWHERE pev.athlete_id = a.id\n" % m[0],
         "\n%sWHERE pev.athlete_id = a.id\n%s  AND COALESCE(public.is_partner_eligible_athlete(a.id), false)  %s\n"
         % (m[0], m[0], LOI25))

rs = rep(rs, "ORDER BY pev.updated_at DESC\n", "ORDER BY pev.updated_at DESC, pev.id DESC\n")

tx = orig["push_textes"]
tx = rep(tx, "      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'\n",
         "      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'\n"
         "      when p_genre = 'VISIBILITE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'\n")
tx = rep(tx, "      when p_genre = 'CARTE_PARTENAIRE' then 'Réponds dans l''appli Nexus ou sur nexussports.ca.'\n",
         "      when p_genre = 'CARTE_PARTENAIRE' then 'Réponds dans l''appli Nexus ou sur nexussports.ca.'\n"
         "      when p_genre = 'VISIBILITE_PARTENAIRE' then 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche.'\n")

pt = orig["push_traiter_file"]
pt = rep(pt, "          and r.statut = 'PROPOSE');\n  get diagnostics v_k = row_count;\n  v_annules := v_annules + v_k;\n",
         "          and r.statut = 'PROPOSE');\n  get diagnostics v_k = row_count;\n  v_annules := v_annules + v_k;\n\n"
         "  -- Demande de visibilité qui n'attend plus le jeune (acceptée, au parent, caduque) : rien ne part.\n"
         "  update public.push_file f\n"
         "     set statut = 'ANNULE', traite_le = p_maintenant\n"
         "   where f.statut = 'EN_ATTENTE' and f.genre = 'VISIBILITE_PARTENAIRE'\n"
         "     and not exists (\n"
         "       select 1 from public.athlete_notifications n\n"
         "        where n.id::text = f.detail->>'notification_id'\n"
         "          and n.metadata->>'etat' = 'EN_ATTENTE');\n"
         "  get diagnostics v_k = row_count;\n  v_annules := v_annules + v_k;\n")

g = io.open(os.path.join(ICI, "gabarit.sql"), encoding="utf-8").read().replace("\r\n", "\n")
for k, v in {"EVAL": ev, "BADGES": ba, "ADMISSIBLES": ad, "RSA": rs, "TEXTES": tx, "PTF": pt}.items():
    g = rep(g, "{{%s}}" % k, v)
assert "{{" not in g
mig = os.path.join(DEPOT, "supabase", "migrations", "20261016170000_cote_partenaire_carte_mes_athletes.sql")
io.open(mig, "w", encoding="utf-8", newline="\n").write(g)

# ── Rollback : retour EXACT à l'état relevé (W4d, W2, W3b, A4a/A5, D1b) ──────
w4d = io.open(os.path.join(DEPOT, "supabase", "migrations", "20261015110727_w4d_partenaires_terminees_mes_athletes.sql"),
              encoding="utf-8").read().replace("\r\n", "\n")
d = w4d.index("create function public.partenaire_mes_athletes()")
f = w4d.index("\n$$;\n", d) + 5
mes_w4d = w4d[d:f]

rb = """-- Rollback de 20261016170000 : retour EXACT à l'état relevé le 2026-10-16 (W2, W3b, W4d, A4a/A5, D1b).
-- Les demandes de visibilité (cloche jeune, portail parent) et leurs lignes de file push sont
-- SUPPRIMÉES : leurs types sortent des listes. Rien d'autre n'est touché.
do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is null then
    raise exception 'NEXUS: lot 20261016170000 absent — rien à défaire';
  end if;
end $$;

drop trigger trg_partenaire_demande_sur_carte on public.partenaire_prospects;
drop trigger trg_partenaire_demande_sur_optin on public.athletes;
drop function public.trg_partenaire_demande_sur_carte();
drop function public.trg_partenaire_demande_sur_optin();
drop function public.accepter_visibilite_partenaire(uuid, text);
drop function public.partenaire_demander_visibilite(uuid);
drop function public.partenaire_regler_demandes_visibilite(uuid);
drop function public.cotes_partenaires_athletes(uuid[]);

delete from public.athlete_notifications where type = 'PARTENAIRE_VISIBILITE_DEMANDE';
delete from public.parent_notifications where type = 'CHILD_PARTNER_VISIBILITY_REQUEST';
alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION', 'PARTENAIRE_BADGE', 'PARTENAIRE_EVALUATION_RECUE']::text[]));
alter table public.parent_notifications drop constraint parent_notifications_type_check;
alter table public.parent_notifications add constraint parent_notifications_type_check
  check (type = any (array['CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED']::text[]));
delete from public.push_file where genre = 'VISIBILITE_PARTENAIRE';
alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE', 'CARTE_PARTENAIRE']::text[]));

"""
for n in ["evaluations_partenaires_athlete", "badges_partenaires_athlete", "partenaire_badges_nexus_admissibles",
          "recruiter_search_athletes", "push_textes", "push_traiter_file"]:
    rb += orig[n] + "\n\n"
rb += "drop function public.partenaire_mes_athletes();\n\n" + mes_w4d + "\n" + """
revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated, service_role;

do $$
begin
  if exists (
    select 1
      from (values
        ('public.partenaire_mes_athletes()', '71a92e788d13bc85ee8d9d9baa675e30'),
        ('public.evaluations_partenaires_athlete(uuid)', '33d0544f27a8b62fa9e21902f2e62310'),
        ('public.badges_partenaires_athlete(uuid)', '6baa5e2d5c2f219a0bd1baac97f99e72'),
        ('public.partenaire_badges_nexus_admissibles(uuid)', 'd55783f816d54757ee2e18c94e7d3757'),
        ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '957289faec17d8e027681a155ba80bc7'),
        ('public.push_textes(text,text,integer,text)', 'd8b270c9d129866b636e4d9ee1bbe8a3'),
        ('public.push_traiter_file(timestamptz)', '8e7bfc261e8041074486d5395f17b198')
      ) as v(f, attendu)
     where (select md5(replace(p.prosrc, E'\\r', '')) from pg_proc p where p.oid = to_regprocedure(v.f)) is distinct from v.attendu)
  then
    raise exception 'NEXUS: rollback — une fonction n''est pas revenue à l''identique';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'athlete_notifications_type_check')
       is distinct from 'f7c3e05c8d78780c77afe27967fedb61'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'parent_notifications_type_check')
       is distinct from '521852a6656bff4344aae982c7623209'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'push_file_genre_check')
       is distinct from '2e673d7536774b4c181d9897db778521' then
    raise exception 'NEXUS: rollback — contraintes de type non restaurées';
  end if;
  if (select array_agg(t.g order by t.g)
        from pg_proc pr,
             lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
       where pr.oid = 'public.partenaire_mes_athletes()'::regprocedure)
     is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: rollback — ACL de partenaire_mes_athletes';
  end if;
  raise notice 'NEXUS rollback 20261016170000 : retour à l''état relevé — OK';
end $$;
"""
io.open(os.path.join(DEPOT, "supabase", "rollback", "20261016170000_rollback_cote_partenaire_carte_mes_athletes.sql"),
        "w", encoding="utf-8", newline="\n").write(rb)
print("migration", len(g), "octets ; rollback", len(rb), "octets")
