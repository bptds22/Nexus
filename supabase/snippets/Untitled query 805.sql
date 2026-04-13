-- Find the actual evaluation table
SELECT tablename FROM pg_tables WHERE tablename LIKE '%eval%' OR tablename LIKE '%review%' OR tablename LIKE '%cote%';

-- Also check for JSONB columns on athletes that might store evaluations
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'athletes' AND (column_name LIKE '%eval%' OR column_name LIKE '%cote%' OR data_type = 'jsonb');