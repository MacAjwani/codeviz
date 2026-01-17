import { DiagramStorageService } from "@/services/code-tracing"
import type { EmptyRequest } from "@/shared/proto/cline/common"
import { DiagramList } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for listing all saved diagrams in the workspace
 */
export async function listDiagrams(controller: Controller, _req: EmptyRequest): Promise<DiagramList> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		return DiagramList.create({ diagrams: [] })
	}

	const storageService = new DiagramStorageService(workspaceRoot)

	const diagrams = await storageService.listDiagrams()

	return DiagramList.create({
		diagrams: diagrams.map((d) => ({
			id: d.id,
			entryPoint: d.entryPoint,
			description: d.description,
			createdAt: d.createdAt,
			nodeCount: d.nodeCount,
		})),
	})
}
