from datetime import datetime

from miles.tools.registry import tool

# Tools are plain functions: take your arguments, return a value.
@tool
def get_time() -> dict:
    """Get the current local time."""
    return {"time": datetime.now().strftime("%H:%M")}
