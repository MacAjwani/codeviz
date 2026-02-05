import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import type { RepoInventory } from "@/shared/architecture-visualization/types"
import { ArchitectureDiagramData } from "@/shared/proto/cline/architecture"
import { StringRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for loading an architecture diagram by ID
 */
export async function loadArchitectureDiagram(controller: Controller, req: StringRequest): Promise<ArchitectureDiagramData> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ArchitectureDiagramStorageService(workspaceRoot)
	const diagramId = req.value

	// Load the cluster graph
	const clusterGraph = await storageService.loadClusterGraph(diagramId)
	if (!clusterGraph) {
		throw new Error(`Diagram not found: ${diagramId}`)
	}

	// Load the inventory (might be cached)
	let inventory: RepoInventory | null = await storageService.loadInventoryCache()
	if (!inventory) {
		// Return empty inventory if not available
		inventory = {
			files: [],
			dependencies: [],
			metadata: {
				timestamp: Date.now(),
				workspaceRoot,
				fileCount: 0,
				totalLOC: 0,
				analyzedExtensions: [],
				durationMs: 0,
			},
		}
	}

	return ArchitectureDiagramData.create({
		id: clusterGraph.id || "unknown",
		clusterGraphJson: JSON.stringify(clusterGraph),
		inventoryJson: JSON.stringify(inventory),
		createdAt: clusterGraph.metadata?.timestamp || Date.now(),
		clusterCount: clusterGraph.clusters.length,
		fileCount: inventory.files.length,
	})
}
