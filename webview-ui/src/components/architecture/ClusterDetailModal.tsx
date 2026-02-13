import type { C4ComponentType, Cluster, ClusterGraph, RepoInventory } from "@shared/architecture-visualization/types"
import type { LucideIcon } from "lucide-react"
import {
	CloudIcon,
	CogIcon,
	ComponentIcon,
	DatabaseIcon,
	FileCodeIcon,
	FilterIcon,
	HardDriveIcon,
	InboxIcon,
	LayersIcon,
	ServerIcon,
	WrenchIcon,
	XIcon,
} from "lucide-react"
import { memo } from "react"
import { PLATFORM_CONFIG } from "@/config/platform.config"

interface Props {
	cluster: Cluster
	inventory: RepoInventory
	clusterGraph?: ClusterGraph // Optional: for showing relationships
	onClose: () => void
}

// C4 Component Type Icons (same as ClusterNode)
const COMPONENT_TYPE_ICONS: Record<C4ComponentType, LucideIcon> = {
	controller: ServerIcon,
	service: CogIcon,
	repository: DatabaseIcon,
	component: ComponentIcon,
	gateway: CloudIcon,
	database: DatabaseIcon,
	external_system: CloudIcon,
	message_queue: InboxIcon,
	cache: HardDriveIcon,
	middleware: FilterIcon,
	utility: WrenchIcon,
	config: WrenchIcon,
}

// C4 Component Type Colors (same as ClusterNode)
const C4_COMPONENT_COLORS: Record<C4ComponentType, string> = {
	controller: "#3b82f6",
	service: "#10b981",
	repository: "#f59e0b",
	component: "#8b5cf6",
	gateway: "#ec4899",
	database: "#f97316",
	external_system: "#6366f1",
	message_queue: "#14b8a6",
	cache: "#f43f5e",
	middleware: "#84cc16",
	utility: "#64748b",
	config: "#78716c",
}

// C4 Component Type Descriptions
const COMPONENT_TYPE_DESCRIPTIONS: Record<C4ComponentType, string> = {
	controller: "Handles HTTP requests and routes them to appropriate services",
	service: "Contains business logic and orchestrates operations",
	repository: "Provides data access abstraction and persistence operations",
	component: "UI component that renders visual elements",
	gateway: "Client for external API communication",
	database: "Database schema and ORM models",
	external_system: "Integration with external third-party systems",
	message_queue: "Message broker for asynchronous communication",
	cache: "Caching layer for performance optimization",
	middleware: "Request/response processing middleware",
	utility: "Helper functions and shared utilities",
	config: "Configuration management and environment setup",
}

