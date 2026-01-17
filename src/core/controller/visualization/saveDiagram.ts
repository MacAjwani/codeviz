import { DiagramStorageService } from "@/services/code-tracing"
import type { CodeFlowDiagram } from "@/shared/code-visualization/types"
import { String as ProtoString } from "@/shared/proto/cline/common"
import { SaveDiagramRequest } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for saving a code flow diagram to disk
 */
export async function saveDiagram(controller: Controller, req: SaveDiagramRequest): Promise<ProtoString> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new DiagramStorageService(workspaceRoot)

	// Parse the diagram JSON
	let diagram: CodeFlowDiagram
	try {
		diagram = JSON.parse(req.diagramJson) as CodeFlowDiagram
	} catch (error) {
		throw new Error(`Invalid diagram JSON: ${error}`)
	}

	// Save the diagram
	const diagramId = await storageService.saveDiagram(diagram)

	return ProtoString.create({ value: diagramId })
}
