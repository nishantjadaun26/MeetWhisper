"""MeetWhisper AI/ML Pipeline Evaluation Benchmark
Measures:
1. Pydantic v2 Schema Compliance Rate (%)
2. Graph & Flowchart Validity Pass Rate (%)
3. Processing Latency per Audio Minute (seconds)
"""

import asyncio
import os
import sys
import time
from typing import List, Dict, Any

# Ensure backend modules are resolvable
sys.path.insert(0, os.path.abspath("backend"))

from app.ml.models import SegmentResult, TranscriptResult, TopicChunk
from app.ml.chunker import chunk_transcript_segments
from app.ml.extractor import extract_meeting_intelligence
from app.ml.validator import validate_graph
from app.ml.llm_provider import MockLLMProvider

SAMPLE_BENCHMARK_MEETINGS = [
    {
        "title": "Architecture Review: Event-Driven Microservices",
        "duration_seconds": 360.0,
        "segments": [
            SegmentResult(speaker="Alex (Tech Lead)", start_time=0.0, end_time=15.0, text="Welcome everyone. We are here to evaluate Apache Kafka vs RabbitMQ for our async event backbone."),
            SegmentResult(speaker="Elena (Staff Engineer)", start_time=15.5, end_time=45.0, text="Our benchmark shows Kafka delivers 150k msg/sec with sub-5ms commit latency, while providing persistent log replay."),
            SegmentResult(speaker="Alex (Tech Lead)", start_time=45.5, end_time=65.0, text="Let's make a decision: we will standardize on Kafka clusters managed via Strimzi on Kubernetes."),
            SegmentResult(speaker="Marcus (DevOps)", start_time=65.5, end_time=90.0, text="I have an open question: what is our topic retention SLA and storage capacity limit in eu-west-1?"),
            SegmentResult(speaker="Marcus (DevOps)", start_time=90.5, end_time=120.0, text="For action items, I will configure Prometheus alerting rules and create the Terraform manifest by Friday."),
            SegmentResult(speaker="Elena (Staff Engineer)", start_time=120.5, end_time=150.0, text="I will write the schema registry protobuf contracts and share with client teams by Thursday."),
        ]
    },
    {
        "title": "Product Growth & Onboarding Funnel Sync",
        "duration_seconds": 240.0,
        "segments": [
            SegmentResult(speaker="Sarah (Product Manager)", start_time=0.0, end_time=20.0, text="Our drop-off rate on the signup verification screen reached 22% last week."),
            SegmentResult(speaker="David (Design Lead)", start_time=20.5, end_time=45.0, text="We should eliminate the mandatory phone OTP step and replace it with passkeys or OAuth2 single-click sign-in."),
            SegmentResult(speaker="Sarah (Product Manager)", start_time=45.5, end_time=70.0, text="Agreed. We decide to roll out social sign-in as the default and deprecate phone SMS for new users."),
            SegmentResult(speaker="David (Design Lead)", start_time=70.5, end_time=95.0, text="I will finalize the Figma high-fidelity prototypes for the new onboarding flow by tomorrow noon."),
            SegmentResult(speaker="Sarah (Product Manager)", start_time=95.5, end_time=115.0, text="Open question: how does this affect our anti-fraud detection on newly created accounts?"),
        ]
    },
    {
        "title": "Machine Learning Model Evaluation & Quantization",
        "duration_seconds": 300.0,
        "segments": [
            SegmentResult(speaker="Dr. Vance (ML Lead)", start_time=0.0, end_time=25.0, text="Today we are examining int8 vs float16 quantization benchmarks for our local Whisper deployment."),
            SegmentResult(speaker="Liam (Research Engineer)", start_time=25.5, end_time=55.0, text="int8 quantization using CTranslate2 achieved 4.2x faster inference on CPU with only a 0.3% degradation in Word Error Rate."),
            SegmentResult(speaker="Dr. Vance (ML Lead)", start_time=55.5, end_time=75.0, text="Decision approved: we deploy int8 quantization across all edge worker nodes."),
            SegmentResult(speaker="Liam (Research Engineer)", start_time=75.5, end_time=100.0, text="Action item: I will prepare the Docker container image and run the test harness across varying audio noise profiles."),
        ]
    }
]


async def run_benchmark():
    print("=" * 70)
    print("MeetWhisper Pipeline Evaluation Benchmark")
    print("=" * 70)

    total_runs = len(SAMPLE_BENCHMARK_MEETINGS)
    schema_passes = 0
    graph_valid_passes = 0
    total_latency_seconds = 0.0
    total_audio_minutes = 0.0

    mock_llm = MockLLMProvider()

    for idx, meeting in enumerate(SAMPLE_BENCHMARK_MEETINGS):
        print(f"\nEvaluating Meeting {idx + 1}/{total_runs}: '{meeting['title']}'")
        audio_mins = meeting["duration_seconds"] / 60.0
        total_audio_minutes += audio_mins

        start_time = time.perf_counter()

        # 1. Semantic Chunking
        topic_chunks = await chunk_transcript_segments(meeting["segments"])
        
        # 2. Intelligence & Graph Extraction
        analysis = await extract_meeting_intelligence(
            meeting["title"],
            meeting["segments"],
            topic_chunks,
            provider=mock_llm
        )

        elapsed = time.perf_counter() - start_time
        total_latency_seconds += elapsed

        # 3. Schema compliance check
        is_schema_compliant = (
            bool(analysis.executive_summary)
            and len(analysis.decisions) > 0
            and len(analysis.action_items) > 0
            and len(analysis.graph.nodes) > 0
            and len(analysis.graph.edges) > 0
        )
        if is_schema_compliant:
            schema_passes += 1

        # 4. Deterministic graph validation check
        is_graph_valid, graph_errors = validate_graph(analysis.graph)
        if is_graph_valid:
            graph_valid_passes += 1

        print(f"  - Audio Duration: {audio_mins:.1f} mins")
        print(f"  - Processing Latency: {elapsed:.3f} s")
        print(f"  - Schema Compliant: {'PASSED' if is_schema_compliant else 'FAILED'}")
        print(f"  - Graph Validity: {'PASSED' if is_graph_valid else f'FAILED ({graph_errors})'}")
        print(f"  - Graph Metrics: {len(analysis.graph.nodes)} nodes, {len(analysis.graph.edges)} edges")

    schema_compliance_rate = (schema_passes / total_runs) * 100.0
    graph_validity_rate = (graph_valid_passes / total_runs) * 100.0
    avg_latency_per_audio_minute = total_latency_seconds / total_audio_minutes if total_audio_minutes > 0 else 0.0

    print("\n" + "=" * 70)
    print("FINAL EVALUATION METRICS REPORT")
    print("=" * 70)
    print(f"Total Meetings Evaluated:             {total_runs}")
    print(f"Total Audio Duration:                 {total_audio_minutes:.2f} minutes")
    print(f"Schema Compliance Pass Rate:          {schema_compliance_rate:.1f}%")
    print(f"Graph Integrity Pass Rate:            {graph_validity_rate:.1f}%")
    print(f"Avg Processing Latency / Audio Min:   {avg_latency_per_audio_minute:.3f} s / audio minute")
    print("=" * 70)

    assert schema_compliance_rate == 100.0, "Schema compliance rate below 100%"
    assert graph_validity_rate == 100.0, "Graph validity rate below 100%"
    print("\nBENCHMARK RUN SUCCESSFUL!")


if __name__ == "__main__":
    asyncio.run(run_benchmark())
