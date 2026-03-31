SELECT school_type, count(*) 
FROM school_registry 
GROUP BY school_type 
ORDER BY count(*) DESC;
