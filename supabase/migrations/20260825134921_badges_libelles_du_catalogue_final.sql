-- ═══════════════════════════════════════════════════════════════
-- Aligne les 22 libellés sur badges-catalogue-final.json.
--
-- ── RÈGLE POSÉE ─────────────────────────────────────────────────
-- badges-catalogue-final.json est LA SOURCE DE VÉRITÉ du catalogue.
-- Si la base diverge, c'est la base qui a tort. Les codes, eux, ne bougent
-- pas : ils nomment les fichiers SVG (public/badges/badge-{code}.svg) et
-- servent de clé partout.
--
-- ── CE QUI CHANGE ───────────────────────────────────────────────
-- 13 libellés, pas 9. Aux neuf renommages voulus s'ajoutent quatre vieux
-- libellés de seed jamais alignés, détectés en diffant le JSON contre la
-- base avant d'écrire :
--     mvp            « Joueur par excellence » → « MVP »
--     leader-equipe  « Meneur d'équipe »       → « Leader d'équipe »
--     leader-ligue   « Meneur de la ligue »    → « Leader de la ligue »
--     3-points       « Trois points »          → « 3 points »
--
-- Deux collisions avec des critères d'évaluation sont VOULUES et assumées :
-- « Leadership » (capitaine) et « Vision du jeu » (radar). Ce ne sont pas
-- des défauts ; ne pas les « corriger » à la relecture.
--
-- ── PORTÉE ──────────────────────────────────────────────────────
-- Aucun code, aucune famille, aucun rattachement touché. La colonne libelle
-- seule. Les 22 lignes sont réécrites, y compris les 9 identiques : la
-- migration devient idempotente et la base finit par ÊTRE le JSON, au lieu
-- de n'en recevoir qu'un delta qu'il faudrait recalculer à chaque fois.
--
-- Sans effet sur l'app 1.2 : le miroir n'écrit que des CODES anciens dans
-- evaluations.distinctions, jamais de libellé. Les projections partenaire
-- lisent badges.libelle en direct, elles reflètent donc le changement
-- immédiatement, sans backfill.
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  v_touchees int; v_total int; v_restes int; v_liste text;
begin
  with cible(code, libelle) as (values
    ('capitaine', 'Leadership'),
    ('qi', 'IQ'),
    ('clutch', 'Clutch'),
    ('costaud', 'Joueur physique'),
    ('disponibilite', 'Disponibilité'),
    ('mvp', 'MVP'),
    ('leader-equipe', 'Leader d''équipe'),
    ('leader-ligue', 'Leader de la ligue'),
    ('equipe-etoiles', 'Équipe d''étoiles'),
    ('nexus-x', 'Custom'),
    ('finisseur', 'Finisseur'),
    ('3-points', '3 points'),
    ('insaisissable', 'Insaisissable'),
    ('verrou', 'Défensive impeccable'),
    ('fusee', 'Explosif'),
    ('dans-la-mire', 'Précision extrême'),
    ('vitesse', 'Vitesse'),
    ('mains-sures', 'Mains sûres'),
    ('inarretable', 'Inarrêtable'),
    ('force-de-frappe', 'Force de frappe'),
    ('rempart', 'Bloqueur'),
    ('radar', 'Vision du jeu')
  )
  update public.badges b
     set libelle = c.libelle
    from cible c
   where c.code = b.code
     and b.libelle is distinct from c.libelle;

  get diagnostics v_touchees = row_count;

  if v_touchees <> 13 then
    raise exception 'NEXUS: % libellé(s) modifié(s) au lieu de 13 — la base n''était pas dans l''état attendu, abandon', v_touchees;
  end if;

  -- Le JSON fait foi : à la fin, AUCUNE ligne ne doit s'en écarter.
  with cible(code, libelle) as (values
    ('capitaine', 'Leadership'), ('qi', 'IQ'), ('clutch', 'Clutch'),
    ('costaud', 'Joueur physique'), ('disponibilite', 'Disponibilité'),
    ('mvp', 'MVP'), ('leader-equipe', 'Leader d''équipe'),
    ('leader-ligue', 'Leader de la ligue'), ('equipe-etoiles', 'Équipe d''étoiles'),
    ('nexus-x', 'Custom'), ('finisseur', 'Finisseur'), ('3-points', '3 points'),
    ('insaisissable', 'Insaisissable'), ('verrou', 'Défensive impeccable'),
    ('fusee', 'Explosif'), ('dans-la-mire', 'Précision extrême'),
    ('vitesse', 'Vitesse'), ('mains-sures', 'Mains sûres'),
    ('inarretable', 'Inarrêtable'), ('force-de-frappe', 'Force de frappe'),
    ('rempart', 'Bloqueur'), ('radar', 'Vision du jeu')
  )
  select count(*), coalesce(string_agg(coalesce(c.code, b.code), ', '), '(aucun)')
    into v_restes, v_liste
  from cible c
  full outer join public.badges b on b.code = c.code
  where c.code is null or b.code is null or b.libelle is distinct from c.libelle;

  if v_restes > 0 then
    raise exception 'NEXUS: % écart(s) subsistant(s) avec le JSON : %', v_restes, v_liste;
  end if;

  select count(*) into v_total from public.badges;
  raise notice 'NEXUS: % libellés alignés, % badges au catalogue, aucun écart avec badges-catalogue-final.json.', v_touchees, v_total;
end $$;

comment on column public.badges.libelle is
$c$Libellé affiché du badge.

SOURCE DE VÉRITÉ : badges-catalogue-final.json (déposé le 2026-08-25). Si la
base diverge de ce fichier, c'est la base qui a tort.

« Leadership » (capitaine) et « Vision du jeu » (radar) entrent volontairement
en collision avec des libellés de critères d'évaluation. Ce n'est pas un
défaut.

Le libellé de `nexus-x` (« Custom ») ne sert QU'AU PICKER : à l'affichage,
c'est le contexte saisi par le coach qui tient lieu de libellé et s'affiche
seul.$c$;