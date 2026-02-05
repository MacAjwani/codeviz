import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
	Panel,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react"
import { useEffect, useMemo, useState } from "react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import type { Cluster, ClusterGraph, RepoInventory } from "@shared/architecture-visualization/types"
import { ClusterDetailModal } from "./ClusterDetailModal"
import { ClusterNode } from "./ClusterNode"

// Register custom node types
const nodeTypes = {
	cluster: ClusterNode as any,
}

/**
 * Layer-based color palette.
 * Colors are assigned based on the cluster's architectural layer.
 */
const LAYER_COLORS: Record<string, string> = {
	presentation: "#3b82f6", // Blue - UI layer
	business: "#10b981", // Green - Business logic
	data: "#f59e0b", // Amber - Data access
	infrastructure: "#8b5cf6", // Purple - Infrastructure/services
}

/**
 * Get layer rank for vertical positioning.
 * Lower rank = higher on screen (data flows top to bottom).
 * Order: Frontend (presentation) > Business logic > Data > Backend (infrastructure)
 */
function getLayerRank(layer?: string): number {
	switch (layer) {
		case "presentation":
			return 0 // Top - frontend/UI
		case "business":
			return 1 // Middle-top - business logic
		case "data":
			return 2 // Middle-bottom - data access
		case "infrastructure":
			return 3 // Bottom - backend services
		default:
			return 1.5 // Default between business and data
	}
}

/**
 * Apply Dagre layout to cluster nodes with layer-based ranking.
 * Organizes nodes top-to-bottom by data flow (presentation → business → data → infrastructure).
 */
function getLayoutedNodes(nodes: Node[], edges: Edge[]): Node[] {
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))

	dagreGraph.setGraph({
		rankdir: "TB", // Top to bottom
		ranker: "network-simplex", // Better ranking algorithm
		nodesep: 100, // Horizontal spacing between nodes
		ranksep: 180, // Vertical spacing between ranks (layers)
		edgesep: 50, // Spacing between edges
		marginx: 50,
		marginy: 50,
		acyclicer: "greedy", // Handle cycles
	})

	// Group nodes by layer rank for proper positioning
	const nodesByRank = new Map<number, typeof nodes>()
	nodes.forEach((node) => {
		const layer = (node.data as any).cluster?.layer
		const rank = getLayerRank(layer)
		if (!nodesByRank.has(rank)) {
			nodesByRank.set(rank, [])
		}
		nodesByRank.get(rank)!.push(node)
	})

	// Add nodes with explicit rank constraints
	nodes.forEach((node) => {
		const layer = (node.data as any).cluster?.layer
		const rank = getLayerRank(layer)
		dagreGraph.setNode(node.id, {
			width: 250,
			height: 150,
		})
		// Force rank by setting it directly on the graph node
		const graphNode = dagreGraph.node(node.id)
		if (graphNode) {
			graphNode.rank = rank
		}
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
		return {
			...node,
			position: {
				x: positioned.x - 125,
				y: positioned.y - 75,
			},
		}
	})
}

interface Props {
	clusterGraph: ClusterGraph
	inventory: RepoInventory
}

