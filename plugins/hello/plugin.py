def register(api):
    @api.tool
    def say_hello(name: str) -> dict:
        """Greet someone by name.

        Args:
            name: The person's name.
        """
        return {"greeting": f"Hello {name}!"}
