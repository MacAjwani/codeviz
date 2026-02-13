import { ExecutionTraceStorageService } from "@/services/architecture-analysis/ExecutionTraceStorageService"
import { Empty, StringRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for deleting an execution trace
 */
export async function deleteExecutionTrace(controller: Controller, req: StringRequest): Promise<Empty> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ExecutionTraceStorageService(workspaceRoot)
	const traceId = req.value

	const success = await storageService.deleteExecutionTrace(traceId)
	if (!success) {
		throw new Error(`Failed to delete execution trace: ${traceId}`)
	}

	return Empty.create()
}
