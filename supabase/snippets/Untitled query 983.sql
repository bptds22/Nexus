SELECT id, email, raw_user_meta_data->>'role' AS role
FROM auth.users
ORDER BY created_at;