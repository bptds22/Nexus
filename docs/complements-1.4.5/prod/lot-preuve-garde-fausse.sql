-- LOT PROD compléments 1.4.5 — généré par docs/complements-1.4.5/prod/construire-lot.mjs — VARIANTE DE PREUVE (empreinte fausse)
-- Fichier : supabase/migrations/20261017010000_complements_1_4_5.sql — md5 d95f608347271299b8e66eabc5c32669
-- Empreinte attendue des objets : 00000000000000000000000000000000
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _pj_releve as
select txid_current() as txid,
       (select count(*) from public.blackout_periods) || '|' || (select count(*) from public.partenaire_prospects)
       || '|' || (select count(*) from public.athletes) as donnees,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261017010000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _pj_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _pj_releve) <> 0 then
    raise exception 'NEXUS LOT: migration compléments 1.4.5 déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261017010000_complements_1_4_5.sql =====
-- Compléments 1.4.5 (BP 2026-10-16) — deux corrections serveur, un seul lot.
--
--  A. Période de non-contact sur les cartes prospect PARTENAIRE (point 5). Aujourd'hui les
--     périodes (blackout_periods, /admin/blackouts) ne bloquent que l'écriture recruteur ↔ athlète.
--     Pendant une période active pour le sport et la promotion de la carte, la création ou le
--     remplacement du lien (partenaire_prospect_lien) est REFUSÉ — même règle que get_active_blackout
--     (actif, date de Montréal entre début et fin inclus, sport nul = tous, bornes de promotion ;
--     une carte sans promotion est couverte, comme un athlète sans promotion).
--     non_contact_carte(sport, promotion) rend la fin de période, lue aussi par l'écran pour griser
--     « Envoyer par texto », « Copier le message » et « Nouveau lien ».
--  B. lookup_invitable_athletes_by_email (point 10) : un athlète DÉJÀ dans l'effectif du coach ne
--     lève plus exists_exact (« Il fait partie d'une autre équipe ») ; nouveau drapeau exists_mine
--     (courriel exact d'un athlète du coach), sans PII. Colonne de retour ajoutée → DROP + CREATE,
--     droits rétablis à l'identique (anon, authenticated, service_role). Un client qui ignore la
--     colonne (appli 1.4.4) lit le reste comme avant.
--
-- Aucune table, aucune policy modifiée. Aucune donnée écrite.
do $$
begin
  if to_regprocedure('public.non_contact_carte(uuid,integer)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (compléments 1.4.5)';
  end if;
  -- Les deux fonctions remplacées, telles que relevées en prod ET en local le 2026-10-16
  -- (empreinte sans commentaires ni espaces).
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure) is distinct from '4f00ff226b829189f21cd3a487daad80' then
    raise exception 'NEXUS: partenaire_prospect_lien ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.lookup_invitable_athletes_by_email(text)'::regprocedure) is distinct from '5b5b908927bd4c2fcc4edcd01a9f7f95' then
    raise exception 'NEXUS: lookup_invitable_athletes_by_email ne correspond pas au relevé';
  end if;
end $$;

-- ── A. Non-contact ───────────────────────────────────────────────────────────
create function public.non_contact_carte(p_sport uuid, p_promo integer)
returns table (date_fin date, libelle text)
language sql
stable
security definer
set search_path = public, pg_temp
as $nc$
  select b.date_fin, b.libelle
    from public.blackout_periods b
   where b.actif
     and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
     and (b.sport_id is null or p_sport is null or b.sport_id = p_sport)
     and (
           (b.promo_min is null and b.promo_max is null)
        or p_promo is null
        or (    (b.promo_min is null or p_promo >= b.promo_min)
            and (b.promo_max is null or p_promo <= b.promo_max))
     )
   order by b.date_fin desc, b.date_debut asc
   limit 1
$nc$;

comment on function public.non_contact_carte(uuid, integer) is
  'Période de non-contact active pour un sport et une promotion (règle de get_active_blackout) : '
  'sa fin et son libellé, ou rien. Lue par partenaire_prospect_lien et par /partenaire/prospects.';

revoke all on function public.non_contact_carte(uuid, integer) from public, anon, authenticated;
grant execute on function public.non_contact_carte(uuid, integer) to authenticated;

CREATE OR REPLACE FUNCTION public.partenaire_prospect_lien(p_carte uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $lien$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_jeton text := encode(extensions.gen_random_bytes(32), 'hex');
  v_prop  boolean;
  v_vu    text;
  v_fin   date;
begin
  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  if not public.partenaire_peut_evaluer(v_carte.partner_id, v_carte.sport_id) then
    raise exception 'NEXUS: cartes prospects non permises (permission, sport ou statut du partenaire)' using errcode = '42501';
  end if;
  -- 1.4.5 : période de non-contact (blackout_periods, la règle de get_active_blackout)
  -- sur le sport et la promotion de la carte → aucun lien, ni neuf ni remplacé.
  select n.date_fin into v_fin from public.non_contact_carte(v_carte.sport_id, v_carte.promotion) n;
  if v_fin is not null then
    raise exception 'NEXUS: Période de non-contact jusqu''au %', extract(day from v_fin)::int || ' ' || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from v_fin)::int] || ' ' || extract(year from v_fin)::int using errcode = '42501';
  end if;
  if v_carte.expire_le > now() then
    perform public.prospect_partenaire_lever_reservation_lien(p_carte, 'NOUVEAU_LIEN');
    select * into v_carte from public.partenaire_prospects where id = p_carte;
  end if;
  v_prop := coalesce(v_carte.reservation_source, 'LIEN') <> 'LIEN';
  v_vu   := case when v_prop then v_carte.statut_avant else v_carte.statut end;
  if v_vu not in ('A_ENVOYER', 'ENVOYEE') or v_carte.expire_le <= now() then
    raise exception 'NEXUS: cette carte ne peut pas recevoir de nouveau lien pour l''instant' using errcode = '42501';
  end if;
  update public.partenaire_prospects
     set statut       = case when v_prop then statut else 'ENVOYEE' end,
         statut_avant = case when v_prop then 'ENVOYEE' else statut_avant end,
         jeton_empreinte = encode(extensions.digest(v_jeton, 'sha256'), 'hex'),
         jeton_cree_le = now(), updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id,
            case when v_vu = 'ENVOYEE' then 'LIEN_REMPLACE' else 'LIEN_GENERE' end);
  return v_jeton;
