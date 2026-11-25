import asyncio
import sys
import os

# Ensure backend is on sys.path
sys.path.insert(0, os.path.abspath("backend"))

from app.ml.transcriber import get_transcriber
from app.ml.chunker import chunk_transcript_segments
from app.ml.extractor import extract_meeting_intelligence
from app.ml.validator import validate_graph, repair_graph, repair_raw_graph_dict
from app.schemas.analysis import VisualGraph


async def main():
    print("1. Testing Transcriber...")
    transcriber = get_transcriber("mock")
    transcript = await transcriber.transcribe("sample.wav")
    assert len(transcript.segments) > 0, "No segments found"
    print(f"   Transcribed {len(transcript.segments)} segments.")

    print("2. Testing Semantic Chunker...")
    topic_chunks = await chunk_transcript_segments(transcript.segments)
    assert len(topic_chunks) > 0, "No topic chunks created"
    print(f"   Created {len(topic_chunks)} topic chunks.")

    print("3. Testing Intelligence Extractor & Graph Generator...")
    analysis = await extract_meeting_intelligence(
        "Monolith to Mesh Architecture Review",
        transcript.segments,
        topic_chunks
    )
    assert analysis.executive_summary, "Missing executive summary"
    assert len(analysis.decisions) > 0, "No decisions"
    assert len(analysis.action_items) > 0, "No action items"
    assert len(analysis.open_questions) > 0, "No open questions"
    assert len(analysis.graph.nodes) > 0, "No graph nodes"
    assert len(analysis.graph.edges) > 0, "No graph edges"

    print(f"   Generated {len(analysis.graph.nodes)} nodes and {len(analysis.graph.edges)} edges.")

    print("4. Testing Graph Validator...")
    is_valid, errors = validate_graph(analysis.graph)
    assert is_valid, f"Graph validation failed: {errors}"
    print("   Graph validation passed with 0 errors!")

    print("5. Testing Graph Auto-Repair on Malformed Raw Dict...")
    broken_graph_data = {
        "nodes": [
            {"id": "n1", "label": "Valid Node", "node_type": "root", "timestamp_start": 10.0, "timestamp_end": 5.0}, # inverted
            {"id": "n1", "label": "", "node_type": "unknown_type", "timestamp_start": 0.0, "timestamp_end": 4.0}, # duplicate id + empty label
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n_missing", "label": "broken link"}, # missing target
            {"id": "e2", "source": "n1", "target": "n1", "label": "self loop"},
        ]
    }
    repaired_dict, repairs = repair_raw_graph_dict(broken_graph_data)
    repaired_graph = VisualGraph(**repaired_dict)
    rep_valid, rep_errors = validate_graph(repaired_graph)
    assert rep_valid, f"Repaired graph still invalid: {rep_errors}"
    print(f"   Auto-repair successfully fixed malformations: {repairs}")

    print("\nALL AI/ML PIPELINE CHECKS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(main())
