"""Data models for DataMapr."""

import sqlite3
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "datamapr.db")

# --- Original fields ---
VALID_TYPES = ["SaaS API", "Database", "File", "Legacy"]
VALID_SCHEMA_COMPLEXITY = ["Simple", "Medium", "Complex"]
VALID_DATA_QUALITY = ["High", "Medium", "Low"]
VALID_ACCESS = ["Easy", "Medium", "Hard"]
VALID_CONNECTOR = ["Native", "Custom", "None"]
VALID_VOLUME = ["Small", "Medium", "Large"]

# --- Enhanced integration signal fields ---
VALID_AUTH_TYPE = ["OAuth", "API Key", "Custom", "None"]
VALID_RATE_LIMITS = ["Unlimited", "Generous", "Moderate", "Strict"]
VALID_API_RELIABILITY = ["99.9%", "99%", "95%", "Unknown"]
VALID_NULL_PERCENTAGE = ["0-5%", "5-20%", "20%+"]
VALID_SCHEMA_DRIFT = ["Stable", "Occasional", "Frequent"]
VALID_VALIDATION_COVERAGE = ["Full", "Partial", "None"]

# New columns with their safe defaults (least-risky values)
_NEW_COLUMNS = [
    ("auth_type", "TEXT", "'None'"),
    ("rate_limits", "TEXT", "'Generous'"),
    ("api_reliability", "TEXT", "'Unknown'"),
    ("null_percentage", "TEXT", "'0-5%'"),
    ("schema_drift", "TEXT", "'Stable'"),
    ("validation_coverage", "TEXT", "'Full'"),
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _get_existing_columns(conn):
    """Return set of column names in the sources table."""
    cursor = conn.execute("PRAGMA table_info(sources)")
    return {row[1] for row in cursor.fetchall()}


def init_db():
    conn = get_db()
    # Create table if it doesn't exist (original schema)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            schema_complexity TEXT NOT NULL,
            data_quality TEXT NOT NULL,
            access TEXT NOT NULL,
            connector TEXT NOT NULL,
            volume TEXT NOT NULL
        )
    """)
    conn.commit()

    # Migrate: add new columns if they don't exist yet
    existing = _get_existing_columns(conn)
    for col_name, col_type, default_val in _NEW_COLUMNS:
        if col_name not in existing:
            conn.execute(
                f"ALTER TABLE sources ADD COLUMN {col_name} {col_type} NOT NULL DEFAULT {default_val}"
            )
    conn.commit()
    conn.close()


def add_source(name: str, type_: str, schema_complexity: str,
               data_quality: str, access: str, connector: str,
               volume: str, auth_type: str = "None",
               rate_limits: str = "Generous",
               api_reliability: str = "Unknown",
               null_percentage: str = "0-5%",
               schema_drift: str = "Stable",
               validation_coverage: str = "Full") -> int:
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO sources "
        "(name, type, schema_complexity, data_quality, access, connector, volume, "
        " auth_type, rate_limits, api_reliability, null_percentage, schema_drift, validation_coverage) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (name, type_, schema_complexity, data_quality, access, connector, volume,
         auth_type, rate_limits, api_reliability, null_percentage, schema_drift, validation_coverage)
    )
    conn.commit()
    source_id = cursor.lastrowid
    conn.close()
    return source_id


def get_all_sources() -> list[dict]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM sources").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_source(source_id: int) -> Optional[dict]:
    conn = get_db()
    row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_source(source_id: int, **kwargs) -> bool:
    conn = get_db()
    fields = []
    values = []
    for key, val in kwargs.items():
        fields.append(f"{key} = ?")
        values.append(val)
    values.append(source_id)
    conn.execute(f"UPDATE sources SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    changed = conn.total_changes > 0
    conn.close()
    return changed


def delete_source(source_id: int) -> bool:
    conn = get_db()
    conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    conn.commit()
    changed = conn.total_changes > 0
    conn.close()
    return changed


def delete_all_sources():
    conn = get_db()
    conn.execute("DELETE FROM sources")
    conn.commit()
    conn.close()
