SELECT type, COUNT(*) FROM (
  SELECT DISTINCT ON (type, athlete_id, DATE(created_at)) id, type
  FROM activities
  WHERE coach_id = 'e74b866b-c544-46a2-af12-c330a5fd8ecb'
  ORDER BY type, athlete_id, DATE(created_at), created_at DESC
) deduped
GROUP BY type ORDER BY COUNT(*) DESC;