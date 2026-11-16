# Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user group documents into collections and scope a chat question to one collection, optionally plus individually ticked documents.

**Architecture:** The Go backend gains a collections API on the existing `collections` / `collection_documents` tables. The message endpoints accept `collection_id`; Go resolves it to the member document ids at send time, unions them with the request's `document_ids`, and forwards the result to the AI service as `document_ids`. The AI service is not changed. The frontend replaces the mock Collections page with real list and detail views and adds a Collections section to the chat scope picker.

**Tech Stack:** Go 1.26 / Gin / pgx, React 19 / TypeScript / Tailwind, PostgreSQL (no migration).

**Spec:** `docs/superpowers/specs/2026-11-15-collections-design.md`

## Global Constraints

- NO commits, NO branches, no `git add`: the user commits and pushes manually. Never add a `Co-Authored-By` line anywhere. Never touch the user's uncommitted `.gitignore` change. Every "verify" step replaces a commit step.
- No database migration and no change under `ai-service/`.
- Routes (under `/api/v1`), exactly: `GET|POST /workspaces/:id/collections`; `GET|PATCH|DELETE /collections/:collectionId`; `POST /collections/:collectionId/documents`; `DELETE /collections/:collectionId/documents/:documentId`.
- Error strings, exactly: `collection not found` (404), `name is required` (400), `name must be at most 150 characters` (400), `document not found in this workspace` (400), `collection has no documents` (400).
- Collection name: trimmed, required, at most 150 characters (count runes, not bytes). Description optional; empty or whitespace-only is stored as NULL.
- Deleting a collection never deletes documents. Adding or removing documents bumps the collection's `updated_at`.
- Chat scope = union of the collection's member document ids and the request's `document_ids`, no duplicates. A scoped request never falls back to the whole workspace. Scope validation happens before the user message is saved.
- At most one collection per scope. Scope is not persisted across reloads.
- Frontend: tsconfig has `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`; ESLint react-hooks is enforced; no new dependencies; keep the existing visual language (reuse `Dialog`, `ConfirmDialog`, `Button`, `PageContainer`, `PageHeader`, `SearchField`, `EmptyState`, `useToast`, and the card classes already in `CollectionsPage.tsx`).
- Live checks run against a backend copy on port 8090 (`APP_PORT=8090 go run ./cmd/server` from `backend/`, same database, AI service at the default `:8000`). The user's services on :8000/:8080/:5173/:5432 are never stopped. Every row created for a check is deleted afterwards.
- Workspace id for checks: `5400fe40-1e5a-4d63-9ffe-06fb12621540`.

## Review Focus

1. The selected collection is deleted (or emptied) before the question is sent: the request is rejected, the scope is cleared with a toast, the question goes back into the composer, and nothing is saved. Pinned in Task 3 (backend) and Task 6 (UI).
2. A document id from another workspace, or a random UUID, is added to a collection: rejected with `document not found in this workspace`, nothing inserted. Pinned in Task 2.
3. The same document arrives twice (ticked and also a member, or added twice): one id in the scope, one membership row. Pinned in Task 2 and Task 3.
4. Names: whitespace only, 150 vs 151 characters, non-ASCII characters counted as runes. Pinned in Task 1.
5. A member document is deleted from the workspace: the collection's `document_count` drops and the scope no longer contains it. Pinned in Task 2.

---

### Task 1: Collection model, repository and service

**Files:**
- Create: `backend/internal/model/collection.go`, `backend/internal/repository/collection_repository.go`, `backend/internal/service/collection_service.go`
- Test: `backend/internal/service/collection_service_test.go`

