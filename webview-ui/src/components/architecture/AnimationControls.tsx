/**
 * Animation controls for execution trace playback.
 * Provides play/pause, step forward/back, and reset functionality.
 */

interface AnimationControlsProps {
	currentStep: number
	totalSteps: number
	isPlaying: boolean
	onPlay: () => void
	onStepBack: () => void
	onStepForward: () => void
	onReset: () => void
}

export function AnimationControls({
	currentStep,
	totalSteps,
	isPlaying,
	onPlay,
	onStepBack,
	onStepForward,
	onReset,
}: AnimationControlsProps) {
	const canStepBack = currentStep > 0
	const canStepForward = currentStep < totalSteps - 1

	return (
		<div className="absolute bottom-6 left-6 bg-[#252526] border-2 border-[#3c3c3c] rounded-lg p-3 flex items-center gap-2 shadow-2xl">
			{/* Play/Pause Button */}
			<button
				className="px-4 py-2 bg-[#007ACC] hover:bg-[#005A9E] text-white rounded font-medium transition-colors"
				onClick={onPlay}
				title={isPlaying ? "Pause" : "Play"}>
				{isPlaying ? "⏸ Pause" : "▶ Play"}
			</button>

			{/* Step Back Button */}
			<button
				className={`px-4 py-2 rounded font-medium transition-colors ${
					canStepBack ? "bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white" : "bg-[#2d2d2d] text-[#5a5a5a] cursor-not-allowed"
				}`}
				disabled={!canStepBack}
				onClick={onStepBack}
				title="Step backward">
				← Step
			</button>

			{/* Step Forward Button */}
			<button
				className={`px-4 py-2 rounded font-medium transition-colors ${
					canStepForward
						? "bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white"
						: "bg-[#2d2d2d] text-[#5a5a5a] cursor-not-allowed"
				}`}
				disabled={!canStepForward}
				onClick={onStepForward}
				title="Step forward">
				Step →
			</button>

			{/* Reset Button */}
			<button
				className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white rounded font-medium transition-colors"
				onClick={onReset}
				title="Reset to beginning">
				↺ Reset
			</button>

			{/* Progress Indicator */}
			<div className="text-sm text-[#cccccc] px-3 py-2 bg-[#181818] border border-[#3c3c3c] rounded font-medium">
				{currentStep + 1} / {totalSteps}
			</div>
		</div>
	)
}
