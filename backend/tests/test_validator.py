import pytest
from app.schemas.analysis import VisualGraph, GraphNode, GraphEdge
from app.ml.validator import validate_graph, repair_graph, repair_raw_graph_dict


def test_valid_graph():
    graph = VisualGraph(
        nodes=[
            GraphNode(id="n1", label="Kickoff Discussion", node_type="root", timestamp_start=0.0, timestamp_end=10.0),
            GraphNode(id="n2", label="Adopt PostgreSQL", node_type="decision", timestamp_start=12.0, timestamp_end=20.0),
        ],
        edges=[
            GraphEdge(id="e1", source="n1", target="n2", label="decides")
        ]
    )
    is_valid, errors = validate_graph(graph)
    assert is_valid is True
    assert len(errors) == 0


def test_missing_node_edge_target():
    graph = VisualGraph(
        nodes=[
            GraphNode(id="n1", label="Kickoff", node_type="root", timestamp_start=0.0, timestamp_end=10.0)
        ],
        edges=[
            GraphEdge(id="e1", source="n1", target="n_ghost", label="points to nowhere")
        ]
    )
    is_valid, errors = validate_graph(graph)
    assert is_valid is False
    assert any("does not exist in nodes" in err for err in errors)


def test_duplicate_node_ids():
    graph = VisualGraph(
        nodes=[
            GraphNode(id="dup", label="Node A", node_type="topic", timestamp_start=0.0, timestamp_end=5.0),
            GraphNode(id="dup", label="Node B", node_type="topic", timestamp_start=5.0, timestamp_end=10.0),
        ],
        edges=[]
    )
    is_valid, errors = validate_graph(graph)
    assert is_valid is False
    assert any("Duplicate node id" in err for err in errors)


def test_inverted_timestamps():
    graph = VisualGraph(
        nodes=[
            GraphNode(id="n1", label="Node Inverted", node_type="topic", timestamp_start=25.0, timestamp_end=10.0)
        ],
        edges=[]
    )
    is_valid, errors = validate_graph(graph)
    assert is_valid is False
    assert any("inverted timestamps" in err for err in errors)


def test_repair_raw_graph_dict_comprehensive():
    malformed_raw = {
        "nodes": [
            {"id": "n1", "label": "Valid Node", "node_type": "root", "timestamp_start": 30.0, "timestamp_end": 15.0}, # inverted
            {"id": "n1", "label": "", "node_type": "unknown", "timestamp_start": 0.0, "timestamp_end": 5.0}, # duplicate ID & empty label
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "missing_target", "label": "broken"},
            {"id": "e2", "source": "n1", "target": "n1", "label": "loop"},
        ]
    }

    repaired_dict, actions = repair_raw_graph_dict(malformed_raw)
    assert len(actions) > 0

    repaired_graph = VisualGraph(**repaired_dict)
    is_valid, errors = validate_graph(repaired_graph)
    assert is_valid is True
    assert len(errors) == 0
    # Dangling edge was pruned
    assert len(repaired_graph.edges) == 1
    assert repaired_graph.edges[0].id == "e2"
