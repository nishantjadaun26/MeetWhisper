import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.api.router import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # For dev / SQLite test environments, ensure tables are created
    if "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


app = FastAPI(
    title="MeetWhisper API",
    description="Speech Intelligence, Speaker Diarization, and Interactive Flowchart & Mind Map Generation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "service": "MeetWhisper API",
        "transcriber": settings.TRANSCRIBER_ENGINE,
        "llm_provider": settings.LLM_PROVIDER,
    }
