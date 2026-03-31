"""
NEXUS — MEQ CSV → SQL Seed Import Script
==========================================
Downloads and parses the official MEQ open data CSVs to generate
SQL INSERT statements for the school_registry table.

USAGE:
  1. Download the 4 CSV files (see README.md)
  2. Place them in this directory
  3. Run: python import_meq_data.py
  4. Output: seed_schools.sql (ready to run in Supabase SQL editor)

REQUIREMENTS:
  pip install pandas
"""

import pandas as pd
import os
import sys
from pathlib import Path

# ============================================================
# CONFIG — File names (download from Données Québec)
# ============================================================
FILES = {
    "public": "ecoles_publiques.csv",        # Sièges sociaux des organismes scolaires
    "private": "etablissements_prives.csv",   # Établissements privés
    "collegial": "collegial.csv",             # Établissements d'enseignement collégial
    "css": "css.csv",                         # Sièges sociaux des CSS
}

# Column mappings — MEQ CSV columns → Nexus fields
# These vary slightly between files; the script handles each type
# Common columns: CD_ORGNS, NOM_OFFCL, ADRESSE, VILLE, CD_POSTL,
#                 COORD_X_LL84, COORD_Y_LL84, SITE_WEB, ORDRE_ENS

OUTPUT_FILE = "seed_schools.sql"


def clean_str(val):
    """Escape single quotes for SQL and strip whitespace."""
    if pd.isna(val) or val is None:
        return "NULL"
    s = str(val).strip().replace("'", "''")
    return f"'{s}'"


def clean_num(val):
    """Return numeric value or NULL."""
    if pd.isna(val) or val is None:
        return "NULL"
    try:
        return str(float(val))
    except (ValueError, TypeError):
        return "NULL"


def parse_ordre_ens(val):
    """Parse ORDRE_ENS field into boolean flags."""
    if pd.isna(val):
        return {
            "has_prescolaire": False,
            "has_primaire": False,
            "has_secondaire": False,
            "has_formation_pro": False,
            "has_collegial": False,
            "has_universitaire": False,
        }
    s = str(val).upper()
    return {
        "has_prescolaire": "PRÉSCOLAIRE" in s or "PRESCOLAIRE" in s or "PRÉSCOL" in s,
        "has_primaire": "PRIMAIRE" in s,
        "has_secondaire": "SECONDAIRE" in s,
        "has_formation_pro": "PROFESSION" in s or "FP" in s,
        "has_collegial": "COLLÉGIAL" in s or "COLLEGIAL" in s,
        "has_universitaire": "UNIVERSITAIRE" in s or "UNIV" in s,
    }


def determine_network(row, file_type):
    """Determine the school_network enum value."""
    if file_type == "private":
        return "PRIVE"
    if file_type == "collegial":
        reseau = str(row.get("RESEAU", "")).upper()
        if "PRIVÉ" in reseau or "PRIVE" in reseau:
            return "PRIVE"
        if "GOUVERN" in reseau:
            return "GOUVERNEMENTAL"
        return "PUBLIC_FR"  # Default for CEGEP
    # Public schools
    type_cs = str(row.get("TYPE_CS", "")).upper()
    if "ANGLOPH" in type_cs:
        return "PUBLIC_EN"
    if "PARTICULIER" in type_cs or "STATUT" in type_cs:
        return "PUBLIC_SPECIAL"
    return "PUBLIC_FR"


def determine_school_type(row, file_type):
    """Determine the school_type enum value."""
    if file_type == "collegial":
        reseau = str(row.get("RESEAU", "")).upper()
        if "PRIVÉ" in reseau or "PRIVE" in reseau:
            return "CEGEP_PRIVE"
        if "GOUVERN" in reseau:
            return "COLLEGE_GOUVERNEMENTAL"
        return "CEGEP_PUBLIC"
    if file_type == "private":
        return "SECONDAIRE_PRIVE"
    return "SECONDAIRE_PUBLIC"


def find_column(df, candidates):
    """Find the first matching column name from a list of candidates."""
    for c in candidates:
        if c in df.columns:
            return c
        for col in df.columns:
            if c.lower() == col.lower():
                return col
    return None


