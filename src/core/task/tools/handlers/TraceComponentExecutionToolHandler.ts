import type { ToolUse } from "@core/assistant-message"
import type { ApiHandler } from "@/core/api"
import { formatResponse } from "@/core/prompts/responses"
import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import { ExecutionTraceStorageService } from "@/services/architecture-analysis/ExecutionTraceStorageService"
import { telemetryService } from "@/services/telemetry"
import type {
	AnimatedEdge,
	ClusterGraph,
	CodeReference,
	ComponentExecutionTrace,
	ExampleData,
	ExecutionStep,
	ExecutionTraceMetadata,
} from "@/shared/architecture-visualization/types"
import { ClineSayTool } from "@/shared/ExtensionMessage"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"

/**
 * Generate a descriptive name for an execution trace using LLM.
 */
async function generateTraceName(
	entryPoint: string,
	steps: ExecutionStepInput[],
	baseGraph: ClusterGraph,
	api: ApiHandler,
): Promise<string> {
	// Build step summary
	const stepSummary = steps
		.slice(0, 5) // Limit to first 5 steps
		.map((s) => {
			const cluster = baseGraph.clusters.find((c) => c.id === s.componentId)
			return `${s.stepNumber}. ${cluster?.label || s.componentId}: ${s.description.substring(0, 60)}`
		})
		.join("\n")

	const prompt = `Based on this execution trace, generate a concise, descriptive name (3-6 words max).

Entry Point: ${entryPoint}

Execution Steps:
${stepSummary}

The name should capture the main action or feature being traced.
Reply with ONLY the name, no explanation.

Examples:
- "User Login Flow"
- "Todo Creation Process"
- "Payment Processing Pipeline"
- "Data Export Workflow"`

	try {
		const systemPrompt = "You are an expert software architect. Generate concise, descriptive names for execution flows."
		const messages = [{ role: "user" as const, content: prompt }]

		const stream = api.createMessage(systemPrompt, messages, [])

		let responseText = ""
		for await (const chunk of stream) {
			if (chunk.type === "text") {
				responseText += chunk.text
			}
		}

		// Clean up the response - remove quotes, newlines, etc.
		let name = responseText.trim()
		name = name.replace(/^["']|["']$/g, "") // Remove surrounding quotes
		name = name.split("\n")[0] // Take first line only
		return name.slice(0, 60) // Max 60 chars
	} catch (error) {
		console.warn("[TraceComponentExecution] Failed to generate name:", error)
	}

	// Fallback to entry point (truncated)
	return entryPoint.slice(0, 60)
}

/**
 * Execution step input from LLM
 */
interface ExecutionStepInput {
	stepNumber: number
	componentId: string
	description: string
	codeReference: {
		filePath: string
		lineNumber?: number
		snippet?: string
	}
	exampleData: {
		format: string
		sample: string
	}
	transitionTo: string | null
}

/**
 * Tool handler for tracing execution flow through architecture diagrams.
 * Creates step-by-step animated walkthroughs of feature execution.
 */
export class TraceComponentExecutionToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.TRACE_COMPONENT_EXECUTION

	constructor() {}

	getDescription(block: ToolUse): string {
		const entryPoint = (block.params as any).entry_point || "execution"
		const stepsParam = (block.params as any).execution_steps
		let stepCount = 0
		try {
			const steps = typeof stepsParam === "string" ? JSON.parse(stepsParam) : stepsParam
			stepCount = Array.isArray(steps) ? steps.length : 0
		} catch {
			// Ignore parsing errors in description
		}
		return `[${block.name}: ${entryPoint.substring(0, 40)}... (${stepCount} steps)]`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const baseDiagramId = (block.params as any).base_diagram_id
		const entryPoint = (block.params as any).entry_point
		const stepsParam = (block.params as any).execution_steps

		let stepCount = 0
		try {
			const steps = typeof stepsParam === "string" ? JSON.parse(stepsParam) : stepsParam
			stepCount = Array.isArray(steps) ? steps.length : 0
		} catch {
			// Ignore parsing errors in partial handling
		}

		const sharedMessageProps = {
			tool: "traceComponentExecution",
			path: "", // No specific file path
			content: "",
			baseDiagramId: baseDiagramId,
			entryPoint: entryPoint,
			stepCount,
		} satisfies ClineSayTool

		const partialMessage = JSON.stringify(sharedMessageProps)

		// Always show as ask since this creates a trace
		if (await uiHelpers.shouldAutoApproveToolWithPath(block.name, "")) {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await uiHelpers.say("tool", partialMessage, undefined, undefined, block.partial)
		} else {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
			await uiHelpers.ask("tool", partialMessage, block.partial).catch(() => {})
		}
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		console.log("[TraceComponentExecution] Tool invoked")

		const baseDiagramId: string | undefined = (block.params as any).base_diagram_id
		const entryPoint: string | undefined = (block.params as any).entry_point
		const stepsParam: string | ExecutionStepInput[] | undefined = (block.params as any).execution_steps

		// Extract provider information for telemetry
		const apiConfig = config.services.stateManager.getApiConfiguration()
		const currentMode = config.services.stateManager.getGlobalSettingsKey("mode")
		const provider = (currentMode === "plan" ? apiConfig.planModeApiProvider : apiConfig.actModeApiProvider) as string

		// Validate required parameters
		if (!baseDiagramId) {
			console.log("[TraceComponentExecution] ERROR: Missing required parameter 'base_diagram_id'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "base_diagram_id")
		}

		if (!entryPoint) {
			console.log("[TraceComponentExecution] ERROR: Missing required parameter 'entry_point'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_point")
		}

		if (!stepsParam) {
			console.log("[TraceComponentExecution] ERROR: Missing required parameter 'execution_steps'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "execution_steps")
		}

		console.log("[TraceComponentExecution] All required parameters present")
		config.taskState.consecutiveMistakeCount = 0

		// Get workspace root
		const workspaceRoot = config.cwd
		if (!workspaceRoot) {
			console.log("[TraceComponentExecution] ERROR: No workspace root available")
			return formatResponse.toolError("No workspace root available")
		}

		// Parse execution steps
		console.log("[TraceComponentExecution] Parsing execution steps...")
		let steps: ExecutionStepInput[]
		try {
			steps = typeof stepsParam === "string" ? JSON.parse(stepsParam) : stepsParam

			if (!Array.isArray(steps)) {
				console.log(`[TraceComponentExecution] ERROR: execution_steps is not an array, got ${typeof steps}`)
				return formatResponse.toolError(
					`execution_steps must be a JSON array. Got: ${typeof steps}\n\n` +
						"Expected format:\n" +
						'[\n  { "stepNumber": 1, "componentId": "...", "description": "...", ... }\n]',
				)
			}

			if (steps.length === 0) {
				console.log("[TraceComponentExecution] ERROR: execution_steps array is empty")
				return formatResponse.toolError("execution_steps array cannot be empty. Provide at least one step.")
			}
		} catch (error) {
			console.log(`[TraceComponentExecution] ERROR: Failed to parse execution_steps: ${error}`)
			return formatResponse.toolError(
				`Failed to parse execution_steps JSON: ${error}\n\n` + "Make sure execution_steps is valid JSON array format.",
			)
		}

		// Load base diagram
		console.log(`[TraceComponentExecution] Loading base diagram: ${baseDiagramId}`)
		const diagramStorage = new ArchitectureDiagramStorageService(workspaceRoot)
		const baseGraph = await diagramStorage.loadClusterGraph(baseDiagramId)

		if (!baseGraph) {
			console.log(`[TraceComponentExecution] ERROR: Base diagram not found: ${baseDiagramId}`)
			return formatResponse.toolError(
				`Base diagram not found: ${baseDiagramId}\n\n` +
					"Make sure you provide a valid diagram ID from a previously generated architecture diagram.",
			)
		}

		// Validate componentIds
		console.log("[TraceComponentExecution] Validating component IDs...")
		const validClusterIds = new Set(baseGraph.clusters.map((c) => c.id))
		const invalidComponents: string[] = []

		for (const step of steps) {
			if (!validClusterIds.has(step.componentId)) {
				invalidComponents.push(step.componentId)
			}
		}

		if (invalidComponents.length > 0) {
			console.log(`[TraceComponentExecution] ERROR: Invalid component IDs: ${invalidComponents.join(", ")}`)
			return formatResponse.toolError(
				`Invalid componentId(s): ${invalidComponents.join(", ")}\n\n` +
					`Valid cluster IDs from diagram "${baseDiagramId}":\n` +
					Array.from(validClusterIds)
						.map((id) => `  - ${id}`)
						.join("\n"),
			)
		}

		// Build execution trace
		console.log("[TraceComponentExecution] Building execution trace...")
		const executionSteps: ExecutionStep[] = steps.map((step) => ({
			stepNumber: step.stepNumber,
			componentId: step.componentId,
			description: step.description,
			codeReference: step.codeReference as CodeReference,
			exampleData: step.exampleData as ExampleData,
			transitionTo: step.transitionTo,
		}))

		// Calculate highlighted components (unique componentIds)
		const highlightedComponents = Array.from(new Set(executionSteps.map((s) => s.componentId)))

		// Build animated edges
		const animatedEdges = this.buildAnimatedEdges(executionSteps, baseGraph)

		// Create trace metadata
		const metadata: ExecutionTraceMetadata = {
			timestamp: Date.now(),
			totalSteps: executionSteps.length,
			componentsInvolved: highlightedComponents.length,
		}

		// Create trace object
		const trace: ComponentExecutionTrace = {
			id: "", // Will be generated by storage service
			baseDiagramId,
			entryPoint,
			steps: executionSteps,
			highlightedComponents,
			animatedEdges,
			metadata,
		}

		// Generate descriptive name
		console.log("[TraceComponentExecution] Generating descriptive name...")
		const traceName = await generateTraceName(entryPoint, steps, baseGraph, config.api)
		trace.name = traceName

		// Save trace
		console.log("[TraceComponentExecution] Saving execution trace...")
		const traceStorage = new ExecutionTraceStorageService(workspaceRoot)
		const traceId = await traceStorage.saveExecutionTrace(trace)

		// Validate trace (warnings only)
		const validation = traceStorage.validateTrace(trace, baseGraph)
		if (validation.warnings.length > 0) {
			console.log("[TraceComponentExecution] Validation warnings:")
			validation.warnings.forEach((w) => console.log(`  - ${w}`))
		}

		// Track telemetry
		telemetryService.captureToolUsage(
			config.ulid,
			block.name,
			config.api.getModel().id,
			provider,
			true,
			true,
			undefined,
			block.isNativeToolCall,
		)

		console.log(`[TraceComponentExecution] Successfully created trace: ${traceId}`)

		// Return success message
		const warningsMessage =
			validation.warnings.length > 0
				? `\n\nValidation warnings:\n${validation.warnings.map((w) => `- ${w}`).join("\n")}`
				: ""

		// Send success message with button to open trace
		await config.callbacks.say(
			"text",
			`## ✅ Execution Trace Created\n\n` +
				`**Entry Point:** ${entryPoint}\n` +
				`**Steps:** ${executionSteps.length}\n` +
				`**Components:** ${highlightedComponents.length}\n\n` +
				`Click the button below to view the animated trace:\n\n` +
				`[OPEN_TRACE:${traceId}]`,
		)

		return formatResponse.toolResult(
			`Execution trace created successfully!\n\n` +
				`Trace ID: ${traceId}\n` +
				`Entry Point: ${entryPoint}\n` +
				`Steps: ${executionSteps.length}\n` +
				`Components Involved: ${highlightedComponents.length}\n\n` +
				`The trace has been saved and will be available for visualization in the architecture diagram viewer.` +
				warningsMessage,
		)
	}

	/**
	 * Build animated edges from execution steps and base graph.
	 */
	private buildAnimatedEdges(steps: ExecutionStep[], baseGraph: ClusterGraph): AnimatedEdge[] {
		const animatedEdges: AnimatedEdge[] = []

		// For each transition between steps
		for (let i = 0; i < steps.length - 1; i++) {
			const currentStep = steps[i]
			const nextStep = steps[i + 1]

			// Find edge in base graph
			const edge = baseGraph.clusterEdges.find(
				(e) => e.source === currentStep.componentId && e.target === nextStep.componentId,
			)

			if (edge) {
				animatedEdges.push({
					edgeId: edge.id,
					animationOrder: i + 1,
					durationMs: 1000, // Default 1 second animation
				})
			} else {
				// Edge doesn't exist - log warning but continue
				// (relationship might be implicit)
				console.warn(
					`[TraceComponentExecution] No edge found between ${currentStep.componentId} and ${nextStep.componentId}`,
				)
			}
		}

		return animatedEdges
	}
}
