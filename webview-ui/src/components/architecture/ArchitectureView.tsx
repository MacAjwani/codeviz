import type { ClusterGraph, RepoInventory } from "@shared/architecture-visualization/types"
import { EmptyRequest } from "@shared/proto/cline/common"
import { useEffect, useState } from "react"
import { ArchitectureServiceClient } from "@/services/grpc-client"
import { ArchitectureDiagramViewer } from "./ArchitectureDiagramViewer"

/**
 * Main architecture diagram view component.
 * Loads the most recent cluster graph and renders interactive diagram.
 */
export function ArchitectureView() {
	const [clusterGraph, setClusterGraph] = useState<ClusterGraph | null>(null)
	const [inventory, setInventory] = useState<RepoInventory | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		loadMostRecentDiagram()

		// Poll for new diagrams every 5 seconds
		const interval = setInterval(loadMostRecentDiagram, 5000)
		return () => clearInterval(interval)
	}, [])

	async function loadMostRecentDiagram() {
		try {
			console.log("[ArchitectureView] Loading most recent diagram...")

			// List all diagrams and get the most recent one
			const listResponse = await ArchitectureServiceClient.listArchitectureDiagrams(EmptyRequest.create({}))

			console.log("[ArchitectureView] List response:", listResponse)

			if (!listResponse.diagrams || listResponse.diagrams.length === 0) {
				console.log("[ArchitectureView] No diagrams found")
				setLoading(false)
				setError("No architecture diagrams found. Generate one to get started!")
				return
			}

			// Sort by creation time and get the newest
			const sortedDiagrams = [...listResponse.diagrams].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
			const newestDiagram = sortedDiagrams[0]

			console.log("[ArchitectureView] Loading diagram:", newestDiagram.id)

			// Check if we already have this diagram loaded
			if (clusterGraph && clusterGraph.id === newestDiagram.id) {
				console.log("[ArchitectureView] Diagram already loaded, skipping")
				return // Already loaded
			}

			// Load the diagram data
			const diagramResponse = await ArchitectureServiceClient.loadArchitectureDiagram({ value: newestDiagram.id })

			console.log("[ArchitectureView] Diagram loaded successfully")

			const loadedClusterGraph = JSON.parse(diagramResponse.clusterGraphJson) as ClusterGraph
			const loadedInventory = JSON.parse(diagramResponse.inventoryJson) as RepoInventory

			console.log("[ArchitectureView] Parsed data:", {
				clusters: loadedClusterGraph.clusters.length,
				files: loadedInventory.files.length,
			})

			setClusterGraph(loadedClusterGraph)
			setInventory(loadedInventory)
			setLoading(false)
			setError(null)
		} catch (err) {
			console.error("[ArchitectureView] Failed to load architecture diagram:", err)
			setLoading(false)
			if (!clusterGraph) {
				const errorMsg = err instanceof Error ? err.message : "Unknown error"
				setError(`Failed to load diagram: ${errorMsg}`)
			}
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="text-lg">Loading architecture diagram...</div>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full p-4">
				<div className="text-center max-w-md">
					<div className="text-sm text-description mb-2">Architecture Diagram</div>
					<div className="text-description">{error}</div>
					<div className="mt-4 text-xs text-description">
						Generate a diagram using the tool, and it will appear here.
					</div>
				</div>
			</div>
		)
	}

	if (!clusterGraph || !inventory) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center text-description">
					<div>No diagram loaded</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full w-full">
			{/* Diagram area - 75% */}
			<div className="flex-[3]">
				<ArchitectureDiagramViewer clusterGraph={clusterGraph} inventory={inventory} />
			</div>

			{/* Chat area - 25% */}
			<div className="flex-[1] border-l border-editor-group-border bg-editor-background">
				<div className="h-full flex flex-col">
					<div className="p-4 border-b border-editor-group-border">
						<h3 className="font-semibold text-sm">Architecture Chat</h3>
						<p className="text-xs text-description mt-1">Ask questions about the architecture diagram</p>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						<div className="text-sm text-description text-center mt-8">
							<p>Chat integration coming soon...</p>
							<p className="text-xs mt-2">Click on components in the diagram to see details</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
