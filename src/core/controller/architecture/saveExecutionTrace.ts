import { ExecutionTraceStorageService } from "@/services/architecture-analysis/ExecutionTraceStorageService"
import type { ComponentExecutionTrace } from "@/shared/architecture-visualization/types"
import { SaveExecutionTraceRequest } from "@/shared/proto/cline/architecture"
import { String as ProtoString } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for saving an execution trace
 */
export async function saveExecutionTrace(controller: Controller, req: SaveExecutionTraceRequest): Promise<ProtoString> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	// Parse trace JSON
	let trace: ComponentExecutionTrace
	try {
		trace = JSON.parse(req.traceJson) as ComponentExecutionTrace
	} catch (error) {
		throw new Error(`Invalid trace JSON: ${error}`)
	}

	// Save trace
	const storageService = new ExecutionTraceStorageService(workspaceRoot)
	const traceId = await storageService.saveExecutionTrace(trace)

	return ProtoString.create({ value: traceId })
}
