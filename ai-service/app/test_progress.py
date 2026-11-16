"""Checks for the progress helper.

Run with:  python -m app.test_progress
"""

import threading
import time

from app.rag.progress import run_with_progress


def check(name, condition, detail=""):
    assert condition, f"FAIL {name}: {detail}"
    print(f"ok  {name}")


def drain(gen):
    """Collect every yielded event and the generator's return value."""
    events = []
    while True:
        try:
            events.append(next(gen))
        except StopIteration as stop:
            return events, stop.value


# --- steps in order, return value delivered
def work_ok(on_step):
    on_step({"n": 1})
    on_step({"n": 2})
    return "r"


events, result = drain(run_with_progress(work_ok))
check("steps in order", events == [("step", {"n": 1}), ("step", {"n": 2})], str(events))
check("return value", result == "r", str(result))

# --- a step arrives while work is still running
release = threading.Event()


def work_blocking(on_step):
    on_step({"n": 1})
    release.wait(5)
    return "done"


gen = run_with_progress(work_blocking)
first = next(gen)
check("step before work ends", first == ("step", {"n": 1}) and not release.is_set(), str(first))
release.set()
events, result = drain(gen)
check("blocking work finishes", events == [] and result == "done", f"{events} {result}")


# --- exception re-raised after the earlier step
def work_boom(on_step):
    on_step({"n": 1})
    raise RuntimeError("boom")


gen = run_with_progress(work_boom)
check("step before exception", next(gen) == ("step", {"n": 1}))
try:
    next(gen)
    raised = None
except RuntimeError as exc:
    raised = exc
check("exception re-raised", raised is not None and str(raised) == "boom", repr(raised))

# --- closing early does not wait for the thread
hold = threading.Event()


def work_slow(on_step):
    on_step({"n": 1})
    hold.wait(5)


gen = run_with_progress(work_slow)
next(gen)
start = time.monotonic()
gen.close()
elapsed = time.monotonic() - start
check("close returns fast", elapsed < 1, f"{elapsed:.2f}s")
hold.set()

print("all progress checks passed")
