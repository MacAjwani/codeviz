import type { FlowEdge } from "@shared/code-visualization/types"
import { ArrowRightIcon, CodeIcon, InfoIcon, PackageIcon, XIcon } from "lucide-react"
import { memo } from "react"

interface EdgeDetailModalProps {
	edge: FlowEdge | null
	onClose: () => void
}

function EdgeDetailModalComponent({ edge, onClose }: EdgeDetailModalProps) {
	if (!edge || !edge.metadata) return null

	const { trigger, dataDescription, dataFormat, sampleData } = edge.metadata as {
		trigger: string
		dataDescription: string
		dataFormat: string
		sampleData: string
	}

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
			<div
				className="bg-editor-background border border-editor-group-border rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[60vh] overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-editor-group-border">
					<div className="flex items-center gap-2">
						<ArrowRightIcon className="w-5 h-5" />
						<span className="font-semibold text-lg">Connection Details</span>
					</div>
					<button
						aria-label="Close"
						className="p-1 hover:bg-list-hover-background rounded transition-colors"
						onClick={onClose}>
						<XIcon className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="overflow-y-auto flex-1 p-4 space-y-4">
					{/* Trigger */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-description">
							<ArrowRightIcon className="w-4 h-4" />
							<span>Trigger</span>
						</div>
						<p className="text-sm pl-6">{trigger}</p>
					</div>

					{/* Data Description */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-description">
							<InfoIcon className="w-4 h-4" />
							<span>Data Flow</span>
						</div>
						<p className="text-sm pl-6">{dataDescription}</p>
					</div>

					{/* Data Format */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-description">
							<PackageIcon className="w-4 h-4" />
							<span>Data Format</span>
						</div>
						<div className="inline-block px-3 py-1.5 rounded text-sm font-medium border bg-blue-900/50 text-blue-300 border-blue-500 ml-6">
							{dataFormat}
						</div>
					</div>

					{/* Sample Data */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-description">
							<CodeIcon className="w-4 h-4" />
							<span>Sample Data</span>
						</div>
						<pre className="bg-code rounded-md p-3 text-xs overflow-x-auto border border-editor-group-border ml-6">
							<code>{sampleData}</code>
						</pre>
					</div>
				</div>
			</div>
		</div>
	)
}

export const EdgeDetailModal = memo(EdgeDetailModalComponent)
