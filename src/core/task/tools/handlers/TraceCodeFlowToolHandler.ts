import type { ToolUse } from "@core/assistant-message"
import { getReadablePath } from "@utils/path"
import * as path from "path"
import { formatResponse } from "@/core/prompts/responses"
import { CodeTracingService } from "@/services/code-tracing"
import { telemetryService } from "@/services/telemetry"
import type { CodeFlowDiagram } from "@/shared/code-visualization/types"
import { ClineSayTool } from "@/shared/ExtensionMessage"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

/**
 * Tool handler for tracing code execution flow through a codebase.
 * This tool analyzes code starting from an entry point and generates
 * a visual diagram of the code flow.
 */
export class TraceCodeFlowToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.TRACE_CODE_FLOW

	private tracingService: CodeTracingService

	constructor() {
		this.tracingService = new CodeTracingService()
	}

	getDescription(block: ToolUse): string {
		const entryPoint = block.params.entry_point || "unknown"
		const description = block.params.description || ""
		return `[${block.name} from '${entryPoint}'${description ? `: ${description.substring(0, 50)}...` : ""}]`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const entryPoint = block.params.entry_point
		const description = block.params.description
		const maxDepth = block.params.max_depth

		const config = uiHelpers.getConfig()

		const sharedMessageProps = {
			tool: "traceCodeFlow",
			path: getReadablePath(config.cwd, uiHelpers.removeClosingTag(block, "entry_point", entryPoint) || ""),
			content: "",
			entryPoint: uiHelpers.removeClosingTag(block, "entry_point", entryPoint),
			description: uiHelpers.removeClosingTag(block, "description", description),
			maxDepth: uiHelpers.removeClosingTag(block, "max_depth", maxDepth),
		} satisfies ClineSayTool

		const partialMessage = JSON.stringify(sharedMessageProps)

		// Always show as ask since this is a read-only analysis tool
		if (await uiHelpers.shouldAutoApproveToolWithPath(block.name, entryPoint)) {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await uiHelpers.say("tool", partialMessage, undefined, undefined, block.partial)
		} else {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
			await uiHelpers.ask("tool", partialMessage, block.partial).catch(() => {})
		}
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		const entryPoint: string | undefined = block.params.entry_point
		const description: string | undefined = block.params.description
		const maxDepthStr: string | undefined = block.params.max_depth
		const maxDepth = maxDepthStr ? parseInt(maxDepthStr, 10) : 10

		// Extract provider information for telemetry
		const apiConfig = config.services.stateManager.getApiConfiguration()
		const currentMode = config.services.stateManager.getGlobalSettingsKey("mode")
		const provider = (currentMode === "plan" ? apiConfig.planModeApiProvider : apiConfig.actModeApiProvider) as string

		// Validate required parameters
		if (!entryPoint) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_point")
		}

		if (!description) {
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "description")
		}

		config.taskState.consecutiveMistakeCount = 0

		// Parse the entry point
		const { filePath, symbolName } = this.tracingService.parseEntryPoint(entryPoint, config.cwd)

		// Check if the file exists
		const fileExists = await this.tracingService.fileExists(filePath)
		if (!fileExists) {
			return formatResponse.toolError(`Entry point file not found: ${entryPoint}`)
		}

		// Read the entry point file
		const fileContent = await this.tracingService.readFile(filePath)
		if (!fileContent) {
			return formatResponse.toolError(`Failed to read entry point file: ${entryPoint}`)
		}

		const sharedMessageProps = {
			tool: "traceCodeFlow",
			path: getReadablePath(config.cwd, entryPoint),
			content: "",
			entryPoint,
			description,
			maxDepth: maxDepth.toString(),
		} satisfies ClineSayTool

		const completeMessage = JSON.stringify(sharedMessageProps)

		if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, entryPoint)) {
			// Auto-approval flow
			await config.callbacks.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await config.callbacks.say("tool", completeMessage, undefined, undefined, false)

			// Capture telemetry
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
		} else {
			// Manual approval flow
			const notificationMessage = `Cline wants to trace code flow from ${entryPoint}`

			// Show notification
			showNotificationForApproval(notificationMessage, config.autoApprovalSettings.enableNotifications)

			await config.callbacks.removeLastPartialMessageIfExistsWithType("say", "tool")

			const didApprove = await ToolResultUtils.askApprovalAndPushFeedback("tool", completeMessage, config)
			if (!didApprove) {
				telemetryService.captureToolUsage(
					config.ulid,
					block.name,
					config.api.getModel().id,
					provider,
					false,
					false,
					undefined,
					block.isNativeToolCall,
				)
				return formatResponse.toolDenied()
			} else {
				telemetryService.captureToolUsage(
					config.ulid,
					block.name,
					config.api.getModel().id,
					provider,
					false,
					true,
					undefined,
					block.isNativeToolCall,
				)
			}
		}

		// Run PreToolUse hook after approval but before execution
		try {
			const { ToolHookUtils } = await import("../utils/ToolHookUtils")
			await ToolHookUtils.runPreToolUseIfEnabled(config, block)
		} catch (error) {
			const { PreToolUseHookCancellationError } = await import("@core/hooks/PreToolUseHookCancellationError")
			if (error instanceof PreToolUseHookCancellationError) {
				return formatResponse.toolDenied()
			}
			throw error
		}

		// Create the initial diagram structure
		const diagram = this.tracingService.createEmptyDiagram(entryPoint, description, maxDepth)

		// Create the entry node
		const entryNode = this.tracingService.createBasicNode(filePath, symbolName, config.cwd, fileContent)
		entryNode.type = "entry"
		diagram.nodes.push(entryNode)

		// Detect language and framework
		const ext = path.extname(filePath)
		const language = this.tracingService.getLanguageFromExtension(ext)
		const framework = this.tracingService.detectFramework(fileContent)

		// Update metadata
		const finalDiagram = this.tracingService.updateDiagramMetadata(diagram, language, framework)

		// Return instructions for the LLM to continue the analysis
		// The actual tracing will be done by the LLM using read_file and search_files tools
		const result = this.buildTraceResponse(finalDiagram, entryPoint, description, fileContent, symbolName)

		return result
	}

	/**
	 * Build the response that instructs the LLM how to continue the trace.
	 */
	private buildTraceResponse(
		diagram: CodeFlowDiagram,
		entryPoint: string,
		description: string,
		fileContent: string,
		symbolName?: string,
	): string {
		const truncatedContent = fileContent.length > 2000 ? fileContent.substring(0, 2000) + "\n... (truncated)" : fileContent

		return `## Code Flow Trace Initialized

**Entry Point:** ${entryPoint}
**Description:** ${description}
**Initial Node:** ${symbolName || path.basename(entryPoint)}

### Entry Point File Content:
\`\`\`
${truncatedContent}
\`\`\`

### Initial Diagram Structure:
\`\`\`json
${this.tracingService.serializeDiagram(diagram)}
\`\`\`

### Next Steps for Analysis:

To complete this code flow trace, analyze the entry point code and:

1. **Identify function/method calls** - Look for function invocations, method calls, and component renders
2. **Follow imports** - Trace imported modules and their usage
3. **Track data flow** - Identify props, parameters, and return values
4. **Detect external boundaries** - Note API calls, database operations, and external services

For each node you identify, provide:
- **componentResponsibility**: What is this component/function's purpose?
- **inputDescription**: What data flows in (props, params, state)?
- **outputDescription**: What data flows out (returns, side effects)?
- **fileResponsibility**: What is this file's overall purpose?
- **codeSegmentDescription**: What does the relevant code section do?
- **codeSegment**: The actual code snippet

Use \`read_file\` to examine imported files and \`search_files\` to find related code.
Build up the diagram by adding nodes and edges for each significant code path.

When you have completed the analysis, return the final diagram JSON with all nodes and edges populated.`
	}
}
