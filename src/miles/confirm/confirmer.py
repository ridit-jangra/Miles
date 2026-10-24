import inspect
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from loguru import logger

from miles.confirm.answer import parse_answer

DECLINED = "The user said no, so nothing was done."


@dataclass
class Pending:
    question: str
    action: Callable[[], Any]
    declined: str
    expires_at: float
    retried: bool = False


class Confirmer:
    """Holds one pending yes/no question and decides it with plain code, not the LLM.

    A tool calls request(). The user's next spoken reply reaches handle_text()
    (through ConfirmProcessor), which runs the action on a yes, then tells the
    LLM what happened so it can report it.
    """

    def __init__(
        self,
        speak: Callable[[str], Awaitable[None]],
        inform: Callable[[str], None],
        timeout: float = 30,
    ) -> None:
        self.speak = speak      # Miles says this out loud
        self.inform = inform    # adds a message for the LLM to the conversation
        self.timeout = timeout  # seconds the user has to answer
        self._pending: Pending | None = None

    def request(self, question: str, action: Callable[[], Any], declined: str = DECLINED) -> dict:
        """Remember the question and the action to run on yes. Returns right away."""
        self._pending = Pending(question, action, declined, time.monotonic() + self.timeout)
        return {
            "status": "awaiting_confirmation",
            "instruction": (
                f"Ask the user this yes/no question out loud: {question!r}. "
                "Do not say the action is done. Their answer is handled automatically."
            ),
        }

    def cancel(self) -> None:
        self._pending = None

    async def handle_text(self, text: str) -> bool:
        """Returns True if the transcript should be swallowed (we are re-asking)."""
        pending = self._pending
        if pending is None:
            return False

        if time.monotonic() > pending.expires_at:
            self._pending = None
            self.inform("The confirmation timed out with no answer, so nothing was done.")
            return False

        answer = parse_answer(text)

        if answer == "yes":
            self._pending = None
            self.inform(await self._run(pending))
            return False

        if answer == "no":
            self._pending = None
            self.inform(pending.declined)
            return False

        if not pending.retried:
            pending.retried = True
            await self.speak("Sorry, yes or no?")
            return True

        self._pending = None
        self.inform("The user never gave a clear yes or no, so the action was cancelled and nothing was done.")
        return False

    async def _run(self, pending: Pending) -> str:
        try:
            result = pending.action()
            if inspect.isawaitable(result):
                result = await result
        except Exception as e:  # noqa: BLE001
            logger.exception("Confirmed action failed")
            return f"The user said yes, but the action failed: {e}"
        return f"The user said yes and the action was done. Result: {result}"
