#!/usr/bin/env python3
"""
ws_sync.py — Cross-machine workspace sync.

Pull workspace state from cloud to local, push local changes back.
Enables resuming work on any machine by syncing workspace bundles.

Usage:
    python ws_sync.py list                         # list active workspaces
    python ws_sync.py pull <workspace_id> [dir]    # pull to local directory
    python ws_sync.py push <dir>                   # push local changes back
    python ws_sync.py diff <dir>                   # diff local vs cloud
    python ws_sync.py checkpoint <dir> [message]   # checkpoint and optionally archive
    python ws_sync.py status                       # pool status summary
    python ws_sync.py create <name> [dir]          # create new workspace + pull

Examples:
    python ws_sync.py list
    python ws_sync.py pull ws-abc123 ./my-workspace
    python ws_sync.py push ./my-workspace
    python ws_sync.py diff ./my-workspace
    python ws_sync.py checkpoint ./my-workspace "Completed phase 1"
    python ws_sync.py create "DWGLS-refactor" ./dwgls
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Optional

DEFAULT_API_URL = "https://cloud-memory-worker.aexid03.workers.dev"
LOCAL_MANIFEST = ".ws-manifest.json"  # hidden file tracking cloud state

# ─── Config ────────────────────────────────────────────────────────────────

def get_api_url() -> str:
    return os.environ.get("CF_MEMORY_URL", DEFAULT_API_URL)

def get_api_key() -> str:
    key = os.environ.get("CF_MEMORY_KEY", "")
    if key:
        return key
    # Try .api_key file (same as sync_new.py)
    key_file = Path(__file__).parent.parent / ".api_key"
    if key_file.exists():
        return key_file.read_text().strip()
    return ""

# ─── HTTP helpers ──────────────────────────────────────────────────────────

def api_get(path: str, api_url: str) -> Any:
    url = f"{api_url}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "ws-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def api_post(path: str, data: dict, api_key: str, api_url: str) -> Any:
    url = f"{api_url}{path}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
            "User-Agent": "ws-sync/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))

# ─── Local manifest ────────────────────────────────────────────────────────

def load_manifest(local_dir: Path) -> Optional[dict]:
    manifest_path = local_dir / LOCAL_MANIFEST
    if manifest_path.exists():
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    return None

def save_manifest(local_dir: Path, manifest: dict):
    manifest_path = local_dir / LOCAL_MANIFEST
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

def compute_local_hash(local_dir: Path) -> str:
    """Hash all non-manifest files in local_dir for change detection."""
    files = sorted([f for f in local_dir.rglob("*") if f.is_file() and f.name != LOCAL_MANIFEST])
    h = hashlib.sha256()
    for f in files:
        rel = str(f.relative_to(local_dir))
        h.update(rel.encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:16]

# ─── Commands ──────────────────────────────────────────────────────────────

def cmd_list(args):
    """List active workspaces."""
    api_url = get_api_url()
    status = args.status or "active"
    data = api_get(f"/workspace/list?status={status}", api_url)

    if not data.get("ok"):
        print(f"Error: {data.get('error', 'unknown')}")
        return 1

    workspaces = data.get("workspaces", [])
    if not workspaces:
        print(f"No {status} workspaces found.")
        return 0

    print(f"\n{'ID':<30} {'Name':<25} {'Files':>5} {'Vars':>5} {'Decisions':>9} {'Steps':>5} {'Updated':<20}")
    print("─" * 105)
    for ws in workspaces:
        updated = time.strftime("%Y-%m-%d %H:%M", time.gmtime(ws.get("updated_at", 0) / 1000))
        print(f"{ws['id']:<30} {ws['name']:<25} {ws.get('file_count', 0):>5} "
              f"{ws.get('variable_count', 0):>5} {ws.get('decision_count', 0):>9} "
              f"{ws.get('next_step_count', 0):>5} {updated:<20}")

    print(f"\n{len(workspaces)} workspace(s)")
    return 0


def cmd_pull(args):
    """Pull workspace state from cloud to local directory."""
    api_url = get_api_url()
    ws_id = args.workspace_id
    local_dir = Path(args.dir) if args.dir else Path(f"./{ws_id}")
    local_dir.mkdir(parents=True, exist_ok=True)

    print(f"Pulling workspace {ws_id} → {local_dir}/")

    # Load from cloud
    data = api_get(f"/workspace/{ws_id}", api_url)
    if not data.get("ok"):
        print(f"Error: {data.get('error', 'unknown')}")
        return 1

    ws = data["workspace"]
    state = ws.get("state", {})

    # Write files
    files = state.get("files", {})
    for path, content in files.items():
        file_path = local_dir / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        print(f"  📄 {path} ({len(content)} bytes)")

    # Write variables
    variables = state.get("variables", {})
    if variables:
        vars_path = local_dir / "_variables.json"
        vars_path.write_text(json.dumps(variables, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  🔧 _variables.json ({len(variables)} vars)")

    # Write decisions
    decisions = state.get("decisions", {})
    if decisions:
        dec_path = local_dir / "_decisions.json"
        dec_path.write_text(json.dumps(decisions, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  📋 _decisions.json ({len(decisions)} decisions)")

    # Write next steps
    next_steps = state.get("next_steps", [])
    if next_steps:
        steps_path = local_dir / "_next_steps.md"
        lines = [f"{i+1}. {s}" for i, s in enumerate(next_steps)]
        steps_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"  📌 _next_steps.md ({len(next_steps)} steps)")

    # Write context
    context = state.get("context", "")
    if context:
        ctx_path = local_dir / "_context.md"
        ctx_path.write_text(context, encoding="utf-8")
        print(f"  📝 _context.md ({len(context)} bytes)")

    # Write manifest (for push/diff later)
    manifest = {
        "workspace_id": ws_id,
        "name": ws.get("name", ""),
        "label": ws.get("label"),
        "cloud_hash": "",  # Will be set after push
        "pulled_at": int(time.time() * 1000),
        "last_checkpoint_at": ws.get("last_checkpoint_at"),
        "file_count": ws.get("file_count", 0),
        "variable_count": ws.get("variable_count", 0),
        "decision_count": ws.get("decision_count", 0),
        "next_step_count": ws.get("next_step_count", 0),
    }
    save_manifest(local_dir, manifest)
    print(f"\n✅ Pulled workspace '{ws.get('name', ws_id)}' to {local_dir}/")
    print(f"   Files: {len(files)}, Variables: {len(variables)}, "
          f"Decisions: {len(decisions)}, Next steps: {len(next_steps)}")
    return 0


def cmd_push(args):
    """Push local changes back to cloud."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key. Set CF_MEMORY_KEY or create .api_key file.")
        return 1

    local_dir = Path(args.dir)
    if not local_dir.exists():
        print(f"Error: Directory {local_dir} not found.")
        return 1

    manifest = load_manifest(local_dir)
    if not manifest:
        print(f"Error: No {LOCAL_MANIFEST} in {local_dir}. Was this workspace pulled first?")
        return 1

    ws_id = manifest["workspace_id"]
    print(f"Pushing local changes → workspace {ws_id}")

    # Build state from local files
    state = {}

    # Collect real files (skip _-prefixed metadata files)
    files = {}
    for f in sorted(local_dir.rglob("*")):
        if f.is_file() and f.name != LOCAL_MANIFEST and not f.name.startswith("_"):
            rel = str(f.relative_to(local_dir))
            files[rel] = f.read_text(encoding="utf-8")
    if files:
        state["files"] = files

    # Read _variables.json
    vars_path = local_dir / "_variables.json"
    if vars_path.exists():
        state["variables"] = json.loads(vars_path.read_text(encoding="utf-8"))

    # Read _decisions.json
    dec_path = local_dir / "_decisions.json"
    if dec_path.exists():
        state["decisions"] = json.loads(dec_path.read_text(encoding="utf-8"))

    # Read _next_steps.md → parse back to list
    steps_path = local_dir / "_next_steps.md"
    if steps_path.exists():
        lines = steps_path.read_text(encoding="utf-8").strip().split("\n")
        steps = []
        for line in lines:
            line = line.strip()
            if line and ". " in line:
                steps.append(line.split(". ", 1)[1])
            elif line:
                steps.append(line)
        state["next_steps"] = steps

    # Read _context.md
    ctx_path = local_dir / "_context.md"
    if ctx_path.exists():
        state["context"] = ctx_path.read_text(encoding="utf-8")

    # Push to cloud
    data = api_post(f"/workspace/{ws_id}", {"state": state}, api_key, api_url)
    if not data.get("ok"):
        print(f"Error: {data.get('error', 'unknown')}")
        return 1

    # Update manifest
    cloud_hash = compute_local_hash(local_dir)
    manifest["cloud_hash"] = cloud_hash
    manifest["pulled_at"] = int(time.time() * 1000)
    manifest["file_count"] = len(files)
    manifest["variable_count"] = len(state.get("variables", {}))
    manifest["decision_count"] = len(state.get("decisions", {}))
    manifest["next_step_count"] = len(state.get("next_steps", []))
    save_manifest(local_dir, manifest)

    ws = data.get("workspace", {})
    print(f"\n✅ Pushed to workspace '{ws.get('name', ws_id)}'")
    print(f"   Files: {len(files)}, Variables: {len(state.get('variables', {}))}, "
          f"Decisions: {len(state.get('decisions', {}))}, Next steps: {len(state.get('next_steps', []))}")
    return 0


