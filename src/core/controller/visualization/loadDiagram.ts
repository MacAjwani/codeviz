import { DiagramStorageService } from "@/services/code-tracing"
import type { StringRequest } from "@/shared/proto/cline/common"
import { DiagramData } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for loading a saved diagram by ID
 */
export async function loadDiagram(controller: Controller, req: StringRequest): Promise<DiagramData> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new DiagramStorageService(workspaceRoot)

	const diagram = await storageService.loadDiagram(req.value)

	if (!diagram) {
		throw new Error(`Diagram not found: ${req.value}`)
	}

	return DiagramData.create({
		id: req.value,
		diagramJson: JSON.stringify(diagram),
		createdAt: diagram.metadata.timestamp,
		entryPoint: diagram.entryPoint,
		description: diagram.description,
	})
}
