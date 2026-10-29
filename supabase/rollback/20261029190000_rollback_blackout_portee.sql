-- Rollback de 20261029190000_blackout_portee : corps d'avant de get_active_blackout(uuid) (md5 f93e81bed72c2c180b83da6c6cd01c94)
-- et de enforce_messaging_blackout() (md5 b6b069f4e7c43b96cbc0a5805cb80f7b), variantes à la paire et non_contact_carte
-- à 3 arguments retirées, colonne portee retirée (les portées saisies entre-temps sont perdues).

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.get_active_blackout(uuid)'::regprocedure)
     is distinct from '857f842445e6e7612b729f953215a6dc' then
    raise exception 'NEXUS: get_active_blackout(uuid) n''est pas le corps de 20261029190000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.enforce_messaging_blackout()'::regprocedure)
     is distinct from '94e9d8881f605d44e495f36f0a6d7b70' then
    raise exception 'NEXUS: enforce_messaging_blackout n''est pas le corps de 20261029190000';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.get_active_blackout(p_athlete uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, libelle text, date_debut date, date_fin date, sport_nom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select b.id, b.libelle, b.date_debut, b.date_fin, s.nom
  from public.blackout_periods b
  left join public.athletes a on a.id = p_athlete
  left join public.sports   s on s.id = b.sport_id
  where b.actif
    and coalesce(a.is_showcase, false) = false
    and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
    and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)
    and (
          (b.promo_min is null and b.promo_max is null)
       or a.annee_diplomation is null
       or (    (b.promo_min is null or a.annee_diplomation >= b.promo_min)
           and (b.promo_max is null or a.annee_diplomation <= b.promo_max))
    )
  order by b.date_fin desc, b.date_debut asc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_messaging_blackout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type    public.conversation_type;
  v_athlete uuid;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    v_type := NEW.conversation_type;
    v_athlete := NEW.athlete_id;
  ELSE
    SELECT c.conversation_type, c.athlete_id
      INTO v_type, v_athlete
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;

  -- ── EXEMPTIONS EXPLICITES ────────────────────────────────────────
  -- Types HORS périmètre du black-out de la ligue, par décision produit.
  -- ADMIN_USER : messagerie de service de la plateforme (maintenance,
  -- information, support). Ce n'est pas du recrutement ; le black-out
  -- protège l'intégrité du recrutement, pas la communication de service.
  --
  -- Écrit ici DÉLIBÉRÉMENT plutôt qu'obtenu par le fait que le test
  -- ci-dessous ne vise que RECRUTEUR_ATHLETE : si le black-out est un jour
  -- élargi à d'autres types, cette exemption reste vraie et VISIBLE, au
  -- lieu de disparaître sans que personne ne le remarque.
  -- Voir CLAUDE.md, MIGRATION SAFETY CHECKLIST règle 11.
  IF v_type = ANY (ARRAY['ADMIN_USER']::public.conversation_type[]) THEN
    RETURN NEW;
  END IF;

  IF v_type = 'RECRUTEUR_ATHLETE' AND public.is_messaging_blacked_out(v_athlete) THEN
    RAISE EXCEPTION 'Période de black-out — la messagerie est suspendue par la ligue pour protéger l''intégrité du recrutement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

drop function public.non_contact_carte(uuid, integer, text);
drop function public.is_messaging_blacked_out(uuid, uuid);
drop function public.get_active_blackout(uuid, uuid);
alter table public.blackout_periods drop column portee;