function ClusterDetailModalComponent({ cluster, inventory, clusterGraph, onClose }: Props) {
	// Get file details from inventory
	const keyFileDetails = cluster.keyFiles.map((filePath) => {
		const file = inventory.files.find((f) => f.path === filePath)
		return {
			path: filePath,
			linesOfCode: file?.linesOfCode || 0,
			exports: file?.exports.map((e) => e.name).slice(0, 5) || [],
		}
	})

	// Check if this is a C4 diagram
	const isC4Diagram = cluster.version === 2 || cluster.componentType !== undefined
	const displayColor =
		isC4Diagram && cluster.componentType ? C4_COMPONENT_COLORS[cluster.componentType] : cluster.color || "#3b82f6"

	const Icon = isC4Diagram && cluster.componentType ? COMPONENT_TYPE_ICONS[cluster.componentType] : LayersIcon

	// Get relationships if cluster graph is provided
	const incomingEdges = clusterGraph?.clusterEdges.filter((e) => e.target === cluster.id) || []
	const outgoingEdges = clusterGraph?.clusterEdges.filter((e) => e.source === cluster.id) || []

	// Handler for clicking file links
	const handleFileClick = (filePath: string) => {
		PLATFORM_CONFIG.postMessage({
			type: "openFile",
			filePath: filePath,
		})
	}

	return (
		<div className="fixed inset-0 bg-[#181818]/95 flex items-center justify-center z-50" onClick={onClose}>
			<div
				className="bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div
					className="flex items-center justify-between px-6 py-5 border-b-2"
					style={{ borderBottomColor: displayColor }}>
					<div className="flex items-center gap-3">
						<Icon className="w-6 h-6" style={{ color: displayColor }} />
						<span className="font-semibold text-xl text-white">{cluster.label}</span>
						{isC4Diagram && cluster.componentType && (
							<span
								className="px-3 py-1 rounded-md text-xs font-medium border"
								style={{
									backgroundColor: `${displayColor}20`,
									color: displayColor,
									borderColor: `${displayColor}30`,
								}}>
								{cluster.componentType.replace(/_/g, " ")}
							</span>
						)}
						{!isC4Diagram && cluster.layer && (
							<span
								className="px-3 py-1 rounded-md text-xs font-medium border"
								style={{
									backgroundColor: `${displayColor}20`,
									color: displayColor,
									borderColor: `${displayColor}30`,
								}}>
								{cluster.layer}
							</span>
						)}
					</div>
					<button
						aria-label="Close"
						className="p-2 hover:bg-[#3c3c3c] rounded transition-colors text-[#cccccc] hover:text-white"
						onClick={onClose}>
						<XIcon className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-6 overflow-y-auto flex-1">
					<div className="space-y-6">
						{/* Component Type (C4 only) */}
						{isC4Diagram && cluster.componentType && (
							<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
								<div className="flex items-center gap-2 mb-3">
									<Icon className="w-5 h-5" style={{ color: displayColor }} />
									<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide">
										Component Type
									</h3>
								</div>
								<div className="flex items-start gap-3">
									<div>
										<div className="text-base font-medium mb-2" style={{ color: displayColor }}>
											{cluster.componentType.replace(/_/g, " ")}
										</div>
										<div className="text-sm text-[#9d9d9d] leading-relaxed">
											{COMPONENT_TYPE_DESCRIPTIONS[cluster.componentType]}
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Description */}
						<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
							<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide mb-3">Component Role</h3>
							<p className="text-sm text-white leading-relaxed">{cluster.description}</p>
						</div>

						{/* Technology Stack (C4 only) */}
						{isC4Diagram && cluster.technology && (
							<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide mb-3">
									Technology Stack
								</h3>
								<div className="space-y-2">
									{cluster.technology.language && (
										<div className="text-sm text-white">
											<span className="text-[#9d9d9d]">Language:</span> {cluster.technology.language}
										</div>
									)}
									{cluster.technology.framework && (
										<div className="text-sm text-white">
											<span className="text-[#9d9d9d]">Framework:</span> {cluster.technology.framework}
										</div>
									)}
									{cluster.technology.libraries && cluster.technology.libraries.length > 0 && (
										<div className="text-sm text-white">
											<span className="text-[#9d9d9d]">Libraries:</span>{" "}
											{cluster.technology.libraries.join(", ")}
										</div>
									)}
									{cluster.technology.databases && cluster.technology.databases.length > 0 && (
										<div className="text-sm text-white">
											<span className="text-[#9d9d9d]">Databases:</span>{" "}
											{cluster.technology.databases.join(", ")}
										</div>
									)}
									{cluster.technology.messaging && cluster.technology.messaging.length > 0 && (
										<div className="text-sm text-white">
											<span className="text-[#9d9d9d]">Messaging:</span>{" "}
											{cluster.technology.messaging.join(", ")}
										</div>
									)}
								</div>
							</div>
						)}

						{/* Responsibilities (C4 only) */}
						{isC4Diagram && cluster.responsibilities && cluster.responsibilities.length > 0 && (
							<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide mb-3">
									Key Responsibilities
								</h3>
								<ul className="space-y-2">
									{cluster.responsibilities.map((responsibility, idx) => (
										<li className="text-sm text-white flex items-start gap-2" key={idx}>
											<span className="text-[#007ACC] mt-1">•</span>
											<span>{responsibility}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Relationships (C4 only) */}
						{isC4Diagram && (incomingEdges.length > 0 || outgoingEdges.length > 0) && (
							<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide mb-3">
									Relationships
								</h3>
								<div className="space-y-4">
									{outgoingEdges.length > 0 && (
										<div>
											<div className="text-xs font-semibold text-[#9d9d9d] mb-2 uppercase">
												Outgoing ({outgoingEdges.length})
											</div>
											<div className="space-y-2">
												{outgoingEdges.map((edge) => {
													const targetCluster = clusterGraph?.clusters.find((c) => c.id === edge.target)
													const targetColor = targetCluster?.componentType
														? C4_COMPONENT_COLORS[targetCluster.componentType]
														: targetCluster?.color || "#3b82f6"
													return (
														<div
															className="text-sm pl-3 border-l-2 py-1"
															key={edge.id}
															style={{ borderLeftColor: targetColor }}>
															<div className="font-medium" style={{ color: targetColor }}>
																→ {targetCluster?.label || edge.target}
															</div>
															{edge.relationshipType && (
																<div className="text-[#9d9d9d] text-xs mt-0.5">
																	{edge.relationshipType}
																	{edge.protocol && ` via ${edge.protocol}`}
																	{edge.description && ` - ${edge.description}`}
																</div>
															)}
														</div>
													)
												})}
											</div>
										</div>
									)}
									{incomingEdges.length > 0 && (
										<div>
											<div className="text-xs font-semibold text-[#9d9d9d] mb-2 uppercase">
												Incoming ({incomingEdges.length})
											</div>
											<div className="space-y-2">
												{incomingEdges.map((edge) => {
													const sourceCluster = clusterGraph?.clusters.find((c) => c.id === edge.source)
													const sourceColor = sourceCluster?.componentType
														? C4_COMPONENT_COLORS[sourceCluster.componentType]
														: sourceCluster?.color || "#3b82f6"
													return (
														<div
															className="text-sm pl-3 border-l-2 py-1"
															key={edge.id}
															style={{ borderLeftColor: sourceColor }}>
															<div className="font-medium" style={{ color: sourceColor }}>
																← {sourceCluster?.label || edge.source}
															</div>
															{edge.relationshipType && (
																<div className="text-[#9d9d9d] text-xs mt-0.5">
																	{edge.relationshipType}
																	{edge.protocol && ` via ${edge.protocol}`}
																	{edge.description && ` - ${edge.description}`}
																</div>
															)}
														</div>
													)
												})}
											</div>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Key Files */}
						<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
							<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide mb-3">
								Key Files ({cluster.keyFiles.length})
							</h3>
							<div className="space-y-2">
								{keyFileDetails.map(({ path, linesOfCode, exports }) => (
									<div
										className="bg-[#252526] border border-[#3c3c3c] rounded p-3 transition-colors"
										key={path}
										onMouseEnter={(e) => (e.currentTarget.style.borderColor = displayColor)}
										onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#3c3c3c")}
										style={{ "--hover-border-color": displayColor } as any}>
										<div className="flex items-start gap-2">
											<FileCodeIcon className="w-4 h-4 mt-0.5" style={{ color: displayColor }} />
											<div className="flex-1 min-w-0">
												<div
													className="text-sm font-mono truncate cursor-pointer text-white transition-colors"
													onClick={() => handleFileClick(path)}
													onMouseEnter={(e) => (e.currentTarget.style.color = displayColor)}
													onMouseLeave={(e) => (e.currentTarget.style.color = "white")}>
													{path}
												</div>
												<div className="text-xs text-[#9d9d9d] mt-1">
													{linesOfCode.toLocaleString()} LOC
													{exports.length > 0 && (
														<span className="ml-2">
															· Exports: {exports.join(", ")}
															{exports.length === 5 && "..."}
														</span>
													)}
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* All Files */}
						<details className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
							<summary
								className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide cursor-pointer transition-colors"
								onMouseEnter={(e) => (e.currentTarget.style.color = displayColor)}
								onMouseLeave={(e) => (e.currentTarget.style.color = "#cccccc")}
								style={{ "--hover-color": displayColor } as any}>
								All Files ({cluster.files.length})
							</summary>
							<div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
								{cluster.files.map((filePath) => (
									<div
										className="text-xs font-mono text-[#9d9d9d] pl-4 cursor-pointer transition-colors"
										key={filePath}
										onClick={() => handleFileClick(filePath)}
										onMouseEnter={(e) => (e.currentTarget.style.color = displayColor)}
										onMouseLeave={(e) => (e.currentTarget.style.color = "#9d9d9d")}>
										{filePath}
									</div>
								))}
							</div>
						</details>
					</div>
				</div>
			</div>
		</div>
	)
}

export const ClusterDetailModal = memo(ClusterDetailModalComponent)