export function ArchitectureDiagramViewer({ clusterGraph, inventory }: Props) {
	const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)

	// Convert clusters to React Flow nodes with layer-based colors
	const initialNodes = useMemo(() => {
		// First, determine which clusters have edges (participate in data flow)
		const clustersWithEdges = new Set<string>()
		for (const edge of clusterGraph.clusterEdges) {
			// Get layer ranks to apply same filtering as edges
			const sourceCluster = clusterGraph.clusters.find((c) => c.id === edge.source)
			const targetCluster = clusterGraph.clusters.find((c) => c.id === edge.target)

			// Skip same-layer and self-loop edges (same filtering as edge creation)
			if (edge.source === edge.target) continue
			const sourceRank = getLayerRank(sourceCluster?.layer)
			const targetRank = getLayerRank(targetCluster?.layer)
			if (sourceRank === targetRank) continue

			// This edge will be shown, so include both clusters
			clustersWithEdges.add(edge.source)
			clustersWithEdges.add(edge.target)
		}

		console.log("[ArchitectureDiagramViewer] Clusters with edges:", Array.from(clustersWithEdges))

		// Only create nodes for clusters that participate in data flow
		const nodes: Node[] = clusterGraph.clusters
			.filter((cluster) => clustersWithEdges.has(cluster.id))
			.map((cluster) => {
				// Assign color based on layer, or use cluster's color, or default
				const layerColor = cluster.layer ? LAYER_COLORS[cluster.layer] : undefined
				const color = layerColor || cluster.color || "#6b7280"

				return {
					id: cluster.id,
					type: "cluster",
					position: { x: 0, y: 0 }, // Layout will position
					data: {
						cluster: {
							...cluster,
							color, // Override with layer-based color
						},
						onClusterClick: (clusterId: string) => {
							const cluster = clusterGraph.clusters.find((c) => c.id === clusterId)
							if (cluster) {
								setSelectedCluster(cluster)
							}
						},
					},
				}
			})

		console.log(`[ArchitectureDiagramViewer] Filtered nodes: ${nodes.length} of ${clusterGraph.clusters.length} clusters`)

		const edges: Edge[] = clusterGraph.clusterEdges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			label: `${edge.label} (${edge.weight})`,
			type: "smoothstep",
			style: {
				strokeWidth: Math.max(2, Math.min(8, edge.weight / 5)),
			},
			labelStyle: {
				fontSize: 11,
				fill: "#9ca3af",
			},
		}))

		return getLayoutedNodes(nodes, edges)
	}, [clusterGraph])

	const initialEdges = useMemo(() => {
		console.log("[ArchitectureDiagramViewer] Creating edges from clusterGraph:", {
			edgeCount: clusterGraph.clusterEdges.length,
			edges: clusterGraph.clusterEdges,
		})

		// Get all valid cluster IDs
		const validClusterIds = new Set(clusterGraph.clusters.map((c) => c.id))

		console.log("[ArchitectureDiagramViewer] Valid cluster IDs:", Array.from(validClusterIds))
		console.log(
			"[ArchitectureDiagramViewer] Edge source/target IDs:",
			clusterGraph.clusterEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
		)

		return clusterGraph.clusterEdges
			.filter((edge) => {
				// Validate that both source and target nodes exist
				const hasValidSource = validClusterIds.has(edge.source)
				const hasValidTarget = validClusterIds.has(edge.target)

				if (!hasValidSource || !hasValidTarget) {
					console.warn(
						`[ArchitectureDiagramViewer] Skipping invalid edge ${edge.id}:`,
						`source="${edge.source}" exists=${hasValidSource},`,
						`target="${edge.target}" exists=${hasValidTarget}`,
					)
					return false
				}

				// Filter for execution path: only show layer-to-layer transitions
				const sourceCluster = clusterGraph.clusters.find((c) => c.id === edge.source)
				const targetCluster = clusterGraph.clusters.find((c) => c.id === edge.target)

				const sourceRank = getLayerRank(sourceCluster?.layer)
				const targetRank = getLayerRank(targetCluster?.layer)

				// Remove self-loops
				if (edge.source === edge.target) {
					console.log(`[ArchitectureDiagramViewer] Filtering out self-loop: ${edge.id}`)
					return false
				}

				// Remove same-layer connections (not part of execution flow)
				if (sourceRank === targetRank) {
					console.log(
						`[ArchitectureDiagramViewer] Filtering out same-layer edge: ${edge.id} ` +
							`(${sourceCluster?.label} -> ${targetCluster?.label}, both at rank ${sourceRank})`,
					)
					return false
				}

				// Keep only edges that flow downward through layers (execution path)
				// After reversal logic below, these become top-to-bottom arrows
				return true
			})
			.map((edge) => {
				// Get layer ranks for source and target clusters
				const sourceCluster = clusterGraph.clusters.find((c) => c.id === edge.source)
				const targetCluster = clusterGraph.clusters.find((c) => c.id === edge.target)

				const sourceRank = getLayerRank(sourceCluster?.layer)
				const targetRank = getLayerRank(targetCluster?.layer)

				// For data flow, arrows should point downward (lower rank → higher rank)
				// If edge points upward, reverse it
				const shouldReverse = sourceRank > targetRank

				const actualSource = shouldReverse ? edge.target : edge.source
				const actualTarget = shouldReverse ? edge.source : edge.target

				// Update label to describe execution step (no weight needed)
				const flowLabel = shouldReverse ? `← ${edge.label}` : edge.label

				const reactFlowEdge: Edge = {
					id: edge.id,
					source: actualSource,
					target: actualTarget,
					label: flowLabel,
					type: "smoothstep",
					style: {
						strokeWidth: 2,
						stroke: "#6b7280",
					},
					labelStyle: {
						fontSize: 12,
						fill: "#9ca3af",
						fontWeight: 500,
					},
					markerEnd: {
						type: "arrowclosed" as const,
						width: 20,
						height: 20,
						color: "#6b7280",
					},
					animated: false,
				}

				console.log("[ArchitectureDiagramViewer] Created edge:", reactFlowEdge)
				return reactFlowEdge
			})
	}, [clusterGraph])

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

	// Set edges after nodes are initialized
	useEffect(() => {
		console.log("[ArchitectureDiagramViewer] Setting edges after nodes are ready")
		setEdges(initialEdges)
	}, [initialEdges, setEdges])

	// Debug: Log state
	console.log("[ArchitectureDiagramViewer] React Flow state:", { nodeCount: nodes.length, edgeCount: edges.length })

	return (
		<div className="w-full h-full">
			<ReactFlow
				attributionPosition="bottom-left"
				className="bg-editor-background"
				edges={edges}
				elementsSelectable={true}
				fitView
				nodes={nodes}
				nodesConnectable={false}
				nodesDraggable={true}
				nodeTypes={nodeTypes}
				onEdgesChange={onEdgesChange}
				onNodesChange={onNodesChange}>
				<Background color="#374151" gap={20} size={1} variant={BackgroundVariant.Dots} />
				<Controls
					className="!bg-editor-background !border-editor-group-border !shadow-lg"
					showFitView={true}
					showInteractive={false}
					showZoom={true}
				/>

				<Panel className="bg-editor-background/90 border border-editor-group-border rounded-lg p-3" position="top-left">
					<div className="text-sm space-y-2">
						<div>
							<div className="font-medium">Architecture Diagram</div>
							<div className="text-description text-xs">{clusterGraph.clusters.length} components</div>
							<div className="text-description text-xs">{inventory.files.length} files analyzed</div>
							<div className="text-description text-xs">{edges.length} connections</div>
						</div>

						{/* Layer legend */}
						<div className="pt-2 border-t border-editor-group-border">
							<div className="text-xs font-medium mb-1.5">Layers</div>
							<div className="space-y-1">
								<div className="flex items-center gap-2 text-xs">
									<div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.presentation }} />
									<span className="text-description">Presentation</span>
								</div>
								<div className="flex items-center gap-2 text-xs">
									<div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.business }} />
									<span className="text-description">Business</span>
								</div>
								<div className="flex items-center gap-2 text-xs">
									<div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.data }} />
									<span className="text-description">Data</span>
								</div>
								<div className="flex items-center gap-2 text-xs">
									<div className="w-3 h-3 rounded" style={{ backgroundColor: LAYER_COLORS.infrastructure }} />
									<span className="text-description">Infrastructure</span>
								</div>
							</div>
						</div>

						{/* Data flow indicator */}
						<div className="pt-2 border-t border-editor-group-border">
							<div className="text-xs text-description">
								<span className="font-medium">Arrows:</span> Data flow direction
							</div>
							<div className="text-xs text-description mt-0.5">(Top → Bottom)</div>
						</div>
					</div>
				</Panel>
			</ReactFlow>

			{selectedCluster && (
				<ClusterDetailModal cluster={selectedCluster} inventory={inventory} onClose={() => setSelectedCluster(null)} />
			)}
		</div>
	)
}
