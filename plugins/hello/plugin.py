def register(api):
    greeting = api.config.get("greeting", "Hello")

    @api.tool
    async def say_hello(name: str) -> dict:
        return {"greeting": f"{greeting} {name}"}
