/**
 * Execution Trace Viewer - Animated walkthrough of execution flow.
 * Shows step-by-step execution through architecture components with
 * highlighted nodes and animated edges.
 */

import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react"
import { useEffect, useMemo } from "react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import type { ClusterGraph, ComponentExecutionTrace, RepoInventory } from "@shared/architecture-visualization/types"
import { AnimationControls } from "./AnimationControls"
import { ClusterNode } from "./ClusterNode"

// Register custom node types
const nodeTypes = {
	cluster: ClusterNode as any,
}

/**
 * Calculate node positions using Dagre layout algorithm
 */
function calculateLayout(nodes: Node[], edges: Edge[]): Node[] {
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))
	dagreGraph.setGraph({ rankdir: "TB", nodesep: 100, ranksep: 150 })

	// Add nodes
	nodes.forEach((node) => {
		const width = (node.style?.width as number) || 280
		const height = (node.style?.height as number) || 160
		dagreGraph.setNode(node.id, { width, height })
	})

	// Add edges
	edges.forEach((edge) => {
		dagreGraph.setEdge(edge.source, edge.target)
	})

	// Compute layout
	dagre.layout(dagreGraph)

	// Apply positions
	return nodes.map((node) => {
		const positioned = dagreGraph.node(node.id)
		const width = (node.style?.width as number) || 280
		const height = (node.style?.height as number) || 160

		return {
			...node,
			position: {
				x: positioned.x - width / 2,
				y: positioned.y - height / 2,
			},
		}
	})
}

interface Props {
	trace: ComponentExecutionTrace
	baseGraph: ClusterGraph
	inventory: RepoInventory
	currentStep: number
	onStepChange: (step: number) => void
	isPlaying: boolean
	onPlayToggle: () => void
}

export function ExecutionTraceViewer({ trace, baseGraph, inventory, currentStep, onStepChange, isPlaying, onPlayToggle }: Props) {
	// Get current step data
	const currentStepData = trace.steps[currentStep]

	// Get set of highlighted component IDs up to current step
	const activeComponentIds = useMemo(() => {
		return new Set(trace.steps.slice(0, currentStep + 1).map((s) => s.componentId))
	}, [trace.steps, currentStep])

	// Get set of animated edge IDs up to current step
	const activeEdgeIds = useMemo(() => {
		return new Set(trace.animatedEdges.filter((ae) => ae.animationOrder <= currentStep + 1).map((ae) => ae.edgeId))
	}, [trace.animatedEdges, currentStep])

	// Build nodes with highlighting
	const initialNodes = useMemo(() => {
		// Filter to only clusters with edges (participating in flow)
		const clustersWithEdges = new Set<string>()
		for (const edge of baseGraph.clusterEdges) {
			if (edge.source !== edge.target) {
				clustersWithEdges.add(edge.source)
				clustersWithEdges.add(edge.target)
			}
		}

		const nodes: Node[] = baseGraph.clusters
			.filter((cluster) => clustersWithEdges.has(cluster.id))
			.map((cluster) => {
				const isActive = activeComponentIds.has(cluster.id)
				const isCurrent = currentStepData?.componentId === cluster.id

				// Calculate opacity and border
				// Current node: full opacity, thick border, strong glow
				// Visited (not current): dimmed to emphasize current
				// Unvisited: very dim
				const opacity = isCurrent ? 1 : isActive ? 0.6 : 0.3
				const borderWidth = isCurrent ? 6 : 2
				const borderColor = isCurrent ? "#3b82f6" : cluster.color || "#6b7280"
				const boxShadow = isCurrent
					? "0 0 40px rgba(59, 130, 246, 1), 0 0 80px rgba(59, 130, 246, 0.6), 0 0 120px rgba(59, 130, 246, 0.3)"
					: undefined

				return {
					id: cluster.id,
					type: "cluster",
					position: { x: 0, y: 0 },
					data: {
						cluster,
						width: 280,
						height: 160,
						isCurrent, // Pass this to ClusterNode for styling
					},
					style: {
						width: 280,
						height: 160,
						opacity,
						border: `${borderWidth}px solid ${borderColor}`,
						boxShadow,
					},
				}
			})

		return nodes
	}, [baseGraph.clusters, baseGraph.clusterEdges, activeComponentIds, currentStepData])

	// Build edges with animation
	const initialEdges = useMemo(() => {
		const edges: Edge[] = []

		for (const clusterEdge of baseGraph.clusterEdges) {
			// Skip self-loops
			if (clusterEdge.source === clusterEdge.target) continue

			const isActive = activeEdgeIds.has(clusterEdge.id)

			edges.push({
				id: clusterEdge.id,
				source: clusterEdge.source,
				target: clusterEdge.target,
				label: clusterEdge.label || undefined,
				type: "smoothstep",
				animated: isActive,
				style: {
					strokeWidth: isActive ? 4 : 2,
					stroke: isActive ? "#3b82f6" : "#6b7280",
					cursor: "default",
				},
				labelStyle: {
					fontSize: 14,
					fill: "#fff",
					cursor: "default",
				},
				labelBgStyle: {
					fill: "#1f2937",
					fillOpacity: 0.9,
				},
			})
		}

		return edges
	}, [baseGraph.clusterEdges, activeEdgeIds])

	// Apply layout
	const layoutedNodes = useMemo(() => calculateLayout(initialNodes, initialEdges), [initialNodes, initialEdges])

	const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

	// Update nodes and edges when step changes
	useEffect(() => {
		const updatedNodes = calculateLayout(initialNodes, initialEdges)
		setNodes(updatedNodes)
		setEdges(initialEdges)
	}, [initialNodes, initialEdges, setNodes, setEdges])

	return (
		<div className="relative h-full bg-vscode-editor-background">
			<ReactFlow
				attributionPosition="bottom-left"
				className="bg-vscode-editor-background"
				edges={edges}
				elementsSelectable={true}
				fitView
				nodes={nodes}
				nodesConnectable={false}
				nodesDraggable={false}
				nodeTypes={nodeTypes}
				onEdgesChange={onEdgesChange}
				onNodesChange={onNodesChange}>
				<Background color="#374151" gap={20} size={1} variant={BackgroundVariant.Dots} />
				<Controls
					className="!bg-vscode-editor-background !border-vscode-panel-border !shadow-lg"
					showFitView={true}
					showInteractive={false}
					showZoom={true}
				/>
			</ReactFlow>

			{/* Animation Controls Overlay */}
			<AnimationControls
				currentStep={currentStep}
				isPlaying={isPlaying}
				onPlay={onPlayToggle}
				onReset={() => onStepChange(0)}
				onStepBack={() => onStepChange(Math.max(0, currentStep - 1))}
				onStepForward={() => onStepChange(Math.min(trace.steps.length - 1, currentStep + 1))}
				totalSteps={trace.steps.length}
			/>
		</div>
	)
}
