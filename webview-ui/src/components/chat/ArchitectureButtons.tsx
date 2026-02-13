import { FileTextIcon, PlayCircleIcon } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface Props {
	diagramId?: string
	traceId?: string
}

export function ArchitectureButtons({ diagramId, traceId }: Props) {
	const { openArchitectureDiagram, openArchitectureTrace } = useExtensionState()

	if (!diagramId && !traceId) {
		return null
	}

	return (
		<div className="flex gap-2 flex-wrap mt-2">
			{diagramId && (
				<button
					className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded transition-colors"
					onClick={() => openArchitectureDiagram(diagramId)}
					type="button">
					<FileTextIcon className="size-4" />
					Open Diagram
				</button>
			)}
			{traceId && (
				<button
					className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded transition-colors"
					onClick={() => openArchitectureTrace(traceId)}
					type="button">
					<PlayCircleIcon className="size-4" />
					Open Trace
				</button>
			)}
		</div>
	)
}