def cmd_diff(args):
    """Show diff between local state and cloud state."""
    api_url = get_api_url()
    local_dir = Path(args.dir)

    manifest = load_manifest(local_dir)
    if not manifest:
        print(f"Error: No {LOCAL_MANIFEST} in {local_dir}.")
        return 1

    ws_id = manifest["workspace_id"]

    # Fetch cloud state
    data = api_get(f"/workspace/{ws_id}", api_url)
    if not data.get("ok"):
        print(f"Error fetching cloud state: {data.get('error', 'unknown')}")
        return 1

    cloud = data["workspace"].get("state", {})
    cloud_files = cloud.get("files", {})
    cloud_vars = cloud.get("variables", {})
    cloud_decs = cloud.get("decisions", {})
    cloud_steps = cloud.get("next_steps", [])

    # Build local state
    local_files = {}
    for f in sorted(local_dir.rglob("*")):
        if f.is_file() and f.name != LOCAL_MANIFEST and not f.name.startswith("_"):
            rel = str(f.relative_to(local_dir))
            local_files[rel] = f.read_text(encoding="utf-8")

    local_vars = {}
    vars_path = local_dir / "_variables.json"
    if vars_path.exists():
        local_vars = json.loads(vars_path.read_text(encoding="utf-8"))

    local_decs = {}
    dec_path = local_dir / "_decisions.json"
    if dec_path.exists():
        local_decs = json.loads(dec_path.read_text(encoding="utf-8"))

    local_steps = []
    steps_path = local_dir / "_next_steps.md"
    if steps_path.exists():
        for line in steps_path.read_text(encoding="utf-8").strip().split("\n"):
            line = line.strip()
            if line and ". " in line:
                local_steps.append(line.split(". ", 1)[1])

    # Compare
    diffs = []

    # Files
    all_file_keys = set(list(local_files.keys()) + list(cloud_files.keys()))
    for key in sorted(all_file_keys):
        local_val = local_files.get(key)
        cloud_val = cloud_files.get(key)
        if local_val is None:
            diffs.append(f"  - file (cloud only): {key}")
        elif cloud_val is None:
            diffs.append(f"  + file (local only): {key}")
        elif local_val != cloud_val:
            diffs.append(f"  ~ file modified: {key}")

    # Variables
    all_var_keys = set(list(local_vars.keys()) + list(cloud_vars.keys()))
    for key in sorted(all_var_keys):
        local_val = local_vars.get(key)
        cloud_val = cloud_vars.get(key)
        if local_val is None:
            diffs.append(f"  - var (cloud only): {key} = {cloud_val}")
        elif cloud_val is None:
            diffs.append(f"  + var (local only): {key} = {local_val}")
        elif local_val != cloud_val:
            diffs.append(f"  ~ var modified: {key}")

    # Decisions
    all_dec_keys = set(list(local_decs.keys()) + list(cloud_decs.keys()))
    for key in sorted(all_dec_keys):
        local_val = local_decs.get(key)
        cloud_val = cloud_decs.get(key)
        if local_val is None:
            diffs.append(f"  - decision (cloud only): {key}")
        elif cloud_val is None:
            diffs.append(f"  + decision (local only): {key}")
        elif local_val != cloud_val:
            diffs.append(f"  ~ decision modified: {key}")

    # Next steps
    if local_steps != cloud_steps:
        diffs.append(f"  ~ next_steps changed (local: {len(local_steps)}, cloud: {len(cloud_steps)})")

    if diffs:
        print(f"\nDiff for workspace {ws_id}:\n")
        for d in diffs:
            print(d)
        print(f"\n{len(diffs)} difference(s)")
    else:
        print(f"\n✅ Workspace {ws_id} — no differences (local == cloud)")

    return 0


