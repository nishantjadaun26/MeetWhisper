export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker: string;
  start_time: float;
  end_time: float;
  text: string;
  confidence?: number | null;
  words_json?: Array<{
    word: string;
    start: number;
    end: number;
    probability?: number | null;
  }> | null;
  segment_order: number;
}

export type float = number;

export interface DecisionItem {
  statement: string;
  context: string;
  speaker?: string | null;
  timestamp_start: number;
  timestamp_end: number;
}

export interface ActionItem {
  task: string;
  owner?: string | null;
  deadline?: string | null;
  timestamp_start: number;
  timestamp_end: number;
  completed?: boolean;
}

export interface OpenQuestion {
  question: string;
  raised_by?: string | null;
  timestamp_start: number;
  timestamp_end: number;
}

export interface TopicSegmentItem {
  title: string;
  summary: string;
  timestamp_start: number;
  timestamp_end: number;
}

export type NodeType =
  | 'topic'
  | 'decision'
  | 'action'
  | 'question'
  | 'insight'
  | 'milestone'
  | 'root'
  | 'subtopic';

export interface GraphNode {
  id: string;
  label: string;
  node_type: NodeType;
  timestamp_start: number;
  timestamp_end: number;
  speaker?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
}

export interface VisualGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MeetingAnalysis {
  id: string;
  meeting_id: string;
  executive_summary: string;
  decisions_json: DecisionItem[];
  action_items_json: ActionItem[];
  open_questions_json: OpenQuestion[];
  topics_json: TopicSegmentItem[];
  graph_type: 'flowchart' | 'mindmap';
  graph_json: VisualGraph;
  validation_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface TopicSegment {
  id: string;
  meeting_id: string;
  title: string;
  summary: string;
  start_time: number;
  end_time: number;
  segment_order: number;
}

export interface Meeting {
  id: string;
  title: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
  status?: string;
  progress_percent?: number;
}

export interface MeetingDetail extends Meeting {
  normalized_audio_path?: string | null;
  transcript_segments: TranscriptSegment[];
  topic_segments: TopicSegment[];
  analysis?: MeetingAnalysis | null;
}

export interface JobProgress {
  job_id: string;
  status: string;
  progress_percent: number;
  stage_message: string;
  error_message?: string | null;
}

export interface SearchResultItem {
  meeting_id: string;
  meeting_title: string;
  topic_id: string;
  topic_title: string;
  summary: string;
  start_time: number;
  end_time: number;
  score: number;
}