**Interfaces:**
- Produces:
  - `model.Collection { ID, WorkspaceID, Name string; Description *string; DocumentCount int; CreatedAt, UpdatedAt time.Time }` with JSON `id, workspace_id, name, description (omitempty), document_count, created_at, updated_at`.
  - `model.CollectionDetail { Collection; Documents []model.Document \`json:"documents"\` }` (embedded, flat JSON; `documents` is `[]`, never null).
  - `repository.CollectionRepository` (constructor `NewCollectionRepository(db *pgxpool.Pool)`), methods:
    - `Create(ctx, workspaceID, name string, description *string) (*model.Collection, error)`
    - `ListByWorkspace(ctx, workspaceID string) ([]model.Collection, error)` — `document_count` from a live count of `collection_documents`, ordered `updated_at DESC`
    - `GetByID(ctx, id string) (*model.Collection, error)` — `collection not found` on no rows
    - `Update(ctx, id, name string, description *string) (*model.Collection, error)` — bumps `updated_at`
    - `Delete(ctx, id string) error` — `collection not found` when nothing was deleted
    - `ListDocuments(ctx, id string) ([]model.Document, error)` — newest membership first
    - `DocumentIDs(ctx, id string) ([]string, error)`
    - `AddDocuments(ctx, id, workspaceID string, documentIDs []string) error` — one transaction: every id must be a document of `workspaceID`, else `document not found in this workspace` and nothing inserted; `ON CONFLICT DO NOTHING`; bump `updated_at`
    - `RemoveDocument(ctx, id, documentID string) error` — idempotent; bump `updated_at`
  - `service.CollectionService` (constructor `NewCollectionService(repo *repository.CollectionRepository)`), methods `Create(ctx, workspaceID, name string, description *string)`, `List(ctx, workspaceID)`, `Get(ctx, id) (*model.CollectionDetail, error)`, `Update(ctx, id string, name *string, description *string) (*model.Collection, error)` (nil = leave unchanged), `Delete(ctx, id)`, `AddDocuments(ctx, id string, documentIDs []string) (*model.CollectionDetail, error)`, `RemoveDocument(ctx, id, documentID string) error`.
  - Pure helper in the service file: `normalizeCollectionInput(name string, description *string) (string, *string, error)`.

- [ ] **Step 1: Write the failing test** `collection_service_test.go` (package `service`) for `normalizeCollectionInput`:
  - `"  KKN  "`, nil → `"KKN"`, nil, no error.
  - `"   "` → error `name is required`.
  - 150 × `"é"` → ok; 151 × `"é"` → error `name must be at most 150 characters`.
  - description `"  notes "` → pointer to `"notes"`; description `"   "` → nil.
- [ ] **Step 2:** `cd backend && go test ./internal/service/`. Expected: FAIL, `undefined: normalizeCollectionInput`.
- [ ] **Step 3:** Implement the model, repository and service, following the layout and error style of `document_repository.go` / `conversation_service.go`. `Update` with nil fields reads the current row first and keeps those values.
- [ ] **Step 4:** `go test ./internal/service/ && go build ./... && go vet ./...` and `gofmt -l` on the new files. Expected: PASS, no output.

### Task 2: Collection handler and routes

**Files:**
- Create: `backend/internal/handler/collection_handler.go`
- Modify: `backend/internal/router/router.go`
- Test: `backend/internal/handler/collection_handler_test.go`

**Interfaces:**
- Consumes: `service.CollectionService` (Task 1).
- Produces: `handler.CollectionHandler` (`NewCollectionHandler(service)`), methods `Create`, `List`, `Get`, `Update`, `Delete`, `AddDocuments`, `RemoveDocument`; pure helper `collectionErrorStatus(err error) int` (`collection not found` → 404, everything else → 400). Responses: Create 201 + collection; List 200 + array (`[]`, never null); Get 200 + detail; Update 200 + collection; Delete 204; AddDocuments 200 + detail; RemoveDocument 204. Request bodies: create `{name, description?}`; patch `{name?, description?}` (absent = unchanged); add `{document_ids: [...]}` (empty or missing → 400 `document_ids is required`). Error body `{"error": "..."}`.
- Wiring in `router.go`: build repository, service, handler next to the existing ones; register the seven routes from Global Constraints.

