import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generates structured JSON object adhering to the specified schema."""
        pass


class GeminiProvider(BaseLLMProvider):
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        if not settings.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not configured, falling back to MockLLMProvider")
            return await MockLLMProvider().generate_json(prompt, system_prompt)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"SYSTEM INSTRUCTIONS:\n{system_prompt}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will strictly output valid JSON adhering to the specified format."}]})
        
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        body = {
            "contents": contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            }
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()

        text_content = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text_content)


class OpenAIProvider(BaseLLMProvider):
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not configured, falling back to MockLLMProvider")
            return await MockLLMProvider().generate_json(prompt, system_prompt)

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        raw_json = data["choices"][0]["message"]["content"]
        return json.loads(raw_json)


class OllamaProvider(BaseLLMProvider):
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.2}
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            return json.loads(data["message"]["content"])
        except Exception as e:
            logger.warning("Ollama call failed (%s); falling back to MockLLMProvider", e)
            return await MockLLMProvider().generate_json(prompt, system_prompt)


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic LLM extraction generating compliant meeting analysis and visual graph.
    """
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        return {
            "executive_summary": "The engineering team evaluated the architectural migration from legacy monolithic storage to a scalable event mesh. Key benchmarks confirmed PostgreSQL with pgvector provides superior developer velocity and satisfies strict 12ms p99 latency targets. Disaster recovery procedures and failover automation were prioritized for staging launch.",
            "decisions": [
                {
                    "statement": "Standardize on PostgreSQL 16 with pgvector for vector embeddings",
                    "context": "Evaluated against Milvus; pgvector delivered lower operational overhead and 12ms p99 latency",
                    "speaker": "Alex (Tech Lead)",
                    "timestamp_start": 18.5,
                    "timestamp_end": 25.0
                }
            ],
            "action_items": [
                {
                    "task": "Configure automated WAL shipping to S3 and document failover drill",
                    "owner": "Marcus (DevOps)",
                    "deadline": "Thursday",
                    "timestamp_start": 36.5,
                    "timestamp_end": 48.0
                },
                {
                    "task": "Finalize Alembic migration scripts and commit baseline models",
                    "owner": "Elena (Backend Dev)",
                    "deadline": "Wednesday afternoon",
                    "timestamp_start": 48.5,
                    "timestamp_end": 58.0
                }
            ],
            "open_questions": [
                {
                    "question": "What is the disaster recovery RPO for streaming replication in us-west-2?",
                    "raised_by": "Marcus (DevOps)",
                    "timestamp_start": 25.5,
                    "timestamp_end": 36.0
                }
            ],
            "topic_segments": [
                {
                    "title": "Architecture & Storage Review",
                    "summary": "Team reviewed monolith migration and pgvector benchmark results.",
                    "timestamp_start": 0.0,
                    "timestamp_end": 25.0
                },
                {
                    "title": "Disaster Recovery & Action Items",
                    "summary": "Discussed RPO requirements, WAL shipping, and Alembic migrations.",
                    "timestamp_start": 25.5,
                    "timestamp_end": 66.0
                }
            ],
            "graph_type": "flowchart",
            "graph": {
                "nodes": [
                    {
                        "id": "node_1",
                        "label": "Architecture Review: Monolith to Mesh",
                        "node_type": "root",
                        "timestamp_start": 0.0,
                        "timestamp_end": 7.5,
                        "speaker": "Alex (Tech Lead)"
                    },
                    {
                        "id": "node_2",
                        "label": "Benchmark pgvector vs Milvus (12ms p99)",
                        "node_type": "insight",
                        "timestamp_start": 8.0,
                        "timestamp_end": 18.2,
                        "speaker": "Elena (Backend Dev)"
                    },
                    {
                        "id": "node_3",
                        "label": "Decision: Adopt PostgreSQL 16 + pgvector",
                        "node_type": "decision",
                        "timestamp_start": 18.5,
                        "timestamp_end": 25.0,
                        "speaker": "Alex (Tech Lead)"
                    },
                    {
                        "id": "node_4",
                        "label": "DR RPO in us-west-2 Open Question",
                        "node_type": "question",
                        "timestamp_start": 25.5,
                        "timestamp_end": 36.0,
                        "speaker": "Marcus (DevOps)"
                    },
                    {
                        "id": "node_5",
                        "label": "Action: WAL Shipping & Failover Drill",
                        "node_type": "action",
                        "timestamp_start": 36.5,
                        "timestamp_end": 48.0,
                        "speaker": "Marcus (DevOps)"
                    },
                    {
                        "id": "node_6",
                        "label": "Action: Finalize Alembic Models",
                        "node_type": "action",
                        "timestamp_start": 48.5,
                        "timestamp_end": 58.0,
                        "speaker": "Elena (Backend Dev)"
                    }
                ],
                "edges": [
                    {
                        "id": "edge_1_2",
                        "source": "node_1",
                        "target": "node_2",
                        "label": "leads to"
                    },
                    {
                        "id": "edge_2_3",
                        "source": "node_2",
                        "target": "node_3",
                        "label": "justifies"
                    },
                    {
                        "id": "edge_3_4",
                        "source": "node_3",
                        "target": "node_4",
                        "label": "prompts"
                    },
                    {
                        "id": "edge_3_5",
                        "source": "node_3",
                        "target": "node_5",
                        "label": "assigns"
                    },
                    {
                        "id": "edge_3_6",
                        "source": "node_3",
                        "target": "node_6",
                        "label": "assigns"
                    }
                ]
            }
        }


def get_llm_provider(provider: Optional[str] = None) -> BaseLLMProvider:
    name = (provider or settings.LLM_PROVIDER).lower()
    if name == "gemini":
        return GeminiProvider()
    elif name == "openai":
        return OpenAIProvider()
    elif name == "ollama":
        return OllamaProvider()
    elif name == "mock":
        return MockLLMProvider()
    else:
        logger.warning("Unknown LLM provider '%s'; defaulting to Gemini", name)
        return GeminiProvider()
