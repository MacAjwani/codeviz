import type { SystemComponent } from "@shared/code-visualization/types"
import { LayersIcon, XIcon } from "lucide-react"
import { memo } from "react"

interface ComponentDetailModalProps {
	component: SystemComponent | null
	onClose: () => void
}

function ComponentDetailModalComponent({ component, onClose }: ComponentDetailModalProps) {
	if (!component) return null

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
			<div
				className="bg-editor-background border border-editor-group-border rounded-lg shadow-xl max-w-lg w-full mx-4"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-editor-group-border">
					<div className="flex items-center gap-2">
						<LayersIcon className="w-5 h-5" style={{ color: component.color }} />
						<span className="font-semibold text-lg">{component.name}</span>
					</div>
					<button
						aria-label="Close"
						className="p-1 hover:bg-list-hover-background rounded transition-colors"
						onClick={onClose}>
						<XIcon className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-4">
					<div className="space-y-4">
						{/* Component Description */}
						<div>
							<h3 className="text-sm font-medium text-description mb-2">Role in System</h3>
							<p className="text-sm">{component.description}</p>
						</div>

						{/* Color Badge */}
						{component.color && (
							<div>
								<h3 className="text-sm font-medium text-description mb-2">Visual Identifier</h3>
								<div className="flex items-center gap-2">
									<div
										className="w-8 h-8 rounded border"
										style={{
											backgroundColor: component.color,
											borderColor: component.color,
										}}
									/>
									<span className="text-xs font-mono text-description">{component.color}</span>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export const ComponentDetailModal = memo(ComponentDetailModalComponent)
