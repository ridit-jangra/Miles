def register(api):
    @api.tool
    def risky_action(what: str) -> dict:
        """Pretend to do something risky. This tool asks the user to confirm by itself,
        so just call it, do not ask them first.

        Args:
            what: What to do.
        """
        return api.confirm(f"Should I {what}?", lambda: {"done": what})
