SELECT 
  a.id, 
  a.first_name, 
  a.last_name, 
  s.name AS school_name, 
  s.type AS school_type,
  (SELECT t.name FROM team_athletes ta JOIN teams t ON t.id = ta.team_id WHERE ta.athlete_id = a.id LIMIT 1) AS team_name
FROM athletes a
LEFT JOIN schools s ON s.id = a.school_id
WHERE (a.school_id IS NULL OR s.type = 'LIGUE_CIVILE')
  AND EXISTS (SELECT 1 FROM team_athletes WHERE athlete_id = a.id)
LIMIT 5;