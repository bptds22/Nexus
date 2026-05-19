SELECT policyname, qual 
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'Coaches lookup orphan athletes';
