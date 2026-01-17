import type { EmptyRequest } from "@/shared/proto/cline/common"
import { VisualizationSettings } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for getting visualization settings
 * TODO: Implement in Phase 2
 */
export async function getVisualizationSettings(_controller: Controller, _req: EmptyRequest): Promise<VisualizationSettings> {
	// Stub implementation - will be implemented in Phase 2
	return VisualizationSettings.create({
		storageLocation: ".vscode/codeviz",
		autoLayout: true,
		defaultLayoutDirection: "TB",
	})
}
