import type { ToolUse } from "@core/assistant-message"
import { formatResponse } from "@/core/prompts/responses"
import { DiagramStorageService } from "@/services/code-tracing"
import { telemetryService } from "@/services/telemetry"
import type { CodeFlowDiagram, FlowEdge, FlowNode, NodeType } from "@/shared/code-visualization/types"
import { ClineSayTool } from "@/shared/ExtensionMessage"
import { ClineDefaultTool } from "@/shared/tools"
import type { ToolResponse } from "../../index"
import { showNotificationForApproval } from "../../utils"
import type { IFullyManagedTool } from "../ToolExecutorCoordinator"
import type { TaskConfig } from "../types/TaskConfig"
import type { StronglyTypedUIHelpers } from "../types/UIHelpers"
import { ToolResultUtils } from "../utils/ToolResultUtils"

/**
 * Entity object from agent's analysis
 */
interface EntityInput {
	label: string // Short descriptor (e.g., "AuthService.login()")
	type: NodeType // Entity type
	entityPurpose: string // Purpose in the larger system
	filePath?: string // Path to code (omit for external entities)
	lineNumber?: number // Line where entity code begins
}

/**
 * Flow object describing data movement between entities
 */
interface FlowInput {
	fromEntity: string // Label of source entity
	toEntity: string // Label of target entity
	trigger: string // What triggers this flow
	dataDescription: string // What data flows
	dataFormat: string // Format of the data
	sampleData: string // Example data showing structure/fields - REQUIRED
}

/**
 * Tool handler for creating entity-relationship data flow diagrams.
 * Processes entities and flows to create a visual diagram.
 */
export class TraceCodeFlowToolHandler implements IFullyManagedTool {
	readonly name = ClineDefaultTool.TRACE_CODE_FLOW

	constructor() {}

	getDescription(block: ToolUse): string {
		const description = block.params.description || "data flow"
		const entitiesParam = (block.params as any).entities
		let entityCount = 0
		try {
			const entities = typeof entitiesParam === "string" ? JSON.parse(entitiesParam) : entitiesParam
			entityCount = Array.isArray(entities) ? entities.length : 0
		} catch {
			// Ignore parsing errors in description
		}
		return `[${block.name}: ${description.substring(0, 50)}... (${entityCount} entities)]`
	}

	async handlePartialBlock(block: ToolUse, uiHelpers: StronglyTypedUIHelpers): Promise<void> {
		const description = block.params.description
		const entryPoint = block.params.entry_point
		const entitiesParam = (block.params as any).entities

		let entityCount = 0
		try {
			const entities = typeof entitiesParam === "string" ? JSON.parse(entitiesParam) : entitiesParam
			entityCount = Array.isArray(entities) ? entities.length : 0
		} catch {
			// Ignore parsing errors in partial handling
		}

		const sharedMessageProps = {
			tool: "traceCodeFlow",
			path: "", // No specific file path
			content: "",
			description: uiHelpers.removeClosingTag(block, "description", description),
			entryPoint: uiHelpers.removeClosingTag(block, "entry_point", entryPoint),
			nodeCount: entityCount,
		} satisfies ClineSayTool

		const partialMessage = JSON.stringify(sharedMessageProps)

		// Always show as ask since this generates a diagram
		if (await uiHelpers.shouldAutoApproveToolWithPath(block.name, "")) {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("ask", "tool")
			await uiHelpers.say("tool", partialMessage, undefined, undefined, block.partial)
		} else {
			await uiHelpers.removeLastPartialMessageIfExistsWithType("say", "tool")
			await uiHelpers.ask("tool", partialMessage, block.partial).catch(() => {})
		}
	}

