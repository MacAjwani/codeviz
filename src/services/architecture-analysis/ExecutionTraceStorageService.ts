/**
 * Storage service for component execution traces.
 *
 * Handles persistence of execution traces that show step-by-step
 * flows through architecture diagrams.
 *
 * Storage layout:
 * .vscode/codeviz/architecture/execution-traces/
 * └── {id}.json
 */

import * as fs from "fs/promises"
import * as path from "path"
import type { ClusterGraph, ComponentExecutionTrace, ExecutionTraceInfo } from "@/shared/architecture-visualization/types"

const STORAGE_BASE = ".vscode/codeviz"
const ARCHITECTURE_DIR = "architecture"
const EXECUTION_TRACES_DIR = "execution-traces"

export interface ValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

export class ExecutionTraceStorageService {
	private workspaceRoot: string

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
	}

	// ============================================================================
	// Path Helpers
	// ============================================================================

	private getExecutionTracesDir(): string {
		return path.join(this.workspaceRoot, STORAGE_BASE, ARCHITECTURE_DIR, EXECUTION_TRACES_DIR)
	}

	private getExecutionTracePath(id: string): string {
		return path.join(this.getExecutionTracesDir(), `${id}.json`)
	}

	private async ensureDirectories(): Promise<void> {
		const tracesDir = this.getExecutionTracesDir()
		await fs.mkdir(tracesDir, { recursive: true })
	}

	// ============================================================================
	// ID Generation
	// ============================================================================

	/**
	 * Generate a unique ID for an execution trace.
	 */
	generateTraceId(): string {
		const timestamp = Date.now()
		const random = Math.random().toString(36).substring(2, 8)
		return `trace_${timestamp}_${random}`
	}

	// ============================================================================
	// CRUD Operations
	// ============================================================================

	/**
	 * Save an execution trace to disk.
	 * @returns The trace ID
	 */
	async saveExecutionTrace(trace: ComponentExecutionTrace): Promise<string> {
		await this.ensureDirectories()

		// Generate ID if not present
		const id = trace.id || this.generateTraceId()
		const traceWithId = { ...trace, id }

		const tracePath = this.getExecutionTracePath(id)
		await fs.writeFile(tracePath, JSON.stringify(traceWithId, null, 2), "utf-8")

		console.log(`[ExecutionTraceStorage] Saved execution trace: ${id} (${traceWithId.steps.length} steps)`)
		return id
	}

	/**
	 * Load an execution trace by ID.
	 */
	async loadExecutionTrace(id: string): Promise<ComponentExecutionTrace | null> {
		const tracePath = this.getExecutionTracePath(id)

		try {
			const content = await fs.readFile(tracePath, "utf-8")
			const trace = JSON.parse(content) as ComponentExecutionTrace

			console.log(`[ExecutionTraceStorage] Loaded execution trace: ${id}`)
			return trace
		} catch (error) {
			console.warn(`[ExecutionTraceStorage] Failed to load execution trace ${id}:`, error)
			return null
		}
	}

	/**
	 * List all saved execution traces.
	 * @param baseDiagramId Optional filter by base diagram ID
	 */
	async listExecutionTraces(baseDiagramId?: string): Promise<ExecutionTraceInfo[]> {
		const tracesDir = this.getExecutionTracesDir()

		try {
			const files = await fs.readdir(tracesDir)
			const jsonFiles = files.filter((f) => f.endsWith(".json"))

			const infos: ExecutionTraceInfo[] = []

			for (const file of jsonFiles) {
				try {
					const filePath = path.join(tracesDir, file)
					const content = await fs.readFile(filePath, "utf-8")
					const trace = JSON.parse(content) as ComponentExecutionTrace

					// Filter by baseDiagramId if provided
					if (baseDiagramId && trace.baseDiagramId !== baseDiagramId) {
						continue
					}

					infos.push({
						id: trace.id || file.replace(".json", ""),
						baseDiagramId: trace.baseDiagramId,
						entryPoint: trace.entryPoint,
						createdAt: trace.metadata.timestamp,
						stepCount: trace.steps.length,
					})
				} catch (error) {
					console.warn(`[ExecutionTraceStorage] Failed to read trace ${file}:`, error)
				}
			}

			// Sort by creation time (newest first)
			infos.sort((a, b) => b.createdAt - a.createdAt)

			return infos
		} catch (error) {
			// Directory doesn't exist yet
			return []
		}
	}

	/**
	 * Delete an execution trace by ID.
	 */
	async deleteExecutionTrace(id: string): Promise<boolean> {
		const tracePath = this.getExecutionTracePath(id)

		try {
			await fs.unlink(tracePath)
			console.log(`[ExecutionTraceStorage] Deleted execution trace: ${id}`)
			return true
		} catch (error) {
			console.warn(`[ExecutionTraceStorage] Failed to delete execution trace ${id}:`, error)
			return false
		}
	}

	// ============================================================================
	// Validation
	// ============================================================================

	/**
	 * Validate that an execution trace is consistent with its base diagram.
	 * Checks:
	 * 1. All componentIds exist in base diagram
	 * 2. Transitions follow existing edges (warning only)
	 */
	validateTrace(trace: ComponentExecutionTrace, baseGraph: ClusterGraph): ValidationResult {
		const errors: string[] = []
		const warnings: string[] = []

		// Build set of valid cluster IDs
		const validClusterIds = new Set(baseGraph.clusters.map((c) => c.id))

		// Validate each step's componentId
		for (const step of trace.steps) {
			if (!validClusterIds.has(step.componentId)) {
				errors.push(
					`Step ${step.stepNumber}: Invalid componentId "${step.componentId}". ` +
						`Valid IDs: ${Array.from(validClusterIds).join(", ")}`,
				)
			}
		}

		// Validate transitions follow edges (warnings only)
		for (let i = 0; i < trace.steps.length - 1; i++) {
			const currentStep = trace.steps[i]
			const nextStep = trace.steps[i + 1]

			if (!currentStep.transitionTo) {
				continue
			}

			if (currentStep.transitionTo !== nextStep.componentId) {
				warnings.push(
					`Step ${currentStep.stepNumber}: transitionTo "${currentStep.transitionTo}" ` +
						`does not match next step's componentId "${nextStep.componentId}"`,
				)
			}

			// Check if edge exists in base diagram
			const edgeExists = baseGraph.clusterEdges.some(
				(e) => e.source === currentStep.componentId && e.target === nextStep.componentId,
			)

			if (!edgeExists) {
				warnings.push(
					`Step ${currentStep.stepNumber}: No direct edge from "${currentStep.componentId}" ` +
						`to "${nextStep.componentId}". Relationship may be indirect or inferred.`,
				)
			}
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}
}
