import { ExecutionTraceStorageService } from "@/services/architecture-analysis/ExecutionTraceStorageService"
import { ExecutionTraceData } from "@/shared/proto/cline/architecture"
import { StringRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for loading an execution trace by ID
 */
export async function loadExecutionTrace(controller: Controller, req: StringRequest): Promise<ExecutionTraceData> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ExecutionTraceStorageService(workspaceRoot)
	const traceId = req.value

	const trace = await storageService.loadExecutionTrace(traceId)
	if (!trace) {
		throw new Error(`Execution trace not found: ${traceId}`)
	}

	return ExecutionTraceData.create({
		id: trace.id,
		traceJson: JSON.stringify(trace),
		createdAt: trace.metadata.timestamp,
		stepCount: trace.steps.length,
	})
}
