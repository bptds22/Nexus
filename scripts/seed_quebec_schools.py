#!/usr/bin/env python3
"""
Seed Quebec schools into Supabase `schools` table.

Downloads 3 official Donnees Quebec CSVs (public secondary, private,
collegial), filters to secondary schools + CEGEPs relevant to RSEQ sports
recruitment, compares against existing rows in the local Supabase DB,
and emits a SQL seed file.

Run from project root:
    python scripts/seed_quebec_schools.py

Outputs:
    supabase/snippets/seed_quebec_schools.sql
    supabase/snippets/seed_quebec_schools_summary.txt
"""

from __future__ import annotations

import csv
import io
import os
import re
import subprocess
import sys
import unicodedata
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_SQL = ROOT / "supabase" / "snippets" / "seed_quebec_schools.sql"
OUT_SUMMARY = ROOT / "supabase" / "snippets" / "seed_quebec_schools_summary.txt"

CSVS = {
    "public": "https://www.donneesquebec.ca/recherche/dataset/2d3b5cf8-b347-49c7-ad3b-bd6a9c15e443/resource/c6640a54-bc4b-43ec-864e-6c325dce61bc/download/es_ecole_publique.csv",
    # Spec URL (83aae1b5-87b5-4e24-b4db-584581d8e4fb / pps_etab_prive.csv) returns
    # 404; the current canonical resource is pps_prive_etablissement.csv.
    "private": "https://www.donneesquebec.ca/recherche/dataset/2d3b5cf8-b347-49c7-ad3b-bd6a9c15e443/resource/83aae1b5-87b5-4e3d-9074-c0d4778fe812/download/pps_prive_etablissement.csv",
    "collegial": "https://www.donneesquebec.ca/recherche/dataset/2d3b5cf8-b347-49c7-ad3b-bd6a9c15e443/resource/13aa95e2-22a3-4f20-878a-47dbf3480338/download/es_collegial.csv",
}

