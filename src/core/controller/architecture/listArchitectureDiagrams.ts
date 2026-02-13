import { ArchitectureDiagramStorageService } from "@/services/architecture-analysis/ArchitectureDiagramStorageService"
import { ArchitectureDiagramInfo, ArchitectureDiagramList } from "@/shared/proto/cline/architecture"
import { EmptyRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for listing all saved architecture diagrams
 */
export async function listArchitectureDiagrams(controller: Controller, _req: EmptyRequest): Promise<ArchitectureDiagramList> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new ArchitectureDiagramStorageService(workspaceRoot)
	const diagrams = await storageService.listClusterGraphs()

	const diagramInfos = diagrams.map((diagram) =>
		ArchitectureDiagramInfo.create({
			id: diagram.id,
			createdAt: diagram.createdAt,
			clusterCount: diagram.clusterCount,
			fileCount: diagram.fileCount,
			name: diagram.name || "",
		}),
	)

	return ArchitectureDiagramList.create({
		diagrams: diagramInfos,
	})
}
