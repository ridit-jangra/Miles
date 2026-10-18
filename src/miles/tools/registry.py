TOOLS = []


def tool(fn):
    TOOLS.append(fn)
    return fn
