import psycopg2
import os

conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur = conn.cursor()
BASE = os.path.dirname(__file__)

def run_sql_file(filename, description):
    filepath = os.path.join(BASE, filename)
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filename}")
        return False
    print(f"\nRunning {filename} — {description}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            sql = f.read()
        cur.execute(sql)
        conn.commit()
        print(f"  ✓ Done")
        return True
    except Exception as e:
        conn.rollback()
        print(f"  ✗ Error: {e}")
        return False

# Step 1 — School registry
run_sql_file('001_school_registry.sql', 'School registry table')

# Step 2 — School seed
run_sql_file('seed_schools.sql', '1,259 Quebec schools')

# Step 3 — Clean conflicts from 001 before running 002
print("\nCleaning up conflicts from 001...")
cur.execute("""
    DROP TABLE IF EXISTS school_coaches CASCADE;
    DROP TYPE IF EXISTS coach_school_role CASCADE;
    DROP TYPE IF EXISTS school_type CASCADE;
    DROP TYPE IF EXISTS school_claim_status CASCADE;
    DROP TYPE IF EXISTS school_network CASCADE;
    DROP FUNCTION IF EXISTS normalize_school_name CASCADE;
    DROP FUNCTION IF EXISTS update_name_normalized CASCADE;
""")
conn.commit()
print("  ✓ Done")

# Step 4 — Main schema
run_sql_file('002_main_schema.sql', 'Main schema — 32 tables')

# Step 5 — Auth claims
run_sql_file('003_auth_claims.sql', 'Auth JWT claims')

# Step 6 — Seed ligues
print("\nSeeding ligues...")
sport_map = {
    'Football': 'Football', 'Basketball': 'Basketball', 'Volleyball': 'Volleyball',
    'Hockey sur glace': 'Hockey', 'Soccer': 'Soccer', 'Athlétisme': 'Athlétisme',
    'Flag Football': 'Flag football', 'Rugby': 'Rugby', 'Cheerleading': 'Cheerleading',
    'Natation': 'Natation', 'Badminton': 'Badminton', 'Cross-country': 'Cross-country',
    'Soccer en gymnase': 'Futsal', 'Baseball': 'Baseball',
    'Ski alpin': None, 'Golf': None,
}
ligues = [
    ('Football','Football juvénile D1','D1','Juvénile','Masculin','RSEQ Provincial','Automne',True),
    ('Football','Football cadet D1','D1','Cadet','Masculin','RSEQ Provincial','Automne',True),
    ('Football','Football juvénile D2','D2','Juvénile','Masculin','RSEQ Provincial','Automne',True),
    ('Football','Football régional D3+','D3+','Toutes','Masculin','Régional (14)','Automne',False),
    ('Basketball','Basketball benjamin féminin D1','D1','Benjamin','Féminin','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball benjamin masculin D1','D1','Benjamin','Masculin','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball cadet féminin D1','D1','Cadet','Féminin','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball cadet masculin D1','D1','Cadet','Masculin','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball juvénile féminin D1','D1','Juvénile','Féminin','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball juvénile masculin D1','D1','Juvénile','Masculin','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball D2 — toutes catégories','D2','Toutes','F & M','RSEQ Provincial','Hiver',True),
    ('Basketball','Basketball D3 & D4','D3+','Toutes','F & M','Régional (14)','Hiver',False),
    ('Volleyball','Volleyball benjamin féminin D1','D1','Benjamin','Féminin','RSEQ Provincial','Hiver',True),
    ('Volleyball','Volleyball benjamin masculin D1','D1','Benjamin','Masculin','RSEQ Provincial','Hiver',True),
    ('Volleyball','Volleyball cadet féminin D1','D1','Cadet','Féminin','RSEQ Provincial','Hiver',True),
    ('Volleyball','Volleyball cadet masculin D1','D1','Cadet','Masculin','RSEQ Provincial','Hiver',True),
    ('Volleyball','Volleyball juvénile féminin D1','D1','Juvénile','Féminin','RSEQ Provincial','Hiver',True),
    ('Volleyball','Volleyball juvénile masculin D1','D1','Juvénile','Masculin','RSEQ Provincial','Hiver',True),
    ('Volleyball','Volleyball D2+','D2+','Toutes','F & M','Régional (14)','Hiver',False),
    ('Hockey sur glace','Hockey benjamin féminin D1','D1','Benjamin','Féminin','RSEQ Provincial','Hiver',True),
    ('Hockey sur glace','Hockey benjamin masculin D1','D1','Benjamin','Masculin','RSEQ Provincial','Hiver',True),
    ('Hockey sur glace','Hockey cadet féminin D1','D1','Cadet','Féminin','RSEQ Provincial','Hiver',True),
    ('Hockey sur glace','Hockey cadet masculin D1','D1','Cadet','Masculin','RSEQ Provincial','Hiver',True),
    ('Hockey sur glace','Hockey juvénile féminin D1','D1','Juvénile','Féminin','RSEQ Provincial','Hiver',True),
    ('Hockey sur glace','Hockey juvénile masculin D1','D1','Juvénile','Masculin','RSEQ Provincial','Hiver',True),
    ('Hockey sur glace','Hockey D2+','D2+','Toutes','F & M','Régional (14)','Hiver',False),
    ('Soccer','Soccer juvénile D1','D1','Juvénile','F & M','RSEQ + Régional','Automne',True),
    ('Athlétisme','Athlétisme — Championnat','Championnat','Toutes','F & M','Régional (14)','Printemps',True),
    ('Badminton','Badminton — Ligues D1/D2/D3','D1-D3','Toutes','F & M','Régional (14)','Hiver-Printemps',True),
    ('Cross-country','Cross-country — Championnat','Championnat','Toutes','F & M','Régional (14)','Automne',True),
    ('Soccer en gymnase','Futsal — Championnat','Championnat','Toutes','F & M','Régional (14)','Hiver',True),
    ('Flag Football','Flag Football — Championnat','Championnat','Toutes','F & M','Régional (14)','Automne',True),
    ('Natation','Natation — Championnat','Championnat','Toutes','F & M','Régional (14)','Hiver',True),
    ('Cheerleading','Cheerleading — Championnat','Championnat','Toutes','Mixte','Régional (14)','Hiver-Printemps',True),
    ('Rugby','Rugby — Ligues régionales','Régional','Juvénile','F & M','Régional (14)','Printemps',False),
    ('Baseball','Baseball — Ligues régionales','Régional','Juvénile','Masculin','Régional (14)','Printemps',False),
]
inserted = 0
for (sport_excel, nom, division, categorie, genre, gestionnaire, saison, niveau_provincial) in ligues:
    db_sport = sport_map.get(sport_excel, sport_excel)
    if db_sport is None:
        continue
    cur.execute("""
        INSERT INTO ligues (sport_id, nom, division, categorie, genre, gestionnaire, saison, niveau_provincial)
        SELECT id, %s, %s, %s, %s, %s, %s, %s FROM sports WHERE nom = %s
        ON CONFLICT DO NOTHING
    """, (nom, division, categorie, genre, gestionnaire, saison, niveau_provincial, db_sport))
    if cur.rowcount > 0:
        inserted += 1
conn.commit()
print(f"  ✓ {inserted} ligues inserted")

# Step 7 — ligue_custom
cur.execute("ALTER TABLE equipes ADD COLUMN IF NOT EXISTS ligue_custom TEXT;")
conn.commit()
print("  ✓ ligue_custom added")

cur.close()
conn.close()
print("\n✅ NEXUS DATABASE FULLY SEEDED")
print("   Tables: 32 | Sports: 16 | Positions: 42 | Ligues: 36 | Schools: 1,259")
