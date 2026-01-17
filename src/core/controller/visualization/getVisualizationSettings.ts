import { DiagramStorageService } from "@/services/code-tracing"
import type { EmptyRequest } from "@/shared/proto/cline/common"
import { VisualizationSettings } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for getting visualization settings
 */
export async function getVisualizationSettings(controller: Controller, _req: EmptyRequest): Promise<VisualizationSettings> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		// Return defaults if no workspace
		return VisualizationSettings.create({
			storageLocation: ".vscode/codeviz",
			autoLayout: true,
			defaultLayoutDirection: "TB",
		})
	}

	const storageService = new DiagramStorageService(workspaceRoot)
	const settings = await storageService.loadSettings()

	return VisualizationSettings.create({
		storageLocation: settings.storageLocation,
		autoLayout: settings.autoLayout,
		defaultLayoutDirection: settings.defaultLayoutDirection,
	})
}
