# Web Search Live Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a web-search answer is being prepared, show the steps as they finish (documents searched, keyword query, each page read or not openable) in a panel that collapses to the existing summary line.

**Architecture:** The AI service emits a new `step` SSE event before the first `delta`. `gather()` reports steps through an optional `on_step` callback; `chat_stream` runs it in a worker thread and yields each step as it arrives. The Go backend already forwards unknown events unchanged (`message_service.go`, `default: return emit(event)`), so it is not touched. The frontend collects steps in memory only; nothing is stored.

**Tech Stack:** Python (FastAPI, plain-assert test scripts run with `python -m app.<name>`), React + TypeScript (Vite), Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-16-web-search-design.md`, section "Addendum: live progress while the web is searched".

## Global Constraints

- Project rule (memory): do not commit or branch; the user pushes manually. No commit steps below.
- Step event wire shape: `event: step`, `data: {"kind": "documents" | "query" | "page", "ok": bool, "text": str, "url"?: str}`.
- Steps are emitted only when `web_search` is on. Web off must emit no `step` event and behave as today.
- Steps are never stored; the `done` payload is unchanged.
- UI copy is English, matching the existing UI.
- Python tests run from `ai-service/` with the venv active: `source .venv/bin/activate && python -m app.<test_module>`. Frontend checks run from the repo root: `npm run build` and `npm run lint`.

## Review Focus

- `gather` raises mid-way: the answer must still come from the documents with `web.status == "unavailable"`, and steps emitted before the failure must still reach the client (Task 3).
- Consumer stops early (client disconnects) while the worker thread runs: closing the generator must not hang or leak a blocked thread (Task 1).
- Web off: no `step` event at all (Task 3).
- A page title or address from the web is untrusted: render as text only, and make a link only for `http(s)` addresses (Task 4).
- A request aborted by the user or replaced by a new one must not leave its steps in the next request's panel (Task 4).
- Known gap, unchanged and out of scope: after a reload there is no web note (Task 4 states it in the code comment).

---

### Task 1: Run work in a thread and yield its progress

**Files:**
- Create: `ai-service/app/rag/progress.py`
- Create: `ai-service/app/test_progress.py`

**Interfaces:**
- Produces: `run_with_progress(work: Callable[[Callable[[dict], None]], T]) -> Generator[tuple[str, dict], None, T]`. It starts `work(on_step)` in a daemon thread; each dict passed to `on_step` is yielded as `("step", dict)` in order; when `work` returns, the generator returns that value; if `work` raised, the generator re-raises the same exception after yielding every step reported before it.

- [ ] **Step 1: Write the failing tests in `app/test_progress.py`** (plain-assert style like `app/test_web.py`: a `check(name, condition, detail="")` helper, `print("all progress checks passed")` at the end). Cases, each with its assertion:
  - steps come out in order and the return value is delivered: `work` calls `on_step({"n": 1})`, `on_step({"n": 2})`, returns `"r"`; drive the generator by hand (`for x in gen` collecting, then `StopIteration.value`, or wrap with `yield from` inside a small helper generator) and assert events `== [("step", {"n": 1}), ("step", {"n": 2})]` and result `== "r"`.
  - a step is yielded while `work` is still running: `work` reports a step then waits on a `threading.Event`; the first `next(gen)` returns that step before the event is set (set it afterwards so the thread ends).
  - exception: `work` reports one step then raises `RuntimeError("boom")`; the step is yielded first, then the generator raises `RuntimeError`.
  - early close: `work` reports a step then blocks on an Event with a 5 s wait; take one item, call `gen.close()`; assert `close()` returns within 1 s (measure with `time.monotonic()`), then set the Event so the thread exits.

- [ ] **Step 2: Run `python -m app.test_progress`** from `ai-service/`. Expected: fails with `ModuleNotFoundError: app.rag.progress`.

- [ ] **Step 3: Implement `run_with_progress` in `app/rag/progress.py`.** Use a `queue.Queue` and a daemon `threading.Thread`; the thread puts a sentinel (carrying the result or the exception) last. The generator loops on `queue.get()`, yielding steps, and returns or raises on the sentinel. Closing the generator must not join the thread (the daemon thread finishes on its own).

- [ ] **Step 4: Run `python -m app.test_progress`.** Expected: `all progress checks passed`.

### Task 2: `gather` reports its steps

**Files:**
- Modify: `ai-service/app/rag/web.py` (`gather`, around the URL fetch, query, search and page-fetch blocks)
- Modify: `ai-service/app/test_web.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `gather(question, search_query, document_results, llm=None, on_step=None) -> tuple[list[dict], dict]`. `on_step` is `Callable[[dict], None] | None`; when given it is called with step dicts of the wire shape above. Return values are unchanged.

