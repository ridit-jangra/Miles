from pathlib import Path

class PluginAPI:
    def __init__(self, name: str, config: dict) -> None:
        self.name = name
        self.config = config
        self.tools = []

    def tool(self, fn):
        self.tools.append(fn)
        return fn
