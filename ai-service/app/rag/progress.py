"""Run blocking work in a thread and yield the progress it reports."""

import queue
import threading
from typing import Callable, Generator, TypeVar

T = TypeVar("T")

_STEP = "step"
_DONE = "done"
_ERROR = "error"


def run_with_progress(
    work: Callable[[Callable[[dict], None]], T],
) -> Generator[tuple[str, dict], None, T]:
    """Start work(on_step) in a daemon thread.

    Each dict passed to on_step is yielded as ("step", dict), in order. When
    work returns, the generator returns its value; if work raised, the same
    exception is re-raised after every step reported before it. Closing the
    generator early does not wait for the thread.
    """
    events: queue.Queue = queue.Queue()

    def on_step(step: dict) -> None:
        events.put((_STEP, step))

    def runner() -> None:
        try:
            result = work(on_step)
        except BaseException as exc:
            events.put((_ERROR, exc))
        else:
            events.put((_DONE, result))

    threading.Thread(target=runner, daemon=True).start()

    while True:
        kind, payload = events.get()
        if kind == _STEP:
            yield (_STEP, payload)
        elif kind == _ERROR:
            raise payload
        else:
            return payload
