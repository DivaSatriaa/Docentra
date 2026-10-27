from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.rag.chat import chat
from app.rag.llm import PROVIDERS, list_providers
from app.services.document_processor import process_document


router = APIRouter()


class ProcessDocumentRequest(BaseModel):
    document_id: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    workspace_id: str

    history: list[ChatMessage] = Field(
        default_factory=list,
    )

    document_ids: list[str] | None = None
    collection_id: str | None = None

    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    provider: str | None = None
    model: str | None = None


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


@router.get("/internal/llm/providers")
async def list_providers_route():
    return {
        "providers": list_providers(),
    }


@router.post("/internal/chat")
async def chat_route(
    request: ChatRequest,
):
    if (
        request.provider
        and request.provider not in PROVIDERS
    ):
        raise HTTPException(
            status_code=400,
            detail=f"unknown provider: {request.provider}",
        )

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
            provider=request.provider,
            model=request.model,
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