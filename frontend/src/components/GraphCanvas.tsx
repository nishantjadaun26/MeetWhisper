import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { VisualGraph, NodeType } from '../types/meeting';
import { formatTime } from '../utils/format';
import {
  Clock,
  User,
  CheckCircle2,
  CheckSquare,
  HelpCircle,
  Lightbulb,
  Compass,
  ArrowRight,
} from 'lucide-react';

export interface CustomNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  node_type: NodeType;
  timestamp_start: number;
  timestamp_end: number;
  speaker?: string | null;
  onSeek: (time: number) => void;
}

export type MeetingNodeType = Node<CustomNodeData, 'meetingNode'>;

interface GraphCanvasProps {
  graph: VisualGraph;
  graphType?: 'flowchart' | 'mindmap';
  onSeek: (time: number) => void;
}

const NODE_CONFIG: Record<
  NodeType,
  { border: string; bg: string; text: string; icon: React.ReactNode; glow: string }
> = {
  root: {
    border: 'border-cyan-500',
    bg: 'bg-slate-900/90',
    text: 'text-cyan-400',
    icon: <Compass className="h-3.5 w-3.5" />,
    glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
  },
  decision: {
    border: 'border-emerald-500',
    bg: 'bg-slate-900/90',
    text: 'text-emerald-400',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
  },
  action: {
    border: 'border-blue-500',
    bg: 'bg-slate-900/90',
    text: 'text-blue-400',
    icon: <CheckSquare className="h-3.5 w-3.5" />,
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
  },
  question: {
    border: 'border-amber-500',
    bg: 'bg-slate-900/90',
    text: 'text-amber-400',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
  },
  insight: {
    border: 'border-purple-500',
    bg: 'bg-slate-900/90',
    text: 'text-purple-400',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
  },
  milestone: {
    border: 'border-pink-500',
    bg: 'bg-slate-900/90',
    text: 'text-pink-400',
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    glow: 'shadow-[0_0_15px_rgba(236,72,153,0.3)]',
  },
  topic: {
    border: 'border-slate-700',
    bg: 'bg-slate-900/90',
    text: 'text-slate-300',
    icon: <Compass className="h-3.5 w-3.5" />,
    glow: 'shadow-md',
  },
  subtopic: {
    border: 'border-slate-800',
    bg: 'bg-slate-900/80',
    text: 'text-slate-400',
    icon: <Compass className="h-3.5 w-3.5" />,
    glow: 'shadow-sm',
  },
};

// Custom React Flow Node
const CustomMeetingNode: React.FC<NodeProps<MeetingNodeType>> = ({ data }) => {
  const nodeType: NodeType = data.node_type || 'topic';
  const config = NODE_CONFIG[nodeType] || NODE_CONFIG.topic;

  return (
    <div
      onClick={() => data.onSeek(data.timestamp_start)}
      className={`group relative flex min-w-[200px] max-w-[280px] cursor-pointer flex-col rounded-xl border-2 p-3 backdrop-blur transition-all duration-200 hover:scale-105 active:scale-95 ${config.border} ${config.bg} ${config.glow}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-2 !h-2" />

      {/* Header: Type Pill & Timestamp */}
      <div className="flex items-center justify-between mb-1.5">
        <div className={`flex items-center space-x-1 text-[11px] font-semibold uppercase tracking-wider ${config.text}`}>
          {config.icon}
          <span>{nodeType}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onSeek(data.timestamp_start);
          }}
          className="flex items-center space-x-1 rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 hover:bg-cyan-500/20"
          title="Click to seek audio"
        >
          <Clock className="h-2.5 w-2.5" />
          <span>{formatTime(data.timestamp_start)}</span>
        </button>
      </div>

      {/* Label */}
      <p className="text-xs font-medium leading-snug text-slate-100 mb-1">{data.label}</p>

      {/* Speaker if present */}
      {data.speaker && (
        <div className="mt-1 flex items-center text-[10px] text-slate-400">
          <User className="mr-1 h-2.5 w-2.5 text-slate-500" />
          <span>{data.speaker}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  meetingNode: CustomMeetingNode,
};

// Dagre Layout Algorithm
function getLayoutedElements(nodes: any[], edges: any[], direction = 'LR') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 110 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - 120,
        y: nodeWithPosition.y - 55,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graph,
  onSeek,
}) => {
  const [direction, setDirection] = React.useState<'LR' | 'TB'>('LR');

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const rawNodes = graph.nodes.map((n) => ({
      id: n.id,
      type: 'meetingNode',
      data: {
        ...n,
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
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      labelStyle: { fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
      labelBgPadding: [4, 4] as [number, number],
      labelBgBorderRadius: 4,
    }));

    const layout = getLayoutedElements(rawNodes, rawEdges, direction);
    return { initialNodes: layout.nodes, initialEdges: layout.edges };
  }, [graph, direction, onSeek]);

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

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Top Floating Controls */}
      <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 backdrop-blur shadow-lg">
        <button
          onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
          className="rounded px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
          title="Toggle layout direction"
        >
          {direction === 'LR' ? 'Horizontal →' : 'Vertical ↓'}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2.0}
      >
        <Background color="#334155" gap={20} size={1} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300 fill-slate-300 rounded-lg overflow-hidden shadow-lg" />
        <MiniMap
          nodeColor={(node: any) => {
            const type = node.data?.node_type;
            if (type === 'decision') return '#10b981';
            if (type === 'action') return '#3b82f6';
            if (type === 'question') return '#f59e0b';
            if (type === 'root') return '#22d3ee';
            return '#64748b';
          }}
          className="!bg-slate-900/90 !border-slate-800 !rounded-lg"
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  );
};
