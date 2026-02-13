import type { C4ComponentType, Cluster } from "@shared/architecture-visualization/types"
import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import type { LucideIcon } from "lucide-react"
import {
	CloudIcon,
	CogIcon,
	ComponentIcon,
	DatabaseIcon,
	FilterIcon,
	HardDriveIcon,
	InboxIcon,
	LayersIcon,
	ServerIcon,
	WrenchIcon,
} from "lucide-react"
import { memo } from "react"

export interface ClusterNodeData extends Record<string, unknown> {
	cluster: Cluster
	onClusterClick?: (clusterId: string) => void
	width?: number
	height?: number
	isCurrent?: boolean // Whether this is the current step in execution trace
}

// C4 Component Type Icons
const COMPONENT_TYPE_ICONS: Record<C4ComponentType, LucideIcon> = {
	controller: ServerIcon,
	service: CogIcon,
	repository: DatabaseIcon,
	component: ComponentIcon,
	gateway: CloudIcon,
	database: DatabaseIcon,
	external_system: CloudIcon,
	message_queue: InboxIcon,
	cache: HardDriveIcon,
	middleware: FilterIcon,
	utility: WrenchIcon,
	config: WrenchIcon,
}

// C4 Component Type Colors
const C4_COMPONENT_COLORS: Record<C4ComponentType, string> = {
	controller: "#3b82f6", // Blue
	service: "#10b981", // Green
	repository: "#f59e0b", // Amber
	component: "#8b5cf6", // Purple
	gateway: "#ec4899", // Pink
	database: "#f97316", // Orange
	external_system: "#6366f1", // Indigo
	message_queue: "#14b8a6", // Teal
	cache: "#f43f5e", // Rose
	middleware: "#84cc16", // Lime
	utility: "#64748b", // Slate
	config: "#78716c", // Stone
}

function ClusterNodeComponent({ data, ...props }: NodeProps) {
	const { cluster, onClusterClick, width, height, isCurrent } = data as ClusterNodeData

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (onClusterClick) {
			onClusterClick(cluster.id)
		}
	}

	// Use C4 component type if available, otherwise fall back to legacy layer
	const isC4Diagram = cluster.version === 2 || cluster.componentType !== undefined
	const displayColor =
		isC4Diagram && cluster.componentType ? C4_COMPONENT_COLORS[cluster.componentType] : cluster.color || "#3b82f6"

	const Icon = isC4Diagram && cluster.componentType ? COMPONENT_TYPE_ICONS[cluster.componentType] : LayersIcon

	// Use dynamic dimensions from data, with fallback
	const nodeWidth = width || 280
	const nodeHeight = height || 160

	// Merge node styles from ExecutionTraceViewer (for highlighting) with default styles
	// Access style from props (ReactFlow passes it even if not in type definition)
	const nodeStyle = (props as any).style || {}
	const mergedStyle = {
		width: `${nodeWidth}px`,
		minHeight: `${nodeHeight}px`,
		border: `2px solid ${displayColor}`,
		borderRadius: "12px",
		backgroundColor: "#1f2937",
		padding: "16px",
		...nodeStyle, // Override with any styles passed from parent (e.g., ExecutionTraceViewer)
	}

	return (
		<div
			className={`cluster-node cursor-pointer hover:shadow-xl transition-all ${isCurrent ? "current-node-pulse" : ""}`}
			onClick={handleClick}
			style={mergedStyle}>
			{/* Connection handles for edges */}
			<Handle position={Position.Top} style={{ opacity: 0 }} type="target" />
			<Handle position={Position.Bottom} style={{ opacity: 0 }} type="source" />
			{/* Header */}
			<div className="flex items-center gap-2 mb-2">
				<Icon className="w-6 h-6" style={{ color: displayColor }} />
				<div className="font-semibold text-lg" style={{ color: displayColor }}>
					{cluster.label}
				</div>
			</div>

			{/* Description - NO truncation, allow full text to show */}
			<div className="text-sm text-description mb-3">{cluster.description}</div>

			{/* Stats and Badge */}
			<div className="flex items-center justify-between text-xs">
				<div className="text-description">
					{cluster.files.length} {cluster.files.length === 1 ? "file" : "files"}
				</div>
				{/* Show component type badge for C4 diagrams, layer badge for legacy */}
				{isC4Diagram && cluster.componentType && (
					<div
						className="px-2 py-0.5 rounded text-xs font-medium"
						style={{
							backgroundColor: `${displayColor}20`,
							color: displayColor,
						}}>
						{cluster.componentType.replace(/_/g, " ")}
					</div>
				)}
				{!isC4Diagram && cluster.layer && (
					<div
						className="px-2 py-0.5 rounded text-xs font-medium"
						style={{
							backgroundColor: `${displayColor}20`,
							color: displayColor,
						}}>
						{cluster.layer}
					</div>
				)}
			</div>
		</div>
	)
}

export const ClusterNode = memo(ClusterNodeComponent)
