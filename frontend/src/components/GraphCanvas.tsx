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
import { Clock, GitBranch, Loader2 } from 'lucide-react';

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
  onGenerateFlowchart?: () => void;
  isGenerating?: boolean;
}

const TYPE_BADGES: Record<NodeType, { label: string; text: string; bg: string }> = {
  root: { label: 'Root', text: 'text-[#C4B5FD]', bg: 'bg-[#C4B5FD]/10 border border-[#C4B5FD]/30' },
  decision: { label: 'Decision', text: 'text-[#67E8F9]', bg: 'bg-[#67E8F9]/10 border border-[#67E8F9]/30' },
  action: { label: 'Action', text: 'text-[#67E8F9]', bg: 'bg-[#67E8F9]/10 border border-[#67E8F9]/30' },
  question: { label: 'Question', text: 'text-[#C4B5FD]', bg: 'bg-[#C4B5FD]/10 border border-[#C4B5FD]/30' },
  insight: { label: 'Insight', text: 'text-[#C4B5FD]', bg: 'bg-[#C4B5FD]/10 border border-[#C4B5FD]/30' },
  milestone: { label: 'Milestone', text: 'text-[#67E8F9]', bg: 'bg-[#67E8F9]/10 border border-[#67E8F9]/30' },
  topic: { label: 'Topic', text: 'text-[#B3AFCB]', bg: 'bg-white/[0.04] border border-[#2E2B45]' },
  subtopic: { label: 'Subtopic', text: 'text-[#B3AFCB]', bg: 'bg-white/[0.04] border border-[#2E2B45]' },
};

// Custom Minimal React Flow Node
const MeetingNode: React.FC<NodeProps<MeetingNodeType>> = ({ data }) => {
  const badge = TYPE_BADGES[data.node_type] || TYPE_BADGES.topic;

  return (
    <div
      onClick={() => data.onSeek(data.timestamp_start)}
      className="group relative flex w-60 flex-col rounded-xl border border-[#2E2B45] bg-[#09090F] p-3 shadow-md transition-all duration-200 hover:border-[#C4B5FD] hover:shadow-xl cursor-pointer"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !rounded-full !border-2 !border-[#09090F] !bg-[#C4B5FD]"
      />

      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onSeek(data.timestamp_start);
          }}
          className="flex items-center space-x-1 font-mono text-[10px] text-[#67E8F9] hover:underline"
          title="Seek audio/video"
        >
          <Clock className="h-2.5 w-2.5" />
          <span>{formatTime(data.timestamp_start)}</span>
        </button>
      </div>

      <p className="text-xs font-medium text-[#F1EFFA] leading-snug line-clamp-2 group-hover:text-white transition">
        {data.label}
      </p>

      {data.speaker && (
        <span className="mt-2 text-[10px] font-mono text-[#B3AFCB] truncate">
          {data.speaker}
        </span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !rounded-full !border-2 !border-[#09090F] !bg-[#67E8F9]"
      />
    </div>
  );
};

const nodeTypes = {
  meetingNode: MeetingNode,
};

// Dagre Layout Calculator
const nodeWidth = 260;
const nodeHeight = 110;

function getLayoutedElements(
  nodes: Node[],
  edges: any[],
  direction = 'LR'
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 70,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graph,
  onSeek,
  onGenerateFlowchart,
  isGenerating,
}) => {
  const [direction, setDirection] = React.useState<'LR' | 'TB'>('LR');

  const hasNodes = Boolean(graph && graph.nodes && graph.nodes.length > 0);

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
      style: { stroke: '#2E2B45', strokeWidth: 1.5 },
      labelStyle: { fill: '#B3AFCB', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#09090F', fillOpacity: 0.9 },
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

  if (!hasNodes) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-fade rounded-xl border border-[#2E2B45] bg-[#09090F]">
        <div className="h-10 w-10 rounded-full bg-white/[0.04] border border-[#2E2B45] flex items-center justify-center text-[#B3AFCB] mb-3">
          <GitBranch className="h-5 w-5 text-[#C4B5FD]" />
        </div>
        <h3 className="text-xs font-semibold text-[#F1EFFA] mb-1">Visual Flowchart Not Generated</h3>
        <p className="text-[11px] text-[#B3AFCB] max-w-xs mb-4">
          You chose Notes Only during upload. You can synthesize a visual decision flowchart on demand.
        </p>
        {onGenerateFlowchart && (
          <button
            onClick={onGenerateFlowchart}
            disabled={isGenerating}
            className="flex items-center space-x-1.5 rounded-lg border border-[#C4B5FD]/30 bg-[#C4B5FD]/10 px-3.5 py-1.5 text-xs font-medium text-[#C4B5FD] hover:bg-[#C4B5FD]/20 transition active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="h-3.5 w-3.5" />
            )}
            <span>{isGenerating ? 'Generating Flowchart...' : 'Generate Visual Flowchart'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-[#2E2B45] bg-[#09090F] animate-slide-up">
      {/* Top Floating Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center space-x-1.5 rounded-lg border border-[#2E2B45] bg-[#09090F]/90 p-1 backdrop-blur shadow-sm">
        <button
          onClick={() => setDirection(direction === 'LR' ? 'TB' : 'LR')}
          className="rounded px-2 py-0.5 font-mono text-[11px] text-[#B3AFCB] hover:text-[#F1EFFA] transition"
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
        <Background color="#2E2B45" gap={20} size={1} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-[#09090F] !border-[#2E2B45] !text-[#B3AFCB] fill-[#B3AFCB] rounded-lg overflow-hidden shadow-sm" />
        <MiniMap
          nodeColor="#2E2B45"
          className="!bg-[#09090F]/90 !border-[#2E2B45] !rounded-lg"
          maskColor="rgba(9, 9, 15, 0.75)"
        />
      </ReactFlow>
    </div>
  );
};
