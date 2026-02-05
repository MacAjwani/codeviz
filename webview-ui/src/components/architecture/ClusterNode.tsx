import type { Cluster } from "@shared/architecture-visualization/types"
import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { LayersIcon } from "lucide-react"
import { memo } from "react"

export interface ClusterNodeData extends Record<string, unknown> {
	cluster: Cluster
	onClusterClick?: (clusterId: string) => void
}

function ClusterNodeComponent({ data }: NodeProps) {
	const { cluster, onClusterClick } = data as ClusterNodeData

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (onClusterClick) {
			onClusterClick(cluster.id)
		}
	}

	return (
		<div
			className="cluster-node cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow"
			onClick={handleClick}
			style={{
				width: "250px",
				minHeight: "120px",
				border: `2px solid ${cluster.color || "#3b82f6"}`,
				borderRadius: "12px",
				backgroundColor: "#1f2937",
				padding: "16px",
			}}>
			{/* Connection handles for edges */}
			<Handle position={Position.Top} style={{ opacity: 0 }} type="target" />
			<Handle position={Position.Bottom} style={{ opacity: 0 }} type="source" />
			{/* Header */}
			<div className="flex items-center gap-2 mb-2">
				<LayersIcon className="w-5 h-5" style={{ color: cluster.color || "#3b82f6" }} />
				<div className="font-semibold text-base" style={{ color: cluster.color || "#3b82f6" }}>
					{cluster.label}
				</div>
			</div>

			{/* Description */}
			<div className="text-xs text-description mb-3 line-clamp-2">{cluster.description}</div>

			{/* Stats */}
			<div className="flex items-center justify-between text-xs">
				<div className="text-description">
					{cluster.files.length} {cluster.files.length === 1 ? "file" : "files"}
				</div>
				{cluster.layer && (
					<div
						className="px-2 py-0.5 rounded text-xs font-medium"
						style={{
							backgroundColor: `${cluster.color || "#3b82f6"}20`,
							color: cluster.color || "#3b82f6",
						}}>
						{cluster.layer}
					</div>
				)}
			</div>
		</div>
	)
}

export const ClusterNode = memo(ClusterNodeComponent)
