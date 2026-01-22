import { Handle, type NodeProps, Position } from "@xyflow/react"
import { ChevronDownIcon, ChevronRightIcon, FileCodeIcon } from "lucide-react"
import { memo } from "react"
import { cn } from "@/lib/utils"

export interface GroupedFlowNodeData extends Record<string, unknown> {
	/** Display label (usually the file name) */
	label: string
	/** Number of methods/handlers contained in this group */
	childCount: number
	/** IDs of child nodes that belong to this group */
	childNodeIds: string[]
	/** Whether this group is currently expanded */
	isExpanded: boolean
	/** Callback when expand/collapse is toggled */
	onToggleExpand?: (nodeId: string) => void
	/** Callback when the node is clicked (for details) */
	onNodeClick?: (nodeId: string) => void
}

function GroupedFlowNodeComponent({ data, id }: NodeProps) {
	const nodeData = data as GroupedFlowNodeData

	const handleToggle = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (nodeData.onToggleExpand) {
			nodeData.onToggleExpand(id)
		}
	}

	const handleClick = () => {
		if (nodeData.onNodeClick) {
			nodeData.onNodeClick(id)
		}
	}

	const ChevronIcon = nodeData.isExpanded ? ChevronDownIcon : ChevronRightIcon

	return (
		<div
			className={cn(
				"px-4 py-3 rounded-lg border-[3px] cursor-pointer transition-all",
				"hover:shadow-xl hover:scale-105",
				"min-w-[180px] max-w-[280px]",
				"bg-slate-700/80 border-slate-400",
			)}
			onClick={handleClick}>
			<Handle className="!bg-gray-400 !w-3 !h-3" position={Position.Top} type="target" />

			<div className="flex items-center gap-2">
				<button
					className="p-0.5 rounded hover:bg-slate-600 transition-colors"
					onClick={handleToggle}
					title={nodeData.isExpanded ? "Collapse" : "Expand"}>
					<ChevronIcon className="w-5 h-5 text-slate-300" />
				</button>
				<FileCodeIcon className="w-6 h-6 text-slate-300 shrink-0" />
				<span className="font-semibold text-sm text-slate-200 truncate">{nodeData.label}</span>
			</div>

			<div className="text-xs text-slate-400 mt-1.5 pl-7">
				{nodeData.childCount} {nodeData.childCount === 1 ? "method" : "methods"}
			</div>

			<Handle className="!bg-gray-400 !w-3 !h-3" position={Position.Bottom} type="source" />
		</div>
	)
}

export const GroupedFlowNode = memo(GroupedFlowNodeComponent)
