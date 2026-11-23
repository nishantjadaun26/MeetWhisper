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
import { Clock } from 'lucide-react';

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

const TYPE_BADGES: Record<NodeType, { label: string; text: string; bg: string }> = {
  root: { label: 'Root', text: 'text-zinc-200', bg: 'bg-white/[0.08]' },
  decision: { label: 'Decision', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  action: { label: 'Action', text: 'text-sky-400', bg: 'bg-sky-500/10' },
  question: { label: 'Question', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  insight: { label: 'Insight', text: 'text-purple-400', bg: 'bg-purple-500/10' },
  milestone: { label: 'Milestone', text: 'text-pink-400', bg: 'bg-pink-500/10' },
  topic: { label: 'Topic', text: 'text-zinc-400', bg: 'bg-white/[0.04]' },
  subtopic: { label: 'Subtopic', text: 'text-zinc-400', bg: 'bg-white/[0.04]' },
};

// Custom Minimal React Flow Node
const CustomMeetingNode: React.FC<NodeProps<MeetingNodeType>> = ({ data }) => {
  const nodeType: NodeType = data.node_type || 'topic';
  const badge = TYPE_BADGES[nodeType] || TYPE_BADGES.topic;

  return (
    <div
      onClick={() => data.onSeek(data.timestamp_start)}
      className="group relative flex min-w-[210px] max-w-[260px] cursor-pointer flex-col rounded-xl border border-white/[0.08] bg-[#0c0e14] p-3 shadow-md transition-all duration-200 hover:border-white/[0.2] hover:bg-[#11141d] active:scale-[0.99]"
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-500 !w-1.5 !h-1.5 !border-0" />

      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${badge.text} ${badge.bg}`}>
          {badge.label}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onSeek(data.timestamp_start);
          }}
          className="flex items-center space-x-1 font-mono text-[10px] text-zinc-500 hover:text-sky-400 transition"
          title="Seek audio"
        >
          <Clock className="h-2.5 w-2.5" />
          <span>{formatTime(data.timestamp_start)}</span>
        </button>
      </div>

      {/* Label */}
      <p className="text-xs font-medium leading-snug text-zinc-200">{data.label}</p>

      {/* Speaker */}
      {data.speaker && (
        <span className="mt-1.5 font-mono text-[10px] text-zinc-500">
          {data.speaker}
        </span>
      )}

      <Handle type="source" position={Position.Right} className="!bg-zinc-500 !w-1.5 !h-1.5 !border-0" />
    </div>
  );
};

const nodeTypes = {
  meetingNode: CustomMeetingNode,
};

function getLayoutedElements(nodes: any[], edges: any[], direction = 'LR') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 35,
    ranksep: 70,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 230, height: 100 });
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
        x: nodeWithPosition.x - 115,
        y: nodeWithPosition.y - 50,
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
      animated: false,
      style: { stroke: '#3f3f46', strokeWidth: 1.5 },
      labelStyle: { fill: '#71717a', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#0c0e14', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
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
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#08090d] animate-slide-up">
      {/* Top Floating Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center space-x-1.5 rounded-lg border border-white/[0.08] bg-[#0c0e14]/90 p-1 backdrop-blur shadow-sm">
        <button
          onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
          className="rounded px-2 py-0.5 font-mono text-[11px] text-zinc-400 hover:text-white transition"
          title="Toggle orientation"
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
        minZoom={0.25}
        maxZoom={1.75}
      >
        <Background color="#1f232e" gap={20} size={1} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-[#0c0e14] !border-white/[0.08] !text-zinc-400 fill-zinc-400 rounded-lg overflow-hidden shadow-sm" />
        <MiniMap
          nodeColor="#3f3f46"
          className="!bg-[#0c0e14]/90 !border-white/[0.08] !rounded-lg"
          maskColor="rgba(8, 9, 13, 0.75)"
        />
      </ReactFlow>
    </div>
  );
};
