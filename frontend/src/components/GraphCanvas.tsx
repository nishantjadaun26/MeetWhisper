import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { VisualGraph, NodeType } from '../types/meeting';
import { formatTime } from '../utils/format';
import {
  Clock,
  GitBranch,
  Loader2,
  User,
  Compass,
  CheckCircle2,
  Zap,
  HelpCircle,
  Lightbulb,
  Flag,
  Layers,
} from 'lucide-react';

export interface CustomNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  node_type: NodeType;
  timestamp_start: number;
  timestamp_end: number;
  speaker?: string | null;
  stepIndex?: number;
  onSeek: (time: number) => void;
}

export type MeetingNodeType = Node<CustomNodeData, 'meetingNode'>;

interface GraphCanvasProps {
  graph: VisualGraph;
  graphType?: 'flowchart' | 'mindmap';
  hasContent?: boolean;
  onSeek: (time: number) => void;
  onGenerateFlowchart?: () => void;
  isGenerating?: boolean;
}

const TYPE_STYLES: Record<
  NodeType,
  { label: string; text: string; bg: string; accentBar: string; icon: React.FC<{ className?: string }> }
> = {
  root: {
    label: 'Root',
    text: 'text-[var(--accent-violet)]',
    bg: 'bg-[var(--accent-violet)]/12 border border-[var(--accent-violet)]/35',
    accentBar: 'from-[var(--accent-violet)] to-[var(--accent-cyan)]',
    icon: Compass,
  },
  decision: {
    label: 'Decision',
    text: 'text-[var(--accent-cyan)]',
    bg: 'bg-[var(--accent-cyan)]/12 border border-[var(--accent-cyan)]/35',
    accentBar: 'from-[var(--accent-cyan)] to-[var(--accent-cyan)]/50',
    icon: CheckCircle2,
  },
  action: {
    label: 'Action',
    text: 'text-[var(--accent-cyan)]',
    bg: 'bg-[var(--accent-cyan)]/12 border border-[var(--accent-cyan)]/35',
    accentBar: 'from-[var(--accent-cyan)] to-[var(--accent-violet)]',
    icon: Zap,
  },
  question: {
    label: 'Question',
    text: 'text-[var(--accent-violet)]',
    bg: 'bg-[var(--accent-violet)]/12 border border-[var(--accent-violet)]/35',
    accentBar: 'from-[var(--accent-violet)] to-[var(--accent-violet)]/50',
    icon: HelpCircle,
  },
  insight: {
    label: 'Insight',
    text: 'text-[var(--accent-violet)]',
    bg: 'bg-[var(--accent-violet)]/12 border border-[var(--accent-violet)]/35',
    accentBar: 'from-[var(--accent-violet)] to-[var(--accent-cyan)]',
    icon: Lightbulb,
  },
  milestone: {
    label: 'Milestone',
    text: 'text-[var(--accent-cyan)]',
    bg: 'bg-[var(--accent-cyan)]/12 border border-[var(--accent-cyan)]/35',
    accentBar: 'from-[var(--accent-cyan)] to-[var(--accent-violet)]',
    icon: Flag,
  },
  topic: {
    label: 'Topic',
    text: 'text-[var(--text-secondary)]',
    bg: 'bg-[var(--subtle-fill)] border border-[var(--border)]',
    accentBar: 'from-[var(--accent-violet)]/60 to-[var(--border)]',
    icon: Layers,
  },
  subtopic: {
    label: 'Subtopic',
    text: 'text-[var(--text-secondary)]',
    bg: 'bg-[var(--subtle-fill)] border border-[var(--border)]',
    accentBar: 'from-[var(--accent-cyan)]/60 to-[var(--border)]',
    icon: Layers,
  },
};

