def register(api):
    @api.tool
    async def say_hello(params, name: str):
        """Greet someone by name.

        Args:
            name: The person's name.
        """
        await params.result_callback({"greeting": f"Hello {name}!"})
