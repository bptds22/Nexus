SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%message%' OR table_name LIKE '%conversation%' OR table_name LIKE '%demande%';