SELECT 
  sp.nom AS sport,
  a.first_name,
  a.last_name,
  s.name AS school,
  a.annee_diplomation AS promotion,
  a.cote_globale_entraineur AS cote
FROM athletes a
LEFT JOIN sports sp ON sp.id = a.sport_id
LEFT JOIN schools s ON s.id = a.school_id
ORDER BY sp.nom NULLS LAST, a.last_name, a.first_name;