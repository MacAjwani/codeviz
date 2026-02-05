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
import { useCallback, useMemo, useState } from "react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import type { CodeFlowDiagram, FlowEdge, FlowNode as FlowNodeType, SystemComponent } from "@shared/code-visualization/types"
import { DownloadIcon } from "lucide-react"
import { ComponentDetailModal } from "./ComponentDetailModal"
import { type ComponentGroupData, ComponentGroupNode } from "./ComponentGroupNode"
import { EdgeDetailModal } from "./EdgeDetailModal"
import { FlowNode, type FlowNodeData } from "./FlowNode"
import { NodeDetailModal } from "./NodeDetailModal"

// Register custom node types
const nodeTypes = {
	flowNode: FlowNode as any, // Type assertion needed for React Flow compatibility
	componentGroup: ComponentGroupNode as any,
}

// Node dimensions for layout calculation
const NODE_WIDTH = 220
const NODE_HEIGHT = 80
const GROUP_PADDING = 80

/**
 * Apply automatic hierarchical layout using Dagre
 * Supports compound graphs (parent-child relationships) for component grouping
 */
function getLayoutedNodes(nodes: Node[], edges: Edge[]): Node[] {
	const dagreGraph = new dagre.graphlib.Graph({ compound: true })
	dagreGraph.setDefaultEdgeLabel(() => ({}))

	// Configure graph layout
	dagreGraph.setGraph({
		rankdir: "TB", // Top-to-bottom layout
		align: "UL", // Align nodes to upper left
		nodesep: 80, // Horizontal spacing between nodes
		ranksep: 120, // Vertical spacing between ranks
		marginx: 50,
		marginy: 50,
	})

	// Separate parent nodes (component groups) from child nodes
	const parentNodes = nodes.filter((n) => n.type === "componentGroup")
	const childNodes = nodes.filter((n) => n.type !== "componentGroup")

	// Add all nodes to graph with their dimensions
	nodes.forEach((node) => {
		const isParent = node.type === "componentGroup"
		dagreGraph.setNode(node.id, {
			width: isParent ? 400 : NODE_WIDTH, // Groups are wider
			height: isParent ? 300 : NODE_HEIGHT, // Groups are taller
		})
	})

	// Set parent-child relationships for compound graph
	childNodes.forEach((child) => {
		if (child.parentId) {
			dagreGraph.setParent(child.id, child.parentId)
		}
	})

	// Add edges to graph
	edges.forEach((edge) => {
		dagreGraph.setEdge(edge.source, edge.target)
	})

	// Compute layout
	dagre.layout(dagreGraph)

	// Apply computed positions to nodes
	return nodes.map((node) => {
		const nodeWithPosition = dagreGraph.node(node.id)
		const isParent = node.type === "componentGroup"

		return {
			...node,
			position: {
				x: nodeWithPosition.x - (isParent ? 400 : NODE_WIDTH) / 2,
				y: nodeWithPosition.y - (isParent ? 300 : NODE_HEIGHT) / 2,
			},
			...(isParent && {
				style: {
					width: nodeWithPosition.width || 400,
					height: nodeWithPosition.height || 300,
				},
			}),
		}
	})
}

interface DiagramViewerProps {
	diagram: CodeFlowDiagram
	onOpenFile?: (filePath: string, lineNumber?: number) => void
	onSaveDiagram?: (diagram: CodeFlowDiagram) => void
}

export function DiagramViewer({ diagram, onOpenFile, onSaveDiagram }: DiagramViewerProps) {
	const [selectedNode, setSelectedNode] = useState<FlowNodeType | null>(null)
	const [selectedEdge, setSelectedEdge] = useState<FlowEdge | null>(null)
	const [selectedComponent, setSelectedComponent] = useState<SystemComponent | null>(null)

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

	// Handler for component group clicks
	const handleComponentClick = useCallback(
		(componentId: string) => {
			const component = diagram.components?.find((c) => c.id === componentId)
			if (component) {
				setSelectedComponent(component)
			}
		},
		[diagram.components],
	)

	// Convert diagram edges to React Flow edges (needed for layout calculation)
	const initialEdges: Edge[] = useMemo(() => {
		return diagram.edges.map((edge) => {
			return {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				label: edge.label,
				type: "smoothstep",
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
			}
		})
	}, [diagram.edges])

	// Convert diagram nodes to React Flow nodes and apply layout
	const initialNodes = useMemo(() => {
		const allNodes: Node[] = []

		// Create parent nodes for each component if components exist
		if (diagram.components && diagram.components.length > 0) {
			diagram.components.forEach((component) => {
				allNodes.push({
					id: component.id,
					type: "componentGroup",
					position: { x: 0, y: 0 }, // Will be positioned by layout
					data: {
						component,
						onComponentClick: handleComponentClick,
					} as ComponentGroupData,
				})
			})
		}

		// Create child nodes with parent references
		diagram.nodes.forEach((node, index) => {
			// Find the parent component for this node
			const parentComponentId = diagram.components?.find((c) => c.name === node.componentLayer)?.id

			allNodes.push({
				id: node.id,
				type: "flowNode",
				position: node.position || { x: 250, y: index * 150 }, // Fallback position
				data: {
					label: node.label,
					nodeType: node.type,
					filePath: node.filePath,
					lineNumber: node.lineNumber,
					entityPurpose: node.entityPurpose,
					onNodeClick: handleNodeClick,
				} as FlowNodeData,
				// Set parent reference if this node belongs to a component
				...(parentComponentId && {
					parentId: parentComponentId,
					extent: "parent" as const,
				}),
			})
		})

		// Apply automatic layout using dagre
		return getLayoutedNodes(allNodes, initialEdges)
	}, [diagram.nodes, diagram.components, initialEdges, handleNodeClick, handleComponentClick])

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

	const onConnect = useCallback(
		(params: Connection) => setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds)),
		[setEdges],
	)

	const handleEdgeClick = useCallback(
		(_event: React.MouseEvent, edge: Edge) => {
			// Get the original edge from diagram edges by ID
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

	const handleCloseComponentModal = () => {
		setSelectedComponent(null)
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
				<Panel className="bg-editor-background/90 border border-editor-group-border rounded-lg p-3" position="top-left">
					<div className="text-sm space-y-1">
						<div className="font-medium">{diagram.description}</div>
						<div className="text-description text-xs">Entry: {diagram.entryPoint}</div>
						<div className="text-description text-xs">
							{diagram.nodes.length} nodes, {diagram.edges.length} edges
						</div>
					</div>
				</Panel>

				{/* Export Button */}
				<Panel position="top-right">
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

			{/* Component Detail Modal */}
			<ComponentDetailModal component={selectedComponent} onClose={handleCloseComponentModal} />
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
