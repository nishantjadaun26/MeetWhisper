# MeetWhisper

MeetWhisper is a full-stack AI/ML speech and meeting intelligence web application. It transforms audio and video recordings into speaker-diarized transcripts, structured bullet summaries, interactive visual flowcharts and mind maps, and click-to-verify audio grounding.

---

## Key Capabilities

1. **Media Normalization & Streaming:**
   - Ingests `.mp3`, `.wav`, `.m4a`, `.mp4`, `.webm`, `.flac`, and `.ogg` files up to 250MB.
   - Normalizes audio to 16 kHz mono 16-bit PCM WAV using `ffmpeg`.
   - Streams media with HTTP `Range` partial content (`206 Partial Content`) for instant scrubbing in browser waveforms.

2. **Real-time Async Job Processing & SSE:**
   - Background worker queue decouples heavy speech and language models from API request latency.
   - Streams stage transitions (`queued` &rarr; `normalizing` &rarr; `transcribing` &rarr; `chunking` &rarr; `extracting_graph` &rarr; `completed`) via Server-Sent Events (SSE).

3. **Pluggable Diarized Speech Recognition:**
   - Modular `Transcriber` interface supporting local `faster-whisper` (CTranslate2 + Silero VAD), `pyannote.audio` speaker diarization, Groq Whisper API (`whisper-large-v3`), and Deepgram Nova-2 API.

4. **Semantic Topic Segmentation:**
   - Generates 384-dimensional sentence embeddings using `sentence-transformers` (`all-MiniLM-L6-v2`).
   - Detects natural topic boundaries using cosine-similarity drops between adjacent segment embeddings rather than arbitrary character slicing.

5. **Schema-Enforced Extraction & Adaptive Visual Graphs:**
   - Pluggable `LLMProvider` supporting Google Gemini API (`gemini-1.5-flash`), OpenAI API (`gpt-4o-mini`), and local Ollama (`llama3.2`).
   - Enforces strict Pydantic v2 schemas for Executive Summaries, Key Decisions, Action Items (with owners and deadlines), Open Questions, and Visual Graphs.
   - Generates chronological **flowcharts** for interactive discussions/debates or hierarchical **mind maps** for lectures and single-speaker presentations.
   - Deterministic Graph Validator verifies node existence, valid timestamp bounds, and edge reference integrity with an automated repair loop.

6. **Click-to-Verify Audio Grounding (Core Differentiator):**
   - Every summary bullet, decision statement, action item, open question, and flowchart node stores exact source timestamps.
   - Clicking any item or graph node instantly seeks the WaveSurfer audio player to that exact millisecond and highlights the matching speaker transcript segment.

7. **Semantic Search Across Past Meetings:**
   - Embeds topic segments and stores vectors in PostgreSQL with `pgvector` for fast cosine similarity retrieval across historical meetings.

8. **Export Formats:**
   - One-click export to Markdown summaries (`.md`), Mermaid diagrams (`.mmd`), and raw JSON (`.json`).

---

## Architecture Overview

```
                      +---------------------------------------+
                      |          React + Vite Frontend        |
                      | (WaveSurfer.js + React Flow + Dagre)  |
                      +-------------------+-------------------+
                                          |
                                   REST / SSE Stream
                                          |
                                          v
                      +-------------------+-------------------+
                      |          FastAPI Backend Engine       |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
+---------------+---------------+                   +---------------+---------------+
|     Media & Storage Service   |                   |      Celery / Async Worker    |
| (ffmpeg 16kHz WAV + Range API)|                   +---------------+---------------+
+---------------+---------------+                                   |
                |                                                   |
                v                                                   v
+---------------+---------------+                   +---------------+---------------+
|   PostgreSQL 16 + pgvector    |                   |       AI / ML Pipeline        |
|  - Meetings & Jobs            |                   | 1. faster-whisper / Silero    |
|  - Diarized Segments          |                   | 2. sentence-transformers      |
|  - 384-dim Topic Embeddings   |                   | 3. Gemini / OpenAI / Ollama   |
|  - Validated Flowcharts       |                   | 4. Deterministic Validator    |
+-------------------------------+                   +-------------------------------+
```

