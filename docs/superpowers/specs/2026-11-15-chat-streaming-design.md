# Chat answer streaming: design

Status: draft, waiting for approval. Date: 2026-11-15.

## Intent

Answers currently appear all at once after the model finishes. With a local
model (default `qwen3:4b-instruct`, timeout 900 s) that is tens of seconds to
minutes of the same "Reading N selected documents..." animation, so the app
feels frozen. Streaming shows the answer as the model writes it. Total time is
unchanged; the wait feels much shorter and visibly alive.

The existing loading indicator already covers the retrieval phase, so no new
status messages are needed. Streaming only has to cover the generation phase.

## Goals

- The final answer text streams word by word from every provider: Ollama,
  OpenAI, Gemini, Anthropic and custom OpenAI-compatible endpoints.
- Citation verification keeps working exactly as today. The user never sees a
  raw `[S3]` label.
- The saved message in the database is the final verified answer, identical to
  what the non-streaming path stores.

## Non-goals

- A Stop button (the abort plumbing is built, the button is a follow-up).
- Streaming the conversation title or the query rewrite (both stay one-shot).
- Showing a model's reasoning/"thinking" output.
- Resuming a dropped stream; WebSockets; auth.

## Anti-goals (would be a failure even if it technically works)

- Unverified or mis-numbered citations visible at any point.
- Breaking the existing non-streaming endpoint or its callers.
- A half-written answer saved as if it were final.

## Constraints from the current code

- Pipeline is `chat()` in `ai-service/app/rag/chat.py`: rewrite, embed, hybrid
  search, generate, then `resolve_citations` + `renumber` rewrite the answer
  text and build `citations`. Verification needs the complete answer, so it can
  only run after the last token.
- `llm.generate()` makes one blocking request per provider (`stream: False` on
  Ollama, no `stream` flag elsewhere).
- Go `MessageService.Chat` saves the user message, calls the AI service, saves
  the assistant message, returns JSON. The Go HTTP client timeout is 15 min and
  no server `WriteTimeout` is set, so long streams are not cut by the server.
- The frontend uses `fetch` with POST and a JSON body, so `EventSource` (GET
  only) is not usable; the stream is read from `fetch` response body.

## Approaches considered

1. **Stream tokens, hide `[S..]` labels, replace with the verified answer on
   `done` (chosen).** Verification stays intact; text barely shifts at the end.
2. Stream raw tokens including `[S3]`, rewrite at the end. Easy, but labels
   flicker and renumber in front of the user.
3. Stream and skip verification. Rejected: it throws away the verified
   citations feature that just shipped.

Transport: SSE from FastAPI to Go to browser (chosen) versus WebSockets
(heavier, no benefit for one-way text).

## Design

### AI service (Python)

- `llm.py`: add `generate_stream(prompt, llm)` yielding text deltas.
  - Ollama: `/api/generate` with `stream: true` (NDJSON, field `response`).
  - OpenAI-compatible / Gemini / custom: `stream: true`, SSE `data:` lines,
    `choices[0].delta.content`, ends at `[DONE]`.
  - Anthropic: `stream: true`, SSE `content_block_delta` events, `delta.text`.
  - Same error handling as today (`_raise_for_status`, never echo the key).
- `generation.py`: add `generate_answer_stream(...)` sharing the prompt with
  `generate_answer`.
- `chat.py`: split `chat()` into a generator `chat_stream(...)` yielding
  events, and keep `chat()` as a thin wrapper that consumes it and returns the
  final dict, so the old endpoint and `test_*.py` scripts behave the same.
  Events: `delta {text}`, `done {answer, citations, search_query, scope}`,
  `error {message}`. When retrieval finds nothing, emit only `done` with the
  not-found message (no deltas).
- Label hiding happens server-side in a small pure function that wraps the
  delta stream: it buffers from a `[` while the text could still become a
  source label (reusing the label pattern from `citations.py`), drops complete
  labels, and flushes anything that turns out not to be one (for example
  `[2026]`). The buffer is capped so a stray `[` never stalls output.
- `routes.py`: new `POST /internal/chat/stream` returning
  `StreamingResponse(text/event-stream)` from a sync generator. The existing
  `/internal/chat` stays.

### Backend (Go)

- `AIClient.ChatStream(ctx, request, onEvent)` reads the SSE body from the AI
  service and calls `onEvent` per event. The request context is passed through,
  so a browser disconnect cancels the upstream call.
- `MessageService.ChatStream`: same preparation as `Chat` (conversation, history,
  save user message). On the AI `done` event it saves the assistant message
  with the verified answer and citations, then forwards `done` with the saved
  `message_id` added. If saving fails it sends `error` instead.
- `MessageHandler.CreateStream` on a new route
  `POST /conversations/:id/messages/stream`. Sets `Content-Type:
  text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and
  flushes after every event. The existing `POST .../messages` stays.

### Frontend

- `src/lib/chatStream.ts`: `streamMessage(url, body, signal, handlers)` using
  `fetch` + `ReadableStream` + `TextDecoder`, parsing SSE frames into
  `delta` / `done` / `error` callbacks.
- `MainChat.tsx` `sendMessage`: keep the dots + "Reading..." indicator until
  the first `delta`; then add an assistant message and append deltas to it.
  Rendering reuses `AssistantMessage` with no citations while streaming. On
  `done`, replace that message's content and citations with the final payload.
  Then run the existing first-exchange rename.
- On `error` or network failure mid-stream, drop the partial assistant message
  and show the existing error banner with retry (same as today's failure path).
- Abort the request on conversation switch and unmount (`AbortController`).
- Autoscroll while streaming: instant (not smooth) and only when the user is
  already near the bottom, so reading earlier text is not interrupted.

## Testing and verification

- Python (script style used in `ai-service/app/test_*.py`): `test_streaming.py`
  for the label-hiding function (labels split across chunks, `[2026]`, lone
  `[`) and for each provider's stream parser using canned lines. No network.
- Go: first `_test.go` in the repo, for the SSE parser in `AIClient`.
- Manual, with the real app (`./dev.sh`): ask a question with a local Ollama
  model and confirm text streams, citations appear only at the end, the final
  text matches what a reload shows, and unplugging the AI service mid-answer
  shows the error banner. Run `npm run build` and `npm run lint`.

## Left to the builder

Exact event field names beyond those listed, buffer cap for the label filter,
and chunking of SSE frames. These are my calls and are easy to adjust.

## Known existing behavior not changed here

The user message is saved before the AI call, so a failed request leaves an
orphan user message that a retry duplicates. Out of scope for this change.
