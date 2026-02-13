import type { ExecutionStep } from "@shared/architecture-visualization/types"
import { CodeIcon, DatabaseIcon, FileCodeIcon, MapPinIcon } from "lucide-react"
import { PLATFORM_CONFIG } from "@/config/platform.config"

interface Props {
	step: ExecutionStep | undefined
}

export function WalkthroughPanel({ step }: Props) {
	const handleFileClick = () => {
		if (!step?.codeReference?.filePath) return
		PLATFORM_CONFIG.postMessage({
			type: "openFile",
			filePath: step.codeReference.filePath,
			lineNumber: step.codeReference.lineNumber,
		})
	}

	if (!step) {
		return (
			<div className="h-full bg-[#252526] border-l border-[#3c3c3c] flex items-center justify-center p-4">
				<div className="text-center text-[#9d9d9d] text-sm">No step selected</div>
			</div>
		)
	}

	return (
		<div
			className="h-full flex-shrink-0 bg-[#252526] border-l border-[#3c3c3c] overflow-y-auto"
			style={{ width: "100%", minWidth: "384px" }}>
			<div className="p-6 space-y-6 w-full">
				{/* Step Header */}
				<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
					<div className="flex items-center gap-2 mb-3">
						<MapPinIcon className="size-5 text-[#007ACC]" />
						<h3 className="text-base font-semibold text-white">Step {step.stepNumber}</h3>
					</div>
					<p className="text-sm leading-relaxed text-[#cccccc]">{step.description}</p>
				</div>

				{/* Code Reference */}
				<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
					<div className="flex items-center gap-2 mb-3">
						<FileCodeIcon className="size-5 text-[#007ACC]" />
						<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide">Code Reference</h3>
					</div>
					<button
						className="text-sm font-mono text-[#007ACC] hover:text-[#4fc3f7] cursor-pointer w-full text-left break-all mb-3 hover:underline transition-colors"
						onClick={handleFileClick}
						type="button">
						{step.codeReference.filePath}
						{step.codeReference.lineNumber && `:${step.codeReference.lineNumber}`}
					</button>
					{step.codeReference.snippet && (
						<pre className="text-xs bg-[#252526] border border-[#3c3c3c] p-3 rounded overflow-x-auto font-mono text-[#d4d4d4]">
							{step.codeReference.snippet}
						</pre>
					)}
				</div>

				{/* Example Data */}
				<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
					<div className="flex items-center gap-2 mb-3">
						<DatabaseIcon className="size-5 text-[#007ACC]" />
						<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide">Example Data</h3>
					</div>
					<div className="text-xs text-[#9d9d9d] mb-2 font-medium">{step.exampleData.format}</div>
					<pre className="text-xs bg-[#252526] border border-[#3c3c3c] p-3 rounded overflow-x-auto font-mono text-[#d4d4d4]">
						{step.exampleData.sample}
					</pre>
				</div>

				{/* Transition */}
				{step.transitionTo && (
					<div className="bg-[#181818] border border-[#3c3c3c] rounded-lg p-4">
						<div className="flex items-center gap-2 mb-3">
							<CodeIcon className="size-5 text-[#007ACC]" />
							<h3 className="text-sm font-semibold text-[#cccccc] uppercase tracking-wide">Next Component</h3>
						</div>
						<div className="text-base text-[#007ACC] font-medium">→ {step.transitionTo}</div>
					</div>
				)}
			</div>
		</div>
	)
}
