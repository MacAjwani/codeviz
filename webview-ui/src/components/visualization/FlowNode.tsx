import type { NodeType } from "@shared/code-visualization/types"
import { Handle, type NodeProps, Position } from "@xyflow/react"
import {
	BoxIcon,
	CloudIcon,
	CodeIcon,
	DatabaseIcon,
	FunctionSquareIcon,
	GlobeIcon,
	MousePointerClickIcon,
	Settings2Icon,
	UserIcon,
	ZapIcon,
} from "lucide-react"
import { memo } from "react"
import { cn } from "@/lib/utils"

// Re-export NodeType for convenience
export type { NodeType }

export interface FlowNodeData extends Record<string, unknown> {
	label: string
	nodeType: NodeType
	filePath?: string // Optional for external entities
	lineNumber?: number
	entityPurpose: string
	onNodeClick?: (nodeId: string) => void
}

const nodeTypeConfig: Record<
	NodeType,
	{
		icon: typeof CodeIcon
		bgColor: string
		borderColor: string
		textColor: string
	}
> = {
	user: {
		icon: UserIcon,
		bgColor: "bg-violet-800/70",
		borderColor: "border-violet-400",
		textColor: "text-violet-200",
	},
	ui_element: {
		icon: MousePointerClickIcon,
		bgColor: "bg-teal-800/70",
		borderColor: "border-teal-400",
		textColor: "text-teal-200",
	},
	component: {
		icon: BoxIcon,
		bgColor: "bg-blue-800/70",
		borderColor: "border-blue-400",
		textColor: "text-blue-200",
	},
	method: {
		icon: FunctionSquareIcon,
		bgColor: "bg-purple-800/70",
		borderColor: "border-purple-400",
		textColor: "text-purple-200",
	},
	api_endpoint: {
		icon: GlobeIcon,
		bgColor: "bg-orange-800/70",
		borderColor: "border-orange-400",
		textColor: "text-orange-200",
	},
	database: {
		icon: DatabaseIcon,
		bgColor: "bg-cyan-800/70",
		borderColor: "border-cyan-400",
		textColor: "text-cyan-200",
	},
	external_service: {
		icon: CloudIcon,
		bgColor: "bg-red-800/70",
		borderColor: "border-red-400",
		textColor: "text-red-200",
	},
	event_handler: {
		icon: ZapIcon,
		bgColor: "bg-amber-800/70",
		borderColor: "border-amber-400",
		textColor: "text-amber-200",
	},
	state_manager: {
		icon: Settings2Icon,
		bgColor: "bg-yellow-800/70",
		borderColor: "border-yellow-400",
		textColor: "text-yellow-200",
	},
}

function FlowNodeComponent({ data, id }: NodeProps) {
	const nodeData = data as FlowNodeData
	const config = nodeTypeConfig[nodeData.nodeType] || nodeTypeConfig.method
	const Icon = config.icon

	const handleClick = () => {
		if (nodeData.onNodeClick) {
			nodeData.onNodeClick(id)
		}
	}

	// Extract just the filename from the full path
	const getFileName = (filePath: string): string => {
		const parts = filePath.split("/")
		return parts[parts.length - 1] || filePath
	}

	return (
		<div
			className={cn(
				"px-4 py-3 rounded-lg border-[3px] cursor-pointer transition-all",
				"hover:shadow-xl hover:scale-105",
				"min-w-[160px] max-w-[260px]",
				config.bgColor,
				config.borderColor,
			)}
			onClick={handleClick}>
			<Handle className="!bg-gray-400 !w-3 !h-3" position={Position.Top} type="target" />

			<div className="flex items-center gap-3">
				<Icon className={cn("w-8 h-8 shrink-0", config.textColor)} />
				<span className={cn("font-semibold text-sm truncate", config.textColor)}>{nodeData.label}</span>
			</div>

			{nodeData.filePath && <div className="text-xs text-gray-400 mt-2 truncate">{getFileName(nodeData.filePath)}</div>}

			{nodeData.lineNumber && <div className="text-xs text-gray-500 mt-0.5">Line {nodeData.lineNumber}</div>}

			<Handle className="!bg-gray-400 !w-3 !h-3" position={Position.Bottom} type="source" />
		</div>
	)
}

export const FlowNode = memo(FlowNodeComponent)
