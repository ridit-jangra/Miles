from miles import state
from miles.tools.registry import tool


def _repeater():
    return state.current["repeater"]


@tool
def repeat_task(agent: str, task: str, every: str, times: int = 0, start_now: bool = True) -> dict:
    """Run a background agent again and again on a timer, like "check this every 5 minutes". Each run is a normal background task and its result is reported when it finishes.

    Use when the user wants something done repeatedly. For a one-off job use delegate instead. The task text must be complete, because it is sent as it is every time.

    Args:
        agent: Name of the background agent that does the work.
        task: What the agent should do each time, with all the detail it needs.
        every: How often, like "30s", "5m" or "1h". At least 30 seconds.
        times: Stop after this many runs. 0 means keep going until stopped.
        start_now: True runs it right away and then every interval. False waits one interval first.
    """
    repeater = _repeater()
    if repeater is None:
        return {"error": "Repeating isn't available right now."}
    try:
        r = repeater.start(agent, task, every, times, start_now)
    except ValueError as e:
        return {"error": str(e)}
    return {"repeat_id": r.id, "agent": r.agent, "every": r.every, "runs_left": r.max_runs}


@tool
def list_repeats() -> dict:
    """List the jobs that are repeating on a timer."""
    repeater = _repeater()
    rows = [
        {"repeat_id": r.id, "agent": r.agent, "task": r.task, "every": r.every, "runs_so_far": r.runs}
        for r in (repeater.repeats.values() if repeater else [])
    ]
    return {"repeats": rows}


@tool
def stop_repeat(repeat_id: str) -> dict:
    """Stop a repeating job. A run already in progress finishes, but no new ones start.

    Args:
        repeat_id: The id returned by repeat_task.
    """
    repeater = _repeater()
    return {"stopped": bool(repeater and repeater.stop(repeat_id))}