def cmd_checkpoint(args):
    """Checkpoint workspace (optionally with message, optionally archive after)."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key.")
        return 1

    local_dir = Path(args.dir)
    manifest = load_manifest(local_dir)
    if not manifest:
        print(f"Error: No {LOCAL_MANIFEST} in {local_dir}.")
        return 1

    ws_id = manifest["workspace_id"]

    # Push first (ensure cloud is up to date)
    print("Pushing latest changes...")
    push_args = argparse.Namespace(dir=args.dir)
    cmd_push(push_args)

    # Create checkpoint
    print(f"\nCreating checkpoint for workspace {ws_id}...")
    data = api_post(f"/workspace/{ws_id}/checkpoint", {
        "fact_summary": args.message or None,
    }, api_key, api_url)

    if not data.get("ok"):
        print(f"Error: {data.get('error', 'unknown')}")
        return 1

    cp = data.get("checkpoint", {})
    print(f"\n✅ Checkpoint #{cp.get('seq')} created")
    print(f"   ID: {cp.get('id')}")
    print(f"   Checksum: {cp.get('checksum')}")
    print(f"   Snapshot size: {cp.get('snapshot_size', 0)} bytes")

    # Archive if requested
    if args.archive:
        print(f"\nArchiving workspace {ws_id}...")
        archive_data = api_post(f"/workspace/{ws_id}/archive", {}, api_key, api_url)
        if archive_data.get("ok"):
            print("✅ Workspace archived")
        else:
            print(f"Error archiving: {archive_data.get('error')}")

    return 0


def cmd_create(args):
    """Create a new workspace and optionally pull it locally."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key.")
        return 1

    name = args.name
    print(f"Creating workspace '{name}'...")

    data = api_post("/workspace/create", {
        "name": name,
        "label": args.label,
    }, api_key, api_url)

    if not data.get("ok"):
        print(f"Error: {data.get('error', 'unknown')}")
        return 1

    ws = data.get("workspace", {})
    ws_id = ws["id"]
    print(f"✅ Created workspace '{name}' (id: {ws_id})")

    # Pull to local dir if specified
    if args.dir:
        local_dir = Path(args.dir)
        local_dir.mkdir(parents=True, exist_ok=True)
        pull_args = argparse.Namespace(workspace_id=ws_id, dir=str(local_dir))
        cmd_pull(pull_args)

    return 0


