-- Get the two IDs
SELECT id, name FROM schools WHERE name LIKE '%Saint-Jean%';

-- Then merge: move everything to the one that has data
-- Replace KEEP_ID and DELETE_ID with actual UUIDs
UPDATE athletes SET school_id = 'KEEP_ID' WHERE school_id = 'DELETE_ID';
UPDATE users SET school_id = 'KEEP_ID' WHERE school_id = 'DELETE_ID';
UPDATE teams SET school_id = 'KEEP_ID' WHERE school_id = 'DELETE_ID';
DELETE FROM schools WHERE id = 'DELETE_ID';
