SELECT u.id, u.first_name, u.last_name, u.role::text, u.school_id, s.name 
FROM users u LEFT JOIN schools s ON u.school_id = s.id 
WHERE u.role = 'RECRUTEUR' LIMIT 5;