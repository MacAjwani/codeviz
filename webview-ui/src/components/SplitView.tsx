import type { ClusterGraph, ComponentExecutionTrace, RepoInventory } from "@shared/architecture-visualization/types"
import { GripVerticalIcon, HomeIcon, RefreshCwIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArchitectureServiceClient } from "@/services/grpc-client"
import { ArchitectureDiagramViewer } from "./architecture/ArchitectureDiagramViewer"
import { ArchitectureHomeView } from "./architecture/ArchitectureHomeView"
import { ExecutionTraceViewer } from "./architecture/ExecutionTraceViewer"
import { WalkthroughPanel } from "./architecture/WalkthroughPanel"
import ChatView from "./chat/ChatView"

interface Props {
	hideAnnouncement: () => void
	isHidden: boolean
	showAnnouncement: boolean
	showHistoryView: () => void
	openDiagramId?: string
	openTraceId?: string
	onDiagramOpened?: () => void
	onTraceOpened?: () => void
}

type ArchitectureMode = "home" | "diagram" | "trace"

/**
 * Main split view: Architecture/Diagram (left) + Chat/Walkthrough (right)
 */
export function SplitView({
	hideAnnouncement,
	isHidden,
	showAnnouncement,
	showHistoryView,
	openDiagramId,
	openTraceId,
	onDiagramOpened,
	onTraceOpened,
}: Props) {
	const [mode, setMode] = useState<ArchitectureMode>("home")
	const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null)
	const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)

	const [clusterGraph, setClusterGraph] = useState<ClusterGraph | null>(null)
	const [inventory, setInventory] = useState<RepoInventory | null>(null)
	const [executionTrace, setExecutionTrace] = useState<ComponentExecutionTrace | null>(null)

	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [leftWidth, setLeftWidth] = useState(50) // percentage
	const [currentTraceStep, setCurrentTraceStep] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)

	const isDragging = useRef(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Handle external requests to open diagrams
	useEffect(() => {
		if (openDiagramId && openDiagramId !== selectedDiagramId) {
			handleSelectDiagram(openDiagramId)
			onDiagramOpened?.()
		}
	}, [openDiagramId])

	// Handle external requests to open traces
	useEffect(() => {
		if (openTraceId && openTraceId !== selectedTraceId) {
			// Load the trace to get its baseDiagramId
			loadTrace(openTraceId).then(() => {
				onTraceOpened?.()
			})
		}
	}, [openTraceId])

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

	// Load diagram when selected
	useEffect(() => {
		if (mode === "diagram" && selectedDiagramId) {
			loadDiagram(selectedDiagramId)
		}
	}, [mode, selectedDiagramId])

	// Load trace when selected
	useEffect(() => {
		if (mode === "trace" && selectedTraceId) {
			loadTrace(selectedTraceId)
		}
	}, [mode, selectedTraceId])

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
			console.error("[SplitView] Failed to load diagram:", err)
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
			setCurrentTraceStep(0)
			setLoading(false)
		} catch (err) {
			console.error("[SplitView] Failed to load trace:", err)
			setError(err instanceof Error ? err.message : "Failed to load trace")
			setLoading(false)
		}
	}

	function handleSelectDiagram(diagramId: string) {
		setSelectedDiagramId(diagramId)
		setSelectedTraceId(null)
		setExecutionTrace(null)
		setMode("diagram")
	}

	function handleSelectTrace(traceId: string, baseDiagramId: string) {
		setSelectedTraceId(traceId)
		setSelectedDiagramId(baseDiagramId)
		setMode("trace")
	}

	function handleBackToHome() {
		setMode("home")
		setSelectedDiagramId(null)
		setSelectedTraceId(null)
		setClusterGraph(null)
		setInventory(null)
		setExecutionTrace(null)
		setCurrentTraceStep(0)
		setIsPlaying(false)
	}

	// Auto-play for traces
	useEffect(() => {
		if (!isPlaying || mode !== "trace" || !executionTrace) return

		const timer = setInterval(() => {
			setCurrentTraceStep((prev) => {
				if (prev >= executionTrace.steps.length - 1) {
					setIsPlaying(false)
					return prev
				}
				return prev + 1
			})
		}, 2000)

		return () => clearInterval(timer)
	}, [isPlaying, mode, executionTrace])

	// Render left side content based on mode
	const renderLeftContent = () => {
		if (loading) {
			return (
				<div className="flex items-center justify-center h-full">
					<div className="text-center">
						<RefreshCwIcon className="size-8 animate-spin mx-auto mb-3 text-description" />
						<div className="text-sm text-description">Loading...</div>
					</div>
				</div>
			)
		}

		if (error) {
			return (
				<div className="flex items-center justify-center h-full p-8">
					<div className="text-center max-w-md">
						<div className="text-sm text-error mb-2">Error</div>
						<p className="text-description text-xs">{error}</p>
						<button
							className="mt-4 px-4 py-2 bg-button hover:bg-button-hover text-button-foreground rounded text-xs font-medium transition-colors"
							onClick={handleBackToHome}
							type="button">
							← Back to Home
						</button>
					</div>
				</div>
			)
		}

		if (mode === "home") {
			return <ArchitectureHomeView onSelectDiagram={handleSelectDiagram} onSelectTrace={handleSelectTrace} />
		}

		if (mode === "diagram" && clusterGraph && inventory) {
			return <ArchitectureDiagramViewer clusterGraph={clusterGraph} inventory={inventory} />
		}

		if (mode === "trace" && executionTrace && clusterGraph && inventory) {
			return (
				<ExecutionTraceViewer
					baseGraph={clusterGraph}
					currentStep={currentTraceStep}
					inventory={inventory}
					isPlaying={isPlaying}
					onPlayToggle={() => setIsPlaying(!isPlaying)}
					onStepChange={setCurrentTraceStep}
					trace={executionTrace}
				/>
			)
		}

		return null
	}

	// Render right side content based on mode
	const renderRightContent = () => {
		if (mode === "trace" && executionTrace) {
			return <WalkthroughPanel step={executionTrace.steps[currentTraceStep]} />
		}

		return (
			<ChatView
				hideAnnouncement={hideAnnouncement}
				isHidden={false}
				showAnnouncement={showAnnouncement}
				showHistoryView={showHistoryView}
			/>
		)
	}

	// Render header based on mode
	const renderHeader = () => {
		if (mode === "home") {
			return (
				<div className="border-b border-editor-group-border p-3 flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-sm">Architecture View</h3>
						<p className="text-xs text-description mt-0.5">Diagrams and Traces</p>
					</div>
				</div>
			)
		}

		if (mode === "diagram" && clusterGraph) {
			return (
				<div className="border-b border-editor-group-border p-3 flex items-center justify-between">
					<div className="flex items-center gap-2 flex-1 min-w-0">
						<button
							className="p-1.5 hover:bg-button-hover rounded transition-colors flex-shrink-0"
							onClick={handleBackToHome}
							title="Back to home"
							type="button">
							<HomeIcon className="size-4" />
						</button>
						<div className="min-w-0">
							<h3 className="font-semibold text-sm">Architecture Diagram</h3>
							<p className="text-xs text-description mt-0.5">
								{clusterGraph.clusters.length} components • {inventory?.files.length || 0} files
							</p>
						</div>
					</div>
				</div>
			)
		}

		if (mode === "trace" && executionTrace) {
			return (
				<div className="border-b border-editor-group-border p-3 flex items-center justify-between">
					<div className="flex items-center gap-2 flex-1 min-w-0">
						<button
							className="p-1.5 hover:bg-button-hover rounded transition-colors flex-shrink-0"
							onClick={handleBackToHome}
							title="Back to home"
							type="button">
							<HomeIcon className="size-4" />
						</button>
						<div className="min-w-0">
							<h3 className="font-semibold text-sm truncate">{executionTrace.entryPoint}</h3>
							<p className="text-xs text-description mt-0.5">
								{executionTrace.steps.length} steps • {executionTrace.highlightedComponents.length} components
							</p>
						</div>
					</div>
				</div>
			)
		}

		return null
	}

	return (
		<div className={`flex h-full w-full ${isHidden ? "hidden" : ""}`} ref={containerRef}>
			{/* Left side - Architecture */}
			<div
				className="border-r border-editor-group-border bg-editor-background flex flex-col"
				style={{ width: `${leftWidth}%` }}>
				{renderHeader()}
				<div className="flex-1 overflow-hidden">{renderLeftContent()}</div>
			</div>

			{/* Resize handle */}
			<div
				className="w-1 bg-editor-group-border hover:bg-button-hover cursor-col-resize relative group"
				onMouseDown={handleMouseDown}>
				<div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
					<GripVerticalIcon className="size-4 text-description opacity-0 group-hover:opacity-100 transition-opacity" />
				</div>
			</div>

			{/* Right side - Chat or Walkthrough */}
			<div className="flex-1">{renderRightContent()}</div>
		</div>
	)
}
