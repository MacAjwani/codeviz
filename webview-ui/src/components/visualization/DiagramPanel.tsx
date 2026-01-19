import type { CodeFlowDiagram } from "@shared/code-visualization/types"
import { StringRequest } from "@shared/proto/cline/common"
import { MaximizeIcon, MinimizeIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { FileServiceClient } from "@/services/grpc-client"
import { DiagramViewer } from "./DiagramViewer"

interface DiagramPanelProps {
	diagram: CodeFlowDiagram
	onClose: () => void
	isFullscreen?: boolean
	onToggleFullscreen?: () => void
}

export function DiagramPanel({ diagram, onClose, isFullscreen = false, onToggleFullscreen }: DiagramPanelProps) {
	const handleOpenFile = (filePath: string, lineNumber?: number) => {
		// Use the gRPC client to open the file in the editor
		const fullPath = lineNumber ? `${filePath}:${lineNumber}` : filePath
		FileServiceClient.openFile(StringRequest.create({ value: fullPath })).catch((err) =>
			console.error("Failed to open file:", err),
		)
	}

	return (
		<div
			className={`
				${isFullscreen ? "fixed inset-0 z-50" : "h-[500px]"}
				bg-editor-background border border-editor-group-border rounded-lg overflow-hidden flex flex-col
			`}>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-editor-group-border bg-sidebar-background">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm">Code Flow Diagram</span>
					<span className="text-xs text-description">({diagram.nodes.length} nodes)</span>
				</div>
				<div className="flex items-center gap-1">
					{onToggleFullscreen && (
						<button
							className="p-1.5 hover:bg-list-hover-background rounded transition-colors"
							onClick={onToggleFullscreen}
							title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
							{isFullscreen ? <MinimizeIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
						</button>
					)}
					<button
						className="p-1.5 hover:bg-list-hover-background rounded transition-colors"
						onClick={onClose}
						title="Close diagram">
						<XIcon className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Diagram Content */}
			<div className="flex-1 min-h-0">
				<DiagramViewer diagram={diagram} onOpenFile={handleOpenFile} />
			</div>
		</div>
	)
}

/**
 * Hook to parse diagram data from a JSON string
 */
export function useParseDiagram(diagramJson: string | null): CodeFlowDiagram | null {
	const [diagram, setDiagram] = useState<CodeFlowDiagram | null>(null)

	useEffect(() => {
		if (!diagramJson) {
			setDiagram(null)
			return
		}

		try {
			const parsed = JSON.parse(diagramJson) as CodeFlowDiagram
			setDiagram(parsed)
		} catch (error) {
			console.error("Failed to parse diagram JSON:", error)
			setDiagram(null)
		}
	}, [diagramJson])

	return diagram
}
