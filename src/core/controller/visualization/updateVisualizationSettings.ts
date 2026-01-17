import { DiagramStorageService } from "@/services/code-tracing"
import type { VisualizationSettings as VisualizationSettingsType } from "@/shared/code-visualization/types"
import { Empty } from "@/shared/proto/cline/common"
import { VisualizationSettings } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for updating visualization settings
 */
export async function updateVisualizationSettings(controller: Controller, req: VisualizationSettings): Promise<Empty> {
	const workspaceManager = controller.getWorkspaceManager()
	const workspaceRoot = workspaceManager?.getPrimaryRoot()?.path

	if (!workspaceRoot) {
		throw new Error("No workspace root available")
	}

	const storageService = new DiagramStorageService(workspaceRoot)

	const settings: VisualizationSettingsType = {
		storageLocation: req.storageLocation || ".vscode/codeviz",
		autoLayout: req.autoLayout ?? true,
		defaultLayoutDirection: (req.defaultLayoutDirection as VisualizationSettingsType["defaultLayoutDirection"]) || "TB",
	}

	await storageService.saveSettings(settings)

	return Empty.create()
}
