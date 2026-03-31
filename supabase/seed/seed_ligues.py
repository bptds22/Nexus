import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur = conn.cursor()

# Sport name mapping — Excel name → DB name (matches web app)
sport_map = {
    'Football':        'Football',
    'Basketball':      'Basketball',
    'Volleyball':      'Volleyball',
    'Hockey sur glace':'Hockey',        # renamed
    'Soccer':          'Soccer',
    'Athlétisme':      'Athlétisme',
    'Flag Football':   'Flag football',
    'Rugby':           'Rugby',
    'Cheerleading':    'Cheerleading',
    'Natation':        'Natation',
    'Badminton':       'Badminton',
    'Cross-country':   'Cross-country',
    'Soccer en gymnase':'Futsal',       # renamed
    'Baseball':        'Baseball',
    'Ski alpin':       None,            # not in app — skip
    'Golf':            None,            # not in app — skip
}

ligues = [
    ('Football',        'Football juvénile D1',            'D1',         'Juvénile', 'Masculin',  'RSEQ Provincial',  'Automne',         True),
    ('Football',        'Football cadet D1',               'D1',         'Cadet',    'Masculin',  'RSEQ Provincial',  'Automne',         True),
    ('Football',        'Football juvénile D2',            'D2',         'Juvénile', 'Masculin',  'RSEQ Provincial',  'Automne',         True),
    ('Football',        'Football régional D3+',           'D3+',        'Toutes',   'Masculin',  'Régional (14)',    'Automne',         False),
    ('Basketball',      'Basketball benjamin féminin D1',  'D1',         'Benjamin', 'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball benjamin masculin D1', 'D1',         'Benjamin', 'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball cadet féminin D1',     'D1',         'Cadet',    'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball cadet masculin D1',    'D1',         'Cadet',    'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball juvénile féminin D1',  'D1',         'Juvénile', 'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball juvénile masculin D1', 'D1',         'Juvénile', 'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball D2 — toutes catégories','D2',        'Toutes',   'F & M',     'RSEQ Provincial',  'Hiver',           True),
    ('Basketball',      'Basketball D3 & D4',              'D3+',        'Toutes',   'F & M',     'Régional (14)',    'Hiver',           False),
    ('Volleyball',      'Volleyball benjamin féminin D1',  'D1',         'Benjamin', 'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Volleyball',      'Volleyball benjamin masculin D1', 'D1',         'Benjamin', 'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Volleyball',      'Volleyball cadet féminin D1',     'D1',         'Cadet',    'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Volleyball',      'Volleyball cadet masculin D1',    'D1',         'Cadet',    'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Volleyball',      'Volleyball juvénile féminin D1',  'D1',         'Juvénile', 'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Volleyball',      'Volleyball juvénile masculin D1', 'D1',         'Juvénile', 'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Volleyball',      'Volleyball D2+',                  'D2+',        'Toutes',   'F & M',     'Régional (14)',    'Hiver',           False),
    ('Hockey sur glace','Hockey benjamin féminin D1',      'D1',         'Benjamin', 'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Hockey sur glace','Hockey benjamin masculin D1',     'D1',         'Benjamin', 'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Hockey sur glace','Hockey cadet féminin D1',         'D1',         'Cadet',    'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Hockey sur glace','Hockey cadet masculin D1',        'D1',         'Cadet',    'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Hockey sur glace','Hockey juvénile féminin D1',      'D1',         'Juvénile', 'Féminin',   'RSEQ Provincial',  'Hiver',           True),
    ('Hockey sur glace','Hockey juvénile masculin D1',     'D1',         'Juvénile', 'Masculin',  'RSEQ Provincial',  'Hiver',           True),
    ('Hockey sur glace','Hockey D2+',                      'D2+',        'Toutes',   'F & M',     'Régional (14)',    'Hiver',           False),
    ('Soccer',          'Soccer juvénile D1',              'D1',         'Juvénile', 'F & M',     'RSEQ + Régional',  'Automne',         True),
    ('Athlétisme',      'Athlétisme — Championnat',        'Championnat','Toutes',   'F & M',     'Régional (14)',    'Printemps',       True),
    ('Badminton',       'Badminton — Ligues D1/D2/D3',     'D1-D3',      'Toutes',   'F & M',     'Régional (14)',    'Hiver-Printemps', True),
    ('Cross-country',   'Cross-country — Championnat',     'Championnat','Toutes',   'F & M',     'Régional (14)',    'Automne',         True),
    ('Soccer en gymnase','Futsal — Championnat',           'Championnat','Toutes',   'F & M',     'Régional (14)',    'Hiver',           True),
    ('Flag Football',   'Flag Football — Championnat',     'Championnat','Toutes',   'F & M',     'Régional (14)',    'Automne',         True),
    ('Natation',        'Natation — Championnat',          'Championnat','Toutes',   'F & M',     'Régional (14)',    'Hiver',           True),
    ('Cheerleading',    'Cheerleading — Championnat',      'Championnat','Toutes',   'Mixte',     'Régional (14)',    'Hiver-Printemps', True),
    ('Rugby',           'Rugby — Ligues régionales',       'Régional',   'Juvénile', 'F & M',     'Régional (14)',    'Printemps',       False),
    ('Baseball',        'Baseball — Ligues régionales',    'Régional',   'Juvénile', 'Masculin',  'Régional (14)',    'Printemps',       False),
]

inserted = 0
skipped  = 0

for (sport_excel, nom, division, categorie, genre, gestionnaire, saison, niveau_provincial) in ligues:
    db_sport = sport_map.get(sport_excel, sport_excel)

    if db_sport is None:
        print(f"  SKIP (sport not in app): {nom}")
        skipped += 1
        continue

    cur.execute("""
        INSERT INTO ligues (sport_id, nom, division, categorie, genre, gestionnaire, saison, niveau_provincial)
        SELECT id, %s, %s, %s, %s, %s, %s, %s
        FROM sports WHERE nom = %s
        ON CONFLICT DO NOTHING
    """, (nom, division, categorie, genre, gestionnaire, saison, niveau_provincial, db_sport))

    if cur.rowcount > 0:
        inserted += 1
    else:
        print(f"  WARN: sport '{db_sport}' not found in DB for ligue '{nom}'")
        skipped += 1

conn.commit()
cur.close()
conn.close()
print(f"\nDone — {inserted} ligues inserted, {skipped} skipped.")