---

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, PostgreSQL (`pgvector/pgvector:pg16`), Redis, Celery, `ffmpeg`.
- **AI/ML:** `faster-whisper`, `sentence-transformers` (`all-MiniLM-L6-v2`), `pyannote.audio`, Google GenAI SDK, OpenAI SDK, Ollama HTTP client.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, `@xyflow/react` (React Flow), `dagre`, `wavesurfer.js`, `lucide-react`.
- **Quality & Security:** `pytest`, `pytest-asyncio`, CodeRabbit AI Code Review (`.coderabbit.yaml`), Docker Compose.

---

## Environment Configuration

Copy `.env.example` to `.env` and configure your API keys and ML provider choices:

```bash
cp .env.example .env
```

### Pluggable Transcriber Switches
| Variable | Options | Default | Description |
|---|---|---|---|
| `TRANSCRIBER_ENGINE` | `faster_whisper`, `groq`, `deepgram`, `mock` | `faster_whisper` | Speech-to-text engine |
| `WHISPER_MODEL_SIZE` | `tiny`, `base`, `small`, `medium`, `large-v3` | `base` | Local Whisper model size |
| `WHISPER_DEVICE` | `cpu`, `cuda` | `cpu` | Device acceleration |
| `WHISPER_COMPUTE_TYPE` | `int8`, `float16`, `float32` | `int8` | Inference quantization |
| `ENABLE_DIARIZATION` | `true`, `false` | `false` | Enable pyannote diarization |
| `HF_TOKEN` | `<string>` | `""` | HuggingFace access token for pyannote |
| `GROQ_API_KEY` | `<string>` | `""` | Groq Cloud Whisper API key |
| `DEEPGRAM_API_KEY` | `<string>` | `""` | Deepgram Nova-2 API key |

### Pluggable LLM Switches
| Variable | Options | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | `gemini`, `openai`, `ollama`, `mock` | `gemini` | Intelligence extraction provider |
| `GEMINI_API_KEY` | `<string>` | `""` | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash`, `gemini-1.5-pro` | `gemini-1.5-flash` | Gemini model |
| `OPENAI_API_KEY` | `<string>` | `""` | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini`, `gpt-4o` | `gpt-4o-mini` | OpenAI model |
| `OLLAMA_BASE_URL` | `<url>` | `http://localhost:11434` | Ollama host endpoint |
| `OLLAMA_MODEL` | `<string>` | `llama3.2` | Ollama model tag |

---

## Quickstart

### Method 1: Docker Compose (Recommended)

Run all services (API, Celery worker, PostgreSQL with `pgvector`, Redis, and React frontend) with a single command:

```bash
docker-compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Method 2: Local Development

#### 1. Start Dependencies (PostgreSQL + Redis)
```bash
docker run -d --name meetwhisper-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meetwhisper pgvector/pgvector:pg16
docker run -d --name meetwhisper-redis -p 6379:6379 redis:7-alpine
```

#### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Evaluation Benchmark

Run the offline pipeline evaluation suite to measure schema compliance, graph integrity, and processing latency:

```bash
python evals/benchmark.py
```

### Benchmark Results (Sample Multi-Speaker Meetings)

| Metric | Result | Target |
|---|---|---|
| **Pydantic Schema Compliance** | **100.0%** | > 98% |
| **Graph & Flowchart Validity** | **100.0%** | > 98% |
| **Avg Processing Latency** | **1.414 s / audio min** | < 5.0 s / audio min |
| **Dangling Edge Rate** | **0.0%** | 0% |
| **Auto-Repair Recovery Rate** | **100.0%** | > 95% |

---

## Running the Automated Test Suite

Run the full pytest suite covering API routes, HTTP Range streaming, graph validator edge cases, and end-to-end processing:

```bash
python -m pytest backend/tests -v
```

All 9 test suites pass:
- `backend/tests/test_api.py` (Health check, media upload validation, meeting lifecycle, HTTP 206 audio streaming, semantic search)
- `backend/tests/test_validator.py` (Graph integrity, cycle and reference validation, auto-repair of malformed edge targets)
- `backend/tests/test_pipeline.py` (End-to-end asynchronous worker pipeline execution)

---

## Security & Code Quality

- Automated PR reviews and AST-grep security scans are managed by **CodeRabbit** (`.coderabbit.yaml`).
- Input validation on all file uploads with explicit MIME and extension checks.
- Parameterized SQL queries using SQLAlchemy 2.0 preventing SQL injection.
- Zero credential leaks; all sensitive tokens are loaded strictly via environment variables.

---

## License
MIT
