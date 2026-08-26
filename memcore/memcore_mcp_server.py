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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import query  # noqa: E402

DB = os.path.join(r"I:\tools\pre_embedding_filter", "fact_store.sqlite3")

server = MCPServer("memcore")


@server.tool()
def memcore_query(q: str, k: int = 5) -> str:
    """Hybrid semantic+keyword search over the personal knowledge corpus.

    Args:
        q: natural language query (Thai or English)
        k: number of results (default 5)

    Returns JSON array of {term, kind, n_sources, body, score}."""
    import json
    results = query.search(DB, q, k, 1.0, 1.0)
    return json.dumps(results, ensure_ascii=False, indent=1)


@server.tool()
def memcore_stats() -> str:
    """Counts of entries in the fact store, grouped by kind."""
    db = sqlite3.connect(DB)
    rows = db.execute(
        "SELECT kind, COUNT(*) FROM entries GROUP BY kind").fetchall()
    total = db.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
    db.close()
    return "\n".join(f"{kind}: {n}" for kind, n in rows) + f"\nembedded: {total}"


if __name__ == "__main__":
    server.run("stdio")
