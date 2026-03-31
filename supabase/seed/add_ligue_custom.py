import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur = conn.cursor()

cur.execute("""
    ALTER TABLE equipes 
    ADD COLUMN IF NOT EXISTS ligue_custom TEXT;
""")

conn.commit()
cur.close()
conn.close()
print("Done — ligue_custom added to equipes table")
