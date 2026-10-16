-- Journal partenaire par fonction en base — vues de fiche et téléchargements de carte (lot mobile 1.4.5, B1).
--
-- Le web journalise par deux routes Next (/api/partner/profile-views/log, /api/partner/cards/log-download).
-- Une appli en export statique n'embarque AUCUNE route API : sur mobile, ni la vue ni le téléchargement
-- ne seraient tracés (Loi 25 : l'athlète lit ce journal). La même règle passe donc dans UNE fonction,
-- appelée par le web ET par l'appli :
--
--   partenaire_journaliser(p_athlete_id, p_action, p_format)
--     · p_action = 'VUE'            → une ligne partner_profile_views ;
--     · p_action = 'TELECHARGEMENT' → une ligne partner_card_downloads (p_format 'publication' | 'story').
--   Mêmes gardes que les routes, dans le même ordre : session, partenaire APPROUVÉ (celui de auth.uid(),
--   jamais un identifiant passé par le client), paramètres, athlète admissible (is_partner_eligible_athlete).
--   Un refus lève une erreur « NEXUS: … » et n'écrit rien.
--
-- Aucune table, aucune policy, aucune fonction existante modifiée. Aucune donnée écrite par la migration.
do $$
begin
  if to_regprocedure('public.partenaire_journaliser(uuid,text,text)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (journal partenaire)';
  end if;
  if to_regprocedure('public.is_partner_eligible_athlete(uuid)') is null
     or to_regclass('public.partner_profile_views') is null
     or to_regclass('public.partner_card_downloads') is null then
    raise exception 'NEXUS: objets du portail partenaire absents';
  end if;
end $$;

create function public.partenaire_journaliser(p_athlete_id uuid, p_action text, p_format text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_partenaire uuid;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: non authentifié' using errcode = '42501';
  end if;

  select mp.id into v_partenaire
    from public.media_partners mp
   where mp.user_id = auth.uid() and mp.status = 'APPROVED';
  if v_partenaire is null then
    raise exception 'NEXUS: accès refusé — partenaire non approuvé' using errcode = '42501';
  end if;

  if p_athlete_id is null
     or p_action is null or p_action not in ('VUE', 'TELECHARGEMENT')
     or (p_action = 'TELECHARGEMENT' and (p_format is null or p_format not in ('publication', 'story')))
     or (p_action = 'VUE' and p_format is not null) then
    raise exception 'NEXUS: paramètres invalides' using errcode = '22023';
  end if;

  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non disponible' using errcode = '42501';
  end if;

  if p_action = 'VUE' then
    insert into public.partner_profile_views (partner_id, athlete_id) values (v_partenaire, p_athlete_id);
  else
    insert into public.partner_card_downloads (partner_id, athlete_id, format) values (v_partenaire, p_athlete_id, p_format);
  end if;
  return true;
end;
$$;

comment on function public.partenaire_journaliser(uuid, text, text) is
  'Journal Loi 25 du portail partenaire (web et appli) : VUE de fiche ou TELECHARGEMENT de carte, '
  'par le partenaire APPROUVÉ de la session, sur un athlète admissible. Remplace les deux routes Next.';

-- ── Droits ───────────────────────────────────────────────────────────────────
revoke all on function public.partenaire_journaliser(uuid, text, text) from public, anon, authenticated;
grant execute on function public.partenaire_journaliser(uuid, text, text) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────
do $$
declare
  vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL partenaire_journaliser = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure) then
    raise exception 'NEXUS: partenaire_journaliser doit être SECURITY DEFINER';
  end if;
  if (select position('is_partner_eligible_athlete(' in prosrc) from pg_proc
       where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure) = 0 then
    raise exception 'NEXUS: partenaire_journaliser ne vérifie pas l''admissibilité';
  end if;
  raise notice 'NEXUS journal partenaire : partenaire_journaliser (VUE, TELECHARGEMENT) — OK';
end $$;