- [ ] **Step 1: Write the failing test** for `collectionErrorStatus`: `collection not found` → 404; `name is required` → 400; `document not found in this workspace` → 400.
- [ ] **Step 2:** `go test ./internal/handler/`. Expected: FAIL, undefined.
- [ ] **Step 3:** Implement the handler and the routes.
- [ ] **Step 4:** `go test ./internal/... && go build ./... && go vet ./...`. Expected: PASS.
- [ ] **Step 5: Live check on :8090** with `curl`, recording each status and body:
  - create `{"name":"  e2e KKN ","description":" "}` → 201, name `e2e KKN`, no description, `document_count` 0;
  - create with `{"name":"  "}` → 400 `name is required`;
  - list → contains it;
  - add two real ready document ids from `GET /workspaces/<ws>/documents` → 200, `documents` has 2; add the same two again → still 2 (Review Focus 3);
  - add a random UUID → 400 `document not found in this workspace`, count still 2 (Review Focus 2);
  - list shows `document_count` 2 and a newer `updated_at` than at creation;
  - PATCH `{"description":"notes"}` keeps the name; PATCH `{"name":"e2e renamed"}` keeps the description;
  - DELETE one member → 204, count 1; repeat the same DELETE → 204;
  - GET unknown id → 404 `collection not found`;
  - DELETE the collection → 204, and both documents still appear in the documents list.
  - Review Focus 5: upload a small throwaway `.txt` through `POST /workspaces/<ws>/documents`, add it to a second test collection, delete that document, confirm the collection's `document_count` dropped, then delete the collection.
- [ ] **Step 6:** Confirm no `e2e` collection or throwaway document remains and stop the :8090 process.

### Task 3: Chat scope by collection

**Files:**
- Modify: `backend/internal/service/message_service.go`, `backend/internal/handler/message_handler.go`, `backend/internal/router/router.go`
- Test: `backend/internal/service/message_scope_test.go`, `backend/internal/handler/message_handler_test.go`

**Interfaces:**
- Consumes: `repository.CollectionRepository.GetByID` and `.DocumentIDs` (Task 1).
- Produces:
  - Pure `resolveScope(collectionID string, memberIDs, documentIDs []string) ([]string, error)`: empty `collectionID` → `documentIDs` unchanged; otherwise members first then ticked ids, no duplicates; empty result → error `collection has no documents`.
  - `NewMessageService(repository, conversationRepository, collectionRepository, aiClient)` (new third argument).
  - `Chat(ctx, conversationID, content string, llm *client.LLMConfig, documentIDs []string, collectionID string)` and `ChatStream(ctx, conversationID, content string, llm *client.LLMConfig, documentIDs []string, collectionID string, emit ...)`.
  - In the shared preparation, after the conversation lookup and before the user message is saved: when `collectionID` is set, load the collection (`collection not found`), treat a collection whose `WorkspaceID` differs from the conversation's as `collection not found`, load member ids, call `resolveScope`.
  - Request body field `collection_id` (`json:"collection_id,omitempty"`) on the shared request struct of `Create` and `CreateStream`.
  - Pure `chatErrorStatus(err error) int` used by both handlers before anything is emitted: `conversation not found` → 404, `collection not found` → 404, `collection has no documents` → 400, anything else → 500 (unchanged behavior).

- [ ] **Step 1: Write the failing tests.**
  - `resolveScope("", nil, []string{"a"})` → `["a"]`; `resolveScope("", nil, nil)` → nil, no error.
  - `resolveScope("c", []string{"a","b"}, []string{"b","x"})` → `["a","b","x"]`.
  - `resolveScope("c", nil, []string{"x"})` → `["x"]` (empty collection plus a ticked document).
  - `resolveScope("c", nil, nil)` → error `collection has no documents`.
  - `chatErrorStatus` for the four cases above.
- [ ] **Step 2:** `go test ./internal/service/ ./internal/handler/`. Expected: FAIL, undefined.
- [ ] **Step 3:** Implement. Keep `ChatStream`'s rule that preparation errors are returned without emitting.
- [ ] **Step 4:** `go test ./internal/... && go build ./... && go vet ./...`. Expected: PASS.
- [ ] **Step 5: Live check on :8090** (AI service at :8000 is used as is): create a test conversation and a test collection with one real ready document.
  - stream `{"content":"<a question that document answers>","collection_id":"<id>"}` → ends with `done`, every citation's `document_id` is that document;
  - same with `document_ids:["<another ready document>"]` added → `done`, citations only from those two documents;
  - `collection_id` of an empty test collection → 400 `collection has no documents`, and `GET .../messages` shows no new user message;
  - random `collection_id` → 404 `collection not found`;
  - non-stream `POST .../messages` with `collection_id` works too;
  - a request with neither field behaves as before.
