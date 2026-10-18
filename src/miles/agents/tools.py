from collections.abc import Callable

from miles.agents.manager import TaskManager


def make_agent_tools(manager: TaskManager) -> list[Callable]:
    if not manager.agents:
        return []

    def delegate(agent: str, task: str) -> dict:
        try:
            t = manager.start(agent, task)
        except ValueError as e:
            return {"error": str(e)}
        return {"task_id": t.id, "status": t.status}

    available = "; ".join(f"{a.name}: {a.description}" for a in manager.agents.values())
    delegate.__doc__ = f"""Hand a job to a background agent and keep talking. Returns a task id right away.

    Available agents: {available}.

    Args:
        agent: Name of the agent to use.
        task: What the agent should do, with all the detail it needs.
    """

    def check_task(task_id: str) -> dict:
        """Check the status of a background task, and get its result if it is done.

        Args:
            task_id: The id returned by delegate.
        """
        t = manager.tasks.get(task_id)
        if not t:
            return {"error": f"No task {task_id!r}"}
        return {"task_id": t.id, "agent": t.agent, "status": t.status,
                "result": t.result, "error": t.error}

    def list_tasks() -> dict:
        """List all background tasks and their status."""
        return {"tasks": [{"task_id": t.id, "agent": t.agent, "status": t.status}
                          for t in manager.tasks.values()]}

    def cancel_task(task_id: str) -> dict:
        """Cancel a running background task.

        Args:
            task_id: The id returned by delegate.
        """
        return {"cancelled": manager.cancel(task_id)}

    return [delegate, check_task, list_tasks, cancel_task]
