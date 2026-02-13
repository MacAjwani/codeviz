/**
 * Architecture Home View - Landing page showing all diagrams and traces
 */

import type { ClusterGraphInfo, ExecutionTraceInfo } from "@shared/architecture-visualization/types"
import { ListExecutionTracesRequest } from "@shared/proto/cline/architecture"
import { EmptyRequest } from "@shared/proto/cline/common"
import {
	BoxIcon,
	CalendarIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	FileIcon,
	FileTextIcon,
	ListIcon,
	PlayCircleIcon,
	RefreshCwIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ArchitectureServiceClient } from "@/services/grpc-client"

interface Props {
	onSelectDiagram: (diagramId: string) => void
	onSelectTrace: (traceId: string, baseDiagramId: string) => void
}

export function ArchitectureHomeView({ onSelectDiagram, onSelectTrace }: Props) {
	const [diagrams, setDiagrams] = useState<ClusterGraphInfo[]>([])
	const [traces, setTraces] = useState<ExecutionTraceInfo[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [expandedDiagrams, setExpandedDiagrams] = useState<Set<string>>(new Set())

	// Group traces by diagram - MUST be before conditional returns (Rules of Hooks)
	const diagramsWithTraces = useMemo(() => {
		return diagrams.map((diagram) => ({
			...diagram,
			traces: traces.filter((trace) => trace.baseDiagramId === diagram.id),
		}))
	}, [diagrams, traces])

	useEffect(() => {
		loadData()

		// Poll for updates every 5 seconds
		const interval = setInterval(loadData, 5000)
		return () => clearInterval(interval)
	}, [])

	async function loadData() {
		try {
			// Load diagrams
			const diagramsResponse = await ArchitectureServiceClient.listArchitectureDiagrams(EmptyRequest.create({}))
			const sortedDiagrams = [...(diagramsResponse.diagrams || [])].sort(
				(a, b) => Number(b.createdAt) - Number(a.createdAt),
			)
			setDiagrams(sortedDiagrams as ClusterGraphInfo[])

			// Load all traces
			const tracesResponse = await ArchitectureServiceClient.listExecutionTraces(ListExecutionTracesRequest.create({}))
			const sortedTraces = [...(tracesResponse.traces || [])].sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
			setTraces(sortedTraces as ExecutionTraceInfo[])

			setLoading(false)
			setError(null)
		} catch (err) {
			console.error("[ArchitectureHomeView] Failed to load data:", err)
			setLoading(false)
			setError(err instanceof Error ? err.message : "Failed to load data")
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full bg-vscode-editor-background">
				<div className="text-center">
					<RefreshCwIcon className="size-8 animate-spin mx-auto mb-3 text-vscode-descriptionForeground" />
					<div className="text-sm text-vscode-descriptionForeground">Loading...</div>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full p-4 bg-vscode-editor-background">
				<div className="text-center max-w-md">
					<div className="text-sm text-vscode-errorForeground mb-2">Error</div>
					<div className="text-vscode-descriptionForeground text-sm">{error}</div>
				</div>
			</div>
		)
	}

	return (
		<div className="h-full overflow-y-auto bg-[#181818]">
			<div className="p-8 space-y-6">
				{/* Header */}
				<div className="flex items-center gap-3">
					<FileTextIcon className="size-5 text-[#007ACC]" />
					<h2 className="text-lg font-semibold text-white">Architecture Diagrams</h2>
					<span className="text-sm text-[#9d9d9d]">({diagrams.length})</span>
				</div>

				{/* Diagrams - Vertical list */}
				{diagramsWithTraces.length === 0 ? (
					<div className="text-center py-16 border-2 border-[#3c3c3c] rounded-lg bg-[#252526]">
						<div className="text-[#cccccc] mb-3 text-base font-medium">No diagrams generated yet</div>
						<div className="text-sm text-[#9d9d9d]">
							Use{" "}
							<code className="px-2 py-1 bg-[#181818] border border-[#3c3c3c] rounded text-[#007ACC] font-mono">
								generate_architecture_diagram
							</code>{" "}
							to create one
						</div>
					</div>
				) : (
					<div className="space-y-4">
						{diagramsWithTraces.map((diagram) => (
							<div className="w-full" key={diagram.id}>
								{/* Diagram Card */}
								<button
									className="w-full text-left p-4 rounded-lg border-2 border-[#3c3c3c] bg-[#252526] hover:border-[#007ACC] hover:bg-[#2d2d30] transition-all mb-3"
									onClick={() => onSelectDiagram(diagram.id)}
									type="button">
									<div className="flex items-start justify-between mb-3">
										<div className="flex items-center gap-2">
											<FileTextIcon className="size-4 text-[#007ACC]" />
											<div className="text-base font-medium text-white">
												{diagram.name || `Diagram ${diagram.id.split("_")[1]?.substring(0, 8)}`}
											</div>
										</div>
										<div className="flex items-center gap-1 text-xs text-[#9d9d9d]">
											<CalendarIcon className="size-3" />
											{new Date(diagram.createdAt).toLocaleDateString()}
										</div>
									</div>
									<div className="flex items-center gap-4 text-sm text-[#9d9d9d]">
										<div className="flex items-center gap-1.5">
											<BoxIcon className="size-3.5" />
											{diagram.clusterCount} components
										</div>
										<div className="flex items-center gap-1.5">
											<FileIcon className="size-3.5" />
											{diagram.fileCount} files
										</div>
									</div>
								</button>

								{/* Traces Sublist - Collapsible */}
								{diagram.traces.length > 0 && (
									<div className="space-y-2 pl-4 border-l-2 border-[#3c3c3c]">
										<button
											className="text-xs font-semibold text-[#9d9d9d] uppercase tracking-wide mb-2 flex items-center gap-2 hover:text-[#007ACC] transition-colors cursor-pointer"
											onClick={(e) => {
												e.stopPropagation()
												const newExpanded = new Set(expandedDiagrams)
												if (expandedDiagrams.has(diagram.id)) {
													newExpanded.delete(diagram.id)
												} else {
													newExpanded.add(diagram.id)
												}
												setExpandedDiagrams(newExpanded)
											}}
											type="button">
											{expandedDiagrams.has(diagram.id) ? (
												<ChevronDownIcon className="size-3" />
											) : (
												<ChevronRightIcon className="size-3" />
											)}
											<PlayCircleIcon className="size-3" />
											Traces ({diagram.traces.length})
										</button>
										{expandedDiagrams.has(diagram.id) &&
											diagram.traces.map((trace) => (
												<button
													className="w-full text-left p-3 rounded border border-[#3c3c3c] bg-[#1f1f1f] hover:border-[#007ACC] hover:bg-[#252526] transition-all group"
													key={trace.id}
													onClick={(e) => {
														e.stopPropagation()
														onSelectTrace(trace.id, trace.baseDiagramId)
													}}
													type="button">
													<div className="text-sm text-white mb-2 line-clamp-2">
														{trace.name || trace.entryPoint}
													</div>
													<div className="flex items-center gap-3 text-xs text-[#9d9d9d]">
														<div className="flex items-center gap-1">
															<ListIcon className="size-3" />
															{trace.stepCount} steps
														</div>
														<div className="flex items-center gap-1">
															<CalendarIcon className="size-2.5" />
															{new Date(trace.createdAt).toLocaleDateString()}
														</div>
													</div>
												</button>
											))}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
