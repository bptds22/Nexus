-- ═══════════════════════════════════════════════════════════════
-- Seed du catalogue — 22 badges.
--
-- Les `code` sont les noms de fichiers SVG, sans préfixe ni extension. Les
-- images n'existent pas encore (public/badges/ est absent) : c'est un chantier
-- séparé. Le catalogue peut vivre sans elles, le picker non.
--
-- ⚠ LES 12 BADGES DE SPORT ONT sport_id NULL.
-- La spécification donne leurs codes mais N'ASSIGNE AUCUN SPORT. Je ne les
-- devine pas : « rempart » évoque un gardien et « 3-points » le basketball,
-- mais les dix autres ne se déduisent pas sans se tromper. Une ligne
-- famille='sport' à sport_id NULL est chargée normalement et ne peut être
-- filtrée par AUCUN écran — un joueur de basket se verrait proposer
-- « rempart ». À compléter AVANT le chantier picker, par un UPDATE ciblé :
--     update public.badges set sport_id = (select id from public.sports where nom='Hockey')
--      where code = 'rempart';
--
-- ordre : par dizaines, pour intercaler sans renuméroter.
-- ═══════════════════════════════════════════════════════════════

insert into public.badges (code, libelle, famille, sport_id, requiert_contexte, ordre) values
  -- ── universel (5) — aucun contexte, tous sports
  ('capitaine',      'Capitaine',            'universel', null, false,  10),
  ('qi',             'QI',                   'universel', null, false,  20),
  ('clutch',         'Clutch',               'universel', null, false,  30),
  ('costaud',        'Costaud',              'universel', null, false,  40),
  ('disponibilite',  'Disponibilité',        'universel', null, false,  50),

  -- ── honneur (5) — millésimés, contexte OBLIGATOIRE, hors plafond
  --    leader-equipe / leader-ligue : statistique + année (« Verges · 2026 »)
  --    mvp / equipe-etoiles         : année seule (« 2026 »)
  --    nexus-x                      : texte libre
  ('mvp',            'Joueur par excellence','honneur',   null, true,  110),
  ('leader-equipe',  'Meneur d''équipe',     'honneur',   null, true,  120),
  ('leader-ligue',   'Meneur de la ligue',   'honneur',   null, true,  130),
  ('equipe-etoiles', 'Équipe d''étoiles',    'honneur',   null, true,  140),
  ('nexus-x',        'Nexus X',              'honneur',   null, true,  150),

  -- ── sport (12) — sport_id À RENSEIGNER, voir l'avertissement ci-dessus
  ('finisseur',       'Finisseur',           'sport',     null, false, 210),
  ('3-points',        'Trois points',        'sport',     null, false, 220),
  ('insaisissable',   'Insaisissable',       'sport',     null, false, 230),
  ('verrou',          'Verrou',              'sport',     null, false, 240),
  ('fusee',           'Fusée',               'sport',     null, false, 250),
  ('dans-la-mire',    'Dans la mire',        'sport',     null, false, 260),
  ('vitesse',         'Vitesse',             'sport',     null, false, 270),
  ('mains-sures',     'Mains sûres',         'sport',     null, false, 280),
  ('inarretable',     'Inarrêtable',         'sport',     null, false, 290),
  ('force-de-frappe', 'Force de frappe',     'sport',     null, false, 300),
  ('rempart',         'Rempart',             'sport',     null, false, 310),
  ('radar',           'Radar',               'sport',     null, false, 320)
on conflict (code) do update set
  libelle = excluded.libelle,
  famille = excluded.famille,
  requiert_contexte = excluded.requiert_contexte,
  ordre = excluded.ordre;
  -- sport_id VOLONTAIREMENT absent du DO UPDATE : un re-run du seed ne doit
  -- pas écraser les sports renseignés à la main entre-temps.

-- ── Garde-fou : le silence est l'ennemi ──────────────────────────
do $$
declare v_n int; v_h int; v_s int;
begin
  select count(*) into v_n from public.badges;
  if v_n <> 22 then
    raise exception 'NEXUS: % badges au catalogue au lieu de 22', v_n;
  end if;

  select count(*) into v_h from public.badges where famille='honneur' and requiert_contexte;
  if v_h <> 5 then
    raise exception 'NEXUS: % honneurs à contexte obligatoire au lieu de 5', v_h;
  end if;

  select count(*) into v_s from public.badges where famille='sport' and sport_id is null;
  if v_s > 0 then
    raise notice 'NEXUS: % badge(s) de sport SANS sport_id — filtrage par sport inopérant tant qu''ils ne sont pas renseignés.', v_s;
  end if;
end $$;