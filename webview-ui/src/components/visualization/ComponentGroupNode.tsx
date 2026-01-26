import type { SystemComponent } from "@shared/code-visualization/types"
import { type NodeProps } from "@xyflow/react"
import { memo } from "react"

export interface ComponentGroupData extends Record<string, unknown> {
	component: SystemComponent
	onComponentClick?: (componentId: string) => void
}

function ComponentGroupNodeComponent({ data, id }: NodeProps) {
	const componentData = data as ComponentGroupData
	const { component } = componentData

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (componentData.onComponentClick) {
			componentData.onComponentClick(component.id)
		}
	}

	return (
		<div
			className="component-group-node cursor-pointer"
			onClick={handleClick}
			style={{
				width: "100%",
				height: "100%",
				border: `2px solid ${component.color || "#6b7280"}`,
				borderRadius: "12px",
				backgroundColor: `${component.color || "#6b7280"}15`,
				padding: "16px",
				position: "relative",
			}}>
			<div
				className="component-group-header"
				style={{
					position: "absolute",
					top: "8px",
					left: "12px",
					right: "12px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					pointerEvents: "none",
				}}>
				<div
					className="font-semibold text-sm"
					style={{
						color: component.color || "#6b7280",
						textShadow: "0 0 4px rgba(0,0,0,0.5)",
					}}>
					{component.name}
				</div>
				<div
					className="text-xs opacity-70"
					style={{
						color: component.color || "#6b7280",
						textShadow: "0 0 4px rgba(0,0,0,0.5)",
					}}>
					{component.description}
				</div>
			</div>
		</div>
	)
}

export const ComponentGroupNode = memo(ComponentGroupNodeComponent)