	async execute(config: TaskConfig, block: ToolUse): Promise<ToolResponse> {
		console.log("[TraceCodeFlow] Tool invoked with entity-relationship model")

		const description: string | undefined = block.params.description
		const entryPoint: string | undefined = block.params.entry_point
		const entitiesParam: string | string[] | undefined = (block.params as any).entities
		const flowsParam: string | string[] | undefined = (block.params as any).flows

		console.log("[TraceCodeFlow] Parameters received:")
		console.log(`  - description: ${description?.substring(0, 100)}`)
		console.log(`  - entry_point: ${entryPoint}`)
		console.log(`  - entities type: ${typeof entitiesParam}`)
		console.log(`  - flows type: ${typeof flowsParam}`)

		// Extract provider information for telemetry
		const apiConfig = config.services.stateManager.getApiConfiguration()
		const currentMode = config.services.stateManager.getGlobalSettingsKey("mode")
		const provider = (currentMode === "plan" ? apiConfig.planModeApiProvider : apiConfig.actModeApiProvider) as string

		// Validate required parameters
		if (!description) {
			console.log("[TraceCodeFlow] ERROR: Missing required parameter 'description'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "description")
		}

		if (!entryPoint) {
			console.log("[TraceCodeFlow] ERROR: Missing required parameter 'entry_point'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "entry_point")
		}

		if (!entitiesParam) {
			console.log("[TraceCodeFlow] ERROR: Missing required parameter 'entities'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "entities")
		}

		if (!flowsParam) {
			console.log("[TraceCodeFlow] ERROR: Missing required parameter 'flows'")
			config.taskState.consecutiveMistakeCount++
			return await config.callbacks.sayAndCreateMissingParamError(this.name, "flows")
		}

		console.log("[TraceCodeFlow] All required parameters present")
		config.taskState.consecutiveMistakeCount = 0

		// Parse entities
		console.log("[TraceCodeFlow] Parsing entities...")
		let entities: EntityInput[]
		try {
			entities = typeof entitiesParam === "string" ? JSON.parse(entitiesParam) : entitiesParam

			if (!Array.isArray(entities)) {
				console.log(`[TraceCodeFlow] ERROR: entities is not an array, got ${typeof entities}`)
				return formatResponse.toolError(
					`Parameter 'entities' must be an array of entity objects. Received: ${typeof entities}. ` +
						`Example: [{"label":"User","type":"user","entityPurpose":"Person using the application"}]`,
				)
			}

			if (entities.length === 0) {
				console.log("[TraceCodeFlow] ERROR: entities array is empty")
				return formatResponse.toolError("At least one entity is required in the 'entities' array.")
			}

			// Validate entity structure
			const validTypes: NodeType[] = [
				"user",
				"ui_element",
				"component",
				"method",
				"api_endpoint",
				"database",
				"external_service",
				"event_handler",
				"state_manager",
			]

			for (let i = 0; i < entities.length; i++) {
				const entity = entities[i]
				if (!entity.label || !entity.type || !entity.entityPurpose) {
					console.log(`[TraceCodeFlow] ERROR: Entity ${i} is missing required fields`)
					return formatResponse.toolError(
						`Entity at index ${i} is missing required fields. Each entity must have: label, type, entityPurpose. ` +
							`Received: ${JSON.stringify(entity).substring(0, 200)}`,
					)
				}

				if (!validTypes.includes(entity.type)) {
					console.log(`[TraceCodeFlow] ERROR: Entity ${i} has invalid type: ${entity.type}`)
					return formatResponse.toolError(
						`Entity at index ${i} has invalid type "${entity.type}". Valid types: ${validTypes.join(", ")}`,
					)
				}
			}

			console.log(`[TraceCodeFlow] Parsed ${entities.length} entities successfully`)
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"
			console.log(`[TraceCodeFlow] ERROR: JSON parsing failed: ${errorMsg}`)
			return formatResponse.toolError(
				`Failed to parse 'entities' parameter: ${errorMsg}\n\n` +
					`Entities value: ${typeof entitiesParam === "string" ? entitiesParam.substring(0, 200) : JSON.stringify(entitiesParam).substring(0, 200)}\n\n` +
					`Make sure entities is a valid JSON array of entity objects.`,
			)
		}

		// Parse flows
		console.log("[TraceCodeFlow] Parsing flows...")
		let flows: FlowInput[]
		try {
			flows = typeof flowsParam === "string" ? JSON.parse(flowsParam) : flowsParam

			if (!Array.isArray(flows)) {
				console.log(`[TraceCodeFlow] ERROR: flows is not an array, got ${typeof flows}`)
				return formatResponse.toolError(`Parameter 'flows' must be an array of flow objects. Received: ${typeof flows}.`)
			}

			if (flows.length === 0) {
				console.log("[TraceCodeFlow] ERROR: flows array is empty")
				return formatResponse.toolError("At least one flow is required in the 'flows' array.")
			}

			// Validate flow structure
			for (let i = 0; i < flows.length; i++) {
				const flow = flows[i]
				if (
					!flow.fromEntity ||
					!flow.toEntity ||
					!flow.trigger ||
					!flow.dataDescription ||
					!flow.dataFormat ||
					!flow.sampleData
				) {
					console.log(`[TraceCodeFlow] ERROR: Flow ${i} is missing required fields`)
					return formatResponse.toolError(
						`Flow at index ${i} is missing required fields. Each flow must have: fromEntity, toEntity, trigger, dataDescription, dataFormat, sampleData. ` +
							`The sampleData field is REQUIRED and should show the structure/fields of the data. ` +
							`Received: ${JSON.stringify(flow).substring(0, 200)}`,
					)
				}

				// Validate that fromEntity and toEntity reference existing entities
				const entityLabels = entities.map((e) => e.label)
				if (!entityLabels.includes(flow.fromEntity)) {
					console.log(`[TraceCodeFlow] ERROR: Flow ${i} references unknown fromEntity: ${flow.fromEntity}`)
					return formatResponse.toolError(
						`Flow at index ${i} references unknown fromEntity "${flow.fromEntity}". ` +
							`Available entities: ${entityLabels.join(", ")}`,
					)
				}
				if (!entityLabels.includes(flow.toEntity)) {
					console.log(`[TraceCodeFlow] ERROR: Flow ${i} references unknown toEntity: ${flow.toEntity}`)
					return formatResponse.toolError(
						`Flow at index ${i} references unknown toEntity "${flow.toEntity}". ` +
							`Available entities: ${entityLabels.join(", ")}`,
					)
				}
			}

			console.log(`[TraceCodeFlow] Parsed ${flows.length} flows successfully`)
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"
			console.log(`[TraceCodeFlow] ERROR: JSON parsing failed: ${errorMsg}`)
			return formatResponse.toolError(
				`Failed to parse 'flows' parameter: ${errorMsg}\n\n` +
					`Flows value: ${typeof flowsParam === "string" ? flowsParam.substring(0, 200) : JSON.stringify(flowsParam).substring(0, 200)}\n\n` +
					`Make sure flows is a valid JSON array of flow objects.`,
			)
		}

		const sharedMessageProps = {
			tool: "traceCodeFlow",
			path: "",
			content: "",
			description,
			entryPoint,
			nodeCount: entities.length,
		} satisfies ClineSayTool

		const completeMessage = JSON.stringify(sharedMessageProps)

		if (await config.callbacks.shouldAutoApproveToolWithPath(block.name, "")) {
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
			const notificationMessage = `Cline wants to create a code flow diagram (${entities.length} entities)`

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

		// Show initial status
		await config.callbacks.say(
			"trace_code_flow",
			JSON.stringify({
				status: "initializing",
				description,
				entryPoint,
				progress: { current: 0, total: entities.length },
			}),
		)

		// Preview what will be created
		console.log(`\n[TraceCodeFlow] DIAGRAM PREVIEW`)
		console.log(`Description: ${description}`)
		console.log(`Entry Point: ${entryPoint}`)
		console.log(`\nENTITIES (${entities.length} total):`)
		entities.forEach((entity, i) => {
			console.log(
				`  ${i + 1}. [${entity.type}] ${entity.label}` +
					(entity.filePath ? ` (${entity.filePath}:${entity.lineNumber || "?"})` : " (external)"),
			)
		})
		console.log(`\nFLOWS (${flows.length} total):`)
		flows.forEach((flow, i) => {
			console.log(`  ${i + 1}. ${flow.fromEntity} --[${flow.trigger}]--> ${flow.toEntity}`)
			console.log(`     Data: ${flow.dataDescription}`)
			console.log(`     Format: ${flow.dataFormat}`)
			console.log(`     Sample: ${flow.sampleData.substring(0, 80)}${flow.sampleData.length > 80 ? "..." : ""}`)
		})
		console.log(`\n`)

		try {
			// Build diagram from entities and flows
			console.log(`[TraceCodeFlow] Building diagram from ${entities.length} entities and ${flows.length} flows...`)
			const diagram = this.buildDiagramFromEntities(description, entryPoint, entities, flows, config.cwd)
			console.log(`[TraceCodeFlow] Diagram built with ${diagram.nodes.length} nodes and ${diagram.edges.length} edges`)

			// Save the diagram
			console.log("[TraceCodeFlow] Saving diagram to disk...")
			const diagramId = await this.saveDiagram(config, diagram)
			console.log(`[TraceCodeFlow] Diagram saved successfully with ID: ${diagramId}`)

			// Show final status
			await config.callbacks.say(
				"trace_code_flow",
				JSON.stringify({
					status: "complete",
					description,
					entryPoint,
					diagramId,
					nodeCount: diagram.nodes.length,
				}),
			)

			console.log("[TraceCodeFlow] Tool completed successfully")
			return formatResponse.toolResult(
				`Code flow diagram created successfully.\n\n` +
					`Description: ${description}\n` +
					`Entry Point: ${entryPoint}\n` +
					`Nodes: ${diagram.nodes.length}\n` +
					`Edges: ${diagram.edges.length}\n` +
					`Diagram ID: ${diagramId}\n\n` +
					`The interactive diagram is now available. Click "View Diagram" to explore the code flow.`,
			)
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"
			const errorStack = error instanceof Error ? error.stack : undefined
			console.log(`[TraceCodeFlow] ERROR: Failed to create diagram: ${errorMsg}`)
			if (errorStack) {
				console.log(`[TraceCodeFlow] Stack trace:`, errorStack)
			}

			await config.callbacks.say(
				"trace_code_flow",
				JSON.stringify({
					status: "error",
					description,
					entryPoint,
					error: errorMsg,
				}),
			)
			return formatResponse.toolError(`Failed to create diagram: ${errorMsg}`)
		}
	}

	/**
	 * Build a CodeFlowDiagram from entities and flows.
	 * Creates nodes from entities and edges from flow information.
	 */
	private buildDiagramFromEntities(
		description: string,
		entryPoint: string,
		entities: EntityInput[],
		flows: FlowInput[],
		workspaceRoot: string,
	): CodeFlowDiagram {
		console.log("[TraceCodeFlow] Building diagram from entities and flows...")

		// Convert entities to FlowNode format
		const nodes: FlowNode[] = entities.map((entity, index) => {
			// Resolve file path - if relative, prepend workspace root (only if filePath exists)
			let resolvedPath: string | undefined = entity.filePath
			if (resolvedPath && !resolvedPath.startsWith("/") && !resolvedPath.match(/^[A-Za-z]:/)) {
				// Relative path - make it absolute
				resolvedPath = `${workspaceRoot}/${resolvedPath}`.replace(/\/\//g, "/")
			}

			return {
				id: `entity-${index}-${entity.label
					.replace(/\s+/g, "-")
					.toLowerCase()
					.replace(/[^a-z0-9-]/g, "")}`,
				label: entity.label,
				type: entity.type,
				filePath: resolvedPath, // Optional - external entities won't have this
				lineNumber: entity.lineNumber,
				entityPurpose: entity.entityPurpose,
			}
		})

		// Build edges from flows
		console.log(`[TraceCodeFlow] Creating edges from ${flows.length} flows...`)
		const edges: FlowEdge[] = flows.map((flow, index) => {
			// Find source and target nodes by label
			const sourceNode = nodes.find((n) => n.label === flow.fromEntity)
			const targetNode = nodes.find((n) => n.label === flow.toEntity)

			if (!sourceNode || !targetNode) {
				throw new Error(`Flow ${index}: Could not find nodes for "${flow.fromEntity}" -> "${flow.toEntity}"`)
			}

			// Determine edge type based on trigger
			let edgeType: FlowEdge["type"] = "call"
			const triggerLower = flow.trigger.toLowerCase()
			if (triggerLower.includes("event") || triggerLower.includes("click")) {
				edgeType = "event"
			} else if (triggerLower.includes("render") || triggerLower.includes("display")) {
				edgeType = "render"
			} else if (triggerLower.includes("return") || triggerLower.includes("response") || triggerLower.includes("data")) {
				edgeType = "dataflow"
			}

			return {
				id: `${sourceNode.id}->${targetNode.id}-${index}`,
				source: sourceNode.id,
				target: targetNode.id,
				label: flow.trigger,
				type: edgeType,
				metadata: {
					trigger: flow.trigger,
					dataDescription: flow.dataDescription,
					dataFormat: flow.dataFormat,
					sampleData: flow.sampleData,
				},
			}
		})

		console.log(`[TraceCodeFlow] Created ${nodes.length} nodes and ${edges.length} edges`)

		// Create the diagram
		const diagram: CodeFlowDiagram = {
			entryPoint,
			description,
			nodes,
			edges,
			metadata: {
				timestamp: Date.now(),
				maxDepth: nodes.length,
				totalNodes: nodes.length,
				framework: "generic",
				language: "typescript",
			},
		}

		return diagram
	}

	/**
	 * Save the diagram to disk
	 */
	private async saveDiagram(config: TaskConfig, diagram: CodeFlowDiagram): Promise<string> {
		const workspaceRoot = config.cwd
		console.log(`[TraceCodeFlow] Workspace root: ${workspaceRoot}`)

		console.log("[TraceCodeFlow] Creating DiagramStorageService...")
		const storageService = new DiagramStorageService(workspaceRoot)

		console.log("[TraceCodeFlow] Calling storageService.saveDiagram()...")
		const diagramId = await storageService.saveDiagram(diagram)
		console.log(`[TraceCodeFlow] DiagramStorageService returned ID: ${diagramId}`)

		return diagramId
	}
}
