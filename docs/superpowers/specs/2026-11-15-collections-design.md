# Collections: design

Status: draft, waiting for approval. Date: 2026-11-15.

## Intent

Let the user group documents into named collections and ask a question against
one collection, so the search only looks at that group. The point is chat
scoping: "ask my KKN documents" in one click instead of ticking seven files in
the document picker every time. Tidying the library is a side effect of having
collections, not a separate feature.

## Goals

- Create, rename, describe and delete collections.
- Add documents to a collection and remove them. A document can be in several
  collections. Deleting a collection never deletes documents.
- Pick one collection as the scope of a chat question; the answer uses only
  that collection's documents, with membership read at send time.
- Combine the collection with individually ticked documents: the scope is the
  collection's documents plus the ticked ones, so one extra document can be
  included for a single prompt and unticked afterwards.
- The Collections page shows real data instead of the sample cards.

## Non-goals

- Conversations that belong to a collection (notebook style).
- Several collections in one scope, or narrowing inside a collection (leaving
  out some of its documents for one prompt).
- Remembering the scope per conversation across reloads (document scope is not
  remembered today either).
- "Add to collection" from the Documents page card menu, drag and drop, nested
  collections, sharing, auth.
- Changing the AI service.

## Anti-goals

- A question scoped to a collection silently searching the whole workspace
  (for example when the collection is empty or was deleted).
- Deleting a collection removing documents or their chunks.
- Stale membership: a document removed from a collection still being searched.

## What exists today

- Tables `collections` (workspace_id, name ≤150, description, timestamps) and
  `collection_documents` (collection_id, document_id, PK on both, cascade on
  either side) from migration `000001`. No migration is needed.
- AI service search accepts `collection_id`, but `chat.py` turns off
  full-document reading when it is set. It is left unused.
- Go backend: nothing for collections. Message endpoints accept
  `document_ids` and pass them to the AI service.
- Frontend: `CollectionsPage.tsx` is a mock; `DocumentScopePicker` scopes by
  document; `App.tsx` holds `selectedDocIds`, cleared on conversation switch.

## Approaches considered

1. **Backend resolves the collection to document IDs (chosen).** The frontend
   sends `collection_id`; Go looks up the member documents and forwards them as
   `document_ids`. Membership is always current, there is one source of truth,
   the AI service is untouched, and full-document reading keeps working.
2. Frontend expands a collection into ticked documents. Cheapest, but the
   collection is not a real scope and the browser's list can be stale.
3. Pass `collection_id` to the AI service. The SQL filter exists, but list
   questions get worse because full-document reading is disabled for it.

## Design

### Backend (Go)

New `model.Collection`, `CollectionRepository`, `CollectionService`,
`CollectionHandler`, following the existing document/conversation layering.

