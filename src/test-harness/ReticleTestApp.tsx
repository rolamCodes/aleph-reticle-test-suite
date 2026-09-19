import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ContextNode from "../ContextNode";
import InteractionEdge from "../InteractionEdge";
import type { PointedTarget } from "../types";

import ReticleBenchmarkHUD, { type ReticleImplType } from "./ReticleBenchmarkHUD";
import {
  generateStressTestGraph,
  initialTestEdges,
  initialTestNodes,
} from "./staticGraphData";

import ReticleImpl1_Baseline from "./reticle-implementations/ReticleImpl1_Baseline";
import ReticleImpl2_EventDelegation from "./reticle-implementations/ReticleImpl2_EventDelegation";
import ReticleImpl3_GPUTransform from "./reticle-implementations/ReticleImpl3_GPUTransform";
import ReticleImpl4_ViewportMath from "./reticle-implementations/ReticleImpl4_ViewportMath";
import ReticleImpl5_HybridSmooth from "./reticle-implementations/ReticleImpl5_HybridSmooth";
import ReticleImpl6_MagneticTrailingPackage from "./reticle-implementations/ReticleImpl6_MagneticTrailingPackage";

const nodeTypes = { context: ContextNode } satisfies NodeTypes;
const edgeTypes = { interaction: InteractionEdge } satisfies EdgeTypes;

function ReticleTestCanvas() {
  const [activeImpl, setActiveImpl] = useState<ReticleImplType>("baseline");
  const [stressMode, setStressMode] = useState(false);
  const [showDebugHitboxes, setShowDebugHitboxes] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialTestNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialTestEdges);
  const [pointedTarget, setPointedTarget] = useState<PointedTarget>({
    kind: "canvas",
  });

  const queryCountRef = useRef(0);
  const reflowCountRef = useRef(0);
  const [queryCountPerSec, setQueryCountPerSec] = useState(0);
  const [reflowCountPerSec, setReflowCountPerSec] = useState(0);

  // Measure queries & reflows per second
  useEffect(() => {
    const interval = setInterval(() => {
      setQueryCountPerSec(queryCountRef.current);
      setReflowCountPerSec(reflowCountRef.current);
      queryCountRef.current = 0;
      reflowCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRecordQuery = useCallback(() => {
    queryCountRef.current++;
  }, []);

  const handleRecordReflow = useCallback(() => {
    reflowCountRef.current++;
  }, []);

  // Update nodes when stress mode toggles
  useEffect(() => {
    if (stressMode) {
      const { nodes: stressNodes, edges: stressEdges } = generateStressTestGraph(50);
      setNodes(stressNodes);
      setEdges(stressEdges);
    } else {
      setNodes(initialTestNodes);
      setEdges(initialTestEdges);
    }
  }, [stressMode, setNodes, setEdges]);

  // Target label for selected element
  const getTargetLabel = (): string => {
    if (pointedTarget.kind === "context") return `Context: ${pointedTarget.id}`;
    if (pointedTarget.kind === "component") return `Component: ${pointedTarget.id}`;
    if (pointedTarget.kind === "element") return `Element: ${pointedTarget.id}`;
    if (pointedTarget.kind === "edge") return `Edge: ${pointedTarget.id}`;
    return "Canvas";
  };

  const implProps = {
    pointedTarget,
    onTargetChange: setPointedTarget,
    targetLabel: getTargetLabel(),
    onRecordQuery: handleRecordQuery,
    onRecordReflow: handleRecordReflow,
  };

  return (
    <div className={`reticle-test-wrapper ${showDebugHitboxes ? "show-hitboxes" : ""}`}>
      <ReticleBenchmarkHUD
        activeImpl={activeImpl}
        onImplChange={setActiveImpl}
        stressMode={stressMode}
        onStressModeChange={setStressMode}
        showDebugHitboxes={showDebugHitboxes}
        onDebugHitboxesChange={setShowDebugHitboxes}
        queryCountPerSec={queryCountPerSec}
        reflowCountPerSec={reflowCountPerSec}
      />

      <div className="reticle-test-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background color="#334155" gap={16} />
        </ReactFlow>
      </div>

      {activeImpl === "baseline" && <ReticleImpl1_Baseline {...implProps} />}
      {activeImpl === "event-delegation" && <ReticleImpl2_EventDelegation {...implProps} />}
      {activeImpl === "gpu-transform" && <ReticleImpl3_GPUTransform {...implProps} />}
      {activeImpl === "viewport-math" && <ReticleImpl4_ViewportMath {...implProps} />}
      {activeImpl === "hybrid-smooth" && <ReticleImpl5_HybridSmooth {...implProps} />}
      {activeImpl === "marketing-lerp-package" && (
        <ReticleImpl6_MagneticTrailingPackage {...implProps} />
      )}
    </div>
  );
}

export default function ReticleTestApp() {
  return (
    <ReactFlowProvider>
      <ReticleTestCanvas />
    </ReactFlowProvider>
  );
}
