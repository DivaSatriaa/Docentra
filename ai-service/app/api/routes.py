import json
import threading

import anyio
from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.rag.chat import chat, chat_stream
from app.rag.llm import generate_title, list_models
from app.services.document_processor import process_document


router = APIRouter()


class ProcessDocumentRequest(BaseModel):
    document_id: str


class ChatMessage(BaseModel):
    role: str
    content: str


class LLMConfig(BaseModel):
    provider: str = "ollama"
    model: str = ""
    api_key: str = ""
    base_url: str = ""


class ListModelsRequest(BaseModel):
    provider: str
    api_key: str = ""
    base_url: str = ""


class TitleRequest(BaseModel):
    question: str
    answer: str = ""
    llm: LLMConfig | None = None


class ChatRequest(BaseModel):
    question: str
    workspace_id: str

    history: list[ChatMessage] = Field(
        default_factory=list,
    )

    document_ids: list[str] | None = None
    collection_id: str | None = None
    llm: LLMConfig | None = None

    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )


@router.post("/internal/process-document")
async def process_document_route(
    request: ProcessDocumentRequest,
):
    try:
        result = process_document(
            request.document_id,
        )

        return result

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"document processing failed: {error}",
        ) from error


@router.post("/internal/chat")
async def chat_route(
    request: ChatRequest,
):
    try:
        history = [
            {
                "role": message.role,
                "content": message.content,
            }
            for message in request.history
        ]

        result = chat(
            request.question,
            workspace_id=request.workspace_id,
            history=history,
            document_ids=request.document_ids,
            collection_id=request.collection_id,
            top_k=request.top_k,
            llm=request.llm.model_dump() if request.llm else None,
        )

        return result

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"chat failed: {error}",
        ) from error


def _sse(events):
    for name, data in events:
        # jsonable_encoder: citations carry UUIDs, as in the non-stream route.
        payload = json.dumps(jsonable_encoder(data), ensure_ascii=False)
        yield f"event: {name}\ndata: {payload}\n\n"


def _chat_events(request: ChatRequest):
    try:
        history = [
            {"role": message.role, "content": message.content}
            for message in request.history
        ]

        yield from chat_stream(
            request.question,
            workspace_id=request.workspace_id,
            history=history,
            document_ids=request.document_ids,
            collection_id=request.collection_id,
            top_k=request.top_k,
            llm=request.llm.model_dump() if request.llm else None,
        )
    except Exception as error:
        yield "error", {"message": str(error) or type(error).__name__}


_DONE = object()


async def _sse_async(events):
    """Serve the sync event generator without blocking the event loop.

    Each frame is pulled in a worker thread. When the client disconnects the
    response task is cancelled; the finally block then closes the generator,
    which closes the upstream LLM connection (Ollama stops generating).
    """
    frames = _sse(events)
    # A generator can't be closed while a worker thread is inside next(), and
    # a plain asyncio cancel doesn't wait for that thread: serialize both.
    lock = threading.Lock()

    def pull():
        with lock:
            return next(frames, _DONE)

    def close():
        with lock:
            try:
                frames.close()
            finally:
                events.close()

    try:
        while True:
            frame = await anyio.to_thread.run_sync(pull)
            if frame is _DONE:
                break
            yield frame
    finally:
        with anyio.CancelScope(shield=True):
            await anyio.to_thread.run_sync(close)


@router.post("/internal/chat/stream")
async def chat_stream_route(
    request: ChatRequest,
):
    return StreamingResponse(
        _sse_async(_chat_events(request)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/internal/models")
async def list_models_route(
    request: ListModelsRequest,
):
    try:
        return {"models": list_models(request.provider, request.api_key, request.base_url)}

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"could not list models: {error}",
        ) from error



@router.post("/internal/title")
async def title_route(
    request: TitleRequest,
):
    try:
        title = generate_title(
            request.question,
            request.answer,
            request.llm.model_dump() if request.llm else None,
        )

        return {"title": title}

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"title generation failed: {error}",
        ) from error
