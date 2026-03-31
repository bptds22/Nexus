SELECT s.nom as sport, l.nom as ligue, l.division, l.categorie
FROM ligues l
JOIN sports s ON s.id = l.sport_id
ORDER BY s.nom, l.division;
