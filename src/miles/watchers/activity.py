import asyncio
from collections.abc import Callable

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    Frame,
    FunctionCallCancelFrame,
    FunctionCallInProgressFrame,
    FunctionCallResultFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class ActivityTracker(FrameProcessor):
    """Watches the pipeline and knows when Miles is busy: someone is speaking, the LLM
    is thinking or running a tool, or a reply is about to start.

    Put it after transport.output(). It never changes a frame, it only looks.
    """

    def __init__(
        self,
        on_idle: Callable[[], None] | None = None,
        response_timeout: float = 10,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.user_speaking = False
        self.bot_speaking = False
        self.llm_running = False
        self.tools_running = 0
        self.expecting_response = False  # a reply is on its way but has not started yet
        self.on_idle = on_idle           # called once when busy turns into idle
        self.response_timeout = response_timeout
        self._timer: asyncio.TimerHandle | None = None

    @property
    def busy(self) -> bool:
        return (
            self.user_speaking
            or self.bot_speaking
            or self.llm_running
            or self.tools_running > 0
            or self.expecting_response
        )

    def expect_response(self) -> None:
        """Call this right before something makes the LLM respond (a greeting, an alert).

        Between "asked the LLM" and "the LLM started answering" nothing is speaking, so
        without this the tracker would think Miles is idle and a second reply could start.
        """
        self.expecting_response = True
        self._arm_timer()

    def _arm_timer(self) -> None:
        self._cancel_timer()
        self._timer = asyncio.get_running_loop().call_later(self.response_timeout, self._give_up)

    def _cancel_timer(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def _give_up(self) -> None:
        # the reply never came (turn swallowed, error...), don't stay busy forever
        was_busy = self.busy
        self._timer = None
        self.expecting_response = False
        self._notify_if_idle(was_busy)

    def _notify_if_idle(self, was_busy: bool) -> None:
        if was_busy and not self.busy and self.on_idle:
            self.on_idle()

    def _response_started(self) -> None:
        self.expecting_response = False
        self._cancel_timer()

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        was_busy = self.busy

        if isinstance(frame, UserStartedSpeakingFrame):
            self.user_speaking = True
            self._response_started()   # the user is talking now, any old reply is moot
        elif isinstance(frame, UserStoppedSpeakingFrame):
            self.user_speaking = False
            self.expect_response()     # a reply should follow
        elif isinstance(frame, LLMFullResponseStartFrame):
            self.llm_running = True
            self._response_started()
        elif isinstance(frame, LLMFullResponseEndFrame):
            self.llm_running = False
        elif isinstance(frame, BotStartedSpeakingFrame):
            self.bot_speaking = True
            self._response_started()
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self.bot_speaking = False
        elif isinstance(frame, FunctionCallInProgressFrame):
            self.tools_running += 1
        elif isinstance(frame, (FunctionCallResultFrame, FunctionCallCancelFrame)):
            self.tools_running = max(0, self.tools_running - 1)
            if isinstance(frame, FunctionCallResultFrame):
                self.expect_response()  # the LLM runs again with the tool result

        self._notify_if_idle(was_busy)

        await self.push_frame(frame, direction)