- [ ] **Step 6:** Delete the test conversation and collections; stop :8090.

### Task 4: Collections page (list, create, rename, delete)

**Files:**
- Create: `src/lib/collections.ts`, `src/components/collections/CollectionFormDialog.tsx`
- Modify: `src/pages/CollectionsPage.tsx`

**Interfaces:**
- Produces in `src/lib/collections.ts`:
  - `type Collection = { id: string; name: string; description?: string | null; document_count: number; updated_at: string }`
  - `type CollectionDetail = Collection & { documents: WorkspaceDocument[] }` (`WorkspaceDocument` from `./documents`)
  - `type CollectionScope = { id: string; name: string }`
  - `fetchCollections(): Promise<Collection[]>`, `fetchCollection(id): Promise<CollectionDetail>`, `createCollection(input: { name: string; description?: string }): Promise<Collection>`, `updateCollection(id, input: { name?: string; description?: string }): Promise<Collection>`, `deleteCollection(id): Promise<void>`, `addCollectionDocuments(id, documentIds: string[]): Promise<CollectionDetail>`, `removeCollectionDocument(id, documentId): Promise<void>`. Each rejects with `new Error(<backend "error" string, or "Request failed (<status>)">)`.
  - `CollectionFormDialog` props: `{ open: boolean; initial?: { name: string; description?: string | null }; onClose(): void; onSubmit(values: { name: string; description: string }): Promise<void> }`; title "New collection" or "Rename collection"; name input limited to 150 characters; shows the rejection message inline.
  - `CollectionsPage` props (used by Task 5 and 6): `{ onAskCollection(scope: CollectionScope): void; onCollectionChanged(scope: CollectionScope): void; onCollectionDeleted(id: string): void }`.

- [ ] **Step 1:** Implement `collections.ts`.
- [ ] **Step 2:** Rewrite `CollectionsPage.tsx`: remove the sample data and the "in preview" notice; load with `fetchCollections`; loading, error-with-retry and empty states (`EmptyState`, with a "New Collection" action); search filters by name and description; cards keep the current classes and show `N documents` and `Updated <formatRelativeTime(updated_at)>`; "New Collection" is enabled and opens the dialog; each card has a `⋯` menu with Rename and Delete (`ConfirmDialog` whose text says the documents are kept). After rename call `onCollectionChanged`; after delete call `onCollectionDeleted`; toasts on success and failure. Card click is wired in Task 5 (leave a `onOpen(collection)` handler that sets local state).
- [ ] **Step 3:** In `src/App.tsx` pass no-op handlers for the three new props for now (Task 6 replaces them).
- [ ] **Step 4:** `npm run build && npm run lint`. Expected: both pass.

### Task 5: Collection detail (documents, add, remove, ask)

**Files:**
- Create: `src/components/collections/CollectionDetail.tsx`, `src/components/collections/AddDocumentsDialog.tsx`
- Modify: `src/pages/CollectionsPage.tsx`

**Interfaces:**
- Consumes: `fetchCollection`, `addCollectionDocuments`, `removeCollectionDocument`, `fetchDocuments`, `CollectionScope` (Task 4).
- Produces: `CollectionDetail` props `{ collectionId: string; onBack(): void; onAsk(scope: CollectionScope): void; onChanged(): void }`; `AddDocumentsDialog` props `{ open: boolean; excludeIds: string[]; onClose(): void; onAdd(documentIds: string[]): Promise<void> }`.

