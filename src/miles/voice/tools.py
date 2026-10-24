import asyncio
import inspect
from collections.abc import Callable

from pipecat.services.llm_service import FunctionCallParams

def to_pipecat(fn: Callable) -> Callable:
    sig = inspect.signature(fn)
    params_arg = inspect.Parameter(
        "params",
        inspect.Parameter.POSITIONAL_OR_KEYWORD,
        annotation=FunctionCallParams
    )

    async def wrapper(params: FunctionCallParams, **kwargs):
        result = fn(**kwargs)
        if inspect.isawaitable(result):
            result = await result
        if not isinstance(result, dict):
            result = {"result": result}
        await asyncio.sleep(0)
        await params.result_callback(result)

    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    wrapper.__signature__ = sig.replace(parameters=[params_arg, *sig.parameters.values()])
    wrapper.__annotations__ = {
        "params": FunctionCallParams,
        **{k: v for k, v in fn.__annotations__.items() if k != "return"}
    }

    return wrapper
