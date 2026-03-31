-- Allow the trigger function to insert into users
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Re-insert manually for the existing test user
INSERT INTO users (id, email, role, status)
SELECT id, email, 'ATHLETE', 'ACTIF'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add a permissive insert policy for the trigger
CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  WITH CHECK (true);