- [ ] **Step 1: Add failing checks to `app/test_web.py`**, before the final `print`, using the existing fakes (`web.search`, `web.fetch_page`, `web.generate`) and a `steps = []` list passed as `on_step=steps.append`:
  - a normal search: the first step is `{"kind": "query", "ok": True, "text": <the query used>}`; each page that was read gives `{"kind": "page", "ok": True, "text": <page title>, "url": <url>}`; a hit whose page could not be read (`fetch_page` returns `None`) gives `{"kind": "page", "ok": False, "text": <host of the url>, "url": <url>}`. Assert the query step comes before every page step.
  - shorter-query fallback (reuse the `only_short` fake from the existing fallback test): two query steps, the second with the shortened text.
  - provider raises: one `{"kind": "query", "ok": False, "text": "Web search unavailable"}` step and `status["status"] == "unavailable"`.
  - a URL typed in the question that opens: a page step for it comes first, before the query step.
  - `on_step=None` (the existing calls) still works unchanged.

- [ ] **Step 2: Run `python -m app.test_web`.** Expected: FAIL on the first new check (`gather` does not accept `on_step`).

- [ ] **Step 3: Add the `on_step` parameter to `gather` and emit the steps.** Wrap it once (`emit = on_step or (lambda step: None)`). Emit the query step right after `build_query`, the fallback query step when `shorten_query` is used and finds results, one page step per page attempted (given URL, and each search hit after its fetch), and the failed query step when the provider raises. Keep `status` exactly as today.

- [ ] **Step 4: Run `python -m app.test_web`.** Expected: `all web checks passed`.

### Task 3: `chat_stream` sends the steps

**Files:**
- Modify: `ai-service/app/rag/chat.py` (the `if web_search:` block, about lines 179-186)
- Modify: `ai-service/app/test_chat_stream.py`

