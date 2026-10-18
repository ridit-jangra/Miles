from typing import Any


class PluginContext:
    def __init__(self, name: str, config: dict) -> None:
        self.name = name
        self.config = config
        self.tools = []

    def tool(self, fn: Any) -> Any:
        self.tools.append(fn)
        return fn
