-- P5 (1.4.5, décision BP 2026-10-18) : la période de non-contact ne bloque plus le PARTENAIRE.
--
-- 20261017010000 (point 5 des compléments, EN PROD) avait ajouté deux choses :
--  · non_contact_carte(sport, promotion) : la période de non-contact active (règle de
--    get_active_blackout) — sa fin et son libellé, ou rien ;
--  · un refus dans partenaire_prospect_lien : aucun lien d'invitation pendant une période.
-- BP retire SEULEMENT le refus : un partenaire n'est pas un recruteur, son invitation n'est pas un
-- contact de recrutement. non_contact_carte RESTE (inchangée, même ACL) : l'écran recruteur la lit
-- pour griser son bouton texto (« Période de non-contact jusqu'au [date] ») — le sms: part de
-- l'appareil, le blocage du texto est donc côté client.
--
--  · partenaire_prospect_lien : le corps de 20261017010000 moins la garde de non-contact (la
--    déclaration v_fin, le select et le raise). Tout le reste est inchangé, octet pour octet.
--  · Le commentaire de non_contact_carte suit son nouveau lecteur.
--
-- Garde : empreinte md5 BRUTE du corps relevé en prod après 20261017010000 (8670f3da…).
-- Aucune table, aucune policy, aucune donnée touchée ; les périodes restent dans blackout_periods.
-- Rollback : supabase/rollback/20261017140000_rollback_non_contact_retrait_partenaire.sql

do $$
begin
  if to_regprocedure('public.non_contact_carte(uuid,integer)') is null then
    raise exception 'NEXUS: non_contact_carte absente — 20261017010000 n''est pas appliquée';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure)
       is distinct from '8670f3dae66bff7295b1da08587a2bf0' then
    raise exception 'NEXUS: partenaire_prospect_lien ne correspond pas au corps relevé en prod (20261017010000) — ne pas écraser une version inconnue';
  end if;
end $$;

-- ACL relevées AVANT (CLAUDE.MD : comparer la liste complète avant/après un remplacement).
create temp table _acl_p5_avant on commit drop as
  select pr.oid::regprocedure::text as f, coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
    from pg_proc pr, lateral unnest(pr.proacl::text[]) as x
   where pr.oid in ('public.partenaire_prospect_lien(uuid)'::regprocedure,
                    'public.non_contact_carte(uuid,integer)'::regprocedure);

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

comment on function public.non_contact_carte(uuid, integer) is
  'Période de non-contact active pour un sport et une promotion (règle de get_active_blackout) : '
  'sa fin et son libellé, ou rien. Lue par l''écran recruteur pour griser le bouton texto.';

-- GATES — plus de garde de non-contact dans le lien, non_contact_carte intacte, ACL complètes
-- triées identiques à l'avant (jamais par inclusion), SECURITY DEFINER partout.
do $$
declare
  fn   regprocedure;
  vus  text[];
  veut text[];
begin
  if position('non_contact_carte(' in (select prosrc from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure)) > 0 then
    raise exception 'NEXUS: partenaire_prospect_lien appelle encore non_contact_carte';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.non_contact_carte(uuid,integer)'::regprocedure)
       is distinct from '2a41929e0ebbc5564e72689b32f08806' then
    raise exception 'NEXUS: non_contact_carte a changé — elle devait rester intacte';
  end if;
  foreach fn in array array['public.partenaire_prospect_lien(uuid)'::regprocedure,
                           'public.non_contact_carte(uuid,integer)'::regprocedure] loop
    select array_agg(g order by g) into veut from _acl_p5_avant where _acl_p5_avant.f = fn::text;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = fn;
    if vus is distinct from veut or vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL de % = %, attendu %', fn, vus, veut;
    end if;
    if not (select prosecdef from pg_proc where oid = fn) then
      raise exception 'NEXUS: % doit rester SECURITY DEFINER', fn;
    end if;
  end loop;
end $$;