def cmd_status(args):
    """Show pool status summary."""
    api_url = get_api_url()

    # Get active workspaces
    active = api_get("/workspace/list?status=active", api_url)
    paused = api_get("/workspace/list?status=paused", api_url)
    archived = api_get("/workspace/list?status=archived", api_url)

    active_count = active.get("count", 0)
    paused_count = paused.get("count", 0)
    archived_count = archived.get("count", 0)

    print(f"\n{'═' * 50}")
    print(f"  Cloud Workspace Pool — Status")
    print(f"{'═' * 50}")
    print(f"  Active:   {active_count}")
    print(f"  Paused:   {paused_count}")
    print(f"  Archived: {archived_count}")
    print(f"  Total:    {active_count + paused_count + archived_count}")

    if active_count > 0:
        print(f"\n  Active workspaces:")
        for ws in active.get("workspaces", [])[:10]:
            updated = time.strftime("%m-%d %H:%M", time.gmtime(ws.get("updated_at", 0) / 1000))
            print(f"    • {ws['name']:<25} (files: {ws.get('file_count', 0)}, "
                  f"vars: {ws.get('variable_count', 0)}, updated: {updated})")

    print(f"{'═' * 50}\n")
    return 0


def cmd_heartbeat(args):
    """Send heartbeat for a workspace."""
    api_url = get_api_url()
    local_dir = Path(args.dir)
    manifest = load_manifest(local_dir)
    if not manifest:
        print(f"Error: No {LOCAL_MANIFEST} in {local_dir}.")
        return 1

    ws_id = manifest["workspace_id"]
    agent = args.agent or os.environ.get("WS_AGENT", os.environ.get("COMPUTERNAME", "unknown"))

    data = api_post(f"/workspace/{ws_id}/heartbeat", {"agent": agent}, "", api_url)
    if data.get("ok"):
        print(f"\u2713 Heartbeat sent for {ws_id[:8]}... (agent: {agent})")
    else:
        print(f"Error: {data.get('error', 'unknown')}")
    return 0


