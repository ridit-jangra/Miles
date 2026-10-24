from pathlib import Path

import yaml
from loguru import logger
from pydantic import BaseModel


class AgentDef(BaseModel):
    name: str
    description: str = ""
    model: str | None = None
    tools: list[str] = []
    max_steps: int = 10
    prompt: str
    mcp: list[str] = []
    plugin: str = ""
    memory: bool = False


def load_agent(path: Path) -> AgentDef:
    _, front, body = path.read_text().split("---", 2)
    return AgentDef(**yaml.safe_load(front), prompt=body.strip())


def load_agents(agents_dir: Path) -> dict[str, AgentDef]:
    agents = {}
    for path in sorted(agents_dir.glob("*.md")):
        try:
            agent = load_agent(path)
            agents[agent.name] = agent
        except Exception:  # noqa: BLE001
            logger.exception(f"Failed to load agent {path.name}")
    return agents
