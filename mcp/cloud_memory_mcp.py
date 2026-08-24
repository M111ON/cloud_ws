"""Cloud Memory MCP Server — wraps the Cloudflare Worker API as MCP tools.

Uses FastMCP (mcp SDK) for correct stdio framing, same as inbox/pogls.
API key: env CLOUD_MEMORY_API_KEY or .env file next to this script.
"""

import json
import os
import urllib.request
import urllib.error
from mcp.server.fastmcp import FastMCP

WORKER_URL = "https://cloud-memory-worker.aexid03.workers.dev"

def _load_api_key():
    key = os.environ.get("CLOUD_MEMORY_API_KEY", "").strip()
    if key:
        return key
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.isfile(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("CLOUD_MEMORY_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("CLOUD_MEMORY_API_KEY not set (env var or .env next to script)")

API_KEY = _load_api_key()

mcp = FastMCP("cloud-memory")


def call_worker(path, method="GET", body=None):
    url = f"{WORKER_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-API-Key", API_KEY)
    req.add_header("User-Agent", "CloudMemoryMCP/1.0")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def memory_init() -> str:
    """Fetch full manifest of all sources + chunk counts (call once per session)."""
    return json.dumps(call_worker("/list-sources"), ensure_ascii=False, indent=2)


@mcp.tool()
def search_memory(q: str, k: int = 5) -> str:
    """Semantic search across all past conversations (OpenCode + Hermes chat logs)."""
    return json.dumps(call_worker("/search", "POST", {"q": q, "k": k}), ensure_ascii=False, indent=2)


@mcp.tool()
def memory_get(source_file: str, from_: int, to: int) -> str:
    """Get chunk text by source_file and index range (cheap navigation after search)."""
    return json.dumps(call_worker("/get", "POST", {
        "source_file": source_file, "from": from_, "to": to
    }), ensure_ascii=False, indent=2)


@mcp.tool()
def memory_remember(text: str, source: str = "user-memory") -> str:
    """Save a fact/note back to cloud memory (embeds + indexes server-side).

    Note: write goes through the worker's /mcp JSON-RPC endpoint (tool
    "memory_remember") — there is no REST /remember route on the worker
    (calling it returns the endpoint manifest instead of storing anything).
    """
    return _ws_call("memory_remember", {"text": text, "source": source})


@mcp.tool()
def list_sources() -> str:
    """List all source files and their chunk counts."""
    return json.dumps(call_worker("/list-sources"), ensure_ascii=False, indent=2)


@mcp.tool()
def memory_status() -> str:
    """Health check — total chunks and index status."""
    return json.dumps(call_worker("/status"), ensure_ascii=False, indent=2)


# ─── Workspace tools (cloud workspace pool — state, not search) ───

def _ws_call(name: str, args: dict) -> str:
    """Call a workspace tool through the worker's MCP endpoint."""
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "id": 1,
        "params": {"name": name, "arguments": args},
    }).encode()
    req = urllib.request.Request(f"{WORKER_URL}/mcp", data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-API-Key", API_KEY)
    req.add_header("User-Agent", "CloudMemoryMCP/1.0")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
        text = result.get("result", {}).get("content", [{}])[0].get("text", "")
        return text
    except urllib.error.HTTPError as e:
        return json.dumps({"error": f"HTTP {e.code}: {e.read().decode()[:200]}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def _find_current_workspace_id():
    """Locate .workspace/current — walk up from cwd to the repo root."""
    path = os.getcwd()
    while True:
        candidate = os.path.join(path, ".workspace", "current")
        if os.path.isfile(candidate):
            try:
                with open(candidate, encoding="utf-8") as f:
                    ws_id = f.read().strip()
                if ws_id:
                    return ws_id
            except OSError:
                pass
        parent = os.path.dirname(path)
        if parent == path:
            return None
        path = parent


@mcp.tool()
def ws_current() -> str:
    """Read the current workspace pointer (.workspace/current in the repo
    root). Returns the active workspace id for this project, or null."""
    ws_id = _find_current_workspace_id()
    if not ws_id:
        return json.dumps({"ok": False, "error": "No .workspace/current pointer found"})
    return json.dumps({"ok": True, "workspace_id": ws_id})


@mcp.tool()
def ws_resume() -> str:
    """RESUME: load the current workspace state in one call (workspace-model
    session start). Reads .workspace/current pointer, then loads the lossless
    bundle (files, variables, decisions, next_steps, context). Use this FIRST
    at session start — the workspace is held, not searched for."""
    ws_id = _find_current_workspace_id()
    if not ws_id:
        return json.dumps({"ok": False, "error": "No .workspace/current pointer found in this repo"})
    return _ws_call("ws_load", {"workspace_id": ws_id})


@mcp.tool()
def ws_list(status: str = "active") -> str:
    """List cloud workspaces (active/paused/archived/all). Active workspaces
    = open work units. Call this FIRST at session start (with resume) to see
    what work is in flight — this is the workspace pool."""
    return _ws_call("ws_list", {"status": status})


@mcp.tool()
def ws_load(workspace_id: str) -> str:
    """Load full workspace state (lossless bundle: files, variables,
    decisions, next_steps). The core 'load state and continue' operation —
    no search needed."""
    return _ws_call("ws_load", {"workspace_id": workspace_id})


@mcp.tool()
def ws_create(name: str, label: str = "", template: str = "blank",
              next_steps: list = [], context: str = "",
              variables: dict = None, decisions: dict = None,
              api_key: str = "") -> str:
    """Create a new workspace. Templates: blank, project, research, meeting.
    api_key defaults to the configured CLOUD_MEMORY_API_KEY."""
    args = {"name": name, "label": label, "template": template,
            "next_steps": next_steps, "context": context,
            "api_key": api_key or API_KEY}
    if variables: args["variables"] = variables
    if decisions: args["decisions"] = decisions
    return _ws_call("ws_create", args)


@mcp.tool()
def ws_update(workspace_id: str, files: dict = None,
              variables: dict = None, decisions: dict = None,
              next_steps: list = None, context: str = "",
              api_key: str = "") -> str:
    """Update workspace state (lossless merge). Record decisions, advance
    next_steps, update files as work progresses."""
    args = {"workspace_id": workspace_id, "api_key": api_key or API_KEY}
    if files is not None: args["files"] = files
    if variables is not None: args["variables"] = variables
    if decisions is not None: args["decisions"] = decisions
    if next_steps is not None: args["next_steps"] = next_steps
    if context: args["context"] = context
    return _ws_call("ws_update", args)


@mcp.tool()
def ws_checkpoint(workspace_id: str, fact_summary: str = "",
                  api_key: str = "") -> str:
    """Create a lossless checkpoint snapshot of a workspace (like git
    commit). Use at meaningful milestones."""
    return _ws_call("ws_checkpoint", {
        "workspace_id": workspace_id,
        "fact_summary": fact_summary,
        "api_key": api_key or API_KEY,
    })


@mcp.tool()
def ws_search(workspace_id: str, q: str, k: int = 10) -> str:
    """Search within a workspace's state (files, variables, decisions,
    next_steps). Returns matching snippets."""
    return _ws_call("ws_search", {"workspace_id": workspace_id, "q": q, "k": k})


@mcp.tool()
def ws_heartbeat(workspace_id: str, agent: str = "") -> str:
    """Send heartbeat to keep workspace alive. Auto-sent by sync push/pull."""
    return _ws_call("ws_heartbeat", {"workspace_id": workspace_id, "agent": agent})


@mcp.tool()
def ws_claim(workspace_id: str, agent: str, api_key: str = "") -> str:
    """Claim workspace for exclusive write access."""
    return _ws_call("ws_claim", {"workspace_id": workspace_id, "agent": agent, "api_key": api_key or API_KEY})


@mcp.tool()
def ws_release(workspace_id: str, agent: str, api_key: str = "") -> str:
    """Release claim on a workspace."""
    return _ws_call("ws_release", {"workspace_id": workspace_id, "agent": agent, "api_key": api_key or API_KEY})


@mcp.tool()
def ws_archive(workspace_id: str, api_key: str = "") -> str:
    """Archive a workspace (preserved but removed from active pool)."""
    return _ws_call("ws_archive", {"workspace_id": workspace_id, "api_key": api_key or API_KEY})


@mcp.tool()
def ws_delete(workspace_id: str, api_key: str = "") -> str:
    """Permanently delete a workspace. Cannot be undone."""
    return _ws_call("ws_delete", {"workspace_id": workspace_id, "api_key": api_key or API_KEY})


@mcp.tool()
def ws_pool_status() -> str:
    """Full pool status: active/paused/archived counts, claimed, stale."""
    return _ws_call("ws_pool_status", {})


@mcp.tool()
def ws_feedback(rating: int = 0, category: str = "general",
               comment: str = "", workspace_id: str = "",
               list_feedback: bool = False, summary: bool = False,
               api_key: str = "") -> str:
    """Submit, list, or summarize feedback. Modes:
    - Submit: pass rating (1-5)
    - List: pass list_feedback=True
    - Summary: pass summary=True (avg rating, category breakdown, trend)"""
    if summary:
        return _ws_call("ws_feedback", {"summary": True, "workspace_id": workspace_id})
    if list_feedback:
        return _ws_call("ws_feedback", {"list": True, "workspace_id": workspace_id})
    return _ws_call("ws_feedback", {
        "rating": rating, "category": category, "comment": comment,
        "workspace_id": workspace_id, "api_key": api_key or API_KEY,
    })


@mcp.tool()
def project_list() -> str:
    """List projects (nests) with workspace counts."""
    return _ws_call("project_list", {})


@mcp.tool()
def project_create(name: str, description: str = "", api_key: str = "") -> str:
    """Create a project to group workspaces."""
    return _ws_call("project_create", {"name": name, "description": description, "api_key": api_key or API_KEY})


@mcp.tool()
def ws_assign(workspace_id: str, project_id: str = "", api_key: str = "") -> str:
    """Move workspace into/out of a project (empty project_id to unassign)."""
    return _ws_call("ws_assign", {"workspace_id": workspace_id, "project_id": project_id, "api_key": api_key or API_KEY})


if __name__ == "__main__":
    mcp.run()
