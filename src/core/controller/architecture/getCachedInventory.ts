import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import { InventoryData } from "@/shared/proto/cline/architecture"
import { EmptyRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for getting cached inventory if available
 */
export async function getCachedInventory(controller: Controller, _req: EmptyRequest): Promise<InventoryData> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ArchitectureDiagramStorageService(workspaceRoot)
	const inventory = await storageService.loadInventoryCache()

	if (!inventory) {
		// Return empty inventory data if no cache exists
		return InventoryData.create({
			inventoryJson: "{}",
			cachedAt: 0,
			fileCount: 0,
			totalLoc: 0,
		})
	}

	return InventoryData.create({
		inventoryJson: JSON.stringify(inventory),
		cachedAt: inventory.metadata.timestamp,
		fileCount: inventory.files.length,
		totalLoc: inventory.metadata.totalLOC,
	})
}
