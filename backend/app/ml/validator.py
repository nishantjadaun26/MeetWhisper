import logging
from typing import Tuple, List, Set, Dict, Any, Union
from app.schemas.analysis import VisualGraph, GraphNode, GraphEdge

logger = logging.getLogger(__name__)


class GraphValidationError(Exception):
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.errors = errors


def validate_graph(graph: VisualGraph) -> Tuple[bool, List[str]]:
    """
    Deterministically validates graph integrity:
    1. Every edge.source and edge.target must exist in nodes.
    2. Node IDs must be unique.
    3. Node labels must be non-empty.
    4. Node timestamps must satisfy 0 <= timestamp_start <= timestamp_end.
    5. Edge IDs must be unique.
    """
    errors: List[str] = []

    if not graph.nodes:
        errors.append("Graph must contain at least one node")
        return False, errors

    node_ids: Set[str] = set()
    for idx, node in enumerate(graph.nodes):
        if not node.id or not node.id.strip():
            errors.append(f"Node at index {idx} has an empty id")
        elif node.id in node_ids:
            errors.append(f"Duplicate node id detected: '{node.id}'")
        else:
            node_ids.add(node.id)

        if not node.label or not node.label.strip():
            errors.append(f"Node '{node.id}' has an empty label")

        if node.timestamp_start < 0:
            errors.append(f"Node '{node.id}' has negative timestamp_start: {node.timestamp_start}")

        if node.timestamp_end < node.timestamp_start:
            errors.append(
                f"Node '{node.id}' has inverted timestamps: start={node.timestamp_start} > end={node.timestamp_end}"
            )

    edge_ids: Set[str] = set()
    for idx, edge in enumerate(graph.edges):
        if not edge.id or not edge.id.strip():
            errors.append(f"Edge at index {idx} has an empty id")
        elif edge.id in edge_ids:
            errors.append(f"Duplicate edge id detected: '{edge.id}'")
        else:
            edge_ids.add(edge.id)

        if edge.source not in node_ids:
            errors.append(f"Edge '{edge.id}' source '{edge.source}' does not exist in nodes")

        if edge.target not in node_ids:
            errors.append(f"Edge '{edge.id}' target '{edge.target}' does not exist in nodes")

    return len(errors) == 0, errors


def repair_raw_graph_dict(graph_data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Repairs raw JSON graph dictionaries prior to Pydantic instantiation.
    Fixes empty labels, duplicate IDs, missing fields, inverted timestamps, and dangling edges.
    """
    actions_taken: List[str] = []
    raw_nodes = graph_data.get("nodes", [])
    raw_edges = graph_data.get("edges", [])

    repaired_nodes: List[Dict[str, Any]] = []
    seen_node_ids: Set[str] = set()

    for idx, node in enumerate(raw_nodes):
        if not isinstance(node, dict):
            continue

        raw_id = str(node.get("id", "")).strip()
        node_id = raw_id if raw_id else f"node_{idx+1}"
        if node_id in seen_node_ids:
            node_id = f"{node_id}_{idx+1}"
            actions_taken.append(f"Deduplicated node id to '{node_id}'")
        seen_node_ids.add(node_id)

        raw_label = str(node.get("label", "")).strip()
        label = raw_label if raw_label else f"Node {idx+1}"
        if label != raw_label:
            actions_taken.append(f"Replaced empty label for node '{node_id}' with '{label}'")

        try:
            start = max(0.0, float(node.get("timestamp_start", 0.0)))
        except (ValueError, TypeError):
            start = 0.0

        try:
            end = float(node.get("timestamp_end", start))
        except (ValueError, TypeError):
            end = start

        if end < start:
            start, end = end, start
            actions_taken.append(f"Fixed inverted timestamps for node '{node_id}': [{start}, {end}]")

        node_type = str(node.get("node_type", "topic")).lower()
        allowed_types = {"topic", "decision", "action", "question", "insight", "milestone", "root", "subtopic"}
        if node_type not in allowed_types:
            node_type = "topic"

        repaired_nodes.append({
            "id": node_id,
            "label": label,
            "node_type": node_type,
            "timestamp_start": round(start, 2),
            "timestamp_end": round(end, 2),
            "speaker": node.get("speaker")
        })

    valid_node_ids = {n["id"] for n in repaired_nodes}
    repaired_edges: List[Dict[str, Any]] = []
    seen_edge_ids: Set[str] = set()

    for idx, edge in enumerate(raw_edges):
        if not isinstance(edge, dict):
            continue

        source = str(edge.get("source", "")).strip()
        target = str(edge.get("target", "")).strip()

        if source not in valid_node_ids or target not in valid_node_ids:
            actions_taken.append(f"Pruned dangling edge referencing '{source}' -> '{target}'")
            continue

        raw_eid = str(edge.get("id", "")).strip()
        edge_id = raw_eid if raw_eid else f"edge_{idx+1}"
        if edge_id in seen_edge_ids:
            edge_id = f"{edge_id}_{idx+1}"
            actions_taken.append(f"Deduplicated edge id to '{edge_id}'")
        seen_edge_ids.add(edge_id)

        repaired_edges.append({
            "id": edge_id,
            "source": source,
            "target": target,
            "label": str(edge.get("label", "")).strip() if edge.get("label") else None
        })

    return {"nodes": repaired_nodes, "edges": repaired_edges}, actions_taken


def repair_graph(graph: VisualGraph) -> Tuple[VisualGraph, List[str]]:
    repaired_dict, actions = repair_raw_graph_dict(graph.model_dump())
    return VisualGraph(**repaired_dict), actions