end $lien$;

-- ── B. « Autre équipe » ≠ « mon effectif » ───────────────────────────────────
drop function public.lookup_invitable_athletes_by_email(text);

create function public.lookup_invitable_athletes_by_email(p_prefix text)
returns table (athlete_id uuid, email text, first_name text, last_name text, sport_name text,
               has_account boolean, exists_not_invitable boolean, exists_exact boolean, exists_mine boolean)
language plpgsql
stable
security definer
set search_path = public
as $lk$
declare
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
  v_caller uuid := auth.uid();
begin
  if not public.is_coach() then
    return;
  end if;
  if length(v_prefix) < 4 then
    return;
  end if;

  return query
  -- Compartiment 1 : MES orphelins sans compte -> invitable (courriel de claim).
  -- PREFIXE conserve : c'est une suggestion, elle doit apparaitre en tapant.
  ( select a.id, a.email, a.first_name, a.last_name, sp.nom, false, false, false, false
    from public.athletes a
    left join public.sports sp on sp.id = a.sport_id
    where a.coach_id = v_caller
      and a.user_id is null
      and a.email is not null
      and lower(a.email) like v_prefix || '%'
    order by a.email
    limit 3 )

  union all
  -- Compartiment 2 : comptes SANS coach (civil OU scolaire) -> invitable.
  -- PREFIXE conserve, meme raison.
  ( select a.id, u.email, a.first_name, a.last_name, sp.nom, true, false, false, false
    from public.users u
    join public.athletes a on a.user_id = u.id
    left join public.sports sp on sp.id = a.sport_id
    where u.role = 'ATHLETE'
      and a.coach_id is null
      and u.email ilike v_prefix || '%'
    order by u.email
    limit 3 )

  union all
  -- Compartiment 3 : existe mais NON-invitable -> DRAPEAUX SEULS, AUCUNE PII.
  --   exists_not_invitable : sur PREFIXE (inchangé).
  --   exists_exact         : sur EGALITE, athlète d'un AUTRE coach — c'est lui qui
  --                          gouverne la bannière « autre équipe », le blocage de
  --                          création et le bouton d'invitation.
  --   exists_mine          : sur EGALITE, athlète déjà dans MON effectif (avec
  --                          compte) — « Déjà dans ton effectif », création bloquée
  --                          (1.4.5 : il ne lève plus exists_exact).
  ( select null::uuid, null::text, null::text, null::text, null::text,
           null::boolean,
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(coalesce(a.email, u.email)) like v_prefix || '%'
               and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
               and not (a.coach_id is null and a.user_id is not null)
           ),
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(btrim(coalesce(a.email, u.email))) = v_prefix
               and not coalesce(a.coach_id = v_caller, false)
               and not (a.coach_id is null and a.user_id is not null)
           ),
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(btrim(coalesce(a.email, u.email))) = v_prefix
               and a.coach_id = v_caller
               and a.user_id is not null
           )
    where exists (
      select 1
      from public.athletes a
      left join public.users u on u.id = a.user_id
      where lower(coalesce(a.email, u.email)) like v_prefix || '%'
        and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
        and not (a.coach_id is null and a.user_id is not null)
    ) )

  union all
  -- Compartiment 4 : le courriel appartient a un compte public.users qui n'a
  -- AUCUNE ligne athletes (COACH, RECRUTEUR, PARENT, ADMIN). DRAPEAUX SEULS,
  -- AUCUNE PII. Le coach lui-meme tombe ici s'il saisit son propre courriel.
  ( select null::uuid, null::text, null::text, null::text, null::text,
           null::boolean,
           exists (
             select 1 from public.users u
             where lower(btrim(u.email)) like v_prefix || '%'
               and not exists (select 1 from public.athletes a where a.user_id = u.id)
           ),
           exists (
             select 1 from public.users u
             where lower(btrim(u.email)) = v_prefix
               and not exists (select 1 from public.athletes a where a.user_id = u.id)
           ),
           false
    where exists (
      select 1 from public.users u
      where lower(btrim(u.email)) like v_prefix || '%'
        and not exists (select 1 from public.athletes a where a.user_id = u.id)
    ) );
