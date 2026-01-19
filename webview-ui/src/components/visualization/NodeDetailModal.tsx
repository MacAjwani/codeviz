import type { FlowNode } from "@shared/code-visualization/types"
import { ExternalLinkIcon, FileCodeIcon, InfoIcon, XIcon } from "lucide-react"
import { memo } from "react"
import { cn } from "@/lib/utils"

interface NodeDetailModalProps {
	node: FlowNode | null
	onClose: () => void
	onOpenFile?: (filePath: string, lineNumber?: number) => void
}

function NodeDetailModalComponent({ node, onClose, onOpenFile }: NodeDetailModalProps) {
	if (!node) return null

	const handleOpenFile = () => {
		if (onOpenFile && node.filePath) {
			onOpenFile(node.filePath, node.lineNumber)
		}
	}

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
			<div
				className="bg-editor-background border border-editor-group-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-editor-group-border">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-lg">{node.label}</span>
						<span className="text-xs px-2 py-0.5 rounded bg-description/20 text-description">{node.type}</span>
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
					{/* Entity Purpose */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-description">
							<InfoIcon className="w-4 h-4" />
							<span>Purpose in System</span>
						</div>
						<p className="text-sm pl-6">{node.entityPurpose}</p>
					</div>

					{/* File Location - Only show if entity has code in codebase */}
					{node.filePath && (
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium text-description">
								<FileCodeIcon className="w-4 h-4" />
								<span>Code Location</span>
							</div>
							<div
								className="flex items-center gap-2 text-sm text-link cursor-pointer hover:underline pl-6"
								onClick={handleOpenFile}>
								<ExternalLinkIcon className="w-3 h-3" />
								<span>
									{node.filePath}
									{node.lineNumber && `:${node.lineNumber}`}
								</span>
							</div>
						</div>
					)}
				</div>

				{/* Footer - Only show Open in Editor if entity has code */}
				{node.filePath && (
					<div className="px-4 py-3 border-t border-editor-group-border flex justify-end">
						<button
							className="px-4 py-2 bg-button-background hover:bg-button-hover-background text-button-foreground rounded text-sm transition-colors flex items-center gap-2"
							onClick={handleOpenFile}>
							<ExternalLinkIcon className="w-4 h-4" />
							Open in Editor
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

interface DetailSectionProps {
	icon: typeof InfoIcon
	title: string
	content: string
	iconColor?: string
}

function DetailSection({ icon: Icon, title, content, iconColor = "text-description" }: DetailSectionProps) {
	if (!content || content === "Pending analysis") return null

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 text-sm font-medium text-description">
				<Icon className={cn("w-4 h-4", iconColor)} />
				<span>{title}</span>
			</div>
			<p className="text-sm pl-6">{content}</p>
		</div>
	)
}

export const NodeDetailModal = memo(NodeDetailModalComponent)
