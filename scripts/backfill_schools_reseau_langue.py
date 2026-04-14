#!/usr/bin/env python3
"""
Backfill schools.reseau + schools.langue from the 3 cached Donnees Quebec CSVs.

Does NOT modify the schools seed script. Emits UPDATE statements targeted by
id to `supabase/snippets/update_schools_reseau_langue.sql`. User reviews
before applying.

Run from project root:
    python scripts/backfill_schools_reseau_langue.py
"""

from __future__ import annotations

import csv
import io
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_SQL = ROOT / "supabase" / "snippets" / "update_schools_reseau_langue.sql"
OUT_SUMMARY = ROOT / "supabase" / "snippets" / "update_schools_reseau_langue_summary.txt"

PUBLIC_CSV = CACHE_DIR / "es_ecole_publique.csv"
PRIVATE_CSV = CACHE_DIR / "pps_prive_etablissement.csv"
COLLEGIAL_CSV = CACHE_DIR / "es_collegial.csv"


# ---------------------------------------------------------------------------
# Normalization (same logic as seed_quebec_schools.py)
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
    t = strip_accents(s or "").lower().strip()
    t = re.sub(r"\s+", " ", t)
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


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------

def decode_bytes(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def load_csv(path: Path) -> Tuple[List[str], List[Dict[str, str]]]:
    data = path.read_bytes()
    text = decode_bytes(data)
    sample = text[:8192]
    delim = ","
    try:
        d = csv.Sniffer().sniff(sample, delimiters=[";", ",", "\t", "|"])
        delim = d.delimiter
    except csv.Error:
        if sample.count(";") > sample.count(","):
            delim = ";"
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    headers = reader.fieldnames or []
    rows = list(reader)
    return headers, rows


def find_field(row: Dict[str, str], candidates: Iterable[str]) -> Optional[str]:
    norm_map = {strip_accents(k or "").lower().strip(): k for k in row.keys()}
    for cand in candidates:
        key = strip_accents(cand).lower().strip()
        if key in norm_map:
            return norm_map[key]
    return None


def get_field(row: Dict[str, str], candidates: Iterable[str]) -> str:
    fld = find_field(row, candidates)
    if not fld:
        return ""
    return norm_text(row.get(fld, ""))


# ---------------------------------------------------------------------------
# Language / reseau parsing
# ---------------------------------------------------------------------------

def parse_langue(raw: str) -> Optional[str]:
    """Normalize LANG_ENS values. Returns 'FR' | 'EN' | None."""
    if not raw:
        return None
    t = strip_accents(raw).lower().strip()
    if not t:
        return None
    if t.startswith("fran"):
        return "FR"
    if t.startswith("angl") or t == "en" or t == "english":
        return "EN"
    if "bilingue" in t:
        return "BILINGUE"
    return None


def parse_reseau(raw: str) -> Optional[str]:
    if not raw:
        return None
    t = strip_accents(raw).lower().strip()
    if not t:
        return None
    if t.startswith("priv"):
        return "PRIVE"
    if t.startswith("public") or t == "publique":
        return "PUBLIC"
    if t.startswith("gouvern"):
        # Gouvernemental = government-run (e.g. military colleges). Treat as PUBLIC.
        return "PUBLIC"
    return None


# ---------------------------------------------------------------------------
# Build map (norm_name, norm_city) -> {reseau, languages}
# ---------------------------------------------------------------------------

@dataclass
class MapEntry:
    reseau: Optional[str] = None
    languages: Set[str] = field(default_factory=set)


def build_map() -> Dict[Tuple[str, str], MapEntry]:
    m: Dict[Tuple[str, str], MapEntry] = defaultdict(MapEntry)

    # --- Public CSV: implicitly PUBLIC; language via TYPE_CS (Franco/Anglo/Statut) ---
    hdrs, rows = load_csv(PUBLIC_CSV)
    print(f"[public] columns: {hdrs}", file=sys.stderr)
    print(f"[public] {len(rows)} rows", file=sys.stderr)
    name_cands = ["NOM_OFFCL_ORGNS", "NOM_OFFCL_ECOLE", "NOM_OFFCL", "NOM_ECOLE", "NOM"]
    city_cands = ["NOM_MUNCP", "NOM_MUNCP_GDUNO_ORGNS", "NOM_MUNCP_GDUNO_IMM", "MUNICIPALITE", "VILLE"]
    type_cs_cands = ["TYPE_CS"]
    lang_cands = ["LANG_ENS", "LANGUE_ENS", "LANG", "LANGUE"]
    for r in rows:
        name = get_field(r, name_cands)
        city = get_field(r, city_cands)
        if not name:
            continue
        key = (norm_key_name(name), norm_key_city(city))
        entry = m[key]
        entry.reseau = "PUBLIC"
        # Prefer explicit LANG_ENS if present, else TYPE_CS (Franco/Anglo)
        lang_raw = get_field(r, lang_cands)
        lang = parse_langue(lang_raw)
        if lang is None:
            type_cs = get_field(r, type_cs_cands)
            tcs = strip_accents(type_cs).lower().strip()
            if tcs == "franco":
                lang = "FR"
            elif tcs == "anglo":
                lang = "EN"
            # 'Statut' (Cree/Kativik/etc.) -> leave unset
        if lang and lang != "BILINGUE":
            entry.languages.add(lang)

    # --- Private CSV: reseau from 'RESEAU' col; no language column ---
    hdrs, rows = load_csv(PRIVATE_CSV)
    print(f"[private] columns: {hdrs}", file=sys.stderr)
    print(f"[private] {len(rows)} rows", file=sys.stderr)
    name_cands = ["NOM_OFFCL", "NOM_OFFCL_ECOLE", "NOM_ETBL", "NOM"]
    city_cands = ["NOM_MUNCP", "MUNICIPALITE", "VILLE"]
    for r in rows:
        name = get_field(r, name_cands)
        city = get_field(r, city_cands)
        if not name:
            continue
        key = (norm_key_name(name), norm_key_city(city))
        entry = m[key]
        # RESEAU col values: 'Prive' (garbled 'Priv�')
        reseau_raw = get_field(r, ["RESEAU"])
        reseau = parse_reseau(reseau_raw)
        entry.reseau = reseau or "PRIVE"
        # Language candidates (none expected)
        lang_raw = get_field(r, ["LANG_ENS", "LANGUE_ENS", "LANG", "LANGUE"])
        lang = parse_langue(lang_raw)
        if lang and lang != "BILINGUE":
            entry.languages.add(lang)

    # --- Collegial CSV: has RESEAU + LANG_ENS ---
    hdrs, rows = load_csv(COLLEGIAL_CSV)
    print(f"[collegial] columns: {hdrs}", file=sys.stderr)
    print(f"[collegial] {len(rows)} rows", file=sys.stderr)
    name_cands = ["NOM_OFFCL", "NOM_ETABL", "NOM_ETABLISSEMENT", "NOM"]
    city_cands = ["NOM_MUNCP", "MUNICIPALITE", "VILLE"]
    for r in rows:
        name = get_field(r, name_cands)
        city = get_field(r, city_cands)
        if not name:
            continue
        key = (norm_key_name(name), norm_key_city(city))
        entry = m[key]
        reseau = parse_reseau(get_field(r, ["RESEAU"]))
        if reseau:
            # Don't overwrite an existing reseau if one already set (public wins for shared keys)
            if entry.reseau is None:
                entry.reseau = reseau
        lang_raw = get_field(r, ["LANG_ENS", "LANGUE_ENS", "LANG", "LANGUE"])
        lang = parse_langue(lang_raw)
        if lang and lang != "BILINGUE":
            entry.languages.add(lang)

    return m


# ---------------------------------------------------------------------------
# DB fetch
# ---------------------------------------------------------------------------

@dataclass
class DBSchool:
    id: str
    name: str
    city: str


def fetch_db() -> List[DBSchool]:
    result = subprocess.run(
        [
            "docker", "exec", "supabase_db_Nexus",
            "psql", "-U", "postgres", "-d", "postgres",
            "-c", "SELECT id, name, city FROM schools;",
            "--csv",
        ],
        capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql failed: {result.stderr}")
    reader = csv.DictReader(io.StringIO(result.stdout))
    out = []
    for row in reader:
        out.append(DBSchool(
            id=row["id"],
            name=row.get("name") or "",
            city=row.get("city") or "",
        ))
    return out


# ---------------------------------------------------------------------------
# Match + emit
# ---------------------------------------------------------------------------

def resolve_langue(langs: Set[str]) -> Optional[str]:
    if "FR" in langs and "EN" in langs:
        return "BILINGUE"
    if "FR" in langs:
        return "FR"
    if "EN" in langs:
        return "EN"
    return None


def main() -> int:
    print("Loading CSVs...", file=sys.stderr)
    m = build_map()
    print(f"Map entries: {len(m)}", file=sys.stderr)

    # Also build name-only fallback
    name_only: Dict[str, List[Tuple[Tuple[str, str], MapEntry]]] = defaultdict(list)
    for k, v in m.items():
        name_only[k[0]].append((k, v))

    print("Querying DB...", file=sys.stderr)
    db = fetch_db()
    print(f"DB rows: {len(db)}", file=sys.stderr)

    matched = 0
    unmatched: List[str] = []
    updates: List[Tuple[str, Optional[str], Optional[str]]] = []  # (id, reseau, langue)

    buckets = {"PUBLIC/FR": 0, "PRIVE/FR": 0, "PUBLIC/EN": 0, "PRIVE/EN": 0, "BILINGUE": 0}

    for d in db:
        k = (norm_key_name(d.name), norm_key_city(d.city))
        entry = m.get(k)
        if entry is None and d.city:
            # Fallback: try name-only if DB row has city but CSV entry has blank city
            candidates = name_only.get(k[0], [])
            blank_city = [(kk, vv) for (kk, vv) in candidates if kk[1] == ""]
            if blank_city:
                entry = blank_city[0][1]
        if entry is None and not d.city:
            # DB row has no city, try any CSV entry with this name
            candidates = name_only.get(k[0], [])
            if len(candidates) == 1:
                entry = candidates[0][1]

        if entry is None:
            unmatched.append(d.name)
            continue

        reseau = entry.reseau
        langue = resolve_langue(entry.languages)
        if reseau is None and langue is None:
            unmatched.append(d.name)
            continue

        matched += 1
        updates.append((d.id, reseau, langue))

        if langue == "BILINGUE":
            buckets["BILINGUE"] += 1
        elif reseau and langue:
            key_b = f"{reseau}/{langue}"
            if key_b in buckets:
                buckets[key_b] += 1

    # Emit SQL
    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"-- Backfill schools.reseau + schools.langue (generated {date.today().isoformat()})",
        f"-- Source: Donnees Quebec CSVs (cached in scripts/.cache/)",
        f"-- {len(updates)} rows updated",
        "",
        "BEGIN;",
    ]
    for school_id, reseau, langue in updates:
        sets = []
        if reseau:
            sets.append(f"reseau='{reseau}'")
        if langue:
            sets.append(f"langue='{langue}'")
        if not sets:
            continue
        lines.append(f"UPDATE schools SET {', '.join(sets)} WHERE id='{school_id}';")
    lines.append("COMMIT;")
    lines.append("")
    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote SQL -> {OUT_SQL}", file=sys.stderr)

    # Summary
    summary_lines = [
        f"Schools reseau/langue backfill - {date.today().isoformat()}",
        "=" * 60,
        f"Rows in DB: {len(db)}",
        f"Matched in CSV (with at least 1 value): {matched}",
        "",
        "Of matched:",
    ]
    for k, v in buckets.items():
        summary_lines.append(f"  {k}: {v}")
    summary_lines.append("")
    summary_lines.append(f"Unmatched (stayed null): {len(unmatched)}")
    summary_lines.append("First 20 unmatched names:")
    for n in unmatched[:20]:
        summary_lines.append(f"  - {n}")
    text = "\n".join(summary_lines) + "\n"
    OUT_SUMMARY.write_text(text, encoding="utf-8")
    print(text)
    print(f"Wrote summary -> {OUT_SUMMARY}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
