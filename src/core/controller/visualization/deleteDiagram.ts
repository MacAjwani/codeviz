import { Empty, type StringRequest } from "@/shared/proto/cline/common"
import type { Controller } from "../index"

/**
 * Handler for deleting a saved diagram
 * TODO: Implement in Phase 2
 */
export async function deleteDiagram(_controller: Controller, _req: StringRequest): Promise<Empty> {
	// Stub implementation - will be implemented in Phase 2
	return Empty.create()
}
