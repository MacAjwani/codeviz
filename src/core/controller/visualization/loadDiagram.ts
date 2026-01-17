import type { StringRequest } from "@/shared/proto/cline/common"
import { DiagramData } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for loading a saved diagram by ID
 * TODO: Implement in Phase 2
 */
export async function loadDiagram(_controller: Controller, req: StringRequest): Promise<DiagramData> {
	// Stub implementation - will be implemented in Phase 2
	return DiagramData.create({
		id: req.value,
		diagramJson: "{}",
		createdAt: 0,
		entryPoint: "",
		description: "",
	})
}
