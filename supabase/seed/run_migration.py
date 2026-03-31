import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur = conn.cursor()

# Drop everything created by 001_school_registry.sql that conflicts
print("Cleaning up 001_school_registry.sql objects...")
cleanup = """
DROP TABLE IF EXISTS school_coaches CASCADE;
DROP TYPE IF EXISTS coach_school_role CASCADE;
DROP TYPE IF EXISTS school_type CASCADE;
DROP TYPE IF EXISTS school_claim_status CASCADE;
DROP TYPE IF EXISTS school_network CASCADE;
DROP FUNCTION IF EXISTS normalize_school_name CASCADE;
DROP FUNCTION IF EXISTS update_name_normalized CASCADE;
"""
cur.execute(cleanup)
conn.commit()
print("Cleanup done.")

# Run main schema
print("Running 002_main_schema.sql...")
with open('supabase/seed/002_main_schema.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

cur.execute(sql)
conn.commit()
print("Done — main schema created successfully.")

cur.close()
conn.close()
