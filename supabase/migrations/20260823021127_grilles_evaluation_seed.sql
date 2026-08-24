-- ═══════════════════════════════════════════════════════════════
-- Seed : 14 grilles + binding des 5 fentes variables.
--
-- GENERIQUE porte les libellés DÉJÀ EN PRODUCTION des 5 colonnes visées
-- par evaluation_slots (Compétitivité, Esprit d'équipe, Résilience,
-- Vision du jeu, Sens tactique). Ce n'est pas un changement de libellé :
-- c'est la reprise à l'octet près de l'existant, pour qu'un athlète sans
-- grille voie exactement ce qu'il voit aujourd'hui.
--
-- Les 9 critères FIXES ne sont volontairement PAS seedés : ils vivront
-- dans le frontend. Aucune grille ne les porte.
-- ═══════════════════════════════════════════════════════════════

-- ── Binding fente → colonne ───────────────────────────────────────
insert into public.evaluation_slots (slot, colonne) values
  (1, 'competitivite'),
  (2, 'esprit_equipe'),
  (3, 'resilience'),
  (4, 'vision_du_jeu'),
  (5, 'sens_tactique');

-- ── Les 14 grilles ────────────────────────────────────────────────
insert into public.evaluation_grilles
  (code, libelle, sport_id, slot_1_libelle, slot_2_libelle, slot_3_libelle, slot_4_libelle, slot_5_libelle, ordre)
select v.code, v.libelle, s.id, v.s1, v.s2, v.s3, v.s4, v.s5, v.ordre
from (values
  ('GENERIQUE', 'Générique (tous sports)', null::text,
     'Compétitivité', 'Esprit d''équipe', 'Résilience', 'Vision du jeu', 'Sens tactique', 0),

  ('FB-QB',  'Football · Quart-arrière',        'Football',
     'Précision de passe', 'Lecture de défensive', 'Force de bras', 'Gestion de la pochette', 'Synchronisme', 10),
  ('FB-REC', 'Football · Receveurs',            'Football',
     'Mains', 'Tracé', 'Départ de tracé', 'Gains après attrapé', 'Explosivité au départ', 20),
  ('FB-POR', 'Football · Porteurs',             'Football',
     'Mains', 'Explosivité', 'Résistance au plaqué', 'Changement de direction', 'Blocage', 30),
  ('FB-LO',  'Football · Ligne offensive',      'Football',
     'Protection de passe', 'Blocage de zone', 'Blocage individuel', 'Jeu de pieds', 'Technique de mains', 40),
  ('FB-LD',  'Football · Ligne défensive',      'Football',
     'Pression sur le passeur', 'Défense contre la course', 'Plaqué', 'Lecture de l''offensive', 'Technique puissance / finesse', 50),
  ('FB-SEC', 'Football · Secondeurs',           'Football',
     'Couverture', 'Technique puissance / finesse', 'Pression sur le passeur', 'Plaqué', 'Lecture de l''offensive', 60),
  ('FB-SD',  'Football · Secondaire défensive', 'Football',
     'Couverture de zone', 'Couverture individuelle', 'Se défaire du bloc', 'Plaqué', 'Vision', 70),
  ('FB-SP',  'Football · Unités spéciales',     'Football',
     'Distance', 'Précision', 'Temps de suspension', 'Variété', 'Feintes', 80),

  ('BB',     'Basketball · Toutes positions',   'Basketball',
     'Tir extérieur', 'Finition au panier', 'Création de jeu', 'Défense', 'Rebond', 90),

  ('FL-QB',   'Flag · Quart-arrière',           'Flag football',
     'Précision de passe', 'Lecture de défensive', 'Force de bras', 'Évasion', 'Synchronisme', 100),
  ('FL-REC',  'Flag · Receveurs et porteurs',   'Flag football',
     'Mains', 'Capacité à lancer', 'Lecture de défensive', 'Évasion (éviter le déflagage)', 'Tracé', 110),
  ('FL-SD',   'Flag · Secondaire défensive',    'Flag football',
     'Couverture de zone', 'Couverture individuelle', 'Couverture en zone payante', 'Déflagage', 'Vision', 120),
  ('FL-RUSH', 'Flag · Rusher et secondeur',     'Flag football',
     'Déflagage', 'Lecture des remises', 'Contrôle à l''approche', 'Changement de direction', 'Explosivité', 130)
) as v(code, libelle, sport_nom, s1, s2, s3, s4, s5, ordre)
left join public.sports s on s.nom = v.sport_nom;

-- ── Garde-fou : un nom de sport non résolu passerait en sport_id NULL
--    sans la moindre erreur. On refuse ce silence.
do $$
declare v_orphelines int;
begin
  select count(*) into v_orphelines
  from public.evaluation_grilles
  where code <> 'GENERIQUE' and sport_id is null;

  if v_orphelines > 0 then
    raise exception 'NEXUS: % grille(s) de sport avec sport_id NULL — nom de sport non résolu', v_orphelines;
  end if;

  if (select count(*) from public.evaluation_grilles) <> 14 then
    raise exception 'NEXUS: % grilles seedées au lieu de 14', (select count(*) from public.evaluation_grilles);
  end if;

  if (select count(*) from public.evaluation_slots) <> 5 then
    raise exception 'NEXUS: % fentes seedées au lieu de 5', (select count(*) from public.evaluation_slots);
  end if;
end $$;
