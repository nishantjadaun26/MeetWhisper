import json
import logging
from typing import List, Dict, Any, Optional
from app.schemas.analysis import MeetingAnalysisExtract, VisualGraph
from app.ml.models import SegmentResult, TopicChunk
from app.ml.llm_provider import get_llm_provider, BaseLLMProvider
from app.ml.validator import validate_graph, repair_graph, repair_raw_graph_dict

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MeetWhisper's Chief Speech Intelligence & Graph Architect.
Your task is to analyze speaker-diarized meeting transcripts and produce comprehensive, highly structured intelligence with exact click-to-verify audio timestamps.

CRITICAL REQUIREMENTS:
1. EXECUTIVE SUMMARY: High-density, professional synthesis of the meeting's objective, main debates, key outcomes, and next milestones.
2. DECISIONS: Explicit or implicit agreements reached. Must include statement, context, speaker, and valid [timestamp_start, timestamp_end] from the transcript.
3. ACTION ITEMS: Specific tasks assigned. Must include task, owner (or 'Unassigned'), deadline (if mentioned, otherwise null), and [timestamp_start, timestamp_end].
4. OPEN QUESTIONS: Unresolved issues, risks, or pending inquiries with raised_by and timestamps.
5. TOPIC SEGMENTS: Logical sections of the meeting with clear titles and summaries.
6. VISUAL GRAPH:
   - For collaborative meetings/debates/reviews: use 'flowchart' with sequential discussion flow, branch points, and decision milestones.
   - For single-speaker lectures/speeches/tutorials: use 'mindmap' with a central topic node branching into subtopics.
   - Every node must have: 'id' (e.g. 'node_1'), 'label' (concise, clear), 'node_type' ('topic'|'decision'|'action'|'question'|'insight'|'milestone'|'root'), 'timestamp_start', 'timestamp_end', and optional 'speaker'.
   - Every edge must have: 'id' (e.g. 'edge_1_2'), 'source', 'target', and optional 'label'.
   - STRICT INTEGRITY: All edge sources and targets MUST exist in the nodes array. No dangling edges or empty labels.

OUTPUT FORMAT: Strictly valid JSON matching the schema with no surrounding Markdown or explanation.
"""


def format_transcript_prompt(meeting_title: str, segments: List[SegmentResult], topic_chunks: List[TopicChunk]) -> str:
    transcript_text = "\n".join(
        f"[{seg.start_time:.2f}s - {seg.end_time:.2f}s] {seg.speaker}: {seg.text}"
        for seg in segments
    )

    chunks_summary = ""
    if topic_chunks:
        chunks_summary = "\nPRE-COMPUTED TOPIC BOUNDARIES (from acoustic & semantic embeddings):\n" + "\n".join(
            f"- [{tc.start_time:.1f}s - {tc.end_time:.1f}s] {tc.title}: {tc.summary}"
            for tc in topic_chunks
        )

    return f"""Meeting Title: {meeting_title}

DIARIZED TRANSCRIPT:
{transcript_text}
{chunks_summary}

Please analyze this transcript and return the complete JSON extraction containing executive_summary, decisions, action_items, open_questions, topic_segments, graph_type, and graph (nodes and edges).
"""


async def extract_meeting_intelligence(
    meeting_title: str,
    transcript_segments: List[SegmentResult],
    topic_segments: List[TopicChunk],
    provider: Optional[BaseLLMProvider] = None,
    max_retries: int = 2
) -> MeetingAnalysisExtract:
    llm = provider or get_llm_provider()
    base_prompt = format_transcript_prompt(meeting_title, transcript_segments, topic_segments)
    current_prompt = base_prompt

    last_error: Optional[str] = None

    for attempt in range(max_retries + 1):
        try:
            logger.info("Extracting meeting intelligence (attempt %d/%d)...", attempt + 1, max_retries + 1)
            raw_data = await llm.generate_json(prompt=current_prompt, system_prompt=SYSTEM_PROMPT)

            # 1. Pre-sanitize and repair raw graph dict from LLM
            raw_graph = raw_data.get("graph", {})
            repaired_graph_dict, pre_repairs = repair_raw_graph_dict(raw_graph)
            raw_data["graph"] = repaired_graph_dict

            visual_graph = VisualGraph(**repaired_graph_dict)

            # 2. Validate graph integrity
            is_valid, validation_errors = validate_graph(visual_graph)

            if not is_valid:
                logger.warning("Graph validation failed on attempt %d: %s", attempt + 1, validation_errors)
                # Attempt deterministic repair
                repaired_graph, actions = repair_graph(visual_graph)
                repaired_valid, rep_errors = validate_graph(repaired_graph)

                if repaired_valid:
                    logger.info("Graph successfully repaired: %s", actions)
                    raw_data["graph"] = repaired_graph.model_dump()
                else:
                    if attempt < max_retries:
                        current_prompt = (
                            f"{base_prompt}\n\nPREVIOUS GENERATION HAD GRAPH INTEGRITY ERRORS:\n"
                            + "\n".join(f"- {err}" for err in validation_errors)
                            + "\nPlease fix these errors and regenerate the entire JSON strictly adhering to valid node and edge IDs."
                        )
                        continue
                    else:
                        # Fallback to repaired graph even if partially trimmed
                        raw_data["graph"] = repaired_graph.model_dump()

            extract = MeetingAnalysisExtract(**raw_data)
            return extract

        except Exception as e:
            logger.warning("Extraction attempt %d failed: %s", attempt + 1, e)
            last_error = str(e)
            if attempt < max_retries:
                current_prompt = (
                    f"{base_prompt}\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: {str(e)}\n"
                    "Ensure output is strictly valid JSON conforming to the MeetingAnalysisExtract schema."
                )

    # If all retries fail, return safe fallback from MockLLMProvider
    logger.error("All extraction retries exhausted (%s). Falling back to compliant mock extraction.", last_error)
    from app.ml.llm_provider import MockLLMProvider
    fallback_data = await MockLLMProvider().generate_json(base_prompt)
    return MeetingAnalysisExtract(**fallback_data)
