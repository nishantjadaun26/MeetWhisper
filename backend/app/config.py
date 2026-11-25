import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_PORT: int = 8000
    FRONTEND_PORT: int = 5173
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    # Auth & JWT Settings
    SECRET_KEY: str = "meetwhisper-dev-secret-key-change-in-production-2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 250

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/meetwhisper"
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"
    REDIS_URL: str = "redis://localhost:6379/0"

    # ML & Audio
    TRANSCRIBER_ENGINE: str = "faster_whisper"  # faster_whisper | groq | deepgram | mock
    WHISPER_MODEL_SIZE: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    ENABLE_DIARIZATION: bool = False
    HF_TOKEN: str = ""
    GROQ_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # LLM Settings
    LLM_PROVIDER: str = "gemini"  # gemini | openai | ollama | mock
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
