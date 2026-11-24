from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class TimestampedItem(BaseModel):
    timestamp_start: float = Field(..., ge=0.0, description="Start time in seconds")
    timestamp_end: float = Field(..., ge=0.0, description="End time in seconds")


class DecisionItem(TimestampedItem):
    statement: str = Field(..., min_length=1, description="Concise statement of the decision made")
    context: str = Field(..., description="Context, motivation or alternative considered")
    speaker: Optional[str] = Field(None, description="Speaker who proposed or approved the decision")


class ActionItem(TimestampedItem):
    task: str = Field(..., min_length=1, description="Actionable task description")
    owner: Optional[str] = Field(None, description="Assigned individual or team")
    deadline: Optional[str] = Field(None, description="Mentioned deadline or timeframe")


class OpenQuestion(TimestampedItem):
    question: str = Field(..., min_length=1, description="Unresolved question or inquiry")
    raised_by: Optional[str] = Field(None, description="Speaker who raised the question")


class TopicSegmentItem(TimestampedItem):
    title: str = Field(..., min_length=1, description="Topic or section heading")
    summary: str = Field(..., min_length=1, description="Summary of discussion under this topic")


class GraphNode(TimestampedItem):
    id: str = Field(..., min_length=1, description="Unique node identifier, e.g. node_1")
    label: str = Field(..., min_length=1, description="Clear, readable node text")
    node_type: Literal[
        "topic", "decision", "action", "question", "insight", "milestone", "root", "subtopic"
    ] = Field(..., description="Categorical type of the node")
    speaker: Optional[str] = Field(None, description="Associated speaker if applicable")


class GraphEdge(BaseModel):
    id: str = Field(..., min_length=1, description="Unique edge identifier, e.g. edge_1_2")
    source: str = Field(..., min_length=1, description="Source node id")
    target: str = Field(..., min_length=1, description="Target node id")
    label: Optional[str] = Field(None, description="Relation label, e.g. leads to, decides, assigns")


class VisualGraph(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list, description="List of graph nodes")
    edges: List[GraphEdge] = Field(default_factory=list, description="List of directed relationships")


class MeetingAnalysisExtract(BaseModel):
    executive_summary: str = Field(default="", description="Executive summary of the meeting or empty if flowchart-only")
    decisions: List[DecisionItem] = Field(default_factory=list, description="Decisions concluded during the meeting")
    action_items: List[ActionItem] = Field(default_factory=list, description="Action items assigned")
    open_questions: List[OpenQuestion] = Field(default_factory=list, description="Open or unresolved questions")
    topic_segments: List[TopicSegmentItem] = Field(default_factory=list, description="Logical topic breakdown")
    graph_type: Literal["flowchart", "mindmap"] = Field("flowchart", description="Visual representation type")
    graph: VisualGraph = Field(default_factory=VisualGraph, description="Interactive visual graph")
