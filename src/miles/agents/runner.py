import os
from collections.abc import Callable

from pydantic_ai import Agent
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from pydantic_ai.usage import UsageLimits

from miles.agents.definition import AgentDef


async def run_agent(
    agent_def: AgentDef,
    task: str,
    tools: dict[str, Callable],
    default_model: str,
    toolsets=(),
    memory=None,  # later; agent memory goes here
) -> str:
    missing = [name for name in agent_def.tools if name not in tools]
    if missing:
        raise ValueError(f"Agent {agent_def.name} asks for unknown tools: {missing}")

    model = OpenRouterModel(
        agent_def.model or default_model,
        provider=OpenRouterProvider(api_key=os.getenv("OPENROUTER_API_KEY")),
    )
    agent = Agent(
        model,
        instructions=agent_def.prompt,
        tools=[tools[name] for name in agent_def.tools],
        toolsets=list(toolsets)
    )
    async with agent:
        result = await agent.run(task, usage_limits=UsageLimits(request_limit=agent_def.max_steps))
    return result.output