end;
$lk$;

revoke all on function public.lookup_invitable_athletes_by_email(text) from public;
grant execute on function public.lookup_invitable_athletes_by_email(text) to anon, authenticated, service_role;


-- ── Garde finale : droits (comparaison COMPLÈTE) et présence des correctifs ──
do $$
declare
  f text; attendu text[]; vus text[];
begin
  for f, attendu in
    select * from (values
      ('public.non_contact_carte(uuid,integer)', array['authenticated','postgres','service_role']),
      ('public.partenaire_prospect_lien(uuid)', array['authenticated','postgres','service_role']),
      ('public.lookup_invitable_athletes_by_email(text)', array['anon','authenticated','postgres','service_role'])
    ) v(fn, a)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f::regprocedure;
    if vus is distinct from attendu then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, attendu;
    end if;
  end loop;
  if position('non_contact_carte(' in (select prosrc from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure)) = 0 then
    raise exception 'NEXUS: partenaire_prospect_lien ne vérifie pas le non-contact';
  end if;
  raise notice 'NEXUS compléments 1.4.5 : non-contact cartes, effectif — OK';
end $$;

-- ===== FIN 20261017010000_complements_1_4_5.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _pj_texte as select $PJMIG$-- Compléments 1.4.5 (BP 2026-10-16) — deux corrections serveur, un seul lot.
--
--  A. Période de non-contact sur les cartes prospect PARTENAIRE (point 5). Aujourd'hui les
--     périodes (blackout_periods, /admin/blackouts) ne bloquent que l'écriture recruteur ↔ athlète.
--     Pendant une période active pour le sport et la promotion de la carte, la création ou le
--     remplacement du lien (partenaire_prospect_lien) est REFUSÉ — même règle que get_active_blackout
--     (actif, date de Montréal entre début et fin inclus, sport nul = tous, bornes de promotion ;
--     une carte sans promotion est couverte, comme un athlète sans promotion).
--     non_contact_carte(sport, promotion) rend la fin de période, lue aussi par l'écran pour griser
--     « Envoyer par texto », « Copier le message » et « Nouveau lien ».
--  B. lookup_invitable_athletes_by_email (point 10) : un athlète DÉJÀ dans l'effectif du coach ne
--     lève plus exists_exact (« Il fait partie d'une autre équipe ») ; nouveau drapeau exists_mine
--     (courriel exact d'un athlète du coach), sans PII. Colonne de retour ajoutée → DROP + CREATE,
--     droits rétablis à l'identique (anon, authenticated, service_role). Un client qui ignore la
--     colonne (appli 1.4.4) lit le reste comme avant.
--
-- Aucune table, aucune policy modifiée. Aucune donnée écrite.
do $$
begin
  if to_regprocedure('public.non_contact_carte(uuid,integer)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (compléments 1.4.5)';
  end if;
  -- Les deux fonctions remplacées, telles que relevées en prod ET en local le 2026-10-16
  -- (empreinte sans commentaires ni espaces).
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure) is distinct from '4f00ff226b829189f21cd3a487daad80' then
    raise exception 'NEXUS: partenaire_prospect_lien ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.lookup_invitable_athletes_by_email(text)'::regprocedure) is distinct from '5b5b908927bd4c2fcc4edcd01a9f7f95' then
    raise exception 'NEXUS: lookup_invitable_athletes_by_email ne correspond pas au relevé';
  end if;
end $$;

-- ── A. Non-contact ───────────────────────────────────────────────────────────
create function public.non_contact_carte(p_sport uuid, p_promo integer)
returns table (date_fin date, libelle text)
language sql
stable
security definer
set search_path = public, pg_temp
as $nc$
  select b.date_fin, b.libelle
    from public.blackout_periods b
   where b.actif
     and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
     and (b.sport_id is null or p_sport is null or b.sport_id = p_sport)
     and (
           (b.promo_min is null and b.promo_max is null)
        or p_promo is null
        or (    (b.promo_min is null or p_promo >= b.promo_min)
            and (b.promo_max is null or p_promo <= b.promo_max))
     )
   order by b.date_fin desc, b.date_debut asc
   limit 1
$nc$;

comment on function public.non_contact_carte(uuid, integer) is
  'Période de non-contact active pour un sport et une promotion (règle de get_active_blackout) : '
  'sa fin et son libellé, ou rien. Lue par partenaire_prospect_lien et par /partenaire/prospects.';

revoke all on function public.non_contact_carte(uuid, integer) from public, anon, authenticated;
grant execute on function public.non_contact_carte(uuid, integer) to authenticated;

CREATE OR REPLACE FUNCTION public.partenaire_prospect_lien(p_carte uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $lien$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_jeton text := encode(extensions.gen_random_bytes(32), 'hex');
  v_prop  boolean;
  v_vu    text;
  v_fin   date;
begin
  select c.* into v_carte from public.partenaire_prospects c
    join public.media_partners mp on mp.id = c.partner_id
   where c.id = p_carte and mp.user_id = auth.uid()
   for update of c;
  if not found then
    raise exception 'NEXUS: carte introuvable' using errcode = 'P0002';
  end if;
  if not public.partenaire_peut_evaluer(v_carte.partner_id, v_carte.sport_id) then
    raise exception 'NEXUS: cartes prospects non permises (permission, sport ou statut du partenaire)' using errcode = '42501';
  end if;
  -- 1.4.5 : période de non-contact (blackout_periods, la règle de get_active_blackout)
  -- sur le sport et la promotion de la carte → aucun lien, ni neuf ni remplacé.
  select n.date_fin into v_fin from public.non_contact_carte(v_carte.sport_id, v_carte.promotion) n;
  if v_fin is not null then
    raise exception 'NEXUS: Période de non-contact jusqu''au %', extract(day from v_fin)::int || ' ' || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from v_fin)::int] || ' ' || extract(year from v_fin)::int using errcode = '42501';
  end if;
  if v_carte.expire_le > now() then
    perform public.prospect_partenaire_lever_reservation_lien(p_carte, 'NOUVEAU_LIEN');
    select * into v_carte from public.partenaire_prospects where id = p_carte;
  end if;
  v_prop := coalesce(v_carte.reservation_source, 'LIEN') <> 'LIEN';
  v_vu   := case when v_prop then v_carte.statut_avant else v_carte.statut end;
  if v_vu not in ('A_ENVOYER', 'ENVOYEE') or v_carte.expire_le <= now() then
    raise exception 'NEXUS: cette carte ne peut pas recevoir de nouveau lien pour l''instant' using errcode = '42501';
  end if;
  update public.partenaire_prospects
     set statut       = case when v_prop then statut else 'ENVOYEE' end,
         statut_avant = case when v_prop then 'ENVOYEE' else statut_avant end,
         jeton_empreinte = encode(extensions.digest(v_jeton, 'sha256'), 'hex'),
         jeton_cree_le = now(), updated_at = now()
   where id = p_carte;
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id,
            case when v_vu = 'ENVOYEE' then 'LIEN_REMPLACE' else 'LIEN_GENERE' end);
  return v_jeton;
