import { DiagramStorageService } from "@/services/code-tracing"
import { Empty, type StringRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for deleting a saved diagram
 */
export async function deleteDiagram(controller: Controller, req: StringRequest): Promise<Empty> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new DiagramStorageService(workspaceRoot)

	const success = await storageService.deleteDiagram(req.value)

	if (!success) {
		throw new Error(`Failed to delete diagram: ${req.value}`)
	}

	return Empty.create()
}
