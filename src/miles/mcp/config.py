from pydantic import BaseModel, model_validator


class McpServer(BaseModel):
    command: str | None = None
    args: list[str] = []
    env: dict[str, str] = {}
    url: str | None = None
    miles: bool = False
    tools: list[str] | None = None

    @model_validator(mode="after")
    def check_command_url(self):
        if (self.command is None) == (self.url is None):
            raise ValueError("Set exactly one of 'command' or 'url'")
        return self
