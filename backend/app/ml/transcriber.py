import os
import logging
from abc import ABC, abstractmethod
from typing import Optional, List
import httpx

from app.config import get_settings
from app.ml.models import WordTimestamp, SegmentResult, TranscriptResult

logger = logging.getLogger(__name__)
settings = get_settings()


class BaseTranscriber(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str) -> TranscriptResult:
        """Transcribes audio file and returns diarized segments."""
        pass


class FasterWhisperTranscriber(BaseTranscriber):
    def __init__(self):
        self.model_size = settings.WHISPER_MODEL_SIZE
        self.device = settings.WHISPER_DEVICE
        self.compute_type = settings.WHISPER_COMPUTE_TYPE
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(
                    "Loading faster-whisper model: %s (%s, %s)",
                    self.model_size, self.device, self.compute_type
                )
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type
                )
            except Exception as e:
                logger.warning("Could not load faster-whisper: %s. Falling back to Mock.", e)
                return None
        return self._model

    async def transcribe(self, audio_path: str) -> TranscriptResult:
        model = self._get_model()
        if model is None:
            return await MockTranscriber().transcribe(audio_path)

        try:
            segments_gen, info = model.transcribe(
                audio_path,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                word_timestamps=True,
            )

            segments: List[SegmentResult] = []
            full_text_parts = []
            current_speaker = "Speaker 1"

            for seg in segments_gen:
                words = []
                if seg.words:
                    for w in seg.words:
                        words.append(
                            WordTimestamp(
                                word=w.word,
                                start=round(w.start, 2),
                                end=round(w.end, 2),
                                probability=round(w.probability, 2) if hasattr(w, "probability") else None
                            )
                        )

                segments.append(
                    SegmentResult(
                        speaker=current_speaker,
                        start_time=round(seg.start, 2),
                        end_time=round(seg.end, 2),
                        text=seg.text.strip(),
                        confidence=round(seg.avg_logprob, 2) if hasattr(seg, "avg_logprob") else None,
                        words=words
                    )
                )
                full_text_parts.append(seg.text.strip())

            # Optional Pyannote Diarization if configured
            if settings.ENABLE_DIARIZATION and settings.HF_TOKEN:
                segments = self._apply_pyannote_diarization(audio_path, segments)

            return TranscriptResult(
                text=" ".join(full_text_parts),
                language=info.language,
                duration=round(info.duration, 2),
                segments=segments
            )

        except Exception as e:
            logger.error("faster-whisper transcription error: %s; falling back to Mock", e)
            return await MockTranscriber().transcribe(audio_path)

    def _apply_pyannote_diarization(self, audio_path: str, segments: List[SegmentResult]) -> List[SegmentResult]:
        try:
            from pyannote.audio import Pipeline
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=settings.HF_TOKEN
            )
            diarization = pipeline(audio_path)
            for seg in segments:
                mid_point = (seg.start_time + seg.end_time) / 2.0
                for turn, _, speaker in diarization.itertracks(yield_label=True):
                    if turn.start <= mid_point <= turn.end:
                        seg.speaker = f"Speaker {speaker}"
                        break
        except Exception as e:
            logger.warning("Pyannote diarization skipped/failed: %s", e)
        return segments


class GroqWhisperTranscriber(BaseTranscriber):
    async def transcribe(self, audio_path: str) -> TranscriptResult:
        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not set, falling back to mock")
            return await MockTranscriber().transcribe(audio_path)

        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

        async with httpx.AsyncClient(timeout=120.0) as client:
            with open(audio_path, "rb") as f:
                files = {"file": (os.path.basename(audio_path), f, "audio/wav")}
                data = {
                    "model": "whisper-large-v3",
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "segment"
                }
                resp = await client.post(url, headers=headers, files=files, data=data)
                resp.raise_for_status()
                payload = resp.json()

        segments = []
        for s in payload.get("segments", []):
            segments.append(
                SegmentResult(
                    speaker="Speaker 1",
                    start_time=round(s.get("start", 0.0), 2),
                    end_time=round(s.get("end", 0.0), 2),
                    text=s.get("text", "").strip(),
                )
            )

        return TranscriptResult(
            text=payload.get("text", ""),
            language=payload.get("language", "en"),
            duration=round(payload.get("duration", 0.0), 2),
            segments=segments
        )


