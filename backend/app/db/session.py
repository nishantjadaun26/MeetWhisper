import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

db_url = settings.DATABASE_URL
connect_args = {}

if "sqlite" in db_url:
    connect_args["check_same_thread"] = False
else:
    # If asyncpg is not installed on host, fall back to SQLite for local development/testing
    try:
        import asyncpg  # noqa: F401
    except ImportError:
        logger.warning("asyncpg not found in environment; falling back to SQLite for local session.")
        db_url = "sqlite+aiosqlite:///./meetwhisper.db"
        connect_args["check_same_thread"] = False

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