Routes (all under `/api/v1`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/workspaces/:id/collections` | list, each with `document_count`, newest `updated_at` first |
| POST | `/workspaces/:id/collections` | create `{name, description?}` |
| GET | `/collections/:collectionId` | one collection plus its `documents` (same shape as the documents list) |
| PATCH | `/collections/:collectionId` | update `name` and/or `description` |
| DELETE | `/collections/:collectionId` | delete the collection only |
| POST | `/collections/:collectionId/documents` | add `{document_ids: [...]}`; already-present ids are ignored |
| DELETE | `/collections/:collectionId/documents/:documentId` | remove one |

Rules: name is trimmed, required, at most 150 characters; description is
optional. Documents added must belong to the collection's workspace (others are
rejected with 400). Adding or removing documents bumps the collection's
`updated_at`. Unknown collection is 404.

Chat scope: the message request body (both `POST /conversations/:id/messages`
and `.../messages/stream`) gains optional `collection_id`. In the shared
preparation step:

- Collection not found, or in a different workspace than the conversation: 404.
- The scope sent to the AI service as `document_ids` is the union of the
  collection's member documents and the request's `document_ids`, without
  duplicates. `collection_id` and `document_ids` may be sent together.
- If `collection_id` is given and the union is empty (empty collection, no
  ticked documents): 400 with `collection has no documents`. The request never
  falls back to the whole workspace.
- Validation happens before the user message is saved, so a rejected request
  leaves nothing behind.

### Frontend

`src/lib/collections.ts`: types and fetch helpers for the routes above.

**Collections page** (replaces the mock, keeps the existing card look):

```
Collections                                   [+ New Collection]
[ Search collections...                                        ]
2 collections
┌───────────────────────────┐ ┌───────────────────────────┐
│ ▣ KKN                  ⋯  │ │ ▣ Final Project        ⋯  │
│ Guidelines and field docs │ │ References for the TA     │
│ 5 documents · 2 hours ago │ │ 12 documents · yesterday  │
└───────────────────────────┘ └───────────────────────────┘
```

- New Collection opens a dialog (name, description). The card menu has Rename
  (same dialog) and Delete (confirm dialog saying documents are kept).
- Clicking a card opens the collection detail on the same page:

```
← Collections
KKN                                  [Ask this collection] [+ Add documents]
Guidelines and field docs
┌──────────────────────────────────────────────────────────────┐
│ 📄 Pedoman KKN 2026.pdf          1.2 MB              Remove  │
│ 📄 Logbook.docx                  340 KB              Remove  │
└──────────────────────────────────────────────────────────────┘
```

- Add documents opens a dialog listing workspace documents not yet in the
  collection, with checkboxes and a search field. Documents still processing
  can be added and are marked as such.
- Ask this collection sets the chat scope to this collection and goes to the
  chat. It is disabled when the collection is empty.
- Empty state on the page when there are no collections.

**Chat scope.** `App.tsx` gains `selectedCollection` (`{id, name} | null`)
next to `selectedDocIds`. They are independent and can both be set; both clear
on conversation switch.

- `DocumentScopePicker` gets a "Collections" section above the document list.
  At most one collection is selected at a time (choosing another replaces it,
  choosing it again deselects it). Empty collections can be selected only when
  at least one document is ticked; otherwise they are shown disabled with
  "empty".
- With a collection selected, its member documents appear in the document list
  as included and not tickable (labelled "in KKN"); any other document can be
  ticked or unticked as today. Ticked documents stay ticked when the collection
  is deselected.
- The button label reads "KKN", "KKN + 1 document", or "2 documents" as
  applicable, and a clear control returns to all documents.
- `MainChat` sends `collection_id` when a collection is selected and
  `document_ids` for the ticked documents, either or both. The waiting
  indicator reads "Reading collection KKN..." (with "+ 1 document" when
  applicable).
- The top bar subtitle reads "· scoped to collection KKN" or
  "· scoped to collection KKN + 1 document".
- "Ask this collection" on the Collections page sets the scope to that
  collection alone (ticked documents are cleared).
- If the backend rejects the scope (collection deleted or emptied meanwhile),
  the scope is cleared and a toast explains why, instead of the generic
  "couldn't answer" banner.

## Testing and verification

- Go: the repo has no database test harness, so repository and service code is
  verified live. Unit tests cover what is pure: request validation and the
  scope rules (union without duplicates, empty union) factored so they can be
  tested without a database.
- Live, on a separate port so the running stack is untouched: `curl` through
  every route (create, list with counts, add, duplicate add, remove, rename,
  delete; document survives a collection delete), then a streamed question with
  `collection_id` whose citations come only from member documents, one with
  `collection_id` plus an extra `document_ids` entry (union), and the
  rejections above. Test data is deleted afterwards.
- Frontend: `npm run build` and `npm run lint`; then a browser pass over
  create, add documents, Ask this collection, picker selection, and the
  deleted-collection case.

## Left to the builder

Exact SQL, component split inside `CollectionsPage.tsx` (it may be split into
a few files if it grows), dialog copy, and icon choices, following the existing
Documents page patterns.