def cmd_claim(args):
    """Claim a workspace for exclusive use."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key.")
        return 1

    local_dir = Path(args.dir)
    manifest = load_manifest(local_dir)
    if not manifest:
        print(f"Error: No {LOCAL_MANIFEST} in {local_dir}.")
        return 1

    ws_id = manifest["workspace_id"]
    agent = args.agent or os.environ.get("WS_AGENT", os.environ.get("COMPUTERNAME", "unknown"))

    data = api_post(f"/workspace/{ws_id}/claim", {"agent": agent}, api_key, api_url)
    if data.get("ok"):
        print(f"\u2713 Workspace claimed by '{agent}'")
    else:
        print(f"Error: {data.get('error', 'unknown')}")
    return 0


def cmd_release(args):
    """Release claim on a workspace."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key.")
        return 1

    local_dir = Path(args.dir)
    manifest = load_manifest(local_dir)
    if not manifest:
        print(f"Error: No {LOCAL_MANIFEST} in {local_dir}.")
        return 1

    ws_id = manifest["workspace_id"]
    agent = args.agent or os.environ.get("WS_AGENT", os.environ.get("COMPUTERNAME", "unknown"))

    data = api_post(f"/workspace/{ws_id}/release", {"agent": agent}, api_key, api_url)
    if data.get("ok"):
        print(f"\u2713 Workspace released")
    else:
        print(f"Error: {data.get('error', 'unknown')}")
    return 0


