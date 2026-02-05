import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@/core/prompts/responses"
import { ArchitectureAnalysisService } from "@/services/architecture-analysis/ArchitectureAnalysisService"
import { ArchitectureClusteringService } from "@/services/architecture-analysis/ArchitectureClusteringService"
import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import { telemetryService } from "@/services/telemetry"
import { ClineSayTool } from "@/shared/ExtensionMessage"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

/**
 * Tool handler for generating architecture diagrams.
 * Analyzes workspace and creates clustered component visualization.
 *
 * COMPLETE IMPLEMENTATION (M1 + M3):
 * - M1: Workspace analysis → RepoInventory
 * - M3: LLM clustering → ClusterGraph
 */
export class GenerateArchitectureDiagramToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.GENERATE_ARCH_DIAGRAM

	constructor() {}

	getDescription(block: ToolUse): string {
		const workspacePath = block.params.workspace_path || "current workspace"
		return `[${block.name}: ${workspacePath}]`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const workspacePath = block.params.workspace_path
		const clusteringHint = block.params.clustering_hint
		const useCache = block.params.use_cache

		const displayPath = workspacePath || "current workspace"
		const cacheStatus = useCache === "false" ? " (fresh analysis)" : " (using cache if available)"

		const sharedMessageProps = {
			tool: "generateArchitectureDiagram" as const,
			path: displayPath,
			content: `Analyzing ${displayPath} to generate an architecture diagram with clustered components${cacheStatus}.${clusteringHint ? `\n\nClustering hint: ${clusteringHint}` : ""}`,
			clusteringHint: uiHelpers.removeClosingTag(block, "clustering_hint", clusteringHint),
		} satisfies ClineSayTool

		const partialMessage = JSON.stringify(sharedMessageProps)

		// Always show as ask since this generates a diagram
		if (await uiHelpers.shouldAutoApproveToolWithPath(block.name, workspacePath || "")) {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await uiHelpers.say("tool", partialMessage, undefined, undefined, block.partial)
		} else {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
			await uiHelpers.ask("tool", partialMessage, block.partial).catch(() => {})
		}
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		console.log("[GenerateArchitectureDiagram] Tool invoked (STUB IMPLEMENTATION)")

		const workspacePath: string | undefined = block.params.workspace_path
		const clusteringHint: string | undefined = block.params.clustering_hint
		const useCache: string | undefined = block.params.use_cache

		console.log(`[GenerateArchitectureDiagram] Parameters:`, {
			workspacePath: workspacePath || config.cwd,
			clusteringHint,
			useCache: useCache !== "false",
		})

		// Extract provider information for telemetry
		const apiConfig = config.services.stateManager.getApiConfiguration()
		const currentMode = config.services.stateManager.getGlobalSettingsKey("mode")
		const provider = (currentMode === "plan" ? apiConfig.planModeApiProvider : apiConfig.actModeApiProvider) as string

		const sharedMessageProps = {
			tool: "generateArchitectureDiagram",
			path: workspacePath || config.cwd,
			content: "",
			clusteringHint,
		} satisfies ClineSayTool

		const completeMessage = JSON.stringify(sharedMessageProps)

		if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, workspacePath || "")) {
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
			const notificationMessage = `Cline wants to generate an architecture diagram`

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

		// M1 IMPLEMENTATION - Generate workspace inventory
		const workspace = workspacePath || config.cwd
		const useCacheFlag = useCache !== "false"

		console.log(`[GenerateArchitectureDiagram] Starting analysis of ${workspace}`)

		try {
			const storageService = new ArchitectureDiagramStorageService(workspace)
			let inventory

			// Check if we can use cached inventory
			if (useCacheFlag && (await storageService.hasInventoryCache())) {
				inventory = await storageService.loadInventoryCache()
				console.log(`[GenerateArchitectureDiagram] Using cached inventory: ${inventory?.files.length} files`)
			}

			// Generate fresh inventory if no cache or cache load failed
			if (!inventory) {
				const analysisService = new ArchitectureAnalysisService()
				inventory = await analysisService.generateInventory(workspace, {})

				// Save to cache for future use
				await storageService.saveInventoryCache(inventory)
				console.log(`[GenerateArchitectureDiagram] Generated and cached new inventory: ${inventory.files.length} files`)
			}

			// M3: LLM Clustering

			const clusteringService = new ArchitectureClusteringService()
			const clusterGraph = await clusteringService.clusterArchitecture(inventory, config.api, clusteringHint)

			// Save cluster graph
			const diagramId = await storageService.saveClusterGraph(clusterGraph)
			console.log(`[GenerateArchitectureDiagram] Saved cluster graph: ${diagramId}`)

			// Generate data flow explanation
			await config.callbacks.say(
				"text",
				`📊 Architecture diagram generated!\n\n` + `Generating step-by-step data flow explanation...`,
			)

			const dataFlowExplanation = await clusteringService.generateDataFlowExplanation(clusterGraph, inventory, config.api)

			// Show explanation to user
			await config.callbacks.say(
				"text",
				`## 🔄 Data Flow Explanation\n\n${dataFlowExplanation}\n\n` +
					`📊 **Interactive diagram available** - Click the refresh button (🔄) in the diagram panel on the left to visualize these components.`,
			)

			// Return summary with cluster details and data flow
			const clusterSummary = clusterGraph.clusters
				.map((c, i) => `${i + 1}. ${c.label} (${c.files.length} files) - ${c.layer || "no layer"}`)
				.join("\n   ")

			return formatResponse.toolResult(
				`Architecture diagram generated successfully!\n\n` +
					`Workspace: ${workspace}\n` +
					`Files analyzed: ${inventory.files.length}\n` +
					`Clusters created: ${clusterGraph.clusters.length}\n\n` +
					`Components:\n   ${clusterSummary}\n\n` +
					`Data Flow Explanation:\n${dataFlowExplanation}\n\n` +
					`Diagram saved to: .vscode/codeviz/architecture/clusters/${diagramId}.json`,
			)
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"
			console.error(`[GenerateArchitectureDiagram] Analysis failed:`, error)

			await config.callbacks.say(
				"architecture_diagram",
				JSON.stringify({
					status: "error",
					message: `Analysis failed: ${errorMsg}`,
				}),
			)

			return formatResponse.toolError(`Failed to analyze workspace: ${errorMsg}`)
		}
	}
}
