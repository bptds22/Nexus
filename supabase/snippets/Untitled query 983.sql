SELECT first_name, last_name, position_id IS NOT NULL AS has_position, 
       created_at, updated_at, 
       (updated_at > created_at) AS was_modified
FROM athletes
ORDER BY first_name;