def cmd_stale_detect(args):
    """Find and auto-pause stale workspaces."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key.")
        return 1

    data = api_post("/workspace/stale-detect", {}, api_key, api_url)
    if data.get("ok"):
        paused = data.get("paused", [])
        if paused:
            print(f"\nPaused {len(paused)} stale workspace(s):")
            for ws in paused:
                print(f"  \u2022 {ws['name']} (idle {ws['idle_hours']}h)")
        else:
            print("No stale workspaces found.")
    else:
        print(f"Error: {data.get('error', 'unknown')}")
    return 0


def cmd_delete(args):
    """Permanently delete a workspace."""
    api_url = get_api_url()
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key.")
        return 1

    ws_id = args.workspace_id
    confirm = input(f"Delete workspace {ws_id}? This cannot be undone. [y/N]: ")
    if confirm.lower() != "y":
        print("Cancelled.")
        return 0

    data = api_post(f"/workspace/{ws_id}/delete", {}, api_key, api_url)
    if data.get("ok"):
        print(f"\u2713 Workspace {ws_id} deleted")
    else:
        print(f"Error: {data.get('error', 'unknown')}")
    return 0


def cmd_search(args):
    """Search within a workspace's state."""
    api_url = get_api_url()
    ws_id = args.workspace_id
    q = args.query

    data = api_post(f"/workspace/{ws_id}/search", {"q": q, "k": args.k}, "", api_url)
    if not data.get("ok"):
        print(f"Error: {data.get('error', 'unknown')}")
        return 1

    results = data.get("results", [])
    if not results:
        print(f"No matches for '{q}' in workspace {ws_id}")
        return 0

    print(f"\n{len(results)} match(es) for '{q}' in workspace {ws_id}:\n")
    for r in results:
        cat = r["category"]
        key = r["key"]
        snippet = r["snippet"]
        print(f"  [{cat}] {key}")
        print(f"    {snippet}")
        print()

    return 0


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Cross-machine workspace sync — pull/push/diff workspace bundles",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", help="Command to run")

    # list
    p_list = sub.add_parser("list", help="List active workspaces")
    p_list.add_argument("--status", default="active", help="Filter by status (active/paused/archived/all)")

    # pull
    p_pull = sub.add_parser("pull", help="Pull workspace to local directory")
    p_pull.add_argument("workspace_id", help="Workspace ID")
    p_pull.add_argument("dir", nargs="?", help="Local directory (default: ./<workspace_id>)")

    # push
    p_push = sub.add_parser("push", help="Push local changes to cloud")
    p_push.add_argument("dir", help="Local directory with .ws-manifest.json")

    # diff
    p_diff = sub.add_parser("diff", help="Diff local vs cloud state")
    p_diff.add_argument("dir", help="Local directory with .ws-manifest.json")

    # checkpoint
    p_cp = sub.add_parser("checkpoint", help="Checkpoint workspace state")
    p_cp.add_argument("dir", help="Local directory with .ws-manifest.json")
    p_cp.add_argument("message", nargs="?", help="Checkpoint message (fact summary)")
    p_cp.add_argument("--archive", action="store_true", help="Archive after checkpoint")

    # create
    p_create = sub.add_parser("create", help="Create new workspace")
    p_create.add_argument("name", help="Workspace name")
    p_create.add_argument("dir", nargs="?", help="Pull to this directory after creation")
    p_create.add_argument("--label", help="Optional category tag")

    # status
    sub.add_parser("status", help="Show pool status summary")

    # heartbeat
    p_hb = sub.add_parser("heartbeat", help="Send heartbeat for workspace")
    p_hb.add_argument("dir", help="Local directory with .ws-manifest.json")
    p_hb.add_argument("--agent", help="Agent/machine identifier")

    # claim
    p_claim = sub.add_parser("claim", help="Claim workspace for exclusive use")
    p_claim.add_argument("dir", help="Local directory with .ws-manifest.json")
    p_claim.add_argument("--agent", help="Agent/machine identifier")

    # release
    p_rel = sub.add_parser("release", help="Release claim on workspace")
    p_rel.add_argument("dir", help="Local directory with .ws-manifest.json")
    p_rel.add_argument("--agent", help="Agent/machine identifier")

    # stale-detect
    sub.add_parser("stale-detect", help="Find and auto-pause stale workspaces")

    # delete
    p_del = sub.add_parser("delete", help="Permanently delete a workspace")
    p_del.add_argument("workspace_id", help="Workspace ID to delete")

    # search
    p_search = sub.add_parser("search", help="Search within a workspace's state")
    p_search.add_argument("workspace_id", help="Workspace ID")
    p_search.add_argument("query", help="Search query (substring match)")
    p_search.add_argument("-k", type=int, default=10, help="Max results (default 10)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    commands = {
        "list": cmd_list,
        "pull": cmd_pull,
        "push": cmd_push,
        "diff": cmd_diff,
        "checkpoint": cmd_checkpoint,
        "create": cmd_create,
        "status": cmd_status,
        "heartbeat": cmd_heartbeat,
        "claim": cmd_claim,
        "release": cmd_release,
        "stale-detect": cmd_stale_detect,
        "delete": cmd_delete,
        "search": cmd_search,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main() or 0)
