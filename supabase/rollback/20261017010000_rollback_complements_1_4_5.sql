-- ROLLBACK de 20261017010000_complements_1_4_5 — remet les fonctions telles que relevées le 2026-10-16
-- (prod = local, empreintes vérifiées). Hors du dossier des migrations : db reset ne le rejoue pas.
-- Une transaction ; aucune donnée touchée (les périodes de non-contact restent, seules les fonctions changent).
begin;

-- partenaire_prospect_lien d'origine (sans la garde de non-contact), AVANT de retirer non_contact_carte.
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

drop function if exists public.non_contact_carte(uuid, integer);

-- lookup d'origine (sans exists_mine) : DROP + CREATE, droits d'origine.
drop function public.lookup_invitable_athletes_by_email(text);
CREATE FUNCTION public.lookup_invitable_athletes_by_email(p_prefix text)
 RETURNS TABLE(athlete_id uuid, email text, first_name text, last_name text, sport_name text, has_account boolean, exists_not_invitable boolean, exists_exact boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $lk$
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
  ( select a.id, a.email, a.first_name, a.last_name, sp.nom, false, false, false
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
  ( select a.id, u.email, a.first_name, a.last_name, sp.nom, true, false, false
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
  --   exists_not_invitable : inchange, sur PREFIXE.
  --   exists_exact         : sur EGALITE — c'est lui qui gouverne la
  --                          banniere, le blocage de creation et le bouton.
  -- Les deux predicats de non-invitabilite sont identiques ; seule la
  -- comparaison du courriel change. Ne pas les factoriser : les garder cote a
  -- cote rend l'ecart visible.
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
               and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
               and not (a.coach_id is null and a.user_id is not null)
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
  -- AUCUNE ligne athletes (COACH, RECRUTEUR, PARENT, ADMIN). Invisible des
  -- compartiments 1-3, qui sont tous ancres sur public.athletes.
  -- DRAPEAUX SEULS, AUCUNE PII : on signale l'existence, jamais l'identite
  -- ni le role. athlete_id reste NULL -> exclu des suggestions cote front.
  -- Le coach lui-meme tombe ici s'il saisit son propre courriel : correct,
  -- on ne s'invite pas soi-meme.
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
           )
    where exists (
      select 1 from public.users u
      where lower(btrim(u.email)) like v_prefix || '%'
        and not exists (select 1 from public.athletes a where a.user_id = u.id)
    ) );
end;
$lk$;
revoke all on function public.lookup_invitable_athletes_by_email(text) from public;
grant execute on function public.lookup_invitable_athletes_by_email(text) to anon, authenticated, service_role;

delete from supabase_migrations.schema_migrations where version = '20261017010000';
commit;
