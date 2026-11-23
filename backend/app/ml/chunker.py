import logging
from typing import List, Optional
import numpy as np
from app.config import get_settings
from app.ml.models import SegmentResult, TopicChunk

logger = logging.getLogger(__name__)
settings = get_settings()

_model = None


def get_embedding_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers model: %s", settings.EMBEDDING_MODEL)
            _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        except Exception as e:
            logger.warning("Could not load sentence-transformers: %s; using deterministic fallback.", e)
            _model = None
    return _model


def get_text_embedding(text: str) -> List[float]:
    """
    Computes 384-dimensional normalized embedding vector.
    """
    model = get_embedding_model()
    if model is not None:
        try:
            emb = model.encode(text, normalize_embeddings=True)
            return emb.tolist()
        except Exception as e:
            logger.warning("Encoding failed: %s; using hash embedding fallback", e)

    # Deterministic 384-dim pseudo-embedding fallback
    np.random.seed(abs(hash(text)) % (2**32))
    vec = np.random.randn(384)
    norm = np.linalg.norm(vec)
    return (vec / (norm if norm > 0 else 1.0)).tolist()


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    a = np.array(v1)
    b = np.array(v2)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


async def chunk_transcript_segments(segments: List[SegmentResult]) -> List[TopicChunk]:
    """
    Groups segments into coherent topic chunks using cosine similarity drops between embeddings.
    """
    if not segments:
        return []

    if len(segments) == 1:
        seg = segments[0]
        emb = get_text_embedding(seg.text)
        return [
            TopicChunk(
                title="Meeting Overview",
                summary=seg.text,
                start_time=seg.start_time,
                end_time=seg.end_time,
                segment_indices=[0],
                embedding=emb
            )
        ]

    # Compute embedding for each segment
    embeddings = [get_text_embedding(seg.text) for seg in segments]

    # Compute adjacent similarities
    similarities = []
    for i in range(len(embeddings) - 1):
        sim = cosine_similarity(embeddings[i], embeddings[i + 1])
        similarities.append(sim)

    # Threshold for boundary detection
    sim_array = np.array(similarities)
    mean_sim = float(np.mean(sim_array))
    std_sim = float(np.std(sim_array))
    threshold = max(0.35, min(0.65, mean_sim - (0.5 * std_sim)))

    # Boundaries
    boundaries = [0]
    for idx, sim in enumerate(similarities):
        # If similarity drops below threshold or speaker change with low similarity
        if sim < threshold:
            boundaries.append(idx + 1)

    if boundaries[-1] != len(segments):
        boundaries.append(len(segments))

    # Form topic chunks
    chunks: List[TopicChunk] = []
    for b_idx in range(len(boundaries) - 1):
        start_i = boundaries[b_idx]
        end_i = boundaries[b_idx + 1]
        chunk_segs = segments[start_i:end_i]

        chunk_text = " ".join(s.text for s in chunk_segs)
        start_time = chunk_segs[0].start_time
        end_time = chunk_segs[-1].end_time

        # Generate readable topic title from first sentence/keywords
        first_few_words = chunk_segs[0].text.split()[:6]
        raw_title = " ".join(first_few_words).rstrip(".,-:")
        title = f"Topic {len(chunks) + 1}: {raw_title}" if raw_title else f"Discussion Section {len(chunks) + 1}"
        
        # Summary
        summary = chunk_text if len(chunk_text) <= 280 else chunk_text[:277] + "..."
        chunk_emb = get_text_embedding(chunk_text)

        chunks.append(
            TopicChunk(
                title=title,
                summary=summary,
                start_time=start_time,
                end_time=end_time,
                segment_indices=list(range(start_i, end_i)),
                embedding=chunk_emb
            )
        )

    return chunks
