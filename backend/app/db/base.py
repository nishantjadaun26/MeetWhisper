from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func
from sqlalchemy.types import TypeDecorator, JSON
try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False


class Base(DeclarativeBase):
    pass


class VectorType(TypeDecorator):
    """
    Cross-dialect vector type:
    Uses pgvector Vector on PostgreSQL, falls back to JSON on SQLite.
    """
    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = 384, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if hasattr(value, "tolist"):
            return value.tolist()
        return list(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return list(value)
