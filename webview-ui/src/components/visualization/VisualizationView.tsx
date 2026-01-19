import type { CodeFlowDiagram } from "@shared/code-visualization/types"
import { StringRequest } from "@shared/proto/cline/common"
import { XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { VisualizationServiceClient } from "@/services/grpc-client"
import { DiagramViewer } from "./DiagramViewer"

interface VisualizationViewProps {
	diagramId: string
	onClose: () => void
	onOpenFile?: (filePath: string, lineNumber?: number) => void
}

export function VisualizationView({ diagramId, onClose, onOpenFile }: VisualizationViewProps) {
	const [diagram, setDiagram] = useState<CodeFlowDiagram | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		// Load the diagram from the backend
		const loadDiagram = async () => {
			try {
				setLoading(true)
				setError(null)

				const request = StringRequest.create({ value: diagramId })
				const response = await VisualizationServiceClient.loadDiagram(request)

				if (response.diagramJson) {
					// Parse the JSON string to get the diagram object
					const parsedDiagram = JSON.parse(response.diagramJson) as CodeFlowDiagram
					setDiagram(parsedDiagram)
				} else {
					setError("Diagram not found")
				}
			} catch (err) {
				console.error("Failed to load diagram:", err)
				setError(err instanceof Error ? err.message : "Failed to load diagram")
			} finally {
				setLoading(false)
			}
		}

		loadDiagram()
	}, [diagramId])

	return (
		<div className="fixed inset-0 z-50 bg-background flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-editor-group-border bg-editor-group-header">
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-semibold">Code Flow Visualization</h2>
					{diagram && (
						<span className="text-xs opacity-70">
							{diagram.nodes.length} nodes • {diagram.edges.length} edges
						</span>
					)}
				</div>
				<button
					aria-label="Close visualization"
					className="p-1.5 hover:bg-button-hover rounded-xs transition-colors"
					onClick={onClose}>
					<XIcon className="w-4 h-4" />
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-hidden">
				{loading && (
					<div className="flex items-center justify-center h-full">
						<div className="text-center">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-button mx-auto mb-4"></div>
							<p className="text-foreground opacity-70">Loading diagram...</p>
						</div>
					</div>
				)}

				{error && (
					<div className="flex items-center justify-center h-full">
						<div className="text-center max-w-md">
							<div className="bg-error/10 border border-error rounded-sm p-4 mb-4">
								<p className="text-error font-medium mb-2">Failed to load diagram</p>
								<p className="text-xs opacity-70">{error}</p>
							</div>
							<button
								className="bg-button hover:bg-button-hover text-button-foreground px-4 py-2 rounded-xs text-sm font-medium transition-colors"
								onClick={onClose}>
								Close
							</button>
						</div>
					</div>
				)}

				{!loading && !error && diagram && <DiagramViewer diagram={diagram} onOpenFile={onOpenFile} />}
			</div>
		</div>
	)
}
