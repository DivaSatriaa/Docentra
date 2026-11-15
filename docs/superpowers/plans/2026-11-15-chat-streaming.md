# Chat Answer Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream the assistant's answer word by word from every LLM provider to the chat UI, while keeping citation verification intact.

**Architecture:** The AI service gains a streaming chat endpoint that emits SSE events (`delta`, `done`, `error`); `[S..]` labels are stripped from the delta stream server-side and the `done` event carries the final verified answer and citations. The Go backend proxies the stream on a new endpoint and saves the assistant message only when `done` arrives. The frontend reads the stream with `fetch`, shows the existing "Reading..." indicator until the first delta, then renders the growing message and swaps in the verified answer on `done`.

**Tech Stack:** Python/FastAPI (`StreamingResponse`, `requests` streaming), Go/Gin (SSE with `Flush`), React 19 + TypeScript (`fetch` + `ReadableStream`).

**Spec:** `docs/superpowers/specs/2026-11-15-chat-streaming-design.md`

## Global Constraints

- Event names are exactly `delta`, `done`, `error`; wire format is `event: <name>\ndata: <json>\n\n`.
- `delta` data: `{"text": string}`. `error` data: `{"message": string}`. AI-service `done` data: `{answer, citations, search_query, scope}` (same shape `chat()` returns today). Backend `done` adds `message_id`.
- New endpoints: AI service `POST /internal/chat/stream`; backend `POST /conversations/:id/messages/stream`. Existing `POST /internal/chat` and `POST /conversations/:id/messages` stay unchanged.
- Backend streaming headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`; flush after every event.
- The assistant message is saved only on `done`, never from partial text.
- Title generation and `rewrite_query` stay non-streaming (`llm.generate`).
- No Stop button, no reasoning display, no stream resume.
- Python tests follow the repo style: runnable scripts (`python -m app.test_x`) with plain `assert`, no network, no DB.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Do not stage the pre-existing uncommitted `.gitignore` change.

## Review Focus

1. A bracket that is not a label (`[2026]`, a lone `[`, `[abc]`) must reach the user intact. Pinned in Task 1.
2. A label split across chunks (`"[S"`, `"1]"`) must never leak a partial `[S`. Pinned in Task 1.
3. Retrieval finds nothing: only `done` is sent, no deltas, and the UI must still render the message. Pinned in Task 3 (events) and Task 7 (UI path).
4. Provider fails (bad key, 401) before the first token: an `error` event, not a hang or a half message. Pinned in Task 3 and Task 4.
5. Browser disconnects or navigates away mid-answer: the upstream call is cancelled and nothing is saved. Verified in Task 8.

---

### Task 0: Branch

- [ ] **Step 1:** From the current `feat/source-viewer` HEAD (not yet merged), run `git switch -c feat/chat-streaming`. Expected: `git branch --show-current` prints `feat/chat-streaming`.
- [ ] **Step 2:** Commit the spec and this plan: `git add docs/superpowers && git commit -m "docs: chat streaming design and plan"` (with the Co-Authored-By line).

### Task 1: Label-hiding stream filter

**Files:**
- Create: `ai-service/app/rag/stream.py`
- Test: `ai-service/app/test_stream_filter.py`

**Interfaces:**
- Consumes: `_GROUP`, `_numbers` from `app.rag.citations` (a bracket group is a label iff `_numbers(group_body)` is not `None`).
- Produces: `hide_labels(deltas: Iterable[str]) -> Iterator[str]`. Concatenating its output equals the input with every citation-like bracket group removed. Constant `MAX_HOLD = 120` (chars buffered from an open `[`).

- [ ] **Step 1: Write the failing tests** in `test_stream_filter.py`, a helper `run(chunks) -> str` joining the output:
  - `run(["Halo [S1] dunia"]) == "Halo  dunia"`
  - split label: `run(["Halo [S", "1]", " dunia"]) == "Halo  dunia"`, and no yielded chunk ever contains `"[S"` on its own.
  - multi/combined: `run(["a [S1][S2, S3]."]) == "a ."`
  - bare number is kept: `run(["tahun [2026] ini"]) == "tahun [2026] ini"` and `run(["[S2]"]) == ""`. The filter hides only groups with an `S`/`source`/`sumber` prefix, because a bare `[2]` cannot be told apart from document content mid-stream. A model that cites as bare `[1]` will show it briefly until `done` replaces the text; this is accepted (the prompt asks for `[S<number>]`).
  - plain bracket: `run(["lihat [abc] ya"]) == "lihat [abc] ya"`.
  - unterminated: `run(["teks [S1"]) == "teks [S1"` (flushed at end of stream).
  - hold cap: a `[` followed by 200 non-bracket chars flushes without waiting for `]`.
- [ ] **Step 2:** Run `cd ai-service && python -m app.test_stream_filter`. Expected: fails with `ModuleNotFoundError: app.rag.stream`.
- [ ] **Step 3:** Implement `hide_labels` in `stream.py`. Approach: keep a buffer that starts at an unmatched `[`; when `]` closes it, drop the group only if its body matches `_BODY` **and** contains an `S`/`source`/`sumber` prefix (bare-number groups are kept, matching the `[2026]` rule in `renumber`); when the buffer exceeds `MAX_HOLD` or a second `[` appears, flush it as text; flush any remainder at end of input.
- [ ] **Step 4:** Re-run the script. Expected: prints `ok`.
- [ ] **Step 5:** Commit `feat(ai): hide source labels from streamed text`.

### Task 2: Provider streaming in `llm.py`

**Files:**
- Modify: `ai-service/app/rag/llm.py`
- Test: `ai-service/app/test_llm_stream.py`

**Interfaces:**
- Produces: `generate_stream(prompt: str, llm: dict | None = None) -> Iterator[str]` yielding text deltas, same provider/model/key validation and errors as `generate`. Pure line parsers (each takes `Iterable[str]` of decoded lines, yields `str`): `_ollama_deltas`, `_openai_deltas`, `_anthropic_deltas`.

- [ ] **Step 1: Write the failing tests** with canned lines:
  - Ollama NDJSON: `['{"response":"Ha"}', '{"response":"lo"}', '{"response":"","done":true}']` → `["Ha","lo"]`.
  - OpenAI SSE: `['data: {"choices":[{"delta":{"content":"Ha"}}]}', '', 'data: {"choices":[{"delta":{}}]}', 'data: {"choices":[{"delta":{"content":"lo"}}]}', 'data: [DONE]']` → `["Ha","lo"]` (empty deltas and blank lines skipped, `[DONE]` stops).
  - Anthropic SSE: lines `event: content_block_delta` / `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Ha"}}`, plus an unrelated `event: ping` → only text deltas yielded.
  - Mid-stream provider error object (`data: {"error":{"message":"boom"}}` for OpenAI-style, `{"type":"error","error":{"message":"boom"}}` for Anthropic, `{"error":"boom"}` for Ollama) raises `RuntimeError` containing `boom`.
  - `generate_stream(..., {"provider":"openai","model":"m"})` raises `ValueError` mentioning the API key (consumed with `list(...)` since it is a generator).
- [ ] **Step 2:** Run `python -m app.test_llm_stream`. Expected: fails (`generate_stream` undefined).
- [ ] **Step 3:** Implement the three parsers and `generate_stream`. Each provider path calls `requests.post(..., stream=True, timeout=...)` with the same URL/headers/body as the non-stream version plus `stream: true` (Ollama: `"stream": True` in the same JSON; OpenAI-compatible: add `"stream": True`; Anthropic: add `"stream": True`), runs `_raise_for_status`, and feeds `response.iter_lines(decode_unicode=True)` to the parser. Share the provider-selection/validation code with `generate` by extracting a helper rather than duplicating it.
- [ ] **Step 4:** Re-run the script. Expected: `ok`. Also re-run `python -m app.test_citations` to confirm nothing else broke.
- [ ] **Step 5:** Commit `feat(ai): stream completions from every provider`.

### Task 3: `chat_stream` and the streaming route

**Files:**
- Modify: `ai-service/app/rag/generation.py`, `ai-service/app/rag/chat.py`, `ai-service/app/api/routes.py`
- Test: `ai-service/app/test_chat_stream.py`

**Interfaces:**
- Consumes: `hide_labels` (Task 1), `generate_stream` (Task 2).
- Produces:
  - `generate_answer_stream(question: str, context: str, llm: dict | None = None) -> Iterator[str]` in `generation.py`, using the same prompt as `generate_answer` (move the prompt into a shared `_build_prompt(question, context)`).
  - `chat_stream(question, *, workspace_id, history=None, document_ids=None, collection_id=None, top_k=5, llm=None) -> Iterator[tuple[str, dict]]` yielding `("delta", {"text": str})`, then one `("done", {...same dict chat() returns...})`. Raises like `chat()` does; the route turns exceptions into an `error` event.
  - `chat(...)` keeps its signature and returns the `done` dict by consuming `chat_stream`.
  - Route `POST /internal/chat/stream` (same `ChatRequest` body) returning `StreamingResponse(media_type="text/event-stream")`, headers `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

- [ ] **Step 1: Write the failing tests**, patching module globals on `app.rag.chat` (`match_documents`, `list_documents`, `rewrite_query`, `create_embeddings`, `hybrid_search_chunks`, `scope_text_length`, `document_chunks`, `generate_answer_stream`) with fakes returning two canned chunks:
  - Normal: fake model streams `["Biaya ", "Rp45.000 ", "[S", "1]."]` → events are `delta`s whose joined text has no `[S`, then one `done` whose `answer` contains `[1]` and whose `citations` has one item with `document_id`, `page`, `snippet`; `done.answer` is computed from the **raw** text (labels included), not the filtered stream.
  - Nothing found: `hybrid_search_chunks` returns `[]` → exactly one event, `done`, with `citations == []` and the `not_found_message` text; no `delta`.
  - Cannot-answer: model text "I don't have enough information..." → `done.citations == []`, `done.answer` unchanged.
  - `chat(...)` returns a dict equal to the `done` payload (same keys: `answer, citations, search_query, scope`).
  - Empty question raises `ValueError` on first `next()`.
- [ ] **Step 2:** Run `python -m app.test_chat_stream`. Expected: fails (`chat_stream` undefined).
- [ ] **Step 3:** Refactor `chat.py`: move everything before generation into the generator, stream `hide_labels(generate_answer_stream(...))` as `delta`s while accumulating the raw chunks, then run the existing verification/renumber/citation-building code on the joined raw text and yield `done`. No behavior change to retrieval or verification.
- [ ] **Step 4:** Add the route in `routes.py`: a sync generator `_sse(events)` formatting `event: X\ndata: <json, ensure_ascii=False>\n\n`; wrap `chat_stream` so any exception yields `("error", {"message": str(e)})` and ends. Pass `request.llm.model_dump()` like the existing route.
- [ ] **Step 5:** Re-run the script and `python -m app.test_citations`. Expected: `ok` for both. Start the service (`uvicorn app.main:app --port 8000` from `ai-service`, venv active) and run `curl -N -X POST localhost:8000/internal/chat/stream -H 'Content-Type: application/json' -d '{"question":"hi","workspace_id":"5400fe40-1e5a-4d63-9ffe-06fb12621540"}'`. Expected: SSE frames end with `event: done` or `event: error` (never hangs).
- [ ] **Step 6:** Commit `feat(ai): streaming chat endpoint`.

### Task 4: Go AI client stream reader

**Files:**
- Modify: `backend/internal/client/ai_client.go`
- Test: `backend/internal/client/ai_client_stream_test.go`

**Interfaces:**
- Produces:
  - `type StreamEvent struct { Event string; Data json.RawMessage }`
  - `type StreamDone struct { ChatResponse; MessageID string \`json:"message_id,omitempty"\` }`
  - `func readSSE(r io.Reader, onEvent func(StreamEvent) error) error` (unexported, tested directly): parses frames separated by blank lines, supports `event:` and (multi-line) `data:`, ignores comment lines starting with `:`, returns `onEvent`'s error immediately.
  - `func (c *AIClient) ChatStream(ctx context.Context, request ChatRequest, onEvent func(StreamEvent) error) error`: POSTs to `/internal/chat/stream`, non-2xx → `fmt.Errorf("AI chat service returned HTTP %d", code)`, then `readSSE` on the body. Same `TopK` default as `Chat`. Uses `ctx` so cancelling it aborts the upstream request.

- [ ] **Step 1: Write the failing tests** in `ai_client_stream_test.go` (package `client`): `readSSE` over `"event: delta\ndata: {\"text\":\"Ha\"}\n\nevent: done\ndata: {\"answer\":\"x\"}\n\n"` yields two events with names `delta`, `done` and exact `Data`; a frame split across two `Read` calls (use `iotest.OneByteReader`) parses the same; a `: keepalive` comment line is ignored; `onEvent` returning an error stops parsing and is returned; input ending without a trailing blank line still delivers the last complete frame.
- [ ] **Step 2:** Run `cd backend && go test ./internal/client/`. Expected: FAIL (`undefined: readSSE`).
- [ ] **Step 3:** Implement `readSSE`, the two types, and `ChatStream` in `ai_client.go` (add the `io`/`bufio` imports). Use `bufio.Reader.ReadString('\n')`-style line reading so large `done` payloads (long citation lists) are not truncated by `bufio.Scanner`'s default token limit.
- [ ] **Step 4:** Run `go test ./internal/client/` and `go vet ./...`. Expected: PASS, no vet output.
- [ ] **Step 5:** Commit `feat(backend): AI client stream reader`.

### Task 5: Backend service, handler and route

**Files:**
- Modify: `backend/internal/service/message_service.go`, `backend/internal/handler/message_handler.go`, `backend/internal/router/router.go`

**Interfaces:**
- Consumes: `client.StreamEvent`, `client.StreamDone`, `AIClient.ChatStream` (Task 4).
- Produces:
  - `func (s *MessageService) ChatStream(ctx context.Context, conversationID, content string, llm *client.LLMConfig, documentIDs []string, emit func(client.StreamEvent) error) error`. Validation, conversation lookup, history and user-message save are identical to `Chat` and happen **before** any `emit`; their errors are returned without emitting. `delta` events are forwarded as-is. On the AI `done`: decode into `client.StreamDone`, save the assistant message with the answer and `json.Marshal`ed citations (same as `Chat`), set `MessageID`, and emit a `done` event with the re-marshaled payload. On AI `error`: forward it. If saving fails: emit an `error` event and return nil.
  - `func (h *MessageHandler) CreateStream(c *gin.Context)`; same request struct as `Create`. SSE headers are written lazily on the first `emit`. If `ChatStream` returns an error before any emit: respond with JSON exactly like `Create` (404 for `"conversation not found"`, else 500). If it returns an error after emitting: write one `error` event and end.
  - Route: `conversations.POST("/:id/messages/stream", messageHandler.CreateStream)`.

- [ ] **Step 1:** Implement the service method, handler and route. After each emit, call `c.Writer.Flush()`.
- [ ] **Step 2:** Run `cd backend && go build ./... && go vet ./...`. Expected: no output.
- [ ] **Step 3:** With Postgres, AI service and backend running, create a conversation and run `curl -N -X POST localhost:8080/api/v1/conversations/<id>/messages/stream -H 'Content-Type: application/json' -d '{"content":"hello"}'`. Expected: `delta` frames arrive incrementally (not all at once), the last frame is `event: done` with a `message_id`, and `GET .../messages` shows the assistant message. A bad conversation id returns JSON 404/500, not an SSE stream.
- [ ] **Step 4:** Commit `feat(backend): streaming message endpoint`.

### Task 6: Frontend stream client

**Files:**
- Create: `src/lib/chatStream.ts`

**Interfaces:**
- Produces:
  - `type StreamDonePayload = { answer: string; citations: Citation[]; search_query: string; scope: string[]; message_id?: string }` (import the `Citation` type by moving it to `src/lib/chatStream.ts` and re-exporting it, or by exporting it from `MainChat.tsx`; pick whichever avoids a circular import).
  - `function parseSse(buffer: string): { events: { event: string; data: string }[]; rest: string }` (pure): splits complete frames on blank lines and returns the unfinished tail as `rest`.
  - `function streamMessage(url: string, body: unknown, handlers: { onDelta(text: string): void; onDone(payload: StreamDonePayload): void }, signal?: AbortSignal): Promise<void>`: POSTs JSON; non-2xx rejects with the response text; reads `response.body` with `TextDecoder({stream:true})`; calls `onDelta`/`onDone`; an `error` event rejects with its `message`; if the stream ends without `done` or `error`, rejects with `"stream ended unexpectedly"`. Abort rejects with the native `AbortError`.

- [ ] **Step 1:** Implement the file.
- [ ] **Step 2:** Check `parseSse` with a scratch script outside the repo (use the scratchpad directory): `parseSse("event: delta\ndata: {\"text\":\"a\"}\n\nevent: do")` returns one event and `rest === "event: do"`; run it with `node --experimental-strip-types` (Node 22.12+), or skip to the manual check in Task 8 if the flag is unavailable.
- [ ] **Step 3:** Run `npm run build && npm run lint`. Expected: both succeed.
- [ ] **Step 4:** Commit `feat(ui): SSE stream client`.

### Task 7: Chat UI integration

**Files:**
- Modify: `src/components/layout/MainChat.tsx` (`sendMessage` around `:219`, `ConversationView` around `:520-570`)

**Interfaces:**
- Consumes: `streamMessage` and `StreamDonePayload` (Task 6); URL `${API_V1}/conversations/${conversationId}/messages/stream`.

- [ ] **Step 1:** In `sendMessage`, replace the `fetch` + `response.json()` block with `streamMessage` using the same body (`content`, `model`, `document_ids`). Keep one `AbortController` in a ref. On the first `onDelta`, append an assistant `Message` (new `crypto.randomUUID()` id, no citations) and remember its id in state `streamingId`; later deltas append to its `content`. On `onDone`, set that message's `content`, `citations`, `scope` from the payload, creating the message if no delta ever arrived (the nothing-found path), then clear `streamingId` and run the existing `renameConversation` for the first exchange.
- [ ] **Step 2:** Error path: on any rejection other than `AbortError`, remove the partial assistant message (if any) and the user message, set `failedQuestion` and the existing error banner text, exactly as today. On `AbortError`, do nothing visible.
- [ ] **Step 3:** Abort the in-flight request when `conversationId` changes and on unmount (effect cleanup).
- [ ] **Step 4:** In `ConversationView`, show the "Reading..." indicator only while waiting for the first delta (`isLoading && streamingId === null`; pass it as a new prop). Make the autoscroll effect also depend on the last message's content length, use `behavior: "auto"` while streaming, and scroll only if the scroll container is within ~120px of the bottom before the update.
- [ ] **Step 5:** Run `npm run build && npm run lint`. Expected: both succeed.
- [ ] **Step 6:** Commit `feat(ui): stream answers into the chat`.

### Task 8: End-to-end verification and docs

- [ ] **Step 1:** `./dev.sh` with a local Ollama model and at least one uploaded PDF. In the browser: ask a question about it. Expected: dots + "Reading..." first, then text appears progressively; no `[S` text ever visible; at `done` chips `[1]` appear and the source viewer opens as before; reload the page and confirm the saved message is identical to what was shown.
- [ ] **Step 2:** Ask something unrelated to the documents (nothing-found path). Expected: the not-found message appears as a normal assistant message with no sources.
- [ ] **Step 3:** Mid-answer, stop the AI service (`./dev.sh stop` or kill uvicorn). Expected: partial text disappears, the error banner with retry appears, and `GET .../messages` shows no assistant message for that question.
- [ ] **Step 4:** Mid-answer, switch to another conversation. Expected: the old backend request is cancelled (backend log shows the client disconnect / AI service stops generating) and no assistant message is saved for it.
- [ ] **Step 5:** Run the Python scripts (`test_stream_filter`, `test_llm_stream`, `test_chat_stream`, `test_citations`), `cd backend && go test ./... && go vet ./...`, and `npm run build && npm run lint`. Expected: all pass.
- [ ] **Step 6:** Add "Streaming answers" to the README feature list; commit `docs: mention streaming answers`. Optionally run `/graphify` in update mode (CLAUDE.md asks for it after structural changes).