**Interfaces:**
- Consumes: `run_with_progress` (Task 1), `gather_web(..., on_step=...)` (Task 2).
- Produces: `chat_stream` yields `("step", {...})` events before the first `("delta", ...)` when `web_search` is true: first `{"kind": "documents", "ok": True, "text": "<n> passage(s) found in your documents"}` (n = `len(results)`, wording for 1 vs many is the builder's), then the steps from `gather`. `chat()` (non-stream) must still return the `done` payload only.

- [ ] **Step 1: Update `fake_gather` in `app/test_chat_stream.py`** to `fake_gather(question, search_query, results, llm=None, on_step=None)` and have it call `on_step({"kind": "query", "ok": True, "text": "biaya lomba esai"})` when given. Add failing checks:
  - web on: event names are `step` events first (documents, then query), then `delta`s, then exactly one `done`; the first step is the documents one with `ok` true.
  - web off: no `step` among the event names.
  - `gather` raises after reporting its query step: the query step is still yielded, the `done` has `web.status == "unavailable"`, and the answer still cites the document.
  - `chat(...)` with web on still equals the `done` payload.

- [ ] **Step 2: Run `python -m app.test_chat_stream`.** Expected: FAIL (no `step` events).

- [ ] **Step 3: In `chat_stream`, when `web_search` is on, yield the documents step, then call `gather_web` through `yield from run_with_progress(lambda on_step: gather_web(question, search_query, results, llm, on_step=on_step))`.** Keep the existing `try/except` that turns any failure into the `unavailable` status.

- [ ] **Step 4: Run `python -m app.test_chat_stream`, `python -m app.test_web`, `python -m app.test_progress`.** Expected: all three print their "passed" line.

### Task 4: Frontend panel

**Files:**
- Modify: `src/lib/chatStream.ts` (types, `StreamHandlers`, `dispatch`)
- Modify: `src/components/layout/MainChat.tsx` (`Message` type ~line 85, the send handler ~255-340, the waiting block ~710-722, the `message.web` note ~840-856)

**Interfaces:**
- Consumes: the `step` event wire shape.
- Produces in `chatStream.ts`: `export type StreamStep = { kind: "documents" | "query" | "page"; ok: boolean; text: string; url?: string }` and `StreamHandlers.onStep?(step: StreamStep): void`, called for each `step` event (unknown event names stay ignored).
- Produces in `MainChat.tsx`: `Message.steps?: StreamStep[]` (comment: this session only, not stored; after a reload there is no web note, only web sources); a `WebActivity` component taking `{ steps: StreamStep[]; web?: WebStatus; defaultOpen: boolean }`.

- [ ] **Step 1: In `chatStream.ts`**, add `StreamStep`, `onStep?` on `StreamHandlers`, and a `step` branch in `dispatch` that calls `handlers.onStep?.(parseJson<StreamStep>(ev.data, "step"))`.

- [ ] **Step 2: In `MainChat.tsx`, collect steps.** Keep a local `const steps: StreamStep[] = []` next to `assistantId` in the send handler and a `liveSteps` state (reset to `[]` at the start of each send and when the request ends, errors or is aborted). `onStep` ignores events once `controller.signal.aborted`, otherwise pushes and calls `setLiveSteps([...steps])`. When the assistant message is first created (in `onDelta` or `onDone`), include `steps` (undefined when empty) and clear `liveSteps`.

- [ ] **Step 3: Build `WebActivity`.** A button header with the `Globe2` icon, a chevron, and the summary text; extract the existing status/summary wording (unavailable, no results, "Searched the web for: ...", the requested/used URL suffix) into one function used by both the header and the old note, so the wording lives once. While there is no `web` yet (still waiting), the header reads "Searching the web...". Expanded, list the steps: ok steps with a check, failed with a cross; page steps show the title and the site name via `siteName(url)`. Render a page as a link (`target="_blank"`, `rel="noreferrer"`) only when its `url` starts with `http://` or `https://`; otherwise plain text. All text goes through React children, never `dangerouslySetInnerHTML`. `aria-expanded` on the header button.

- [ ] **Step 4: Wire it in.** In the waiting block, when `liveSteps.length > 0` render `<WebActivity steps={liveSteps} defaultOpen />` next to the typing dots instead of only `waitingLabel`. In `AssistantMessage`, when `message.steps?.length` render `<WebActivity steps={message.steps} web={message.web} defaultOpen={false} />` in place of the existing `message.web` note; messages without steps keep the old note unchanged.

- [ ] **Step 5: Run `npm run build` and `npm run lint`.** Expected: both exit 0 with no new errors.

- [ ] **Step 6: Restart the stack and check in the browser** (`./dev.sh stop` then `./dev.sh`; the AI service has no auto-reload). With web search on, ask a question about an uploaded document. Expected: the panel is open while waiting and fills line by line (documents, query, pages); once the first words appear it is collapsed to "Searched the web for: ..."; clicking it shows the steps and page links open in a new tab. Then: with web search off no panel appears; send a second question while the first is waiting and check the first one's steps do not show up under the second; reload the page and check no panel appears.

### Task 5: Docs

**Files:**
- Modify: `README.md` (only if it describes the web search flow; one line about the live steps)

- [ ] **Step 1: Check whether `README.md` mentions web search behavior** (`grep -n -i "web search" README.md`). If it does, add one line about the live step panel; if not, leave it unchanged.
