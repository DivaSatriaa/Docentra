"""Checks that a cancelled SSE response closes the upstream generator.

Run with:  python -m app.test_stream_cancel
"""

import asyncio
import time

from app.api.routes import _sse_async


def check(name, condition, detail=""):
    assert condition, f"FAIL {name}: {detail}"
    print(f"ok  {name}")


class FakeResponse:
    def __init__(self):
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.closed = True


def make(response, flags, total=1000):
    def events():
        try:
            with response:
                for i in range(total):
                    flags["pulled"] = i + 1
                    time.sleep(0.02)
                    yield "delta", {"text": f"t{i}"}
                yield "done", {"answer": "x"}
        finally:
            flags["finally"] = True

    return events()


async def cancelled():
    response, flags = FakeResponse(), {}
    frames = []

    async def consume():
        async for frame in _sse_async(make(response, flags)):
            frames.append(frame)

    task = asyncio.create_task(consume())
    while not frames:
        await asyncio.sleep(0.01)
    await asyncio.sleep(0.05)  # cancel while a pull is in flight
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    check("cancel: got a frame first", len(frames) >= 1)
    check("cancel: generator finalized", flags.get("finally") is True, flags)
    check("cancel: response closed", response.closed)
    check("cancel: stopped early", flags["pulled"] < 100, flags)


async def complete():
    response, flags = FakeResponse(), {}
    frames = [f async for f in _sse_async(make(response, flags, total=3))]
    check("complete: all frames", len(frames) == 4, len(frames))
    check("complete: wire format", frames[0] == 'event: delta\ndata: {"text": "t0"}\n\n', frames[0])
    check("complete: ends with done", frames[-1].startswith("event: done\n"))
    check("complete: response closed", response.closed and flags.get("finally"))


asyncio.run(cancelled())
asyncio.run(complete())
print("all stream cancel checks passed")