- [ ] **Step 1:** `CollectionsPage` shows `CollectionDetail` instead of the grid when a card is opened (local state, no router); "← Collections" returns and refreshes the list.
- [ ] **Step 2:** `CollectionDetail`: header with name, description, "Ask this collection" (disabled with title "Add documents first" when there are none) and "Add documents"; a list of member documents with the file-type icon used on the Documents page, name, `formatFileSize`, a "processing" / "failed" marker when `processing_status` is not `ready`, and Remove. Empty state when there are no documents. Remove updates the list optimistically and restores it on failure with a toast.
- [ ] **Step 3:** `AddDocumentsDialog`: lists workspace documents not in `excludeIds`, with checkboxes, a search field, a count on the confirm button ("Add 3 documents"), and an empty message when every document is already in the collection.
- [ ] **Step 4:** `npm run build && npm run lint`. Expected: both pass.

### Task 6: Chat scope UI

**Files:**
- Modify: `src/App.tsx`, `src/components/chat/DocumentScopePicker.tsx`, `src/components/layout/MainChat.tsx`

**Interfaces:**
- Consumes: `CollectionScope`, `fetchCollections`, `fetchCollection` (Task 4); backend `collection_id` and its two rejections (Task 3).
- Produces:
  - `App.tsx`: state `selectedCollection: CollectionScope | null`, cleared everywhere `selectedDocIds` is cleared; `handleAskCollection(scope)` sets it, clears `selectedDocIds`, navigates to chat; `onCollectionChanged` updates the name if it is the selected one; `onCollectionDeleted` clears it if it is the selected one. Top bar subtitle: `· scoped to collection KKN`, `· scoped to collection KKN + 2 documents`, or the existing document text.
  - `DocumentScopePicker` new props `selectedCollection: CollectionScope | null`, `onChangeCollection(scope: CollectionScope | null): void`.
  - `MainChat` new props `selectedCollection`, `onChangeSelectedCollection`; `ConversationView`'s `scopeCount` prop is replaced by `waitingLabel: string`.

- [ ] **Step 1: Picker.** On open, also load collections. Render a "Collections" group above a "Documents" group. One collection at a time: clicking the selected one deselects it. A collection with `document_count === 0` is disabled and marked "empty" unless at least one document is ticked. When a collection is selected, load its members; member rows show a check and "in <name>" and are not clickable; ticked ids that are members are removed from `selectedIds` once members load. Button label: `KKN`, `KKN + 1 document`, the existing labels otherwise. "Clear" clears both.
- [ ] **Step 2: MainChat.** Send `collection_id: selectedCollection?.id` alongside `document_ids`. `waitingLabel`: `Reading collection KKN...`, `Reading collection KKN + 1 document...`, or the existing two texts. Composer enabled-state and other behavior unchanged.
- [ ] **Step 3: Scope rejection.** When `streamMessage` rejects with a message containing `collection not found` or `collection has no documents` (and the request was not aborted): remove the just-added user message, put the question text back into the composer, call `onChangeSelectedCollection(null)`, show a toast ("That collection no longer exists. Scope cleared." / "That collection is empty. Scope cleared."), and do not show the retry banner.
- [ ] **Step 4: App.** Wire the state and the three `CollectionsPage` handlers from Task 4.
- [ ] **Step 5:** `npm run build && npm run lint`. Expected: both pass.

### Task 7: End-to-end verification and docs

- [ ] **Step 1 (controller, browser, against a frontend copy on :5174 proxied to the :8090 backend):** create a collection, rename it, add two documents, remove one, re-add it; "Ask this collection" lands in chat with the scope label; ask a question and confirm citations come only from member documents; tick one extra document in the picker and confirm the label reads "+ 1 document" and that document can be cited; untick it; select an empty collection (disabled) and with a ticked document (allowed).
- [ ] **Step 2:** With a collection selected in the chat, delete it from another tab (or via `curl`), send a question: toast, scope cleared, question back in the composer, no user message saved (Review Focus 1).
- [ ] **Step 3:** Regression: a question with no scope and one with only ticked documents behave as before; streaming still works.
- [ ] **Step 4:** `cd backend && go test ./... -count=1 && go vet ./...`; `npm run build && npm run lint`. Expected: all pass.
- [ ] **Step 5:** README: tick "Collections for grouping documents" in the roadmap and add a Features bullet: `- **Collections.** Group documents into collections and ask a whole collection at once, optionally adding single documents to the scope.` Delete all test data and temporary files; stop the copies.
