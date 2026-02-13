import type { ClusterGraph, ComponentExecutionTrace, RepoInventory } from "@shared/architecture-visualization/types"
import { useEffect, useState } from "react"
import { ArchitectureServiceClient } from "@/services/grpc-client"
import { ArchitectureDiagramViewer } from "./ArchitectureDiagramViewer"
import { ArchitectureHomeView } from "./ArchitectureHomeView"
import { ExecutionTraceViewer } from "./ExecutionTraceViewer"

type ViewMode = "home" | "diagram" | "trace"

/**
 * Main architecture view component with navigation between:
 * - Home: List of diagrams and traces
 * - Diagram: Interactive architecture diagram
 * - Trace: Animated execution trace viewer
 */
export function ArchitectureView() {
	const [viewMode, setViewMode] = useState<ViewMode>("home")
	const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null)
	const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)

	const [clusterGraph, setClusterGraph] = useState<ClusterGraph | null>(null)
	const [inventory, setInventory] = useState<RepoInventory | null>(null)
	const [executionTrace, setExecutionTrace] = useState<ComponentExecutionTrace | null>(null)

	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [currentStep, setCurrentStep] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)

	// Load diagram when selected
	useEffect(() => {
		if (viewMode === "diagram" && selectedDiagramId) {
			loadDiagram(selectedDiagramId)
		}
	}, [viewMode, selectedDiagramId])

	// Load trace when selected
	useEffect(() => {
		if (viewMode === "trace" && selectedTraceId) {
			loadTrace(selectedTraceId)
		}
	}, [viewMode, selectedTraceId])

	// Auto-play for traces
	useEffect(() => {
		if (!isPlaying || viewMode !== "trace" || !executionTrace) return

		const timer = setInterval(() => {
			setCurrentStep((prev) => {
				if (prev >= executionTrace.steps.length - 1) {
					setIsPlaying(false)
					return prev
				}
				return prev + 1
			})
		}, 2000)

		return () => clearInterval(timer)
	}, [isPlaying, viewMode, executionTrace])

	async function loadDiagram(diagramId: string) {
		setLoading(true)
		setError(null)
		try {
			const diagramResponse = await ArchitectureServiceClient.loadArchitectureDiagram({ value: diagramId })
			const loadedClusterGraph = JSON.parse(diagramResponse.clusterGraphJson) as ClusterGraph
			const loadedInventory = JSON.parse(diagramResponse.inventoryJson) as RepoInventory

			setClusterGraph(loadedClusterGraph)
			setInventory(loadedInventory)
			setLoading(false)
		} catch (err) {
			console.error("[ArchitectureView] Failed to load diagram:", err)
			setError(err instanceof Error ? err.message : "Failed to load diagram")
			setLoading(false)
		}
	}

	async function loadTrace(traceId: string) {
		setLoading(true)
		setError(null)
		try {
			// Load trace
			const traceResponse = await ArchitectureServiceClient.loadExecutionTrace({ value: traceId })
			const trace = JSON.parse(traceResponse.traceJson) as ComponentExecutionTrace

			// Load base diagram for the trace
			const diagramResponse = await ArchitectureServiceClient.loadArchitectureDiagram({
				value: trace.baseDiagramId,
			})
			const loadedClusterGraph = JSON.parse(diagramResponse.clusterGraphJson) as ClusterGraph
			const loadedInventory = JSON.parse(diagramResponse.inventoryJson) as RepoInventory

			setExecutionTrace(trace)
			setClusterGraph(loadedClusterGraph)
			setInventory(loadedInventory)
			setLoading(false)
		} catch (err) {
			console.error("[ArchitectureView] Failed to load trace:", err)
			setError(err instanceof Error ? err.message : "Failed to load trace")
			setLoading(false)
		}
	}

	function handleSelectDiagram(diagramId: string) {
		setSelectedDiagramId(diagramId)
		setSelectedTraceId(null)
		setExecutionTrace(null)
		setViewMode("diagram")
	}

	function handleSelectTrace(traceId: string, baseDiagramId: string) {
		setSelectedTraceId(traceId)
		setSelectedDiagramId(baseDiagramId)
		setViewMode("trace")
	}

	function handleBackToHome() {
		setViewMode("home")
		setSelectedDiagramId(null)
		setSelectedTraceId(null)
		setClusterGraph(null)
		setInventory(null)
		setExecutionTrace(null)
		setCurrentStep(0)
		setIsPlaying(false)
	}

	// Show loading state
	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					<div className="text-lg text-vscode-foreground">Loading...</div>
				</div>
			</div>
		)
	}

	// Show error state
	if (error) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-4">
				<div className="text-center max-w-md mb-4">
					<div className="text-sm text-vscode-descriptionForeground mb-2">Error</div>
					<div className="text-vscode-descriptionForeground">{error}</div>
				</div>
				<button
					className="px-4 py-2 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded text-sm transition-colors"
					onClick={handleBackToHome}>
					← Back to Home
				</button>
			</div>
		)
	}

	// Show trace viewer
	if (viewMode === "trace" && executionTrace && clusterGraph && inventory) {
		return (
			<div className="flex flex-col h-full">
				{/* Header with back button */}
				<div className="p-3 border-b border-vscode-panel-border bg-vscode-sideBar-background flex items-center gap-3">
					<button
						className="px-3 py-1.5 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded text-sm transition-colors"
						onClick={handleBackToHome}>
						← Back to Home
					</button>
					<div className="flex-1">
						<div className="text-sm font-medium text-vscode-foreground">{executionTrace.entryPoint}</div>
						<div className="text-xs text-vscode-descriptionForeground">
							{executionTrace.steps.length} steps • {executionTrace.highlightedComponents.length} components
						</div>
					</div>
				</div>

				{/* Trace viewer */}
				<div className="flex-1 overflow-hidden">
					<ExecutionTraceViewer
						baseGraph={clusterGraph}
						currentStep={currentStep}
						inventory={inventory}
						isPlaying={isPlaying}
						onPlayToggle={() => setIsPlaying(!isPlaying)}
						onStepChange={setCurrentStep}
						trace={executionTrace}
					/>
				</div>
			</div>
		)
	}

	// Show diagram viewer
	if (viewMode === "diagram" && clusterGraph && inventory) {
		return (
			<div className="flex flex-col h-full">
				{/* Header with back button */}
				<div className="p-3 border-b border-vscode-panel-border bg-vscode-sideBar-background flex items-center gap-3">
					<button
						className="px-3 py-1.5 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded text-sm transition-colors"
						onClick={handleBackToHome}>
						← Back to Home
					</button>
					<div className="flex-1">
						<div className="text-sm font-medium text-vscode-foreground">Architecture Diagram</div>
						<div className="text-xs text-vscode-descriptionForeground">
							{clusterGraph.clusters.length} components • {inventory.files.length} files
						</div>
					</div>
				</div>

				{/* Diagram viewer */}
				<div className="flex-1 overflow-hidden">
					<ArchitectureDiagramViewer clusterGraph={clusterGraph} inventory={inventory} />
				</div>
			</div>
		)
	}

	// Show home view (default)
	return <ArchitectureHomeView onSelectDiagram={handleSelectDiagram} onSelectTrace={handleSelectTrace} />
}
