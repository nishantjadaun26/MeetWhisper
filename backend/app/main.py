import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.api.router import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Ensure SQLite tables exist if running SQLite
    if "sqlite" in str(engine.url):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            res = await conn.execute(text("PRAGMA table_info(meetings)"))
            cols = [row[1] for row in res.fetchall()]
            if "user_id" not in cols:
                await conn.execute(text("ALTER TABLE meetings ADD COLUMN user_id VARCHAR(36)"))

            user_res = await conn.execute(text("PRAGMA table_info(users)"))
            user_cols = [row[1] for row in user_res.fetchall()]
            if "auth_provider" not in user_cols:
                await conn.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) NOT NULL DEFAULT 'local'"))
            if "google_sub" not in user_cols:
                await conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)"))
            if "avatar_url" not in user_cols:
                await conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512)"))

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
