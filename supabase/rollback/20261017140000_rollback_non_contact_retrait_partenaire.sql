-- Rollback de 20261017140000 : remet la garde de non-contact du partenaire dans
-- partenaire_prospect_lien — corps recopié OCTET POUR OCTET du lot 20261017010000 tel qu'appliqué en
-- prod (md5 brut 8670f3da…, vérifié en fin de fichier) — et le commentaire d'origine de
-- non_contact_carte. non_contact_carte elle-même n'a jamais été touchée. Aucune donnée touchée.
-- Hors du dossier des migrations : db reset ne le rejoue pas.
do $$
begin
  if to_regprocedure('public.non_contact_carte(uuid,integer)') is null then
    raise exception 'NEXUS: non_contact_carte absente — état inconnu, rien à défaire';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure)
       is distinct from '16e271e712b9cc9a04423ec3b5e5a1bb' then
    raise exception 'NEXUS: partenaire_prospect_lien n''est pas la version 20261017140000 — rien à défaire';
  end if;
end $$;

create temp table _acl_p5_rb on commit drop as
  select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
    from pg_proc pr, lateral unnest(pr.proacl::text[]) as x
   where pr.oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure;

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

comment on function public.non_contact_carte(uuid, integer) is
  'Période de non-contact active pour un sport et une promotion (règle de get_active_blackout) : '
  'sa fin et son libellé, ou rien. Lue par partenaire_prospect_lien et par /partenaire/prospects.';

-- GATE — corps de la prod rétabli, ACL complète triée identique, SECURITY DEFINER.
do $$
declare vus text[]; veut text[];
begin
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure)
       is distinct from '8670f3dae66bff7295b1da08587a2bf0' then
    raise exception 'NEXUS: partenaire_prospect_lien ne revient pas au corps de la prod (20261017010000)';
  end if;
  select array_agg(g order by g) into veut from _acl_p5_rb;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de partenaire_prospect_lien = %, attendu %', vus, veut;
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.partenaire_prospect_lien(uuid)'::regprocedure) then
    raise exception 'NEXUS: partenaire_prospect_lien doit rester SECURITY DEFINER';
  end if;
end $$;