def process_file(filepath, file_type):
    """Process a single MEQ CSV file and return INSERT statements."""
    if not os.path.exists(filepath):
        print(f"  SKIP: {filepath} not found")
        return []

    # Try different encodings and separators
    df = None
    for enc in ["utf-8", "latin-1", "cp1252"]:
        for sep in [",", ";", "\t"]:
            try:
                df = pd.read_csv(filepath, encoding=enc, sep=sep, dtype=str)
                if len(df.columns) > 3:
                    break
            except Exception:
                continue
        if df is not None and len(df.columns) > 3:
            break

    if df is None or len(df.columns) <= 3:
        print(f"  ERROR: Could not parse {filepath}")
        return []

    print(f"  Loaded {filepath}: {len(df)} rows, {len(df.columns)} columns")
    print(f"  Columns: {list(df.columns[:10])}...")

    # Find columns dynamically (MEQ CSVs have varying column names)
    col_code = find_column(df, ["CD_ORGNS", "CD_ETABS", "CODE_ORGAN", "CD_ORGNS_RESP"])
    col_name = find_column(df, ["NOM_OFFCL", "NOM_ETABS", "NOM_ORGNS", "NOM"])
    col_addr = find_column(df, ["ADRESSE", "AD_GEOREF", "ADRS_GOREF", "ADRESSE_GEO"])
    col_city = find_column(df, ["VILLE", "MUNCPLT", "MUNICIPALITE"])
    col_postal = find_column(df, ["CD_POSTL", "CD_POSTAL", "CODE_POSTAL"])
    col_lon = find_column(df, ["COORD_X_LL84", "LONGITUDE", "LON", "X"])
    col_lat = find_column(df, ["COORD_Y_LL84", "LATITUDE", "LAT", "Y"])
    col_web = find_column(df, ["SITE_WEB", "SITEWEB", "URL"])
    col_ordre = find_column(df, ["ORDRE_ENS", "ORDRE", "ORDRE_ENSEIGNEMENT"])
    col_css = find_column(df, ["CD_CS", "CSS_CODE"])
    col_css_name = find_column(df, ["NOM_CS", "CSS_NOM"])
    col_css_type = find_column(df, ["TYPE_CS"])
    col_region = find_column(df, ["NOM_REG_ADMIN", "REGION_ADMIN", "REGION"])
    col_date = find_column(df, ["DT_MAJ_GDUNO", "DATE_MAJ"])

    if not col_code or not col_name:
        print(f"  ERROR: Cannot find code/name columns in {filepath}")
        print(f"  Available: {list(df.columns)}")
        return []

    # Filter for secondaire only (for public/private), keep all for collegial
    if file_type in ("public", "private") and col_ordre:
        # Keep rows that have "secondaire" in ORDRE_ENS
        mask = df[col_ordre].fillna("").str.upper().str.contains("SECONDAIRE|SECONDAIR")
        df_filtered = df[mask].copy()
        print(f"  Filtered to secondaire: {len(df_filtered)} rows")
    else:
        df_filtered = df.copy()

    inserts = []
    for _, row in df_filtered.iterrows():
        code = str(row.get(col_code, "")).strip()
        name = row.get(col_name, "")
        if pd.isna(name) or not code:
            continue

        ordre = parse_ordre_ens(row.get(col_ordre, "")) if col_ordre else {}
        if file_type == "collegial":
            ordre["has_collegial"] = True

        school_type = determine_school_type(row, file_type)
        network = determine_network(row, file_type)

        sql = f"""INSERT INTO school_registry (
  meq_code, meq_css_code, name, school_type, network,
  address, city, postal_code, region_admin,
  latitude, longitude, css_name, css_type,
  website,
  has_prescolaire, has_primaire, has_secondaire,
  has_formation_pro, has_collegial, has_universitaire,
  meq_data_date
) VALUES (
  {clean_str(code)}, {clean_str(row.get(col_css, None)) if col_css else 'NULL'},
  {clean_str(name)}, '{school_type}', '{network}',
  {clean_str(row.get(col_addr, None)) if col_addr else 'NULL'},
  {clean_str(row.get(col_city, None)) if col_city else 'NULL'},
  {clean_str(row.get(col_postal, None)) if col_postal else 'NULL'},
  {clean_str(row.get(col_region, None)) if col_region else 'NULL'},
  {clean_num(row.get(col_lat, None)) if col_lat else 'NULL'},
  {clean_num(row.get(col_lon, None)) if col_lon else 'NULL'},
  {clean_str(row.get(col_css_name, None)) if col_css_name else 'NULL'},
  {clean_str(row.get(col_css_type, None)) if col_css_type else 'NULL'},
  {clean_str(row.get(col_web, None)) if col_web else 'NULL'},
  {str(ordre.get('has_prescolaire', False)).upper()},
  {str(ordre.get('has_primaire', False)).upper()},
  {str(ordre.get('has_secondaire', False)).upper()},
  {str(ordre.get('has_formation_pro', False)).upper()},
  {str(ordre.get('has_collegial', False)).upper()},
  {str(ordre.get('has_universitaire', False)).upper()},
  {clean_str(row.get(col_date, None)) if col_date else 'NULL'}
) ON CONFLICT (meq_code) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  website = EXCLUDED.website,
  meq_data_date = EXCLUDED.meq_data_date;"""

        inserts.append(sql)

    return inserts


def main():
    print("=" * 60)
    print("NEXUS — MEQ School Registry Import")
    print("=" * 60)

    all_inserts = []

    # Process each file type
    for file_type, filename in FILES.items():
        print(f"\nProcessing {file_type}: {filename}")
        # Try both the expected name and with/without BOM
        inserts = process_file(filename, file_type)
        all_inserts.extend(inserts)

    if not all_inserts:
        print("\n" + "=" * 60)
        print("NO DATA FOUND!")
        print("=" * 60)
        print("\nMake sure you downloaded the CSV files from Données Québec.")
        print("See README.md for exact download links.")
        print("\nExpected files in current directory:")
        for fname in FILES.values():
            exists = "✓" if os.path.exists(fname) else "✗ MISSING"
            print(f"  {exists}  {fname}")
        sys.exit(1)

    # Write output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("-- ============================================================\n")
        f.write("-- NEXUS — School Registry Seed Data\n")
        f.write(f"-- Generated from MEQ open data CSVs\n")
        f.write(f"-- Total records: {len(all_inserts)}\n")
        f.write("-- Run this AFTER 001_school_registry.sql migration\n")
        f.write("-- ============================================================\n\n")
        f.write("BEGIN;\n\n")
        for sql in all_inserts:
            f.write(sql + "\n\n")
        f.write("COMMIT;\n")
        f.write(f"\n-- Done. {len(all_inserts)} schools inserted/updated.\n")

    print(f"\n{'=' * 60}")
    print(f"SUCCESS: {len(all_inserts)} school records → {OUTPUT_FILE}")
    print(f"{'=' * 60}")
    print(f"\nNext steps:")
    print(f"  1. Run 001_school_registry.sql in Supabase SQL editor")
    print(f"  2. Run {OUTPUT_FILE} in Supabase SQL editor")
    print(f"  3. Verify: SELECT count(*), school_type FROM school_registry GROUP BY school_type;")


if __name__ == "__main__":
    main()
