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
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import type { C4ComponentType, Cluster, ClusterGraph, RepoInventory } from "@shared/architecture-visualization/types"
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
 * C4 Component Type Colors (same as ClusterNode)
 */
const C4_COMPONENT_COLORS: Record<C4ComponentType, string> = {
	controller: "#3b82f6",
	service: "#10b981",
	repository: "#f59e0b",
	component: "#8b5cf6",
	gateway: "#ec4899",
	database: "#f97316",
	external_system: "#6366f1",
	message_queue: "#14b8a6",
	cache: "#f43f5e",
	middleware: "#84cc16",
	utility: "#64748b",
	config: "#78716c",
}

/**
 * Get layer rank for vertical positioning (legacy diagrams).
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
 * Get component rank for C4 diagrams.
 * Lower rank = higher on screen (request flow: client → middleware → controllers → services → repositories → databases).
 */
function getComponentRank(type?: C4ComponentType): number {
	const rankMap: Record<C4ComponentType, number> = {
		component: 0, // Top - UI components (request origin)
		middleware: 0.5, // Between client and server - intercepts requests
		controller: 1, // Entry points - handles requests
		gateway: 1.5, // External API clients
		service: 2, // Business logic
		config: 2, // Configuration
		utility: 2, // Helpers
		repository: 3, // Data access
		message_queue: 3, // Async communication
		cache: 4, // Caching layer
		database: 4, // Data storage
		external_system: 4, // External services
	}
	return type ? rankMap[type] : 2.5
}

/**
 * Calculate dynamic node dimensions based on content.
 * Nodes expand to fit content, preventing truncation.
 */
function calculateNodeDimensions(cluster: Cluster): { width: number; height: number } {
	const labelLength = cluster.label.length
	const descLength = cluster.description?.length || 0
	const fileCount = cluster.files.length

	// Base dimensions
	let width = 280
	let height = 160

	// Expand width for long labels (max 420px to prevent excessive width)
	if (labelLength > 30) {
		width = Math.min(420, 280 + (labelLength - 30) * 4)
	}

	// Expand height for long descriptions (max 320px)
	// Estimate: ~50 characters per line at 250px width
	const estimatedDescLines = Math.ceil(descLength / 50)
	if (estimatedDescLines > 3) {
		height = Math.min(320, 160 + (estimatedDescLines - 3) * 22)
	}

	// Add height for large file counts (visual indicator)
	if (fileCount > 15) {
		height += 20
	}

	return { width, height }
}

/**
 * Apply Dagre layout to cluster nodes with intelligent ranking.
 * Uses C4 component types for C4 diagrams, or layer-based ranking for legacy diagrams.
 * Organizes nodes top-to-bottom by request/data flow.
 */
