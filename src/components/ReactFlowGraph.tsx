"use client";

import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// Premium Glassmorphic Node Component
const GlassmorphicNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const bgColor = data.bgColor || '#6366f1';
  
  return (
    <div className={`relative px-4 py-3.5 rounded-2xl border transition-all duration-300 backdrop-blur-md shadow-lg w-[220px] text-left overflow-hidden group ${
      selected 
        ? "border-indigo-400 bg-indigo-950/20 dark:bg-indigo-950/40 shadow-indigo-500/10 scale-105" 
        : "border-slate-800/85 bg-slate-900/70 dark:bg-[#111726]/40 hover:border-slate-700/80"
    }`}>
      {/* Dynamic Glow Halo */}
      {selected && (
        <div 
          className="absolute -inset-0.5 rounded-2xl opacity-40 blur-md -z-10 animate-pulse transition-opacity" 
          style={{ backgroundColor: bgColor }}
        />
      )}
      
      {/* Top Category Badge Accent */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: bgColor }} />
      
      {/* Node Content */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 select-none">
          {data.subject}
        </span>
        <span className="text-xs font-bold text-slate-100 group-hover:text-white leading-snug line-clamp-2">
          {data.label}
        </span>
        {data.tags && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.tags.slice(0, 2).map((t: string) => (
              <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-800/60 text-slate-400 rounded-md">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="opacity-0 w-2 h-2" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 w-2 h-2" />
    </div>
  );
};

// Registered Custom Node Type Mapping
const nodeTypes = {
  glassNode: GlassmorphicNode,
};

export interface GraphNode {
  id: string;
  label?: string;
  subject?: string;
  tags?: string[];
  [key: string]: any;
}

export interface GraphEdge {
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  from_title?: string;
  to_title?: string;
  label?: string;
  [key: string]: any;
}

export interface ReactFlowGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string;
  onNodeClick?: (node: GraphNode) => void;
  subjectColor?: (subject: string) => string;
}

const nodeWidth = 220;
const nodeHeight = 70;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  
  // Fix global singleton memory leak: instantiate fresh Dagre instance inside execution block
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({ rankdir: direction });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    const s = edge.source;
    const t = edge.target;
    if (s && t) {
      dagreGraph.setEdge(s, t);
    }
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
    return newNode;
  });

  return { nodes: newNodes as Node[], edges };
};

function FlowGraphInner({ nodes, edges, selectedId, onNodeClick, subjectColor }: ReactFlowGraphProps) {
  const [rfNodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const mappedNodes: Node[] = nodes.map((n) => {
      const isSelected = n.id === selectedId;
      const subj = n.subject || 'General';
      const bgColor = subjectColor ? subjectColor(subj) : '#6366f1';
      return {
        id: n.id,
        type: 'glassNode', // Use premium custom node type
        position: { x: 0, y: 0 },
        data: { 
          label: n.label || n.id, 
          subject: subj, 
          tags: n.tags || [],
          bgColor: bgColor
        },
        selected: isSelected,
      };
    });

    const mappedEdges: Edge[] = edges.map((e, idx) => {
      const isSelectedEdge = e.source === selectedId || e.from === selectedId || e.target === selectedId || e.to === selectedId;
      return {
        id: `e-${idx}`,
        source: (e.source || e.from) as string,
        target: (e.target || e.to) as string,
        animated: true,
        label: e.label,
        // Marching Dash effect with visual feedback on selected node link pathways
        style: { 
          stroke: isSelectedEdge ? '#818cf8' : '#334155', 
          strokeWidth: isSelectedEdge ? 2.5 : 1.5,
          strokeDasharray: isSelectedEdge ? '6,6' : '0',
          transition: 'all 0.3s ease'
        },
      };
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      mappedNodes,
      mappedEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodes, edges, selectedId, subjectColor, setNodes, setEdges]);

  const onNodeClickInternal = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick({
          id: node.id,
          label: node.data.label as string,
          subject: node.data.subject as string,
          tags: node.data.tags as string[],
        });
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickInternal}
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
        <Controls className="!bg-slate-900 !border-slate-800 !text-white [&_button]:hover:!bg-slate-800 [&_svg]:!fill-white" />
        <MiniMap 
          nodeStrokeWidth={3} 
          nodeColor={(node) => (node.data?.bgColor as string || '#6366f1')}
          style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '12px' }}
        />
      </ReactFlow>
    </div>
  );
}

export default function ReactFlowGraph(props: ReactFlowGraphProps) {
  return (
    <ReactFlowProvider>
      <FlowGraphInner {...props} />
    </ReactFlowProvider>
  );
}
