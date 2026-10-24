from pipecat.frames.frames import Frame, TranscriptionFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from miles.confirm.confirmer import Confirmer


class ConfirmProcessor(FrameProcessor):
    def __init__(self, confirmer: Confirmer, **kwargs):
        super().__init__(**kwargs)
        self.confirmer = confirmer

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and await self.confirmer.handle_text(frame.text):
            return  # the Confirmer is re-asking, the LLM shouldn't see this one

        await self.push_frame(frame, direction)
