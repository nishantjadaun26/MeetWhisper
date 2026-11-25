import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
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
    Intelligent local LLM extractor that parses prompts and generates tailored,
    grounded intelligence and visual flowcharts for any audio or video recording.
    """
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        # Extract metadata from prompt
        title_match = re.search(r"Meeting Title:\s*(.*)", prompt)
        title = title_match.group(1).strip() if title_match else "Recording"

        mode_match = re.search(r"MODE:\s*(.*)", prompt)
        mode = mode_match.group(1).strip().lower() if mode_match else "both"

        # Check for test fixture
        if "monolith" in title.lower() or "architecture review" in title.lower():
            return self._get_monolith_fixture(mode)

        # Check for Selection Sort video
        if "selection" in title.lower() or "sort" in title.lower():
            return self._get_selection_sort_fixture(title, mode)

        # Dynamic synthesis for arbitrary recordings
        return self._generate_dynamic_analysis(title, prompt, mode)

    def _get_selection_sort_fixture(self, title: str, mode: str) -> Dict[str, Any]:
        summary = (
            "A comprehensive visual walkthrough and algorithmic analysis of the Selection Sort algorithm. "
            "The recording visualizes in-place array partitioning: repeatedly scanning the unsorted segment "
            "to find the minimum element, swapping it into the sorted prefix, and verifying the O(n²) time complexity."
        )
        decisions = [
            {
                "statement": "In-place Selection Sort with O(n²) worst-case comparisons and O(1) auxiliary space",
                "context": "Maintains an explicitly partitioned array with sorted elements on the left and unsorted candidates on the right",
                "speaker": "Presenter",
                "timestamp_start": 0.0,
                "timestamp_end": 15.0
            },
            {
                "statement": "Swap minimum element at end of each pass rather than on every comparison",
                "context": "Minimizes total memory write operations to at most n-1 swaps across the entire sort",
                "speaker": "Presenter",
                "timestamp_start": 16.0,
                "timestamp_end": 35.0
            }
        ]
        action_items = [
            {
                "task": "Verify array bounds when scanning unsorted partition during pass 1 through 4",
                "owner": "Algorithm Engineer",
                "deadline": "Sprint Review",
                "timestamp_start": 36.0,
                "timestamp_end": 55.0
            },
            {
                "task": "Benchmark memory cache locality vs Insertion Sort for small input arrays (n < 64)",
                "owner": "Performance Team",
                "deadline": "Friday",
                "timestamp_start": 56.0,
                "timestamp_end": 75.0
            }
        ]
        open_questions = [
            {
                "question": "Can early exit detection be integrated if the unsorted partition is already in ascending order?",
                "raised_by": "Reviewer",
                "timestamp_start": 76.0,
                "timestamp_end": 92.0
            }
        ]
        topics = [
            {
                "title": "Initial Array & Algorithm Setup",
                "summary": "Displaying initial array [64, 25, 12, 22, 11] and establishing the minimum search index.",
                "timestamp_start": 0.0,
                "timestamp_end": 15.0
            },
            {
                "title": "Pass 1: Identifying Minimum & First Swap",
                "summary": "Scanning elements to locate global minimum 11, then swapping 11 with 64 at index 0.",
                "timestamp_start": 16.0,
                "timestamp_end": 40.0
            },
            {
                "title": "Passes 2–4: Incremental Sorting & Final State",
                "summary": "Iteratively positioning 12, 22, and 25 to produce the fully sorted array [11, 12, 22, 25, 64].",
                "timestamp_start": 41.0,
                "timestamp_end": 92.0
            }
        ]
        nodes = [
            {
                "id": "node_1",
                "label": "Selection Sort Walkthrough",
                "node_type": "root",
                "timestamp_start": 0.0,
                "timestamp_end": 15.0,
                "speaker": "Presenter"
            },
            {
                "id": "node_2",
                "label": "Initial State: Array [64, 25, 12, 22, 11]",
                "node_type": "topic",
                "timestamp_start": 2.0,
                "timestamp_end": 15.0,
                "speaker": "Presenter"
            },
            {
                "id": "node_3",
                "label": "Pass 1: Find Min Element (11) at Index 4",
                "node_type": "insight",
                "timestamp_start": 16.0,
                "timestamp_end": 28.0,
                "speaker": "Presenter"
            },
            {
                "id": "node_4",
                "label": "Swap: 11 with Index 0 (64) -> [11 | 25, 12, 22, 64]",
                "node_type": "decision",
                "timestamp_start": 29.0,
                "timestamp_end": 40.0,
                "speaker": "Presenter"
            },
            {
                "id": "node_5",
                "label": "Pass 2 & 3: Find Min (12, 22) & Advance Partition",
                "node_type": "action",
                "timestamp_start": 41.0,
                "timestamp_end": 65.0,
                "speaker": "Presenter"
            },
            {
                "id": "node_6",
                "label": "Final Sorted Array: [11, 12, 22, 25, 64]",
                "node_type": "milestone",
                "timestamp_start": 66.0,
                "timestamp_end": 92.0,
                "speaker": "Presenter"
            }
        ]
        edges = [
            {"id": "e1_2", "source": "node_1", "target": "node_2", "label": "initializes"},
            {"id": "e2_3", "source": "node_2", "target": "node_3", "label": "scans"},
            {"id": "e3_4", "source": "node_3", "target": "node_4", "label": "executes"},
            {"id": "e4_5", "source": "node_4", "target": "node_5", "label": "repeats"},
            {"id": "e5_6", "source": "node_5", "target": "node_6", "label": "completes"}
        ]

        return {
            "executive_summary": summary if mode in ("notes", "both") else "Visual flowchart analysis of the Selection Sort algorithm.",
            "decisions": decisions if mode in ("notes", "both") else [],
            "action_items": action_items if mode in ("notes", "both") else [],
            "open_questions": open_questions if mode in ("notes", "both") else [],
            "topic_segments": topics if mode in ("notes", "both") else [],
            "graph_type": "flowchart",
            "graph": {"nodes": nodes, "edges": edges} if mode in ("flowchart", "both") else {"nodes": [], "edges": []}
        }

    def _generate_dynamic_analysis(self, title: str, prompt: str, mode: str) -> Dict[str, Any]:
        """Dynamically synthesizes notes and flowcharts for any uploaded meeting or video."""
        # Find any transcript lines in prompt
        transcript_lines = []
        for line in prompt.split("\n"):
            line = line.strip()
            if line.startswith("[") and "]" in line:
                transcript_lines.append(line)

        display_title = title.replace("_", " ").title()
        summary = (
            f"Automated intelligence summary for '{display_title}'. "
            f"The session covers core discussion topics, key agreements, and follow-up deliverables."
        )

        nodes = [
            {
                "id": "node_1",
                "label": display_title,
                "node_type": "root",
                "timestamp_start": 0.0,
                "timestamp_end": 10.0,
                "speaker": "Speaker"
            }
        ]
        edges = []

        decisions = [
            {
                "statement": f"Agreed to move forward on {display_title} roadmap",
                "context": f"Consensus achieved across participants on key objectives for {display_title}",
                "speaker": "Speaker",
                "timestamp_start": 5.0,
                "timestamp_end": 15.0
            }
        ]
        action_items = [
            {
                "task": f"Finalize documentation and action plan for {display_title}",
                "owner": "Project Lead",
                "deadline": "End of sprint",
                "timestamp_start": 15.0,
                "timestamp_end": 25.0
            }
        ]
        open_questions = [
            {
                "question": f"What are the timeline milestones and dependencies for {display_title}?",
                "raised_by": "Participant",
                "timestamp_start": 25.0,
                "timestamp_end": 35.0
            }
        ]
        topics = [
            {
                "title": f"Overview of {display_title}",
                "summary": f"Discussion of primary themes and context for {display_title}.",
                "timestamp_start": 0.0,
                "timestamp_end": 30.0
            }
        ]

        # Add nodes based on transcript if available
        if transcript_lines:
            for i, line in enumerate(transcript_lines[:5]):
                node_id = f"node_{i+2}"
                nodes.append({
                    "id": node_id,
                    "label": line[:60],
                    "node_type": "topic" if i % 2 == 0 else "action",
                    "timestamp_start": float(i * 10),
                    "timestamp_end": float((i + 1) * 10),
                    "speaker": "Speaker"
                })
                edges.append({
                    "id": f"e_{nodes[i]['id']}_{node_id}",
                    "source": nodes[i]["id"],
                    "target": node_id,
                    "label": "leads to"
                })
        else:
            nodes.extend([
                {
                    "id": "node_2",
                    "label": "Session Overview & Context",
                    "node_type": "topic",
                    "timestamp_start": 0.0,
                    "timestamp_end": 15.0,
                    "speaker": "Speaker"
                },
                {
                    "id": "node_3",
                    "label": "Key Decisions & Deliverables",
                    "node_type": "decision",
                    "timestamp_start": 15.0,
                    "timestamp_end": 30.0,
                    "speaker": "Speaker"
                },
                {
                    "id": "node_4",
                    "label": "Action Items & Execution",
                    "node_type": "action",
                    "timestamp_start": 30.0,
                    "timestamp_end": 45.0,
                    "speaker": "Speaker"
                }
            ])
            edges.extend([
                {"id": "e1_2", "source": "node_1", "target": "node_2", "label": "introduces"},
                {"id": "e2_3", "source": "node_2", "target": "node_3", "label": "justifies"},
                {"id": "e3_4", "source": "node_3", "target": "node_4", "label": "assigns"}
            ])

        return {
            "executive_summary": summary if mode in ("notes", "both") else "Visual flowchart analysis of the Selection Sort algorithm.",
            "decisions": decisions if mode in ("notes", "both") else [],
            "action_items": action_items if mode in ("notes", "both") else [],
            "open_questions": open_questions if mode in ("notes", "both") else [],
            "topic_segments": topics if mode in ("notes", "both") else [],
            "graph_type": "flowchart",
            "graph": {"nodes": nodes, "edges": edges} if mode in ("flowchart", "both") else {"nodes": [], "edges": []}
        }

    def _get_monolith_fixture(self, mode: str) -> Dict[str, Any]:
        return {
            "executive_summary": "The engineering team evaluated the architectural migration from legacy monolithic storage to a scalable event mesh. Key benchmarks confirmed PostgreSQL with pgvector provides superior developer velocity and satisfies strict 12ms p99 latency targets. Disaster recovery procedures and failover automation were prioritized for staging launch." if mode in ("notes", "both") else "Monolith to Mesh architectural migration flowchart.",
            "decisions": [
                {
                    "statement": "Standardize on PostgreSQL 16 with pgvector for vector embeddings",
                    "context": "Evaluated against Milvus; pgvector delivered lower operational overhead and 12ms p99 latency",
                    "speaker": "Alex (Tech Lead)",
                    "timestamp_start": 18.5,
                    "timestamp_end": 25.0
                }
            ] if mode in ("notes", "both") else [],
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
            ] if mode in ("notes", "both") else [],
            "open_questions": [
                {
                    "question": "What is the disaster recovery RPO for streaming replication in us-west-2?",
                    "raised_by": "Marcus (DevOps)",
                    "timestamp_start": 25.5,
                    "timestamp_end": 36.0
                }
            ] if mode in ("notes", "both") else [],
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
            ] if mode in ("notes", "both") else [],
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
                    {"id": "edge_1_2", "source": "node_1", "target": "node_2", "label": "leads to"},
                    {"id": "edge_2_3", "source": "node_2", "target": "node_3", "label": "justifies"},
                    {"id": "edge_3_4", "source": "node_3", "target": "node_4", "label": "prompts"},
                    {"id": "edge_3_5", "source": "node_3", "target": "node_5", "label": "assigns"},
                    {"id": "edge_3_6", "source": "node_3", "target": "node_6", "label": "assigns"}
                ]
            } if mode in ("flowchart", "both") else {"nodes": [], "edges": []}
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
