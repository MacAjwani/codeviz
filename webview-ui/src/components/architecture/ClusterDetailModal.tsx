import type { Cluster, RepoInventory } from "@shared/architecture-visualization/types"
import { FileCodeIcon, LayersIcon, XIcon } from "lucide-react"
import { memo } from "react"

interface Props {
	cluster: Cluster
	inventory: RepoInventory
	onClose: () => void
}

function ClusterDetailModalComponent({ cluster, inventory, onClose }: Props) {
	// Get file details from inventory
	const keyFileDetails = cluster.keyFiles.map((filePath) => {
		const file = inventory.files.find((f) => f.path === filePath)
		return {
			path: filePath,
			linesOfCode: file?.linesOfCode || 0,
			exports: file?.exports.map((e) => e.name).slice(0, 5) || [],
		}
	})

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
			<div
				className="bg-editor-background border border-editor-group-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div
					className="flex items-center justify-between px-4 py-3 border-b border-editor-group-border"
					style={{ borderBottomColor: cluster.color || "#3b82f6" }}>
					<div className="flex items-center gap-2">
						<LayersIcon className="w-5 h-5" style={{ color: cluster.color || "#3b82f6" }} />
						<span className="font-semibold text-lg">{cluster.label}</span>
						{cluster.layer && (
							<span
								className="px-2 py-0.5 rounded text-xs font-medium"
								style={{
									backgroundColor: `${cluster.color || "#3b82f6"}20`,
									color: cluster.color || "#3b82f6",
								}}>
								{cluster.layer}
							</span>
						)}
					</div>
					<button
						aria-label="Close"
						className="p-1 hover:bg-list-hover-background rounded transition-colors"
						onClick={onClose}>
						<XIcon className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4 overflow-y-auto flex-1">
					<div className="space-y-4">
						{/* Description */}
						<div>
							<h3 className="text-sm font-medium text-description mb-2">Component Role</h3>
							<p className="text-sm">{cluster.description}</p>
						</div>

						{/* Key Files */}
						<div>
							<h3 className="text-sm font-medium text-description mb-2">Key Files ({cluster.keyFiles.length})</h3>
							<div className="space-y-2">
								{keyFileDetails.map(({ path, linesOfCode, exports }) => (
									<div className="border border-editor-group-border rounded p-2" key={path}>
										<div className="flex items-start gap-2">
											<FileCodeIcon className="w-4 h-4 mt-0.5 text-description" />
											<div className="flex-1 min-w-0">
												<div className="text-sm font-mono truncate">{path}</div>
												<div className="text-xs text-description mt-1">
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
						<details>
							<summary className="text-sm font-medium text-description cursor-pointer hover:text-foreground">
								All Files ({cluster.files.length})
							</summary>
							<div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
								{cluster.files.map((filePath) => (
									<div className="text-xs font-mono text-description pl-4" key={filePath}>
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
