-- Comble le contexte laissé NULL par la transposition.
--
-- La transposition ne pouvait PAS déduire ce millésime : l'ancien format ne
-- stockait aucun détail pour `allstar`. Le 2026 vient d'un arbitrage humain
-- (évaluation source créée le 2026-07-15, seule année plausible), pas d'un
-- calcul — d'où une migration distincte plutôt qu'une correction glissée dans
-- la transposition, qui aurait laissé croire que la valeur en découlait.
--
-- `origine` reste 'transposition' : la ligne vient bien de l'ancien format.
-- Seul le contexte a été complété à la main.
--
-- Effet sur l'app 1.2 : AUCUN. Le miroir déclare `allstar` sans détail
-- (porte_detail = false, conforme au catalogue de la 1.2 où hasDetail est
-- faux). distinctions reste donc identique et n'est même pas réécrite.

do $$
declare v_n int;
begin
  update public.athlete_badges ab
     set contexte = '2026'
    from public.badges b, public.athletes a
   where b.id = ab.badge_id
     and a.id = ab.athlete_id
     and b.code = 'equipe-etoiles'
     and a.id = 'd4cd6432-1c45-47bc-8498-071075e4ae7c'   -- Athlete Nexus
     and ab.contexte is null
     and ab.retire_le is null;

  get diagnostics v_n = row_count;

  if v_n <> 1 then
    raise exception 'NEXUS: % ligne(s) mise(s) à jour au lieu de 1 — la cible a changé, abandon', v_n;
  end if;

  -- Plus aucune ligne transposée ne doit manquer de contexte obligatoire.
  select count(*) into v_n
  from public.athlete_badges ab
  join public.badges b on b.id = ab.badge_id
  where ab.origine = 'transposition' and b.requiert_contexte
    and ab.retire_le is null and coalesce(btrim(ab.contexte), '') = '';

  if v_n > 0 then
    raise notice 'NEXUS: il reste % badge(s) transposé(s) sans contexte obligatoire.', v_n;
  else
    raise notice 'NEXUS: aucun badge transposé sans contexte obligatoire.';
  end if;
end $$;