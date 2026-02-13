import { ExecutionTraceStorageService } from "@/services/architecture-analysis/ExecutionTraceStorageService"
import {
	ExecutionTraceList,
	ListExecutionTracesRequest,
	ExecutionTraceInfo as ProtoExecutionTraceInfo,
} from "@/shared/proto/cline/architecture"
import type { Controller } from "../index"

/**
 * Handler for listing execution traces
 */
export async function listExecutionTraces(controller: Controller, req: ListExecutionTracesRequest): Promise<ExecutionTraceList> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ExecutionTraceStorageService(workspaceRoot)
	const baseDiagramId = req.baseDiagramId || undefined

	const traces = await storageService.listExecutionTraces(baseDiagramId)

	// Convert to proto format
	const protoTraces = traces.map((trace) =>
		ProtoExecutionTraceInfo.create({
			id: trace.id,
			baseDiagramId: trace.baseDiagramId,
			entryPoint: trace.entryPoint,
			createdAt: trace.createdAt,
			stepCount: trace.stepCount,
			name: trace.name || "",
		}),
	)

	return ExecutionTraceList.create({ traces: protoTraces })
}
