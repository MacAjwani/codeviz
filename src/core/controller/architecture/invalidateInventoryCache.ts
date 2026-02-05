import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import { Empty, EmptyRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for invalidating (deleting) the inventory cache
 * Forces fresh analysis on next diagram generation
 */
export async function invalidateInventoryCache(controller: Controller, _req: EmptyRequest): Promise<Empty> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ArchitectureDiagramStorageService(workspaceRoot)
	await storageService.invalidateInventoryCache()

	return Empty.create()
}