end $lien$;

-- ── B. « Autre équipe » ≠ « mon effectif » ───────────────────────────────────
drop function public.lookup_invitable_athletes_by_email(text);

create function public.lookup_invitable_athletes_by_email(p_prefix text)
returns table (athlete_id uuid, email text, first_name text, last_name text, sport_name text,
               has_account boolean, exists_not_invitable boolean, exists_exact boolean, exists_mine boolean)
language plpgsql
stable
security definer
set search_path = public
as $lk$
declare
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
  v_caller uuid := auth.uid();
begin
  if not public.is_coach() then
    return;
  end if;
  if length(v_prefix) < 4 then
    return;
  end if;

  return query
  -- Compartiment 1 : MES orphelins sans compte -> invitable (courriel de claim).
  -- PREFIXE conserve : c'est une suggestion, elle doit apparaitre en tapant.
  ( select a.id, a.email, a.first_name, a.last_name, sp.nom, false, false, false, false
    from public.athletes a
    left join public.sports sp on sp.id = a.sport_id
    where a.coach_id = v_caller
      and a.user_id is null
      and a.email is not null
      and lower(a.email) like v_prefix || '%'
    order by a.email
    limit 3 )

  union all
  -- Compartiment 2 : comptes SANS coach (civil OU scolaire) -> invitable.
  -- PREFIXE conserve, meme raison.
  ( select a.id, u.email, a.first_name, a.last_name, sp.nom, true, false, false, false
    from public.users u
    join public.athletes a on a.user_id = u.id
    left join public.sports sp on sp.id = a.sport_id
    where u.role = 'ATHLETE'
      and a.coach_id is null
      and u.email ilike v_prefix || '%'
    order by u.email
    limit 3 )

  union all
  -- Compartiment 3 : existe mais NON-invitable -> DRAPEAUX SEULS, AUCUNE PII.
  --   exists_not_invitable : sur PREFIXE (inchangé).
  --   exists_exact         : sur EGALITE, athlète d'un AUTRE coach — c'est lui qui
  --                          gouverne la bannière « autre équipe », le blocage de
  --                          création et le bouton d'invitation.
  --   exists_mine          : sur EGALITE, athlète déjà dans MON effectif (avec
  --                          compte) — « Déjà dans ton effectif », création bloquée
  --                          (1.4.5 : il ne lève plus exists_exact).
  ( select null::uuid, null::text, null::text, null::text, null::text,
           null::boolean,
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(coalesce(a.email, u.email)) like v_prefix || '%'
               and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
               and not (a.coach_id is null and a.user_id is not null)
           ),
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(btrim(coalesce(a.email, u.email))) = v_prefix
               and not coalesce(a.coach_id = v_caller, false)
               and not (a.coach_id is null and a.user_id is not null)
           ),
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(btrim(coalesce(a.email, u.email))) = v_prefix
               and a.coach_id = v_caller
               and a.user_id is not null
           )
    where exists (
      select 1
      from public.athletes a
      left join public.users u on u.id = a.user_id
      where lower(coalesce(a.email, u.email)) like v_prefix || '%'
        and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
        and not (a.coach_id is null and a.user_id is not null)
    ) )

  union all
  -- Compartiment 4 : le courriel appartient a un compte public.users qui n'a
  -- AUCUNE ligne athletes (COACH, RECRUTEUR, PARENT, ADMIN). DRAPEAUX SEULS,
  -- AUCUNE PII. Le coach lui-meme tombe ici s'il saisit son propre courriel.
  ( select null::uuid, null::text, null::text, null::text, null::text,
           null::boolean,
           exists (
             select 1 from public.users u
             where lower(btrim(u.email)) like v_prefix || '%'
               and not exists (select 1 from public.athletes a where a.user_id = u.id)
           ),
           exists (
             select 1 from public.users u
             where lower(btrim(u.email)) = v_prefix
               and not exists (select 1 from public.athletes a where a.user_id = u.id)
           ),
           false
    where exists (
      select 1 from public.users u
      where lower(btrim(u.email)) like v_prefix || '%'
        and not exists (select 1 from public.athletes a where a.user_id = u.id)
    ) );
