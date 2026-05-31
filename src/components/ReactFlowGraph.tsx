"use client";

import React, { useCallback, useEffect, useMemo } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

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

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 50;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    const s = edge.source || edge.source;
    const t = edge.target || edge.target;
    if (s && t) {
      dagreGraph.setEdge(s, t);
    }
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
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
        position: { x: 0, y: 0 },
        data: { label: n.label || n.id, subject: subj, tags: n.tags || [] },
        style: {
          background: isSelected ? bgColor : '#1e293b',
          color: isSelected ? '#fff' : '#cbd5e1',
          border: `2px solid ${bgColor}`,
          borderRadius: '8px',
          padding: '10px',
          fontWeight: 'bold',
          width: 200,
          opacity: selectedId && !isSelected ? 0.4 : 1,
          transition: 'all 0.3s ease'
        },
      };
    });

    const mappedEdges: Edge[] = edges.map((e, idx) => ({
      id: `e-${idx}`,
      source: (e.source || e.from) as string,
      target: (e.target || e.to) as string,
      animated: true,
      label: e.label,
      style: { stroke: '#475569', strokeWidth: 2 },
    }));

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
        // Reconstruct the GraphNode to pass back
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickInternal}
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} nodeColor={(node) => (subjectColor ? subjectColor(node.data.subject as string) : '#6366f1')} />
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
