from datetime import datetime

from miles.tools.registry import tool
from pipecat.services.llm_service import FunctionCallParams

# Example function
@tool
async def get_time(params: FunctionCallParams):
    """Get the current local time."""
    await params.result_callback({"time": datetime.now().strftime("%H:%M")})
