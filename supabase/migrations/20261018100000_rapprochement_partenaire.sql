-- P2/P3 (1.4.5, décision BP 2026-10-18 : « comme le recruteur, même fonctionnement ») — le PARTENAIRE
-- voit les correspondances possibles entre ses cartes prospect et des athlètes déjà inscrits, et
-- les ACCEPTE ou les REFUSE lui-même, comme le recruteur avec ses cartes (Rapprochements.tsx).
--
-- CE QUI CHANGE PAR RAPPORT À W4a (20261014200739, validé le 2026-10-14) : là, seuls l'admin et le
-- jeune décidaient, et la table des rapprochements n'était « jamais lisible par le partenaire ».
-- Désormais :
--  · partenaire_rapprochements() : les correspondances de SES cartes, SEULEMENT vers des athlètes
--    qui lui sont déjà visibles (is_partner_eligible_athlete : visibilité partenaire active et
--    14 ans ou consentement parental), dont le sport est celui de la carte et permis au partenaire.
--    Ce qui sort de l'athlète (nom, école, sport, promotion, photo) est ce
--    que la recherche partenaire montre déjà de lui : aucune donnée nouvelle.
--  · partenaire_rapprochement_accepter(carte, athlète) : même effet que « C'est moi » du jeune —
--    l'évaluation et les badges de la carte passent sur le profil (prospect_partenaire_transferer,
--    règles W2/W3/W3b inchangées, 7 jours d'annulation par l'admin), puis la carte disparaît.
--    Équivaut à ce que le partenaire pourrait déjà faire en évaluant ce jeune depuis sa fiche.
--  · partenaire_rapprochement_refuser(carte, athlète) : la paire est écartée et n'est plus
--    reproposée ; une proposition automatique déjà envoyée au jeune est levée (son avis devient
--    caduc).
-- Le jeune garde « Ce n'est pas moi » sur une proposition encore ouverte ; l'admin garde tout.
--
-- Deux listes de valeurs s'élargissent d'UNE valeur, 'PARTENAIRE' (source de réservation, origine
-- d'une décision). Aucune donnée existante touchée. Rollback :
-- supabase/rollback/20261018100000_rollback_rapprochement_partenaire.sql

do $$
begin
  if to_regprocedure('public.partenaire_rapprochements()') is not null then
    raise exception 'NEXUS: 20261018100000 déjà appliquée';
  end if;
  -- Listes de valeurs : EXACTEMENT celles relevées en prod le 2026-10-18.
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.partenaire_prospects'::regclass and conname = 'partenaire_prospects_reservation_source_check')
     is distinct from 'CHECK ((reservation_source = ANY (ARRAY[''LIEN''::text, ''ADMIN''::text, ''AUTO''::text])))' then
    raise exception 'NEXUS: partenaire_prospects_reservation_source_check ne correspond pas au relevé';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.partenaire_prospects_rapprochements'::regclass and conname = 'partenaire_prospects_rapprochements_origine_check')
     is distinct from 'CHECK ((origine = ANY (ARRAY[''ADMIN''::text, ''AUTO''::text])))' then
    raise exception 'NEXUS: partenaire_prospects_rapprochements_origine_check ne correspond pas au relevé';
  end if;
  -- Les fonctions sur lesquelles on s'appuie : corps relevés en prod (md5 brut).
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.prospect_partenaire_transferer(uuid,uuid)'::regprocedure)
       is distinct from 'd1efba39cdca153104d724fb4fd5ba6b'
  or (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.prospect_partenaire_candidats(uuid,uuid)'::regprocedure)
       is distinct from 'cbacbaac420d59a3ad577dccad55e9a4'
  or (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.prospect_partenaire_lever_proposition(uuid,text)'::regprocedure)
       is distinct from 'c4300148d5f814b7de202b8d7b04a1d8' then
    raise exception 'NEXUS: une fonction W4a ne correspond pas au relevé (transferer / candidats / lever_proposition)';
  end if;
end $$;

alter table public.partenaire_prospects drop constraint partenaire_prospects_reservation_source_check;
alter table public.partenaire_prospects add constraint partenaire_prospects_reservation_source_check
  check (reservation_source = any (array['LIEN', 'ADMIN', 'AUTO', 'PARTENAIRE']::text[]));
alter table public.partenaire_prospects_rapprochements drop constraint partenaire_prospects_rapprochements_origine_check;
alter table public.partenaire_prospects_rapprochements add constraint partenaire_prospects_rapprochements_origine_check
  check (origine = any (array['ADMIN', 'AUTO', 'PARTENAIRE']::text[]));

comment on table public.partenaire_prospects_rapprochements is
  'W4 — décisions de rapprochement carte partenaire × athlète existant (admin, automatique, ou le partenaire lui-même depuis 1.4.5 pour un athlète qui lui est déjà visible). Lue par fonctions seulement.';

-- ── Lecture : les correspondances de MES cartes ────────────────────────────────
create function public.partenaire_rapprochements()
returns table (
  carte_id uuid, athlete_id uuid, prenom text, nom text, ecole text, sport text, promotion integer,
  photo_url text, critere text, force text, deja_propose boolean)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  with mes_cartes as (
    select c.* from public.partenaire_prospects c
      join public.media_partners mp on mp.id = c.partner_id
     where mp.user_id = auth.uid() and c.expire_le > now()
  ), paires as (
    -- Cartes libres : les candidats calculés (paires déjà décidées exclues par la fonction).
    select c.id as carte_id, k.athlete_id, k.critere, k.force, false as deja_propose
      from mes_cartes c
      cross join lateral public.prospect_partenaire_candidats(c.id, null) k
     where c.statut in ('A_ENVOYER', 'ENVOYEE')
    union all
    -- Proposition automatique déjà envoyée au jeune, encore ouverte.
    select c.id, c.reservee_athlete, r.critere, r.force, true
      from mes_cartes c
      join public.partenaire_prospects_rapprochements r
        on r.carte_id = c.id and r.athlete_id = c.reservee_athlete and r.statut = 'PROPOSE'
     where c.statut = 'RESERVEE' and c.reservation_source = 'AUTO'
  )
  select p.carte_id, a.id, a.first_name, a.last_name, s.name, sp.nom, a.annee_diplomation, a.photo_url,
         p.critere, p.force, p.deja_propose
    from paires p
    join mes_cartes c on c.id = p.carte_id
    join public.athletes a on a.id = p.athlete_id
    left join public.schools s on s.id = a.school_id
    left join public.sports sp on sp.id = a.sport_id
   where coalesce(public.is_partner_eligible_athlete(a.id), false)
     and public.prospect_partenaire_sport_concorde(c.sport_id, a.id)
     and public.prospect_partenaire_peut_transferer(c.partner_id, c.sport_id)
   order by (p.force = 'MOYENNE') desc, a.last_name, a.first_name
$$;

comment on function public.partenaire_rapprochements() is
  'P2/P3 1.4.5 — correspondances possibles des cartes du partenaire appelant, vers des athlètes qui lui sont déjà visibles seulement.';

-- ── Accepter : comme « C'est moi », décidé par le partenaire ───────────────────
create function public.partenaire_rapprochement_accepter(p_carte uuid, p_athlete uuid)
returns jsonb
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte  public.partenaire_prospects%rowtype;
  v_paire  record;
begin
  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found or v_carte.expire_le <= now() then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  -- La paire doit être une correspondance OUVERTE de cette carte (la même liste que la lecture).
  select r.critere, r.force into v_paire
    from public.partenaire_rapprochements() r
   where r.carte_id = p_carte and r.athlete_id = p_athlete;
  if not found then
    raise exception 'NEXUS: cette correspondance n''est plus proposée' using errcode = '22023';
  end if;
  if v_carte.statut = 'RESERVEE' then
    -- Proposition automatique déjà envoyée au jeune : son avis « C'est toi ? » devient caduc.
    update public.athlete_notifications
       set read = true, metadata = metadata || jsonb_build_object('caduque', true, 'caduque_le', now())
     where athlete_id = p_athlete and type = 'PARTENAIRE_EVALUATION'
       and metadata->>'carte_id' = p_carte::text and not coalesce((metadata->>'caduque')::boolean, false);
  else
    update public.partenaire_prospects
       set statut = 'RESERVEE', statut_avant = v_carte.statut, reservation_source = 'PARTENAIRE',
           -- Réservée PAR le partenaire (c'est lui qui décide) : reservee_par = lui, pas le jeune.
           reservee_par = auth.uid(), reservee_athlete = p_athlete, reservee_le = now(), updated_at = now()
     where id = p_carte;
  end if;
  insert into public.partenaire_prospects_rapprochements (carte_id, athlete_id, critere, force, origine, statut, decide_par)
  values (p_carte, p_athlete, v_paire.critere, v_paire.force, 'PARTENAIRE', 'PROPOSE', auth.uid())
  on conflict (carte_id, athlete_id) do update
    set origine = 'PARTENAIRE', decide_par = auth.uid(), decide_le = now();
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'RAPPROCHEMENT_ACCEPTE_PARTENAIRE', p_athlete,
            jsonb_build_object('critere', v_paire.critere, 'force', v_paire.force));
  -- Transfert W2/W3/W3b (rapprochement → CONFIRME, issue RECLAMEE annulable 7 jours, carte supprimée).
  return public.prospect_partenaire_transferer(p_carte, p_athlete);
end $$;

-- ── Refuser : la paire est écartée, plus jamais reproposée ─────────────────────
create function public.partenaire_rapprochement_refuser(p_carte uuid, p_athlete uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_paire record;
begin
  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  select r.critere, r.force into v_paire
    from public.partenaire_rapprochements() r
   where r.carte_id = p_carte and r.athlete_id = p_athlete;
  if not found then
    raise exception 'NEXUS: cette correspondance n''est plus proposée' using errcode = '22023';
  end if;
  if v_carte.statut = 'RESERVEE' and v_carte.reservation_source = 'AUTO' and v_carte.reservee_athlete = p_athlete then
    -- Proposition déjà envoyée au jeune : levée (carte rendue à son état d'avant, avis caduc).
    perform public.prospect_partenaire_lever_proposition(p_carte, 'REFUS_PARTENAIRE');
  end if;
  insert into public.partenaire_prospects_rapprochements (carte_id, athlete_id, critere, force, origine, statut, decide_par)
  values (p_carte, p_athlete, v_paire.critere, v_paire.force, 'PARTENAIRE', 'ECARTE', auth.uid())
  on conflict (carte_id, athlete_id) do update
    set statut = 'ECARTE', origine = 'PARTENAIRE', decide_par = auth.uid(), decide_le = now();
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'RAPPROCHEMENT_REFUSE_PARTENAIRE', p_athlete,
            jsonb_build_object('critere', v_paire.critere, 'force', v_paire.force));
end $$;

revoke all on function public.partenaire_rapprochements() from public, anon, authenticated;
revoke all on function public.partenaire_rapprochement_accepter(uuid, uuid) from public, anon, authenticated;
revoke all on function public.partenaire_rapprochement_refuser(uuid, uuid) from public, anon, authenticated;
grant execute on function public.partenaire_rapprochements() to authenticated, service_role;
grant execute on function public.partenaire_rapprochement_accepter(uuid, uuid) to authenticated, service_role;
grant execute on function public.partenaire_rapprochement_refuser(uuid, uuid) to authenticated, service_role;

-- GATES — ACL complètes triées (jamais par inclusion), SECURITY DEFINER, listes de valeurs.
do $$
declare
  f    regprocedure;
  vus  text[];
begin
  foreach f in array array['public.partenaire_rapprochements()'::regprocedure,
                           'public.partenaire_rapprochement_accepter(uuid,uuid)'::regprocedure,
                           'public.partenaire_rapprochement_refuser(uuid,uuid)'::regprocedure] loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL de % = %', f, vus;
    end if;
    if not (select prosecdef from pg_proc where oid = f) then
      raise exception 'NEXUS: % doit être SECURITY DEFINER', f;
    end if;
  end loop;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.partenaire_prospects'::regclass and conname = 'partenaire_prospects_reservation_source_check')
     is distinct from 'CHECK ((reservation_source = ANY (ARRAY[''LIEN''::text, ''ADMIN''::text, ''AUTO''::text, ''PARTENAIRE''::text])))' then
    raise exception 'NEXUS: liste reservation_source inattendue après la migration';
  end if;
end $$;
