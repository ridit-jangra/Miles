import os

from pydantic_ai.exceptions import UserError
from pydantic_ai.models import Model, infer_model
from pydantic_ai.providers import infer_provider, infer_provider_class

PROVIDERS = {
    "openrouter": "openrouter",
    "openai": "openai",
    "openai-responses": "openai-responses",
    "anthropic": "anthropic",
    "google": "google",
    "aws": "bedrock",
    "azure": "azure",
    "cerebras": "cerebras",
    "crusoe": "crusoe",
    "deepseek": "deepseek",
    "fireworks": "fireworks",
    "grok": "xai",
    "groq": "groq",
    "mistral": "mistral",
    "nebius": "nebius",
    "ollama": "ollama",
    "sambanova": "sambanova",
    "together": "together",
    "qwen": "alibaba",
}

EXTRAS = {"anthropic": "anthropic", "bedrock": "bedrock", "google": "google", "groq": "groq", "mistral": "mistral", "xai": "xai", "cerebras": "cerebras", "openrouter": "openrouter"}


def build_model(provider: str, name: str, api_key_env: str | None = None) -> Model:
    head, _, rest = name.partition(":")
    if rest and head in PROVIDERS:
        provider, name = head, rest

    prefix = PROVIDERS.get(provider)
    if prefix is None:
        raise ValueError(f"Unknown provider {provider!r} for agents; choose from: {sorted(PROVIDERS)}")

    def factory(pydantic_name: str):
        key = os.getenv(api_key_env or "LLM_API_KEY")
        if api_key_env and not key:
            raise ValueError(f"{api_key_env} is not set in your .env file")
        if key:
            try:
                return infer_provider_class(pydantic_name)(api_key=key)
            except TypeError:
                if api_key_env:
                    raise
        return infer_provider(pydantic_name)

    try:
        return infer_model(f"{prefix}:{name}", provider_factory=factory)
    except ImportError as e:
        extra = EXTRAS.get(prefix, "openai")
        raise ValueError(f'The {provider!r} provider is not installed. Install it with: uv add "pydantic-ai-slim[{extra}]"') from e
    except UserError as e:
        raise ValueError(f"Could not set up the {provider!r} model {name!r}: {e}") from e
