"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-11-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Meetings
    op.create_table(
        'meetings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=512), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('duration_seconds', sa.Float(), nullable=False),
        sa.Column('normalized_audio_path', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Jobs
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('meeting_id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('progress_percent', sa.Integer(), nullable=False),
        sa.Column('stage_message', sa.String(length=255), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Transcript Segments
    op.create_table(
        'transcript_segments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('meeting_id', sa.String(length=36), nullable=False),
        sa.Column('speaker', sa.String(length=50), nullable=False),
        sa.Column('start_time', sa.Float(), nullable=False),
        sa.Column('end_time', sa.Float(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('words_json', postgresql.JSONB(astext_type=sa.Text()) if is_postgres else sa.JSON(), nullable=True),
        sa.Column('segment_order', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_transcript_segments_meeting_order', 'transcript_segments', ['meeting_id', 'segment_order'], unique=False)

    # Meeting Analyses
    op.create_table(
        'meeting_analyses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('meeting_id', sa.String(length=36), nullable=False),
        sa.Column('executive_summary', sa.Text(), nullable=False),
        sa.Column('decisions_json', postgresql.JSONB(astext_type=sa.Text()) if is_postgres else sa.JSON(), nullable=False),
        sa.Column('action_items_json', postgresql.JSONB(astext_type=sa.Text()) if is_postgres else sa.JSON(), nullable=False),
        sa.Column('open_questions_json', postgresql.JSONB(astext_type=sa.Text()) if is_postgres else sa.JSON(), nullable=False),
        sa.Column('topics_json', postgresql.JSONB(astext_type=sa.Text()) if is_postgres else sa.JSON(), nullable=False),
        sa.Column('graph_type', sa.String(length=20), nullable=False),
        sa.Column('graph_json', postgresql.JSONB(astext_type=sa.Text()) if is_postgres else sa.JSON(), nullable=False),
        sa.Column('raw_llm_response', sa.Text(), nullable=True),
        sa.Column('validation_attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meeting_id')
    )

    # Topic Segments (with vector embedding)
    embedding_col = sa.Column('embedding', Vector(384), nullable=True) if is_postgres and Vector else sa.Column('embedding', sa.JSON(), nullable=True)

    op.create_table(
        'topic_segments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('meeting_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('start_time', sa.Float(), nullable=False),
        sa.Column('end_time', sa.Float(), nullable=False),
        sa.Column('segment_order', sa.Integer(), nullable=False),
        embedding_col,
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_topic_segments_meeting_order', 'topic_segments', ['meeting_id', 'segment_order'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_topic_segments_meeting_order', table_name='topic_segments')
    op.drop_table('topic_segments')
    op.drop_table('meeting_analyses')
    op.drop_index('idx_transcript_segments_meeting_order', table_name='transcript_segments')
    op.drop_table('transcript_segments')
    op.drop_table('jobs')
    op.drop_table('meetings')
