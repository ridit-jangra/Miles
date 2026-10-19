from collections.abc import Callable

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    Frame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class ActivityTracker(FrameProcessor):
    def __init__(self, on_idle: Callable[[], None] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.user_speaking = False
        self.bot_speaking = False
        self.on_idle = on_idle

    @property
    def busy(self) -> bool:
        return self.user_speaking or self.bot_speaking

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        was_busy = self.busy

        if isinstance(frame, UserStartedSpeakingFrame):
            self.user_speaking = True
        elif isinstance(frame, UserStoppedSpeakingFrame):
            self.user_speaking = False
        elif isinstance(frame, BotStartedSpeakingFrame):
            self.bot_speaking = True
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self.bot_speaking = False

        if was_busy and not self.busy and self.on_idle:
            self.on_idle()

        await self.push_frame(frame, direction)
