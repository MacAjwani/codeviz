import type { EmptyRequest } from "@/shared/proto/cline/common"
import { DiagramList } from "@/shared/proto/cline/visualization"
import type { Controller } from "../index"

/**
 * Handler for listing all saved diagrams in the workspace
 * TODO: Implement in Phase 2
 */
export async function listDiagrams(_controller: Controller, _req: EmptyRequest): Promise<DiagramList> {
	// Stub implementation - will be implemented in Phase 2
	return DiagramList.create({ diagrams: [] })
}
