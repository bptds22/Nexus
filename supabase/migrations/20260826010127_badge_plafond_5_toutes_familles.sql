-- ═══════════════════════════════════════════════════════════════
-- Le plafond redevient 5 badges, TOUTES FAMILLES CONFONDUES.
--
-- CE QU'ON DÉFAIT ET POURQUOI
-- Le chantier badges avait exempté les honneurs du plafond, en supposant
-- qu'un athlète pouvait légitimement porter 5 badges plafonnés PLUS ses
-- honneurs. C'était une regle inventee en cours de route ; la regle
-- d'origine — 5 en tout — est deliberee et tient a la MISE EN PAGE :
-- 5 badges tiennent sur une ligne au web et se posent en 3+2 sur mobile.
-- AdaptiveBadgesRow etait donc correct ; c'est le plafond qui ne l'etait pas.
--
-- CE QUI NE CHANGE PAS
-- Le contexte obligatoire sur les 5 honneurs reste : badge_contexte_requis
-- n'est pas touche. C'est un besoin reel, independant du plafond.
--
-- LE TRIGGER NE REGULARISE RIEN
-- Il est AFTER INSERT OR UPDATE : il ne s'applique qu'aux ecritures a venir.
-- Les lignes deja en place au-dessus de 5 ne sont ni retirees ni signalees
-- par cette migration — c'est voulu, retirer un badge attribue par un coach
-- n'est pas une decision de migration. En revanche, la PROCHAINE ecriture
-- sur un tel athlete levera. Verifie au 2026-08-25 : 0 athlete concerne sur
-- le cloud ; 1 sur la base de dev locale (fixture de demonstration).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.badge_plafond()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_n int; v_max constant int := 5;
begin
  -- Compte les lignes VIVANTES, toutes familles. Un honneur occupe une
  -- place comme un autre : c'est la ligne d'affichage qui est bornee, pas
  -- une categorie.
  select count(*) into v_n
  from public.athlete_badges ab
  where ab.athlete_id = new.athlete_id
    and ab.retire_le is null;

  if v_n > v_max then
    raise exception
      'NEXUS: plafond de % badges atteint pour cet athlete (% actifs). Retire-en un avant d''en ajouter un autre.',
      v_max, v_n;
  end if;
  return null;
end;
$function$;

COMMENT ON FUNCTION public.badge_plafond() IS
  'Plafond de 5 badges vivants par athlete, TOUTES FAMILLES CONFONDUES. Le nombre vient de la mise en page : 5 tiennent sur une ligne au web et en 3+2 sur mobile. Les honneurs NE SONT PAS exemptes — l''exemption introduite pendant le chantier badges a ete retiree le 2026-08-25. Le contexte obligatoire des honneurs, lui, reste (badge_contexte_requis).';