// Big, Appealing React Flow Node Card
const MeetingNode: React.FC<NodeProps<MeetingNodeType>> = ({
  data,
  targetPosition = Position.Left,
  sourcePosition = Position.Right,
}) => {
  const style = TYPE_STYLES[data.node_type] || TYPE_STYLES.topic;
  const Icon = style.icon;
  const stepNum =
    data.stepIndex !== undefined ? String(data.stepIndex + 1).padStart(2, '0') : null;

  return (
    <div
      onClick={() => data.onSeek(data.timestamp_start)}
      className="group relative flex w-[300px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-bg)] p-4 shadow-lg transition-all duration-200 hover:border-[var(--accent-violet)] hover:shadow-[0_8px_30px_rgba(196,181,253,0.18)] hover:-translate-y-0.5 cursor-pointer"
    >
      {/* Top Gradient Accent Bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.accentBar}`} />

      <Handle
        type="target"
        position={targetPosition}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--panel-bg)] !bg-[var(--accent-violet)]"
      />

      {/* Header Row: Step + Category Badge + Timestamp */}
      <div className="flex items-center justify-between mb-2.5 pt-0.5">
        <div className="flex items-center space-x-2">
          {stepNum && (
            <span className="font-mono text-[10px] font-semibold text-[var(--text-secondary)]/70">
              {stepNum}
            </span>
          )}
          <span
            className={`inline-flex items-center space-x-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}
          >
            <Icon className="h-3 w-3" />
            <span>{style.label}</span>
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onSeek(data.timestamp_start);
          }}
          className="flex items-center space-x-1 rounded-md border border-[var(--accent-cyan)]/25 bg-[var(--accent-cyan)]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/20 transition"
          title="Jump to this moment in recording"
        >
          <Clock className="h-2.5 w-2.5" />
          <span>{formatTime(data.timestamp_start)}</span>
        </button>
      </div>

      {/* Main Node Title / Label */}
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-3 group-hover:text-[var(--accent-violet)] transition">
        {data.label}
      </p>

      {/* Footer: Speaker */}
      {data.speaker && (
        <div className="mt-3 pt-2 border-t border-[var(--border)]/60 flex items-center space-x-1.5 text-[11px] font-mono text-[var(--text-secondary)] truncate">
          <User className="h-3 w-3 shrink-0 text-[var(--accent-violet)]" />
          <span className="truncate">{data.speaker}</span>
        </div>
      )}

      <Handle
        type="source"
        position={sourcePosition}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[var(--panel-bg)] !bg-[var(--accent-cyan)]"
      />
    </div>
  );
};

const nodeTypes = {
  meetingNode: MeetingNode,
};

const NODE_WIDTH = 300;
const NODE_HEIGHT = 148;

/**
 * Computes a compact, balanced layout that avoids super-long single lines.
 * - For sequential or mostly-linear graphs, wraps into a 3-column serpentine S-flow.
 * - For branching graphs, uses a compact top-to-bottom Dagre layout.
 */
function getBalancedLayoutedElements(nodes: Node[], edges: any[]) {
  if (nodes.length === 0) return { nodes, edges };

  // Check branching factor (max outgoing edges from any node)
  const outDegree: Record<string, number> = {};
  edges.forEach((e) => {
    outDegree[e.source] = (outDegree[e.source] || 0) + 1;
  });
  const maxOut = Math.max(0, ...Object.values(outDegree));

  // If sequential / linear (or small), wrap into a compact 3-column serpentine flow
  if (maxOut <= 1) {
    const cols = nodes.length <= 2 ? nodes.length : 3;
    const xGap = 470;
    const yGap = 270;

    const layoutedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const colInRow = index % cols;
      const isReversedRow = row % 2 === 1;
      const col = isReversedRow ? cols - 1 - colInRow : colInRow;

      let targetPosition = Position.Left;
      let sourcePosition = Position.Right;

      if (isReversedRow) {
        targetPosition = colInRow === 0 ? Position.Top : Position.Right;
        sourcePosition = colInRow === cols - 1 ? Position.Bottom : Position.Left;
      } else {
        targetPosition = row > 0 && colInRow === 0 ? Position.Top : Position.Left;
        sourcePosition = colInRow === cols - 1 ? Position.Bottom : Position.Right;
      }

      return {
        ...node,
        targetPosition,
        sourcePosition,
        position: {
          x: col * xGap,
          y: row * yGap,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  // Branching graph: compact Top-to-Bottom Dagre layout
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    nodesep: 90,
    ranksep: 115,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graph,
  hasContent = true,
  onSeek,
  onGenerateFlowchart,
  isGenerating,
}) => {
  const hasNodes = Boolean(graph && graph.nodes && graph.nodes.length > 0);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const rawNodes: Node[] = graph.nodes.map((n, idx) => ({
      id: n.id,
      type: 'meetingNode',
      data: {
        ...n,
        stepIndex: idx,
        onSeek,
      },
      position: { x: 0, y: 0 },
    }));

    const rawEdges = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--accent-violet)',
        width: 18,
        height: 18,
      },
      style: { stroke: 'var(--accent-violet)', strokeWidth: 2, opacity: 0.75 },
      labelStyle: {
        fill: 'var(--text-primary)',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'IBM Plex Mono, monospace',
      },
      labelBgStyle: {
        fill: 'var(--panel-bg)',
        stroke: 'var(--border)',
        strokeWidth: 1,
        fillOpacity: 0.95,
      },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 6,
    }));

    const layout = getBalancedLayoutedElements(rawNodes, rawEdges);
    return { initialNodes: layout.nodes, initialEdges: layout.edges };
  }, [graph, onSeek]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: any, node: any) => {
      if (node?.data?.timestamp_start !== undefined) {
        onSeek(node.data.timestamp_start);
      }
    },
    [onSeek]
  );

  if (!hasNodes) {
    if (!hasContent) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-fade rounded-xl border border-[var(--border)] bg-[var(--panel-bg)]">
          <div className="h-12 w-12 rounded-full bg-[var(--subtle-fill)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] mb-3">
            <GitBranch className="h-6 w-6 text-[var(--text-secondary)]/40" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            Not Enough Content for a Flowchart
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm">
            This recording contains no spoken dialogue or structured discussion to map into a flowchart.
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-fade rounded-xl border border-[var(--border)] bg-[var(--panel-bg)]">
        <div className="h-12 w-12 rounded-full bg-[var(--subtle-fill)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] mb-3">
          <GitBranch className="h-6 w-6 text-[var(--accent-violet)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
          Visual Flowchart Not Generated
        </h3>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm mb-5">
          You chose Notes Only during upload. You can synthesize a visual decision flowchart on demand.
        </p>
        {onGenerateFlowchart && (
          <button
            onClick={onGenerateFlowchart}
            disabled={isGenerating}
            className="btn-gradient !h-10 !px-5 !text-xs flex items-center space-x-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4" />
            )}
            <span>{isGenerating ? 'Generating Flowchart...' : 'Generate Visual Flowchart'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] animate-slide-up">
      {/* Subtle Top-Left Legend Pill */}
      <div className="pointer-events-none absolute left-3.5 top-3.5 z-10 flex items-center space-x-2 rounded-lg border border-[var(--border)] bg-[var(--panel-bg)]/90 px-3 py-1.5 backdrop-blur shadow-sm">
        <GitBranch className="h-3.5 w-3.5 text-[var(--accent-violet)]" />
        <span className="font-mono text-[11px] font-medium text-[var(--text-primary)]">
          Interactive Flow
        </span>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
          · Click any node to verify timestamp
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.14, maxZoom: 1.35 }}
        minZoom={0.35}
        maxZoom={1.75}
      >
        <Background color="var(--border)" gap={24} size={1.2} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-[var(--panel-bg)] !border-[var(--border)] !text-[var(--text-secondary)] fill-[var(--text-secondary)] rounded-lg overflow-hidden shadow-md" />
      </ReactFlow>
    </div>
  );
};
