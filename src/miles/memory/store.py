import json
import re
import sqlite3
import time
from datetime import date
from pathlib import Path

from miles.context import SECRET_PATTERN


def _normal(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def item_text(item: str) -> str:
    return item.split(" · ", 2)[-1]


class FactFile:
    def __init__(self, path: Path, max_items: int) -> None:
        self.path = path
        self.max_items = max_items

    def items(self) -> list[str]:
        if not self.path.exists():
            return []
        return [line[2:] for line in self.path.read_text().splitlines() if line.startswith("- ")]

    def _save(self, items: list[str]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text("".join(f"- {item}\n" for item in items))

    def add(self, text: str, source: str = "said") -> str:
        text = " ".join(text.split())
        if not text:
            return "rejected: empty"
        if SECRET_PATTERN.search(text):
            return "rejected: looks like a secret"
        items = self.items()
        wanted = _normal(text)
        if any(_normal(item_text(item)) == wanted for item in items):
            return "duplicate"
        if len(items) >= self.max_items:
            return "rejected: memory is full"
        items.append(f"{date.today().isoformat()} · {source} · {text}")
        self._save(items)
        return "saved"

    def block(self, max_chars: int, title: str) -> str:
        lines = []
        used = 0
        for item in reversed(self.items()):
            text = item_text(item)
            if used + len(text) + 3 > max_chars:
                break
            lines.append(f"- {text}")
            used += len(text) + 3
        if not lines:
            return ""
        return f"{title}\n" + "\n".join(lines)

    def find(self, query: str) -> list[str]:
        words = [w for w in _normal(query).split() if len(w) > 2]
        if not words:
            return []
        scored = [(sum(w in _normal(item_text(item)) for w in words), item) for item in self.items()]
        best = max((score for score, _ in scored), default=0)
        if best == 0:
            return []
        return [item for score, item in scored if score == best]

    def remove(self, matches: list[str]) -> int:
        items = self.items()
        keep = [item for item in items if item not in matches]
        self._save(keep)
        return len(items) - len(keep)


class MemoryStore:
    def __init__(self, directory: Path, max_facts: int = 200) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self.facts = FactFile(directory / "facts.md", max_facts)
        self.recap_path = directory / "last_session.json"
        self.db = sqlite3.connect(directory / "history.db", check_same_thread=False)
        self.db.executescript("""
        create table if not exists turns(id integer primary key, session text, ts real, role text, text text);
        create virtual table if not exists turns_fts using fts5(text, content='turns', content_rowid='id');
        create trigger if not exists turns_ai after insert on turns begin
            insert into turns_fts(rowid, text) values (new.id, new.text);
        end;
        create trigger if not exists turns_ad after delete on turns begin
            insert into turns_fts(turns_fts, rowid, text) values ('delete', old.id, old.text);
        end;
        """)

    def agent_notes(self, name: str, max_items: int = 50) -> FactFile:
        safe = re.sub(r"[^a-z0-9_-]", "", name.lower()) or "agent"
        return FactFile(self.directory / "agents" / f"{safe}.md", max_items)

    def log(self, session: str, role: str, text: str) -> None:
        text = text.strip()
        if not text:
            return
        self.db.execute(
            "insert into turns(session, ts, role, text) values (?, ?, ?, ?)",
            (session, time.time(), role, text),
        )
        self.db.commit()

    def search(self, query: str, limit: int = 5) -> list[dict]:
        words = re.findall(r"\w+", query)
        if not words:
            return []
        match = " ".join(f'"{w}"' for w in words)
        rows = self.db.execute(
            "select t.ts, t.role, t.text from turns_fts f join turns t on t.id = f.rowid "
            "where turns_fts match ? order by rank limit ?",
            (match, limit),
        ).fetchall()
        return [{"ts": ts, "role": role, "text": text} for ts, role, text in rows]

    def prune(self, days: int | str) -> int:
        if days == "never":
            return 0
        cursor = self.db.execute("delete from turns where ts < ?", (time.time() - days * 86400,))
        self.db.commit()
        return cursor.rowcount

    def turns(self, session: str) -> list[tuple[str, str]]:
        rows = self.db.execute("select role, text from turns where session = ? order by id", (session,)).fetchall()
        return [(role, text) for role, text in rows]

    def previous_session(self, current: str) -> tuple[str, float] | None:
        row = self.db.execute(
            "select session, max(ts) from turns where session != ? group by session order by max(ts) desc limit 1",
            (current,),
        ).fetchone()
        return (row[0], row[1]) if row else None

    def read_recap(self) -> dict | None:
        try:
            return json.loads(self.recap_path.read_text())
        except (OSError, ValueError):
            return None

    def write_recap(self, session: str, summary: str) -> None:
        self.recap_path.write_text(json.dumps({"session": session, "summary": summary}))

    def close(self) -> None:
        self.db.close()