class DeepgramTranscriber(BaseTranscriber):
    async def transcribe(self, audio_path: str) -> TranscriptResult:
        if not settings.DEEPGRAM_API_KEY:
            logger.warning("DEEPGRAM_API_KEY not set, falling back to mock")
            return await MockTranscriber().transcribe(audio_path)

        url = "https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&punctuate=true&utterances=true"
        headers = {
            "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
            "Content-Type": "audio/wav"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            with open(audio_path, "rb") as f:
                content = f.read()
            resp = await client.post(url, headers=headers, content=content)
            resp.raise_for_status()
            payload = resp.json()

        utterances = payload.get("results", {}).get("utterances", [])
        segments = []
        full_text = []

        for u in utterances:
            speaker_idx = u.get("speaker", 0)
            segments.append(
                SegmentResult(
                    speaker=f"Speaker {speaker_idx + 1}",
                    start_time=round(u.get("start", 0.0), 2),
                    end_time=round(u.get("end", 0.0), 2),
                    text=u.get("transcript", "").strip(),
                    confidence=round(u.get("confidence", 0.95), 2),
                )
            )
            full_text.append(u.get("transcript", "").strip())

        return TranscriptResult(
            text=" ".join(full_text),
            language="en",
            duration=round(payload.get("metadata", {}).get("duration", 0.0), 2),
            segments=segments
        )


class MockTranscriber(BaseTranscriber):
    """
    High-fidelity realistic meeting transcript for automated tests and offline development.
    """
    async def transcribe(self, audio_path: str) -> TranscriptResult:
        sample_segments = [
            SegmentResult(
                speaker="Alex (Tech Lead)",
                start_time=0.0,
                end_time=7.5,
                text="Welcome everyone. Today we're reviewing the migration from our legacy monolith to the microservices event mesh.",
                words=[
                    WordTimestamp(word="Welcome", start=0.0, end=0.8),
                    WordTimestamp(word="everyone.", start=0.9, end=1.5),
                    WordTimestamp(word="Today", start=1.8, end=2.2),
                    WordTimestamp(word="we're", start=2.3, end=2.6),
                    WordTimestamp(word="reviewing", start=2.7, end=3.4),
                    WordTimestamp(word="the", start=3.5, end=3.7),
                    WordTimestamp(word="migration", start=3.8, end=4.5),
                ]
            ),
            SegmentResult(
                speaker="Elena (Backend Dev)",
                start_time=8.0,
                end_time=18.2,
                text="On the database side, we've benchmarked PostgreSQL with pgvector against Milvus. pgvector delivered lower operational overhead and 12ms p99 latency.",
                words=[
                    WordTimestamp(word="On", start=8.0, end=8.2),
                    WordTimestamp(word="the", start=8.3, end=8.5),
                    WordTimestamp(word="database", start=8.6, end=9.2),
                    WordTimestamp(word="side,", start=9.3, end=9.7),
                ]
            ),
            SegmentResult(
                speaker="Alex (Tech Lead)",
                start_time=18.5,
                end_time=25.0,
                text="Agreed. Let's make an explicit decision: we will standardize on PostgreSQL 16 with pgvector for our vector embeddings.",
            ),
            SegmentResult(
                speaker="Marcus (DevOps)",
                start_time=25.5,
                end_time=36.0,
                text="I have an open question: what is our disaster recovery RPO for the streaming replication replicas in us-west-2?",
            ),
            SegmentResult(
                speaker="Marcus (DevOps)",
                start_time=36.5,
                end_time=48.0,
                text="For action items, I will configure the automated WAL shipping to S3 and document the failover drill by this Thursday.",
            ),
            SegmentResult(
                speaker="Elena (Backend Dev)",
                start_time=48.5,
                end_time=58.0,
                text="And I'll finalize the Alembic migration scripts and commit the baseline models by Wednesday afternoon.",
            ),
            SegmentResult(
                speaker="Alex (Tech Lead)",
                start_time=58.5,
                end_time=66.0,
                text="Sounds great team. Let's wrap up and regroup after the staging deployment.",
            )
        ]

        full_text = " ".join(s.text for s in sample_segments)
        return TranscriptResult(
            text=full_text,
            language="en",
            duration=66.0,
            segments=sample_segments
        )


def get_transcriber(engine: Optional[str] = None) -> BaseTranscriber:
    engine_name = (engine or settings.TRANSCRIBER_ENGINE).lower()

    if engine_name == "faster_whisper":
        return FasterWhisperTranscriber()
    elif engine_name == "groq":
        return GroqWhisperTranscriber()
    elif engine_name == "deepgram":
        return DeepgramTranscriber()
    elif engine_name == "mock":
        return MockTranscriber()
    else:
        logger.warning("Unknown transcriber '%s'; defaulting to faster_whisper", engine_name)
        return FasterWhisperTranscriber()
