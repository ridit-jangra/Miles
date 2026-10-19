from collections.abc import Callable
from typing import Any

from miles.confirm.confirmer import DECLINED, Confirmer


class PluginContext:
    def __init__(self, name: str, config: dict, confirmer: Confirmer) -> None:
        self.name = name
        self.config = config
        self.tools = []
        self._confirmer = confirmer

    def tool(self, fn: Any) -> Any:
        self.tools.append(fn)
        return fn

    def confirm(self, question: str, action: Callable[[], Any], declined: str = DECLINED) -> dict:
        """Ask the user a yes/no question, and only run `action` if they say yes.

        Return the result from your tool: the LLM asks the question out loud, the
        user's answer is decided by code, and the LLM is told what happened.
        """
        return self._confirmer.request(question, action, declined)
