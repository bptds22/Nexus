# Lot B3 cégep — produit scripts/cegep-lot-b3/aligner-local.sql : aligne la base JETABLE nexus_b3 sur la
# PROD pour les objets que B3 touche ou lit (vues partenaire et leurs fonctions), à partir des textes des
# migrations du dépôt. LOCAL SEULEMENT. Les md5 sont vérifiés contre la prod à la fin du .sql.
import os

B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'


def lire(f):
    return open(B + f, encoding='utf-8').read().replace('\r\n', '\n')


def bloc(t, debut, fin):
    i = t.index(debut)
    return t[i:t.index(fin, i) + len(fin)]


rs = lire('supabase/migrations/20261018150000_athlete_reseaux_sociaux.sql')
table = bloc(rs, 'create table public.consentement_partenaire_v2 (', ');')
top = bloc(rs, 'CREATE OR REPLACE VIEW public.top_athletes_view AS', 'ORDER BY a.cote_globale_entraineur DESC;')
# Commentaire prod relevé le 2026-10-26 (md5 af7d280e…, vérifié à la fin du .sql).
COM_PROD = "SECURITY DEFINER ASSUME (2026-08-19, point 5b du chantier RLS partenaire).\n\nPassee en INVOKER le matin meme, puis remise en DEFINER le soir — deliberement.\nINVOKER supposait que la RLS de `athletes` ait la bonne granularite. Elle ne\nl'a pas : la RLS est par LIGNE, l'exposition est COLONNAIRE. Tant qu'une policy\npartenaire existait sur athletes, les 87 colonnes des lignes visibles etaient\nlisibles en PostgREST direct (email, date_naissance, nom_parent... verifie en\nruntime). Cette policy est desormais SUPPRIMEE, et cette vue ne peut donc plus\netre en INVOKER : elle ne verrait plus aucune ligne.\n\nPour le chemin partenaire, DEFINER avec gate interne est la posture FORTE :\nc'est elle qui permet de maitriser la projection.\n\nAcces restreint par : REVOKE anon + gate is_approved_partner(auth.uid()) dans le\nWHERE. Un non-partenaire authentifie lit 0 ligne.\n\nATTENTION — tout CREATE OR REPLACE VIEW sur cet objet efface les reloptions.\nIci l'attendu est justement l'ABSENCE de security_invoker, donc un\nCREATE OR REPLACE est sans danger de ce point de vue. Mais il ferait perdre les\ncolonnes projetees si la definition partait d'une version anterieure : `genre`\n(ajoute 2026-08-18) alimente les filtres genre des QUATRE ecrans partenaire.\n\nVoir docs/security-definer-partner-views-investigation-20260706.md et\nscripts/check-view-hardening.sql, dont l'attendu pour cette vue est DEFINER."
com_top = 'comment on view public.top_athletes_view is $c$' + COM_PROD + '$c$;'

# Corps prod relevés le 2026-10-26 (pg_get_functiondef), fins de ligne prod comprises.
f_consent = ("CREATE OR REPLACE FUNCTION public.consentement_partenaire_v2_valide(p_athlete_id uuid)\n RETURNS boolean\n LANGUAGE sql\n"
             " STABLE SECURITY DEFINER\n SET search_path TO 'public'\n SET row_security TO 'off'\nAS $function$\r\n"
             "  select coalesce((\r\n    select a.partner_visibility_opt_in\r\n           and c.accepte_le is not null\r\n"
             "           and c.accepte_le >= coalesce(a.partner_visibility_opted_in_at, '-infinity'::timestamptz)\r\n"
             "      from public.athletes a\r\n      join public.consentement_partenaire_v2 c on c.athlete_id = a.id\r\n"
             "     where a.id = p_athlete_id), false)\r\n$function$;\n")
f_media = ("CREATE OR REPLACE FUNCTION public.is_partner_media_athlete(p_athlete_id uuid)\n RETURNS boolean\n LANGUAGE sql\n"
           " STABLE SECURITY DEFINER\n SET search_path TO 'public'\n SET row_security TO 'off'\nAS $function$\r\n"
           "  select coalesce(public.is_partner_eligible_athlete(p_athlete_id), false)\r\n"
           "     and public.consentement_partenaire_v2_valide(p_athlete_id)\r\n$function$;\n")
f_partner = ("CREATE OR REPLACE FUNCTION public.is_approved_partner(uid uuid)\n RETURNS boolean\n LANGUAGE sql\n"
             " STABLE SECURITY DEFINER\n SET search_path TO 'public'\n SET row_security TO 'off'\nAS $function$\n"
             "  SELECT EXISTS (\n    SELECT 1 FROM media_partners\n    WHERE user_id = auth.uid() AND status = 'APPROVED'\n  );\n$function$;\n")

sql = f"""-- Lot B3 cégep — aligne la base JETABLE nexus_b3 sur la PROD (objets lus ou touchés par B3).
-- GÉNÉRÉ par scripts/cegep-lot-b3/aligner-local.py. LOCAL SEULEMENT.
\\set ON_ERROR_STOP 1
do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée — alignement local refusé';
  end if;
end $$;
begin;
set local search_path = public, extensions;
{table}
alter table public.consentement_partenaire_v2 enable row level security;
revoke all on table public.consentement_partenaire_v2 from public, anon, authenticated;
{f_consent}revoke all on function public.consentement_partenaire_v2_valide(uuid) from public, anon, authenticated;
grant execute on function public.consentement_partenaire_v2_valide(uuid) to service_role;
{f_media}revoke all on function public.is_partner_media_athlete(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_partner_media_athlete(uuid) to authenticated, service_role;
{f_partner}
{top}
{com_top}

-- Vérifications contre les relevés prod du 2026-10-26.
do $$
begin
  if md5(pg_get_viewdef('public.top_athletes_view'::regclass)) <> 'b677336de698551f2d5b733bc7f70bab'
     or md5(pg_get_viewdef('public.trending_athletes_view'::regclass)) <> 'b45eb0030c789288a79dddbdd020d060' then
    raise exception 'NEXUS: vues locales différentes de la prod';
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) <> 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view différent de la prod';
  end if;
  if (select string_agg(proname || ':' || left(md5(prosrc), 8), ' ' order by proname) from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('is_approved_partner', 'is_partner_media_athlete', 'is_partner_eligible_athlete', 'peut_voir_cegepiens',
                         'athlete_est_cegepien', 'unite_voit_cegepiens', 'athlete_identity_ok', 'user_has_pro', 'is_admin',
                         'recruiter_search_athletes', 'recruiter_athlete_cards', 'recruiter_athlete_profile'))
     <> 'athlete_est_cegepien:3cd17450 athlete_identity_ok:ded602d0 is_admin:02d64a24 is_approved_partner:3d4da666 '
        'is_partner_eligible_athlete:1a196afe is_partner_media_athlete:24dec49b peut_voir_cegepiens:65353c9f '
        'recruiter_athlete_cards:ba26d8b8 recruiter_athlete_profile:0fccf321 recruiter_search_athletes:aba2e501 '
        'unite_voit_cegepiens:1a5be0be user_has_pro:17c163dc' then
    raise exception 'NEXUS: fonctions locales différentes de la prod';
  end if;
end $$;
commit;
\\echo '== nexus_b3 alignée sur la prod (objets B3).'
"""
open(B + 'scripts/cegep-lot-b3/aligner-local.sql', 'w', encoding='utf-8', newline='\n').write(sql)
print('ok')
