from typing import Any

TOOLS = []

def tool(fn: Any) -> Any:
    TOOLS.append(fn)
    return fn
