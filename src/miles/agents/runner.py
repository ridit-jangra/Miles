from collections.abc import Callable

from pydantic_ai import Agent
from pydantic_ai.models import Model
from pydantic_ai.usage import UsageLimits

from miles.agents.definition import AgentDef


async def run_agent(
    agent_def: AgentDef,
    task: str,
    tools: dict[str, Callable],
    model: Model,
    toolsets=(),
    memory=None,  # later; agent memory goes here
) -> str:
    missing = [name for name in agent_def.tools if name not in tools]
    if missing:
        raise ValueError(f"Agent {agent_def.name} asks for unknown tools: {missing}")

    agent = Agent(
        model,
        instructions=agent_def.prompt,
        tools=[tools[name] for name in agent_def.tools],
        toolsets=list(toolsets)
    )
    async with agent:
        result = await agent.run(task, usage_limits=UsageLimits(request_limit=agent_def.max_steps))
    return result.output
