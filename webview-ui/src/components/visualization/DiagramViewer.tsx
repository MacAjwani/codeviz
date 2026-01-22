import {
	addEdge,
	Background,
	BackgroundVariant,
	type Connection,
	Controls,
	type Edge,
	type Node,
	Panel,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import type { CodeFlowDiagram, FlowEdge, FlowNode as FlowNodeType } from "@shared/code-visualization/types"
import { ChevronDown, ChevronRight, DownloadIcon } from "lucide-react"
import { EdgeDetailModal } from "./EdgeDetailModal"
import { FlowNode, type FlowNodeData } from "./FlowNode"
import { GroupedFlowNode, type GroupedFlowNodeData } from "./GroupedFlowNode"
import { NodeDetailModal } from "./NodeDetailModal"

// Register custom node types
const nodeTypes = {
	flowNode: FlowNode as any,
	groupedNode: GroupedFlowNode as any,
}

// Node dimensions for layout calculation
const NODE_WIDTH = 220
const NODE_HEIGHT = 80
const GROUP_NODE_WIDTH = 240
const GROUP_NODE_HEIGHT = 70

/**
 * Apply automatic hierarchical layout using Dagre
 */
function getLayoutedNodes(nodes: Node[], edges: Edge[]): Node[] {
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))

	dagreGraph.setGraph({
		rankdir: "TB",
		align: "UL",
		nodesep: 80,
		ranksep: 120,
		marginx: 50,
		marginy: 50,
	})

	nodes.forEach((node) => {
		const isGroup = node.type === "groupedNode"
		dagreGraph.setNode(node.id, {
			width: isGroup ? GROUP_NODE_WIDTH : NODE_WIDTH,
			height: isGroup ? GROUP_NODE_HEIGHT : NODE_HEIGHT,
		})
	})

	edges.forEach((edge) => {
		dagreGraph.setEdge(edge.source, edge.target)
	})

	dagre.layout(dagreGraph)

	return nodes.map((node) => {
		const nodeWithPosition = dagreGraph.node(node.id)
		const isGroup = node.type === "groupedNode"
		return {
			...node,
			position: {
				x: nodeWithPosition.x - (isGroup ? GROUP_NODE_WIDTH : NODE_WIDTH) / 2,
				y: nodeWithPosition.y - (isGroup ? GROUP_NODE_HEIGHT : NODE_HEIGHT) / 2,
			},
		}
	})
}

/**
 * Check if an edge is a "return" or "response" edge that should be filtered
 */
function isReturnEdge(edge: FlowEdge): boolean {
	const returnKeywords = ["return", "response", "result", "callback", "resolve", "reply"]
	const label = edge.label.toLowerCase()
	const trigger = edge.metadata?.trigger?.toLowerCase() || ""

	// Check if label or trigger contains return keywords
	for (const keyword of returnKeywords) {
		if (label.includes(keyword) || trigger.includes(keyword)) {
			return true
		}
	}

	return false
}

/**
 * Group nodes by filePath for progressive disclosure
 */
interface NodeGroup {
	filePath: string
	fileName: string
	nodeIds: string[]
	nodes: FlowNodeType[]
}

function groupNodesByFile(nodes: FlowNodeType[]): Map<string, NodeGroup> {
	const groups = new Map<string, NodeGroup>()

	for (const node of nodes) {
		// Only group method and event_handler nodes that have a filePath
		if (!node.filePath || (node.type !== "method" && node.type !== "event_handler")) {
			continue
		}

		if (!groups.has(node.filePath)) {
			const fileName = node.filePath.split("/").pop() || node.filePath
			groups.set(node.filePath, {
				filePath: node.filePath,
				fileName,
				nodeIds: [],
				nodes: [],
			})
		}

		const group = groups.get(node.filePath)!
		group.nodeIds.push(node.id)
		group.nodes.push(node)
	}

	// Only keep groups with more than 1 node (single nodes don't need grouping)
	for (const [key, group] of groups) {
		if (group.nodes.length <= 1) {
			groups.delete(key)
		}
	}

	return groups
}

interface DiagramViewerProps {
	diagram: CodeFlowDiagram
	onOpenFile?: (filePath: string, lineNumber?: number) => void
	onSaveDiagram?: (diagram: CodeFlowDiagram) => void
}

