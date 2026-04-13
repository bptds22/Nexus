-- Convert flat string arrays to object arrays in evaluations.distinctions
UPDATE evaluations
SET distinctions = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('badge', elem)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(distinctions) AS elem
)
WHERE distinctions IS NOT NULL
  AND jsonb_typeof(distinctions) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(distinctions) AS e
    WHERE jsonb_typeof(e) = 'string'
  );

-- Migrate custom_distinctions into evaluations.distinctions as {"badge":"custom","detail":title}
UPDATE evaluations e
SET distinctions = COALESCE(e.distinctions, '[]'::jsonb) || (
  SELECT jsonb_agg(jsonb_build_object('badge', 'custom', 'detail', cd.title))
  FROM custom_distinctions cd
  WHERE cd.athlete_id = e.athlete_id AND cd.coach_id = e.coach_id
)
WHERE EXISTS (
  SELECT 1 FROM custom_distinctions cd
  WHERE cd.athlete_id = e.athlete_id AND cd.coach_id = e.coach_id
);

-- Remap old badge keys to new universal set (where applicable)
UPDATE evaluations
SET distinctions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'badge' IN ('scoring_leader', 'points_leader', 'goals_leader', 'assists_leader', 'best_time', 'school_record', 'best_mark', 'offensive_leader', 'defensive_leader', 'singles_leader', 'specialist')
        THEN jsonb_build_object('badge', 'team_leader', 'detail', COALESCE(elem->>'detail',
          CASE elem->>'badge'
            WHEN 'scoring_leader' THEN 'Points'
            WHEN 'points_leader' THEN 'Points'
            WHEN 'goals_leader' THEN 'Buts'
            WHEN 'assists_leader' THEN 'Passes'
            WHEN 'best_time' THEN 'Meilleur chrono'
            WHEN 'school_record' THEN 'Record école'
            WHEN 'best_mark' THEN 'Meilleure marque'
            WHEN 'offensive_leader' THEN 'Offensif'
            WHEN 'defensive_leader' THEN 'Défensif'
            WHEN 'singles_leader' THEN 'Simples'
            WHEN 'specialist' THEN 'Spécialiste'
          END))
      WHEN elem->>'badge' = 'league_leader' THEN elem
      ELSE elem
    END
  )
  FROM jsonb_array_elements(distinctions) AS elem
)
WHERE distinctions IS NOT NULL AND jsonb_array_length(distinctions) > 0;