# Keywords to exclude from collegial CSV (non-RSEQ institutions)
COLLEGIAL_EXCLUDE_KEYWORDS = [
    "conservatoire",
    "aviation",
    "cdi",
    "cctt",
    "centre de transfert",
    "immobilier",
    "institut de technologie",
    "radio",
    # Additional: clearly non-RSEQ (no sports teams)
    "aeronautique",
    "air richelieu",
    "cargair",
    "helicraft",
    "helico",
    "pilotage",
    "ifly",
    "ecole de danse",
    "ecole de musique",
    "ecole nationale de cirque",
    "ecole nationale de theatre",
    "ecole nationale de l'humour",
    "institut d'enregistrement",
    "effets visuels",
    "syn studio",
    "rubika",
    "isart",
    "multihexa",
    "teccart",
    "trebas",
    "formation equestre",
    "cestar",
]

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    print(f"[warn] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Download + parse
# ---------------------------------------------------------------------------

def download(url: str, dest: Path) -> bytes:
    if dest.exists() and dest.stat().st_size > 0:
        log(f"  cache hit: {dest.name}")
        return dest.read_bytes()
    log(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "nexus-seed/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    log(f"  cached -> {dest} ({len(data)} bytes)")
    return data


def decode_bytes(data: bytes) -> str:
    # Try utf-8-sig first (handles BOM), then utf-8, then cp1252
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def parse_csv(text: str) -> Tuple[List[str], List[Dict[str, str]]]:
    # Detect delimiter from the first ~8KB
    sample = text[:8192]
    delim = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=[";", ",", "\t", "|"])
        delim = dialect.delimiter
    except csv.Error:
        # Fallback heuristic
        if sample.count(";") > sample.count(","):
            delim = ";"
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    headers = reader.fieldnames or []
    rows = list(reader)
    return headers, rows


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def strip_accents(s: str) -> str:
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def norm_text(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def norm_key_name(s: str) -> str:
    """Fuzzy name key: lowercased, accent-stripped, with common prefixes removed."""
    t = strip_accents(s or "").lower().strip()
    t = re.sub(r"\s+", " ", t)
    # Remove "ecole secondaire de/du/d'/de la/des"
    t = re.sub(r"^(l['e]?\s*)?ecole\s+secondaire\s+(de\s+la\s+|de\s+l['e]?\s*|du\s+|des\s+|de\s+|d['e]?\s*)?", "", t)
    t = re.sub(r"^(l['e]?\s*)?ecole\s+(de\s+la\s+|du\s+|des\s+|de\s+|d['e]?\s*)?", "", t)
    t = re.sub(r"^polyvalente\s+(de\s+la\s+|du\s+|des\s+|de\s+|d['e]?\s*)?", "", t)
    t = re.sub(r"^cegep\s+(de\s+la\s+|du\s+|des\s+|de\s+|d['e]?\s*)?", "", t)
    t = re.sub(r"^college\s+(de\s+la\s+|du\s+|des\s+|de\s+|d['e]?\s*)?", "", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def norm_key_city(s: str) -> str:
    return strip_accents((s or "").lower()).strip()


def lower_key_exact(name: str, city: str) -> Tuple[str, str]:
    """Match the DB's unique index: lower(name), lower(city)."""
    return (name.lower().strip(), (city or "").lower().strip())


# ---------------------------------------------------------------------------
# Field lookup (case-insensitive + accent-insensitive)
# ---------------------------------------------------------------------------

def find_field(row: Dict[str, str], candidates: Iterable[str]) -> Optional[str]:
    norm_map = {strip_accents(k or "").lower().strip(): k for k in row.keys()}
    for cand in candidates:
        key = strip_accents(cand).lower().strip()
        if key in norm_map:
            return norm_map[key]
    # Partial match fallback
    for cand in candidates:
        key = strip_accents(cand).lower().strip()
        for nk, orig in norm_map.items():
            if key in nk:
                return orig
    return None


def get_field(row: Dict[str, str], candidates: Iterable[str]) -> str:
    fld = find_field(row, candidates)
    if not fld:
        return ""
    return norm_text(row.get(fld, ""))


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    name: str
    city: str
    region: str
    type: str  # SECONDAIRE or CEGEP
    source: str


# ---------------------------------------------------------------------------
# Filters per CSV
# ---------------------------------------------------------------------------

def extract_public(rows: List[Dict[str, str]]) -> List[Candidate]:
    """Public secondary schools."""
    out: List[Candidate] = []
    name_candidates = ["NOM_OFFCL_ECOLE", "NOM_ECOLE", "NOM_OFFCL", "NOM"]
    city_candidates = ["NOM_MUNCP", "MUNICIPALITE", "VILLE", "NOM_MUNICIPALITE"]
    region_candidates = ["NOM_REG_ADM", "REGION_ADM", "REGION", "NOM_REGION"]
    ordre_candidates = ["ORDRE_ENS", "ORDRE_ENS_TYPE", "ORDRE_ENSEIGNEMENT", "TYPE_ORGNS_EN_ACTVT"]
    sec_flag_candidates = ["SEC", "ORDR_ENS_SEC", "SECONDAIRE", "NIV_SEC"]
    # Fields flagging FP/FGA to exclude
    fp_candidates = ["FP", "FGA", "EDA", "CFP", "FORMATION_PROF"]

    kept = 0
    skipped_primary = 0
    skipped_adult = 0
    for row in rows:
        name = get_field(row, name_candidates)
        if not name:
            continue
        city = get_field(row, city_candidates)
        region = get_field(row, region_candidates)

        # Check SEC flag
        sec_flag = get_field(row, sec_flag_candidates)
        ordre = get_field(row, ordre_candidates)
        has_sec = False
        if sec_flag and sec_flag.strip() not in ("", "0", "N", "NON", "No"):
            has_sec = True
        if ordre:
            ordre_norm = strip_accents(ordre).lower()
            if "sec" in ordre_norm:
                has_sec = True

        # Adult ed / vocational exclusions -- but only exclude if they have NO
        # secondary level AND are adult/vocational only.
        name_norm = strip_accents(name).lower()
        is_adult_only = False
        # Many CSVs have FP/FGA columns; if name contains "centre de formation"
        # and no SEC flag, treat as adult-only.
        if not has_sec:
            if any(k in name_norm for k in ["formation professionnelle", "formation aux adultes", "education des adultes"]):
                is_adult_only = True
            if any(k in name_norm for k in ["centre de formation"]) and "sec" not in name_norm:
                is_adult_only = True

        if not has_sec:
            # If we have no SEC signal and no ordre, conservatively skip.
            # This avoids pulling in primary-only schools.
            if not ordre:
                # fallback: try to include if name hints secondary
                if any(k in name_norm for k in ["ecole secondaire", "polyvalente", "secondaire"]):
                    has_sec = True
                else:
                    skipped_primary += 1
                    continue
            else:
                skipped_primary += 1
                continue

        if is_adult_only:
            skipped_adult += 1
            continue

        out.append(Candidate(
            name=norm_text(name),
            city=norm_text(city),
            region=norm_text(region),
            type="SECONDAIRE",
            source="public",
        ))
        kept += 1

    log(f"  public: kept={kept} skipped_primary={skipped_primary} skipped_adult={skipped_adult}")
    return out


def extract_private(rows: List[Dict[str, str]]) -> List[Candidate]:
    """Private schools with secondary level (or CEGEP)."""
    out: List[Candidate] = []
    name_candidates = ["NOM_OFFCL", "NOM_OFFCL_ECOLE", "NOM_ECOLE", "NOM_ETBL", "NOM", "NOM_ETABLISSEMENT"]
    city_candidates = ["NOM_MUNCP", "MUNICIPALITE", "VILLE"]
    region_candidates = ["NOM_REG_ADM", "REGION_ADM", "REGION"]
    sec_flag_candidates = ["SEC", "SECONDAIRE", "NIV_SEC", "ORDR_ENS_SEC"]
    coll_flag_candidates = ["COLL", "COLLEGIAL", "ORDR_ENS_COL"]
    ordre_candidates = ["ORDRE_ENS", "ORDRE_ENS_TYPE", "ORDRE_ENSEIGNEMENT"]

    kept_sec = 0
    kept_cegep = 0
    skipped = 0
    for row in rows:
        name = get_field(row, name_candidates)
        if not name:
            continue
        city = get_field(row, city_candidates)
        region = get_field(row, region_candidates)

        sec_flag = get_field(row, sec_flag_candidates)
        coll_flag = get_field(row, coll_flag_candidates)
        ordre = get_field(row, ordre_candidates)

        has_sec = False
        has_coll = False
        if sec_flag and sec_flag.strip() not in ("", "0", "N", "NON", "No"):
            has_sec = True
        if coll_flag and coll_flag.strip() not in ("", "0", "N", "NON", "No"):
            has_coll = True
        if ordre:
            ordre_norm = strip_accents(ordre).lower()
            if "sec" in ordre_norm:
                has_sec = True
            if "col" in ordre_norm or "cegep" in ordre_norm:
                has_coll = True

        name_norm = strip_accents(name).lower()
        if not has_sec and not has_coll:
            # Heuristic from name
            if any(k in name_norm for k in ["ecole secondaire", "polyvalente", "secondaire", "seminaire", "college", "academie"]):
                has_sec = True

        if not has_sec and not has_coll:
            skipped += 1
            continue

        if has_coll and not has_sec:
            # Private CEGEP
            out.append(Candidate(
                name=norm_text(name),
                city=norm_text(city),
                region=norm_text(region),
                type="CEGEP",
                source="private",
            ))
            kept_cegep += 1
        else:
            out.append(Candidate(
                name=norm_text(name),
                city=norm_text(city),
                region=norm_text(region),
                type="SECONDAIRE",
                source="private",
            ))
            kept_sec += 1

    log(f"  private: kept_sec={kept_sec} kept_cegep={kept_cegep} skipped={skipped}")
    return out


def extract_collegial(rows: List[Dict[str, str]]) -> List[Candidate]:
    """CEGEPs and colleges."""
    out: List[Candidate] = []
    name_candidates = ["NOM_OFFCL", "NOM_ETABL", "NOM_ETABLISSEMENT", "NOM", "NOM_COLLEGE"]
    city_candidates = ["NOM_MUNCP", "MUNICIPALITE", "VILLE"]
    region_candidates = ["NOM_REG_ADM", "REGION_ADM", "REGION"]
    type_candidates = ["TYPE_ORGNS", "TYPE_ORG", "TYPE_ORGN", "TYPE_ETABL", "TYPE"]

    kept = 0
    skipped_excluded = 0
    skipped_unknown = 0
    for row in rows:
        name = get_field(row, name_candidates)
        if not name:
            continue
        city = get_field(row, city_candidates)
        region = get_field(row, region_candidates)
        type_val = get_field(row, type_candidates)

        name_norm = strip_accents(name).lower()
        type_norm = strip_accents(type_val).lower()

        # Exclusions by name
        if any(k in name_norm for k in COLLEGIAL_EXCLUDE_KEYWORDS):
            skipped_excluded += 1
            continue

        # Exclusions by TYPE_ORGNS (non-RSEQ institutions)
        # CCTTs, transfer centers, "Centre d'enseignement", "Installation" duplicates,
        # "École gouvernementale" (military/police).
        type_exclude = [
            "centre collegial de transfert",
            "centre de transfert",
            "centre d'enseignement",
            "ecole gouvernementale",
            "installation",  # "Installation college prive" = site duplicate
        ]
        if any(k in type_norm for k in type_exclude):
            skipped_excluded += 1
            continue

        # Inclusion rules — must be an actual CEGEP or College
        include = False
        # Whole-word "cegep"
        if "cegep" in name_norm or "cegep" in type_norm:
            include = True
        elif re.search(r"\bcollege\b", name_norm) or re.search(r"\bcollege\b", type_norm):
            include = True

        if not include:
            skipped_unknown += 1
            continue

        out.append(Candidate(
            name=norm_text(name),
            city=norm_text(city),
            region=norm_text(region),
            type="CEGEP",
            source="collegial",
        ))
        kept += 1

    log(f"  collegial: kept={kept} skipped_excluded={skipped_excluded} skipped_unknown={skipped_unknown}")
    return out


# ---------------------------------------------------------------------------
# Dedupe within a CSV
# ---------------------------------------------------------------------------

def dedupe(cands: List[Candidate]) -> List[Candidate]:
    seen = {}
    for c in cands:
        k = (norm_key_name(c.name), norm_key_city(c.city))
        if k not in seen:
            seen[k] = c
        else:
            # Prefer one with filled region/city
            existing = seen[k]
            score_new = (bool(c.city) + bool(c.region))
            score_old = (bool(existing.city) + bool(existing.region))
            if score_new > score_old:
                seen[k] = c
    return list(seen.values())


# ---------------------------------------------------------------------------
# Existing DB
# ---------------------------------------------------------------------------

@dataclass
class ExistingSchool:
    id: str
    name: str
    type: str
    city: str
    region: str


def fetch_existing() -> List[ExistingSchool]:
    log("Querying local Supabase for existing schools...")
    result = subprocess.run(
        [
            "docker", "exec", "supabase_db_Nexus",
            "psql", "-U", "postgres", "-d", "postgres",
            "-c", "SELECT id, name, type, city, region FROM schools;",
            "--csv",
        ],
        capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr}")
    reader = csv.DictReader(io.StringIO(result.stdout))
    out = []
    for row in reader:
        out.append(ExistingSchool(
            id=row["id"],
            name=row.get("name") or "",
            type=row.get("type") or "",
            city=row.get("city") or "",
            region=row.get("region") or "",
        ))
    log(f"  got {len(out)} existing rows")
    return out


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------

def build_existing_index(existing: List[ExistingSchool]) -> Dict[Tuple[str, str], ExistingSchool]:
    """Index by (fuzzy name, normalized city). If city is empty, we also
    index by (fuzzy name, '') so candidates without city match too."""
    idx: Dict[Tuple[str, str], ExistingSchool] = {}
    # Exact key (match the DB's unique index behavior)
    for e in existing:
        k = (norm_key_name(e.name), norm_key_city(e.city))
        idx[k] = e
    return idx


def match_candidates(
    cands: List[Candidate],
    existing: List[ExistingSchool],
) -> Tuple[List[Candidate], List[Tuple[ExistingSchool, Candidate]], int]:
    """Returns (to_insert, to_update, skipped_count)."""
    idx = build_existing_index(existing)
    # Also build by-name-only index (for rows in DB with null city)
    name_only: Dict[str, List[ExistingSchool]] = defaultdict(list)
    for e in existing:
        name_only[norm_key_name(e.name)].append(e)

    to_insert: List[Candidate] = []
    to_update: List[Tuple[ExistingSchool, Candidate]] = []
    skipped = 0

    for c in cands:
        key = (norm_key_name(c.name), norm_key_city(c.city))
        hit = idx.get(key)
        if hit is None and c.city:
            # Try name-only against rows with empty city
            for cand_existing in name_only.get(norm_key_name(c.name), []):
                if not cand_existing.city:
                    hit = cand_existing
                    break
        if hit is not None:
            need_update = False
            if (not hit.city) and c.city:
                need_update = True
            if (not hit.region) and c.region:
                need_update = True
            if need_update:
                to_update.append((hit, c))
            else:
                skipped += 1
        else:
            to_insert.append(c)

    return to_insert, to_update, skipped


# ---------------------------------------------------------------------------
# SQL emission
# ---------------------------------------------------------------------------

def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def sql_value(s: str) -> str:
    if s is None or s == "":
        return "NULL"
    return "'" + sql_escape(s) + "'"


def emit_insert_batch(rows: List[Candidate], type_label: str, chunk: int = 200) -> str:
    if not rows:
        return ""
    out = [f"-- New {type_label} schools ({len(rows)} rows)"]
    for start in range(0, len(rows), chunk):
        batch = rows[start:start + chunk]
        out.append("INSERT INTO schools (id, name, type, city, region) VALUES")
        lines = []
        for c in batch:
            lines.append(
                f"  (gen_random_uuid(), {sql_value(c.name)}, '{type_label}', "
                f"{sql_value(c.city)}, {sql_value(c.region)})"
            )
        out.append(",\n".join(lines))
        out.append("ON CONFLICT (lower(name), coalesce(lower(city), '')) DO NOTHING;")
        out.append("")
    return "\n".join(out)


def emit_updates(updates: List[Tuple[ExistingSchool, Candidate]]) -> str:
    if not updates:
        return ""
    out = [f"-- Backfill city/region on existing rows ({len(updates)} rows)"]
    for existing, cand in updates:
        sets = []
        if (not existing.city) and cand.city:
            sets.append(f"city = {sql_value(cand.city)}")
        if (not existing.region) and cand.region:
            sets.append(f"region = {sql_value(cand.region)}")
        if not sets:
            continue
        out.append(
            f"UPDATE schools SET {', '.join(sets)} "
            f"WHERE id = '{existing.id}' AND (city IS NULL OR region IS NULL);"
        )
    out.append("")
    return "\n".join(out)


def write_sql(new_sec: List[Candidate], new_cegep: List[Candidate],
              updates: List[Tuple[ExistingSchool, Candidate]]) -> None:
    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    parts = [
        f"-- Quebec school seed — generated {date.today().isoformat()}",
        "-- Source: Donnees Quebec open data (public, private, collegial)",
        "",
        "BEGIN;",
        "",
    ]
    ins_sec = emit_insert_batch(new_sec, "SECONDAIRE")
    ins_cegep = emit_insert_batch(new_cegep, "CEGEP")
    upd = emit_updates(updates)
    if ins_sec:
        parts.append(ins_sec)
    if ins_cegep:
        parts.append(ins_cegep)
    if upd:
        parts.append(upd)
    parts.append("COMMIT;")
    OUT_SQL.write_text("\n".join(parts), encoding="utf-8")
    log(f"Wrote SQL -> {OUT_SQL}")


def write_summary(counts: Dict[str, int], inserts_sec: int, inserts_cegep: int,
                  updates: int, skipped: int) -> None:
    OUT_SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    text = f"""Quebec school seed — {date.today().isoformat()}
===========================
CSV counts (after filtering + dedup):
  Public secondary:  {counts['public']} rows
  Private secondary: {counts['private']} rows
  CÉGEPs:            {counts['collegial']} rows
  Total candidates:  {counts['total']} rows

DB state before seed: 212 schools (71 CEGEP + 141 SECONDAIRE)

Match outcomes:
  Already in DB (skipped):         {skipped}
  New INSERTs planned:             {inserts_sec} SECONDAIRE + {inserts_cegep} CEGEP = {inserts_sec + inserts_cegep} total
  Existing rows needing city/region backfill: {updates}

Output SQL: supabase/snippets/seed_quebec_schools.sql
"""
    OUT_SUMMARY.write_text(text, encoding="utf-8")
    log(f"Wrote summary -> {OUT_SUMMARY}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Download + parse
    parsed: Dict[str, Tuple[List[str], List[Dict[str, str]]]] = {}
    for key, url in CSVS.items():
        log(f"\n=== {key} ===")
        dest = CACHE_DIR / Path(url).name
        data = download(url, dest)
        text = decode_bytes(data)
        headers, rows = parse_csv(text)
        parsed[key] = (headers, rows)
        log(f"  rows={len(rows)} cols={len(headers)}")
        print(f"  [{key}] columns: {headers}", file=sys.stderr)

    # Extract
    log("\n--- filtering ---")
    pub_cands = dedupe(extract_public(parsed["public"][1]))
    priv_cands_all = dedupe(extract_private(parsed["private"][1]))
    coll_cands = dedupe(extract_collegial(parsed["collegial"][1]))

    # Split private into SEC vs CEGEP
    priv_sec = [c for c in priv_cands_all if c.type == "SECONDAIRE"]
    priv_cegep = [c for c in priv_cands_all if c.type == "CEGEP"]

    # All SECONDAIRE candidates (public + private sec), deduped across sources
    sec_all = dedupe(pub_cands + priv_sec)
    # All CEGEP candidates (collegial + private cegep), deduped
    cegep_all = dedupe(coll_cands + priv_cegep)

    all_candidates = sec_all + cegep_all
    log(f"\nTotal candidates after cross-source dedup: {len(all_candidates)} "
        f"(SEC={len(sec_all)}, CEGEP={len(cegep_all)})")

    # Existing DB
    existing = fetch_existing()

    # Match
    to_insert, to_update, skipped = match_candidates(all_candidates, existing)
    new_sec = [c for c in to_insert if c.type == "SECONDAIRE"]
    new_cegep = [c for c in to_insert if c.type == "CEGEP"]

    log(f"\nMatch results:")
    log(f"  to_insert: {len(to_insert)} ({len(new_sec)} SEC + {len(new_cegep)} CEGEP)")
    log(f"  to_update: {len(to_update)}")
    log(f"  skipped:   {skipped}")

    # Emit SQL + summary
    write_sql(new_sec, new_cegep, to_update)
    write_summary(
        counts={
            "public": len(pub_cands),
            "private": len(priv_sec) + len(priv_cegep),
            "collegial": len(coll_cands),
            "total": len(all_candidates),
        },
        inserts_sec=len(new_sec),
        inserts_cegep=len(new_cegep),
        updates=len(to_update),
        skipped=skipped,
    )

    log("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
