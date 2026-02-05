import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import { Empty, StringRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for deleting an architecture diagram
 */
export async function deleteArchitectureDiagram(controller: Controller, req: StringRequest): Promise<Empty> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ArchitectureDiagramStorageService(workspaceRoot)
	const diagramId = req.value

	const success = await storageService.deleteClusterGraph(diagramId)
	if (!success) {
		throw new Error(`Failed to delete diagram: ${diagramId}`)
	}

	return Empty.create()
}