export function DiagramViewer({ diagram, onOpenFile, onSaveDiagram }: DiagramViewerProps) {
	const [selectedNode, setSelectedNode] = useState<FlowNodeType | null>(null)
	const [selectedEdge, setSelectedEdge] = useState<FlowEdge | null>(null)
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
	const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false)

	// Group nodes by file
	const nodeGroups = useMemo(() => groupNodesByFile(diagram.nodes), [diagram.nodes])

	// Get set of all grouped node IDs
	const groupedNodeIds = useMemo(() => {
		const ids = new Set<string>()
		for (const group of nodeGroups.values()) {
			for (const id of group.nodeIds) {
				ids.add(id)
			}
		}
		return ids
	}, [nodeGroups])

	// Handler for node clicks
	const handleNodeClick = useCallback(
		(nodeId: string) => {
			const node = diagram.nodes.find((n) => n.id === nodeId)
			if (node) {
				setSelectedNode(node)
			}
		},
		[diagram.nodes],
	)

	// Handler for group expansion toggle
	const handleToggleExpand = useCallback((groupId: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(groupId)) {
				next.delete(groupId)
			} else {
				next.add(groupId)
			}
			return next
		})
	}, [])

	// Always filter return edges for architectural clarity
	const filteredDiagramEdges = useMemo(() => {
		return diagram.edges.filter((edge) => !isReturnEdge(edge))
	}, [diagram.edges])

	// Build visible nodes based on expansion state
	const visibleNodes = useMemo(() => {
		const result: Node[] = []

		// Add non-grouped nodes
		for (const node of diagram.nodes) {
			if (!groupedNodeIds.has(node.id)) {
				result.push({
					id: node.id,
					type: "flowNode",
					position: node.position || { x: 0, y: 0 },
					data: {
						label: node.label,
						nodeType: node.type,
						filePath: node.filePath,
						lineNumber: node.lineNumber,
						entityPurpose: node.entityPurpose,
						onNodeClick: handleNodeClick,
					} as FlowNodeData,
				})
			}
		}

		// Add group nodes or their children
		for (const [filePath, group] of nodeGroups) {
			const groupId = `group-${filePath.replace(/[^a-zA-Z0-9]/g, "_")}`
			const isExpanded = expandedGroups.has(groupId)

			if (isExpanded) {
				// Show individual child nodes
				for (const node of group.nodes) {
					result.push({
						id: node.id,
						type: "flowNode",
						position: node.position || { x: 0, y: 0 },
						data: {
							label: node.label,
							nodeType: node.type,
							filePath: node.filePath,
							lineNumber: node.lineNumber,
							entityPurpose: node.entityPurpose,
							onNodeClick: handleNodeClick,
						} as FlowNodeData,
					})
				}
			} else {
				// Show summary group node
				result.push({
					id: groupId,
					type: "groupedNode",
					position: { x: 0, y: 0 },
					data: {
						label: group.fileName,
						childCount: group.nodes.length,
						childNodeIds: group.nodeIds,
						isExpanded: false,
						onToggleExpand: handleToggleExpand,
						onNodeClick: handleNodeClick,
					} as GroupedFlowNodeData,
				})
			}
		}

		return result
	}, [diagram.nodes, nodeGroups, groupedNodeIds, expandedGroups, handleNodeClick, handleToggleExpand])

	// Build visible edges, remapping to group nodes when collapsed
	const visibleEdges = useMemo(() => {
		const edges: Edge[] = []

		for (const edge of filteredDiagramEdges) {
			let source = edge.source
			let target = edge.target

			// Remap source/target to group node if the original node is grouped and collapsed
			for (const [filePath, group] of nodeGroups) {
				const groupId = `group-${filePath.replace(/[^a-zA-Z0-9]/g, "_")}`
				const isExpanded = expandedGroups.has(groupId)

				if (!isExpanded) {
					if (group.nodeIds.includes(source)) {
						source = groupId
					}
					if (group.nodeIds.includes(target)) {
						target = groupId
					}
				}
			}

			// Skip self-loops that result from grouping
			if (source === target) {
				continue
			}

			// Avoid duplicate edges between same source/target
			const edgeKey = `${source}-${target}`
			if (edges.some((e) => `${e.source}-${e.target}` === edgeKey)) {
				continue
			}

			edges.push({
				id: edge.id,
				source,
				target,
				label: edge.label,
				type: "default", // Bezier curves
				animated: edge.type === "dataflow",
				markerEnd: {
					type: "arrowclosed" as const,
					width: 20,
					height: 20,
					color: getEdgeColor(edge.type),
				},
				style: {
					stroke: getEdgeColor(edge.type),
					strokeWidth: 2,
					cursor: "pointer",
				},
				labelStyle: {
					fill: "#9ca3af",
					fontSize: 11,
					fontWeight: 500,
				},
				labelBgStyle: {
					fill: "#1f2937",
					fillOpacity: 0.9,
				},
			})
		}

		return edges
	}, [filteredDiagramEdges, nodeGroups, expandedGroups])

	// Apply layout to visible nodes
	const layoutedNodes = useMemo(() => {
		return getLayoutedNodes(visibleNodes, visibleEdges)
	}, [visibleNodes, visibleEdges])

	const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges)

	// Update nodes/edges when layout changes (due to expansion)
	useEffect(() => {
		setNodes(layoutedNodes)
		setEdges(visibleEdges)
	}, [layoutedNodes, visibleEdges, setNodes, setEdges])

	const onConnect = useCallback(
		(params: Connection) => setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds)),
		[setEdges],
	)

	const handleEdgeClick = useCallback(
		(_event: React.MouseEvent, edge: Edge) => {
			const originalEdge = diagram.edges.find((e) => e.id === edge.id)
			if (originalEdge && originalEdge.metadata) {
				setSelectedEdge(originalEdge)
			}
		},
		[diagram.edges],
	)

	const handleCloseModal = () => {
		setSelectedNode(null)
	}

	const handleCloseEdgeModal = () => {
		setSelectedEdge(null)
	}

	const handleExport = () => {
		const exportData = JSON.stringify(diagram, null, 2)
		const blob = new Blob([exportData], { type: "application/json" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `diagram-${diagram.entryPoint.replace(/[^a-zA-Z0-9]/g, "_")}.json`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	// Count filtered return edges for info display
	const filteredReturnEdgeCount = diagram.edges.filter(isReturnEdge).length

	return (
		<div className="w-full h-full relative">
			<ReactFlow
				attributionPosition="bottom-left"
				className="bg-editor-background"
				edges={edges}
				fitView
				nodes={nodes}
				nodeTypes={nodeTypes}
				onConnect={onConnect}
				onEdgeClick={handleEdgeClick}
				onEdgesChange={onEdgesChange}
				onNodesChange={onNodesChange}>
				<Background color="#374151" gap={20} size={1} variant={BackgroundVariant.Dots} />
				<Controls
					className="!bg-editor-background !border-editor-group-border !shadow-lg"
					showFitView={true}
					showInteractive={false}
					showZoom={true}
				/>

				{/* Info Panel */}
				<Panel
					className="bg-editor-background/90 border border-editor-group-border rounded-lg p-3 max-w-[400px]"
					position="top-left">
					<div className="text-sm space-y-2">
						<div>
							<div className="font-medium">{diagram.description}</div>
							{diagram.simpleDescription && diagram.simpleDescription !== diagram.description && (
								<div className="text-description mt-1 text-xs italic">{diagram.simpleDescription}</div>
							)}
						</div>

						<div className="text-description text-xs">
							entry: {diagram.entryPoint} • {nodes.length} nodes • {edges.length} edges
							{filteredReturnEdgeCount > 0 && <span> ({filteredReturnEdgeCount} filtered)</span>}
						</div>

						{diagram.detailedAnalysis && diagram.detailedAnalysis.length > 0 && (
							<div className="pt-2 border-t border-editor-group-border">
								<button
									className="flex items-center gap-1 text-xs font-medium hover:text-focus-foreground transition-colors w-full text-left"
									onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}>
									{showDetailedAnalysis ? (
										<ChevronDown className="w-3 h-3" />
									) : (
										<ChevronRight className="w-3 h-3" />
									)}
									Technical Analysis
								</button>

								{showDetailedAnalysis && (
									<div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-1">
										{diagram.detailedAnalysis.map((item, i) => (
											<div className="text-xs" key={i}>
												<div className="font-medium text-focus-foreground mb-0.5">{item.title}</div>
												<div className="text-description leading-relaxed">{item.details}</div>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				</Panel>

				{/* Controls Panel */}
				<Panel className="flex gap-2" position="top-right">
					{/* Export Button */}
					<button
						className="flex items-center gap-2 px-3 py-2 bg-editor-background border border-editor-group-border rounded-lg hover:bg-list-hover-background transition-colors text-sm"
						onClick={handleExport}
						title="Export diagram as JSON">
						<DownloadIcon className="w-4 h-4" />
						Export
					</button>
				</Panel>
			</ReactFlow>

			{/* Node Detail Modal */}
			<NodeDetailModal node={selectedNode} onClose={handleCloseModal} onOpenFile={onOpenFile} />

			{/* Edge Detail Modal */}
			<EdgeDetailModal edge={selectedEdge} onClose={handleCloseEdgeModal} />
		</div>
	)
}

function getEdgeColor(type?: string): string {
	switch (type) {
		case "dataflow":
			return "#22c55e"
		case "call":
			return "#3b82f6"
		case "render":
			return "#a855f7"
		case "event":
			return "#f59e0b"
		default:
			return "#6b7280"
	}
}
