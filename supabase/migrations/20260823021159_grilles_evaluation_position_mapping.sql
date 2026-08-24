-- ═══════════════════════════════════════════════════════════════
-- Rattachement position → grille : 36 lignes, aucune orpheline sur les
-- trois sports concernés (Football 23, Flag football 8, Basketball 5).
--
-- Le join porte sur le COUPLE (sport, position) et jamais sur le seul
-- nom : « Centre » existe dans les trois sports, « Maraudeur » et
-- « Quart-arrière » et « Porteur de ballon » dans deux.
--
-- LS (Spécialiste des longues remises) et RET (Retourneur) sont
-- rattachés à FB-SP faute de mieux : FB-SP mesure un botteur (Distance,
-- Précision, Temps de suspension, Variété, Feintes) et aucun de ces
-- cinq critères ne décrit une longue remise ni un retour de botté. Décision
-- assumée pour ne laisser aucun trou ; ces deux postes mériteront leur
-- propre grille. Non résolu ici.
-- ═══════════════════════════════════════════════════════════════

insert into public.position_grille (position_id, grille_id)
select p.id, g.id
from (values
  -- ── Football (23) ──────────────────────────────────────────────
  ('Football', 'Quart-arrière',                    'FB-QB'),

  ('Football', 'Receveur éloigné',                 'FB-REC'),
  ('Football', 'Ailier rapproché',                 'FB-REC'),
  ('Football', 'Demi inséré',                      'FB-REC'),

  ('Football', 'Porteur de ballon',                'FB-POR'),

  ('Football', 'Joueur de ligne offensive',        'FB-LO'),
  ('Football', 'Centre',                           'FB-LO'),
  ('Football', 'Bloqueur offensif',                'FB-LO'),
  ('Football', 'Garde offensif',                   'FB-LO'),

  ('Football', 'Joueur de ligne défensive',        'FB-LD'),
  ('Football', 'Ailier défensif',                  'FB-LD'),
  ('Football', 'Plaqueur défensif',                'FB-LD'),

  ('Football', 'Secondeur',                        'FB-SEC'),
  ('Football', 'Secondeur intérieur',              'FB-SEC'),
  ('Football', 'Secondeur extérieur',              'FB-SEC'),

  ('Football', 'Demi de coin',                     'FB-SD'),
  ('Football', 'Maraudeur',                        'FB-SD'),
  ('Football', 'Demi de sûreté',                   'FB-SD'),
  ('Football', 'Maraudeur rapproché',              'FB-SD'),

  ('Football', 'Botteur',                          'FB-SP'),
  ('Football', 'Botteur de dégagement',            'FB-SP'),
  ('Football', 'Spécialiste des longues remises',  'FB-SP'),
  ('Football', 'Retourneur',                       'FB-SP'),

  -- ── Flag football (8) ──────────────────────────────────────────
  ('Flag football', 'Quart-arrière',               'FL-QB'),

  ('Flag football', 'Receveur',                    'FL-REC'),
  ('Flag football', 'Porteur de ballon',           'FL-REC'),
  ('Flag football', 'Centre',                      'FL-REC'),

  ('Flag football', 'Demi défensif',               'FL-SD'),
  ('Flag football', 'Maraudeur',                   'FL-SD'),

  ('Flag football', 'Rusher',                      'FL-RUSH'),
  ('Flag football', 'Secondeur',                   'FL-RUSH'),

  -- ── Basketball (5) ─────────────────────────────────────────────
  ('Basketball', 'Meneur',                         'BB'),
  ('Basketball', 'Arrière',                        'BB'),
  ('Basketball', 'Ailier',                         'BB'),
  ('Basketball', 'Ailier fort',                    'BB'),
  ('Basketball', 'Centre',                         'BB')
) as v(sport_nom, position_nom, code)
join public.sports    s on s.nom = v.sport_nom
join public.positions p on p.sport_id = s.id and p.nom = v.position_nom
join public.evaluation_grilles g on g.code = v.code;

-- ── Garde-fou : un join non résolu perdrait une ligne en silence ──
do $$
declare
  v_lignes     int;
  v_non_ratt   int;
begin
  select count(*) into v_lignes from public.position_grille;
  if v_lignes <> 36 then
    raise exception 'NEXUS: % lignes dans position_grille au lieu de 36 — un couple (sport, position) n''a pas été résolu', v_lignes;
  end if;

  select count(*) into v_non_ratt
  from public.positions p
  join public.sports s on s.id = p.sport_id
  left join public.position_grille pg on pg.position_id = p.id
  where s.nom in ('Football', 'Flag football', 'Basketball')
    and pg.position_id is null;

  if v_non_ratt > 0 then
    raise exception 'NEXUS: % position(s) des 3 sports cibles sans grille', v_non_ratt;
  end if;
end $$;