function getLayoutedNodes(nodes: Node[], edges: Edge[], isC4Diagram: boolean): Node[] {
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))

	// Enhanced Dagre configuration for better layout
	dagreGraph.setGraph({
		rankdir: "TB", // Top to bottom
		align: "UL", // Align upper-left for consistency
		ranker: "network-simplex", // Better for cyclic graphs
		acyclicer: "greedy", // Break cycles intelligently
		nodesep: 200, // Horizontal spacing between nodes
		ranksep: 250, // Vertical spacing between ranks
		edgesep: 100, // Space between edges
		marginx: 80, // Canvas margins
		marginy: 80,
	})

	// Add nodes with dynamic dimensions and ranking
	nodes.forEach((node) => {
		const cluster = (node.data as any).cluster as Cluster

		// Determine rank based on diagram type
		const rank = isC4Diagram ? getComponentRank(cluster.componentType) : getLayerRank(cluster.layer)

		// Use dynamic dimensions from node style, or calculate if missing
		const styleWidth = node.style?.width
		const styleHeight = node.style?.height
		const width = typeof styleWidth === "number" ? styleWidth : 280
		const height = typeof styleHeight === "number" ? styleHeight : 160

		dagreGraph.setNode(node.id, { width, height })

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

	// Apply positions (center node on calculated position)
	return nodes.map((node) => {
		const positioned = dagreGraph.node(node.id)
		const styleWidth = node.style?.width
		const styleHeight = node.style?.height
		const width = typeof styleWidth === "number" ? styleWidth : 280
		const height = typeof styleHeight === "number" ? styleHeight : 160

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
	clusterGraph: ClusterGraph
	inventory: RepoInventory
}

export function ArchitectureDiagramViewer({ clusterGraph, inventory }: Props) {
	const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
	const [isSummaryExpanded, setIsSummaryExpanded] = useState(true)

	// Detect if this is a C4 diagram
	const isC4Diagram =
		clusterGraph.metadata?.schemaVersion === 2 || clusterGraph.clusters.some((c) => c.componentType !== undefined)

	// Get unique component types present in the diagram
	const componentTypesInDiagram = useMemo(() => {
		if (!isC4Diagram) return []
		const types = new Set<C4ComponentType>()
		for (const cluster of clusterGraph.clusters) {
			if (cluster.componentType) {
				types.add(cluster.componentType)
			}
		}
		return Array.from(types).sort()
	}, [clusterGraph.clusters, isC4Diagram])

	// Convert clusters to React Flow nodes with dynamic sizing
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
				// Calculate dynamic dimensions based on content
				const dimensions = calculateNodeDimensions(cluster)

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
						width: dimensions.width,
						height: dimensions.height,
					},
					style: {
						width: dimensions.width,
						height: dimensions.height,
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
				cursor: "default",
			},
			labelStyle: {
				fontSize: 14,
				fill: "#9ca3af",
				cursor: "default",
			},
		}))

		return getLayoutedNodes(nodes, edges, isC4Diagram)
	}, [clusterGraph, isC4Diagram])

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

		// Track bidirectional edges to apply curvature
		const edgePairs = new Set<string>()
		const reverseEdges = new Map<string, boolean>() // Track if reverse edge exists

		// First pass: identify bidirectional edges
		for (const edge of clusterGraph.clusterEdges) {
			const forwardKey = `${edge.source}->${edge.target}`
			const reverseKey = `${edge.target}->${edge.source}`

			if (edgePairs.has(reverseKey)) {
				// This edge has a reverse counterpart
				reverseEdges.set(forwardKey, true)
				reverseEdges.set(reverseKey, true)
			}
			edgePairs.add(forwardKey)
		}

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

				// Remove self-loops (always)
				if (edge.source === edge.target) {
					console.log(`[ArchitectureDiagramViewer] Filtering out self-loop: ${edge.id}`)
					return false
				}

				// For legacy diagrams: filter same-layer connections
				if (!isC4Diagram) {
					const sourceCluster = clusterGraph.clusters.find((c) => c.id === edge.source)
					const targetCluster = clusterGraph.clusters.find((c) => c.id === edge.target)

					const sourceRank = getLayerRank(sourceCluster?.layer)
					const targetRank = getLayerRank(targetCluster?.layer)

					// Remove same-layer connections (not part of execution flow)
					if (sourceRank === targetRank) {
						console.log(
							`[ArchitectureDiagramViewer] Filtering out same-layer edge: ${edge.id} ` +
								`(${sourceCluster?.label} -> ${targetCluster?.label}, both at rank ${sourceRank})`,
						)
						return false
					}
				}

				// For C4 diagrams: keep all edges (relationships are semantically important)
				return true
			})
			.map((edge) => {
				// For C4 diagrams: NEVER reverse edges (relationship direction is semantic)
				// For legacy diagrams: reverse upward edges to show top-to-bottom data flow
				let actualSource = edge.source
				let actualTarget = edge.target

				if (!isC4Diagram) {
					// Legacy layer-based diagrams: enforce downward flow
					const sourceCluster = clusterGraph.clusters.find((c) => c.id === edge.source)
					const targetCluster = clusterGraph.clusters.find((c) => c.id === edge.target)

					const sourceRank = getLayerRank(sourceCluster?.layer)
					const targetRank = getLayerRank(targetCluster?.layer)

					// If edge points upward, reverse it
					const shouldReverse = sourceRank > targetRank
					actualSource = shouldReverse ? edge.target : edge.source
					actualTarget = shouldReverse ? edge.source : edge.target
				}

				// Update label to include C4 description and protocol
				// Priority: 1. description [protocol], 2. relationshipType [protocol], 3. label
				let flowLabel: string
				if (edge.description) {
					// Use description (business-focused) with protocol in brackets
					flowLabel = edge.protocol ? `${edge.description} [${edge.protocol}]` : edge.description
				} else if (edge.relationshipType) {
					// Fallback to relationshipType with protocol in brackets
					flowLabel = edge.protocol ? `${edge.relationshipType} [${edge.protocol}]` : edge.relationshipType
				} else {
					// Final fallback to generic label
					flowLabel = edge.label
				}

				// Note: Don't add arrow characters - ReactFlow already shows direction with markerEnd

				// Check if this edge is bidirectional (has a reverse edge)
				const edgeKey = `${actualSource}->${actualTarget}`
				const isBidirectional = reverseEdges.get(edgeKey) || false

				// For bidirectional edges, use bezier curve with offset to prevent overlap
				const edgeType = isBidirectional ? "default" : "smoothstep"
				const pathOptions = isBidirectional
					? {
							// Offset based on alphabetical order to ensure consistent offset direction
							curvature: actualSource < actualTarget ? 0.3 : -0.3,
						}
					: undefined

				const reactFlowEdge: Edge = {
					id: edge.id,
					source: actualSource,
					target: actualTarget,
					label: flowLabel,
					type: edgeType,
					...(pathOptions && { pathOptions }),
					style: {
						strokeWidth: 2,
						stroke: "#6b7280",
						cursor: "default",
					},
					labelStyle: {
						fontSize: 14,
						fill: "#ffffff", // White text for better visibility
						fontWeight: 500,
						cursor: "default", // Remove pointer cursor from labels
					},
					labelBgStyle: {
						fill: "#1f2937", // Solid background so edge doesn't show through
						fillOpacity: 1,
					},
					labelBgPadding: [8, 4] as [number, number],
					labelBgBorderRadius: 4,
					markerEnd: {
						type: "arrowclosed" as const,
						width: 24, // Larger arrow for better visibility
						height: 24,
						color: "#d1d5db", // Lighter gray for better visibility
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

				<Panel
					className="bg-[#252526] border-2 border-[#3c3c3c] rounded-lg shadow-2xl overflow-hidden"
					position="bottom-right">
					{isSummaryExpanded ? (
						<div className="text-sm space-y-3 min-w-[220px] p-4">
							<div className="flex items-center justify-between">
								<div className="font-semibold text-white text-base">Diagram Summary</div>
								<button
									className="p-1 hover:bg-[#3c3c3c] rounded transition-colors cursor-pointer"
									onClick={() => setIsSummaryExpanded(false)}
									title="Collapse">
									<ChevronDownIcon className="size-4 text-[#9d9d9d] hover:text-[#007ACC]" />
								</button>
							</div>
							<div className="text-[#9d9d9d] text-xs space-y-1">
								<div className="flex items-center gap-2">
									<span className="text-[#007ACC]">•</span>
									{clusterGraph.clusters.length} components
								</div>
								<div className="flex items-center gap-2">
									<span className="text-[#007ACC]">•</span>
									{inventory.files.length} files analyzed
								</div>
								<div className="flex items-center gap-2">
									<span className="text-[#007ACC]">•</span>
									{edges.length} connections
								</div>
							</div>

							{/* Component Types legend (C4) or Layers legend (legacy) */}
							<div className="pt-3 border-t border-[#3c3c3c]">
								{isC4Diagram ? (
									<>
										<div className="text-xs font-semibold text-[#cccccc] mb-2 uppercase tracking-wide">
											Legend
										</div>
										<div className="space-y-1.5 max-h-48 overflow-y-auto">
											{componentTypesInDiagram.map((type) => (
												<div className="flex items-center gap-2 text-xs" key={type}>
													<div
														className="w-3 h-3 rounded border border-[#3c3c3c]"
														style={{ backgroundColor: C4_COMPONENT_COLORS[type] }}
													/>
													<span className="text-[#9d9d9d]">{type.replace(/_/g, " ")}</span>
												</div>
											))}
										</div>
									</>
								) : (
									<>
										<div className="text-xs font-semibold text-[#cccccc] mb-2 uppercase tracking-wide">
											Layers
										</div>
										<div className="space-y-1.5">
											<div className="flex items-center gap-2 text-xs">
												<div
													className="w-3 h-3 rounded border border-[#3c3c3c]"
													style={{ backgroundColor: LAYER_COLORS.presentation }}
												/>
												<span className="text-[#9d9d9d]">Presentation</span>
											</div>
											<div className="flex items-center gap-2 text-xs">
												<div
													className="w-3 h-3 rounded border border-[#3c3c3c]"
													style={{ backgroundColor: LAYER_COLORS.business }}
												/>
												<span className="text-[#9d9d9d]">Business</span>
											</div>
											<div className="flex items-center gap-2 text-xs">
												<div
													className="w-3 h-3 rounded border border-[#3c3c3c]"
													style={{ backgroundColor: LAYER_COLORS.data }}
												/>
												<span className="text-[#9d9d9d]">Data</span>
											</div>
											<div className="flex items-center gap-2 text-xs">
												<div
													className="w-3 h-3 rounded border border-[#3c3c3c]"
													style={{ backgroundColor: LAYER_COLORS.infrastructure }}
												/>
												<span className="text-[#9d9d9d]">Infrastructure</span>
											</div>
										</div>
									</>
								)}
							</div>

							{/* Data flow indicator */}
							<div className="pt-3 border-t border-[#3c3c3c]">
								<div className="text-xs text-[#9d9d9d]">
									<span className="font-semibold text-[#cccccc]">Flow:</span> Top → Bottom
								</div>
							</div>
						</div>
					) : (
						<button
							className="p-3 hover:bg-[#3c3c3c] transition-colors flex items-center gap-2 cursor-pointer"
							onClick={() => setIsSummaryExpanded(true)}
							title="Expand summary">
							<ChevronUpIcon className="size-4 text-[#9d9d9d] hover:text-[#007ACC]" />
							<span className="text-xs font-semibold text-[#9d9d9d] hover:text-[#007ACC]">Show Summary</span>
						</button>
					)}
				</Panel>
			</ReactFlow>

			{selectedCluster && (
				<ClusterDetailModal
					cluster={selectedCluster}
					clusterGraph={clusterGraph}
					inventory={inventory}
					onClose={() => setSelectedCluster(null)}
				/>
			)}
		</div>
	)
}
