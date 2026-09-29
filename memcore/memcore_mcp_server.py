#!/usr/bin/env python3
"""
memcore_mcp_server.py — MCP server exposing the personal memory engine.

Tools:
    memcore_query(q, k=5)   hybrid (FTS5 + vector RRF) search over fact_store
    memcore_stats()         entry counts by kind

Run with a python that has mcp + numpy (obsidian-memory venv):
    I:/tools/obsidian-memory/.venv/Scripts/python.exe memcore_mcp_server.py
"""
import os
import sqlite3
import sys

from mcp.server.mcpserver import MCPServer


def _load_env_file(path):
    """Load KEY=VALUE pairs into os.environ (setdefault — never overrides).

    Needed because MCP hosts (e.g. Hermes) pass only a filtered environment
    to stdio servers, stripping keys like NVIDIA_API_KEY."""
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    val = val.strip().strip('"').strip("'")
                    if key.strip():
                        os.environ.setdefault(key.strip(), val)
    except OSError:
        pass


# Own .env only — deliberately NOT coupled to any agent/system env file.
_load_env_file(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            ".env"))

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import query  # noqa: E402
import v2 as store_v2  # noqa: E402

DB = os.path.join(r"I:\tools\pre_embedding_filter", "fact_store.sqlite3")
DB_V2 = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "fact_store.v2.sqlite3")
# MEMCORE_STORE=v1 (frozen nemotron store, NVIDIA API) | v2 (default, local e5-small store).
# Separate files, separate embedding spaces — never mixed, toggle only.
STORE = os.environ.get("MEMCORE_STORE", "v2").strip() or "v2"

server = MCPServer("memcore")


@server.tool()
def memcore_query(q: str, k: int = 5) -> str:
    """Hybrid semantic+keyword search over the personal knowledge corpus.

    Args:
        q: natural language query (Thai or English)
        k: number of results (default 5)

    Returns JSON array of {term, kind, n_sources, body, score}."""
    import json
    if STORE == "v2":
        return json.dumps(store_v2.search(DB_V2, q, k),
                          ensure_ascii=False, indent=1)
    results = query.search(DB, q, k, 1.0, 1.0)
    return json.dumps(results, ensure_ascii=False, indent=1)


@server.tool()
def memcore_stats() -> str:
    """Counts of entries in the fact store, grouped by kind."""
    db_path = DB_V2 if STORE == "v2" else DB
    db = sqlite3.connect(db_path)
    rows = db.execute(
        "SELECT kind, COUNT(*) FROM entries GROUP BY kind").fetchall()
    total = db.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
    db.close()
    return (f"[store={STORE}] " + "\n".join(f"{kind}: {n}" for kind, n in rows)
            + f"\nembedded: {total}")


if __name__ == "__main__":
    server.run("stdio")
