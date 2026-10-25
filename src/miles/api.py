import shutil
import tomllib
from time import time

from fastapi import APIRouter

from miles import state
from miles.config import load_config
from miles.env import MEMORY_DIR
from miles.memory.store import FactFile
from miles.plugins.loader import plugin_folders

router = APIRouter(prefix="/api")

def _facts() -> FactFile:
    return FactFile(MEMORY_DIR / "facts.md", load_config().memory.max_facts)

@router.get("/memory/facts")
def list_facts():
    out = []
    for item in _facts().items():
        day, source, text = item.split(" · ", 2)
        out.append({"id": item, "date": day, "source": source, "text": text})
    return out

@router.delete("/memory/facts")
def forget_fact(id: str):
    return {"removed": _facts().remove([id])}

def _view(t):
    end = t.ended or time()
    return {"id": t.id, "agent": t.agent, "text": t.task, "status": t.status,
        "took": int(end - t.started), "result": t.result, "error": t.error}

@router.get("/tasks")
def list_tasks():
    manager = state.current["tasks"]
    return [_view(t) for t in reversed(manager.tasks.values())] if manager else []

@router.delete("/tasks/{task_id}")
def cancel_task(task_id: str):
    manager = state.current["tasks"]
    return {"cancelled": bool(manager and manager.cancel(task_id))}


@router.get("/inbox")
def list_inbox():
    inbox = state.current["inbox"]
    if not inbox:
        return []
    now = time()
    return [
        {"id": a.id, "source": a.source, "text": a.text, "priority": a.priority, "age": int(now - a.created_at)}
        for a in reversed(inbox.unread())
    ]

@router.post("/inbox/{alert_id}/read")
def read_alert(alert_id: int):
    inbox = state.current["inbox"]
    if inbox:
        inbox.mark_read(alert_id)
    return {"ok": inbox is not None}

@router.get("/plugins")
def list_plugins():
    plugins = load_config().plugins
    out = []
    for folder in plugin_folders():
        manifest = folder / "plugin.toml"
        if not manifest.exists() or not (folder / "plugin.py").exists():
            continue
        meta = tomllib.loads(manifest.read_text())
        name = meta.get("name", folder.name)
        servers = meta.get("mcp", {})
        agents = sorted(p.stem for p in (folder / "agents").glob("*.md"))
        missing = [n for n, s in servers.items() if not shutil.which(s.get("command", ""))]
        if not plugins.enabled or name in plugins.disabled:
            plugin_state = "off"
        elif missing:
            plugin_state = "missing"
        else:
            plugin_state = "ready"
        parts = [
            meta.get("description", ""),
            f"MCP: {', '.join(servers)}" if servers else "",
            f"agents: {', '.join(agents)}" if agents else "",
        ]
        out.append({"name": name, "hint": " · ".join(p for p in parts if p) or "tools only", "state": plugin_state})
    return out