end;
$lk$;

revoke all on function public.lookup_invitable_athletes_by_email(text) from public;
grant execute on function public.lookup_invitable_athletes_by_email(text) to anon, authenticated, service_role;


-- ── Garde finale : droits (comparaison COMPLÈTE) et présence des correctifs ──
do $$
declare
  f text; attendu text[]; vus text[];
begin
  for f, attendu in
    select * from (values
      ('public.non_contact_carte(uuid,integer)', array['authenticated','postgres','service_role']),
      ('public.partenaire_prospect_lien(uuid)', array['authenticated','postgres','service_role']),
      ('public.lookup_invitable_athletes_by_email(text)', array['anon','authenticated','postgres','service_role'])
    ) v(fn, a)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f::regprocedure;
    if vus is distinct from attendu then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, attendu;
    end if;
  end loop;
  if position('non_contact_carte(' in (select prosrc from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure)) = 0 then
    raise exception 'NEXUS: partenaire_prospect_lien ne vérifie pas le non-contact';
  end if;
  raise notice 'NEXUS compléments 1.4.5 : non-contact cartes, effectif — OK';
end $$;
$PJMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _pj_texte' using '20261017010000', 'complements_1_4_5', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _pj_texte' using '20261017010000', 'complements_1_4_5';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _pj_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261017010000')
     is distinct from 'd95f608347271299b8e66eabc5c32669' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('non_contact_carte', 'partenaire_prospect_lien', 'lookup_invitable_athletes_by_email')
) t
  ) e;
  if v_empreinte is distinct from '00000000000000000000000000000000' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.blackout_periods) || '|' || (select count(*) from public.partenaire_prospects)
       || '|' || (select count(*) from public.athletes) <> (select donnees from _pj_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _pj_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.blackout_periods) || '|' || (select count(*) from public.partenaire_prospects)
       || '|' || (select count(*) from public.athletes),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261017010000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261017010000'),
     'fonction', to_regprocedure('public.non_contact_carte(uuid,integer)')::text,
     'meme_transaction', (select txid from _pj_releve) = txid_current())
) as resultat_lot_complements_1_4_5;
