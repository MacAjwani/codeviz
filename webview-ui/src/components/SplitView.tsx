import type { ClusterGraph, RepoInventory } from "@shared/architecture-visualization/types"
import { EmptyRequest } from "@shared/proto/cline/common"
import { GripVerticalIcon, RefreshCwIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArchitectureServiceClient } from "@/services/grpc-client"
import { ArchitectureDiagramViewer } from "./architecture/ArchitectureDiagramViewer"
import ChatView from "./chat/ChatView"

interface Props {
	hideAnnouncement: () => void
	isHidden: boolean
	showAnnouncement: boolean
	showHistoryView: () => void
}

/**
 * Main split view: Architecture diagram (left) + Chat (right)
 */
export function SplitView({ hideAnnouncement, isHidden, showAnnouncement, showHistoryView }: Props) {
	const [clusterGraph, setClusterGraph] = useState<ClusterGraph | null>(null)
	const [inventory, setInventory] = useState<RepoInventory | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [leftWidth, setLeftWidth] = useState(50) // percentage
	const isDragging = useRef(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const handleMouseDown = useCallback(() => {
		isDragging.current = true
		document.body.style.cursor = "col-resize"
		document.body.style.userSelect = "none"
	}, [])

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!isDragging.current || !containerRef.current) return

		const containerRect = containerRef.current.getBoundingClientRect()
		const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

		// Constrain between 20% and 80%
		if (newLeftWidth >= 20 && newLeftWidth <= 80) {
			setLeftWidth(newLeftWidth)
		}
	}, [])

	const handleMouseUp = useCallback(() => {
		isDragging.current = false
		document.body.style.cursor = ""
		document.body.style.userSelect = ""
	}, [])

	useEffect(() => {
		document.addEventListener("mousemove", handleMouseMove)
		document.addEventListener("mouseup", handleMouseUp)

		return () => {
			document.removeEventListener("mousemove", handleMouseMove)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [handleMouseMove, handleMouseUp])

	const loadMostRecentDiagram = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			console.log("[SplitView] Loading most recent diagram...")

			// List all diagrams and get the most recent one
			const listResponse = await ArchitectureServiceClient.listArchitectureDiagrams(EmptyRequest.create({}))

			console.log("[SplitView] List response:", listResponse)

			if (!listResponse.diagrams || listResponse.diagrams.length === 0) {
				console.log("[SplitView] No diagrams found")
				setLoading(false)
				setError("No diagrams found")
				return
			}

			// Sort by creation time and get the newest
			const sortedDiagrams = [...listResponse.diagrams].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
			const newestDiagram = sortedDiagrams[0]

			console.log("[SplitView] Loading diagram:", newestDiagram.id)

			// Load the diagram data
			const diagramResponse = await ArchitectureServiceClient.loadArchitectureDiagram({
				value: newestDiagram.id,
			})

			console.log("[SplitView] Diagram loaded successfully")

			const loadedClusterGraph = JSON.parse(diagramResponse.clusterGraphJson) as ClusterGraph
			const loadedInventory = JSON.parse(diagramResponse.inventoryJson) as RepoInventory

			console.log("[SplitView] Parsed data:", {
				clusters: loadedClusterGraph.clusters.length,
				files: loadedInventory.files.length,
			})

			setClusterGraph(loadedClusterGraph)
			setInventory(loadedInventory)
			setLoading(false)
		} catch (err) {
			console.error("[SplitView] Failed to load architecture diagram:", err)
			setLoading(false)
			const errorMsg = err instanceof Error ? err.message : "Unknown error"
			setError(`Failed to load diagram: ${errorMsg}`)
		}
	}, [])

	return (
		<div className={`flex h-full w-full ${isHidden ? "hidden" : ""}`} ref={containerRef}>
			{/* Left side - Architecture Diagram */}
			<div
				className="border-r border-editor-group-border bg-editor-background flex flex-col"
				style={{ width: `${leftWidth}%` }}>
				{/* Header with refresh button */}
				<div className="border-b border-editor-group-border p-3 flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-sm">Architecture Diagram</h3>
						{clusterGraph && (
							<p className="text-xs text-description mt-0.5">
								{clusterGraph.clusters.length} components • {inventory?.files.length || 0} files
							</p>
						)}
					</div>
					<button
						className="p-1.5 hover:bg-button-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={loading}
						onClick={loadMostRecentDiagram}
						title="Refresh diagram"
						type="button">
						<RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
					</button>
				</div>

				{/* Diagram content */}
				<div className="flex-1 overflow-hidden">
					{loading ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-center">
								<RefreshCwIcon className="size-8 animate-spin mx-auto mb-3 text-description" />
								<div className="text-sm text-description">Loading diagram...</div>
							</div>
						</div>
					) : error === "No diagrams found" || (!clusterGraph && !error) ? (
						<div className="flex items-center justify-center h-full p-8">
							<div className="text-center max-w-md">
								<div className="text-sm text-description mb-3">No Architecture Diagram</div>
								<p className="text-description text-xs leading-relaxed">
									Select a previous diagramming session, or start a new one by asking AI to visualize your code!
								</p>
								<button
									className="mt-4 px-4 py-2 bg-button hover:bg-button-hover text-button-foreground rounded text-xs font-medium transition-colors"
									onClick={loadMostRecentDiagram}
									type="button">
									Load Most Recent Diagram
								</button>
							</div>
						</div>
					) : error ? (
						<div className="flex items-center justify-center h-full p-8">
							<div className="text-center max-w-md">
								<div className="text-sm text-error mb-2">Error Loading Diagram</div>
								<p className="text-description text-xs">{error}</p>
								<button
									className="mt-4 px-4 py-2 bg-button hover:bg-button-hover text-button-foreground rounded text-xs font-medium transition-colors"
									onClick={loadMostRecentDiagram}
									type="button">
									Retry
								</button>
							</div>
						</div>
					) : clusterGraph && inventory ? (
						<ArchitectureDiagramViewer clusterGraph={clusterGraph} inventory={inventory} />
					) : null}
				</div>
			</div>

			{/* Resize handle */}
			<div
				className="w-1 bg-editor-group-border hover:bg-button-hover cursor-col-resize relative group"
				onMouseDown={handleMouseDown}>
				<div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
					<GripVerticalIcon className="size-4 text-description opacity-0 group-hover:opacity-100 transition-opacity" />
				</div>
			</div>

			{/* Right side - Chat */}
			<div className="flex-1">
				<ChatView
					hideAnnouncement={hideAnnouncement}
					isHidden={false}
					showAnnouncement={showAnnouncement}
					showHistoryView={showHistoryView}
				/>
			</div>
		</div>
	)
}
